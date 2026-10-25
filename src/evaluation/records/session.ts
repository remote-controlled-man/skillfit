import { PACKAGE_ROOT } from '../../shared/package-root.js';
import { probeVersion, validateCallBudget } from '../../agents/call-limits.js';
export { probeVersion, validateCallBudget } from '../../agents/call-limits.js';
import { measurementScope, requestedClaimFor, assertScopeMatches, assertBenchClaimSupported } from "../measurement/scope.js";

import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { getAgent, type AgentDef } from "../../agents/matrix.js";
import { parseFrontmatter } from "../../resources/frontmatter.js";
import { hashFileSet, sha256File, sha256Text } from "../../shared/hash.js";
import { assertNativeDiffFile, assertNativeDiffWorkspace, NATIVE_DIFF_SNAPSHOT } from "../targets/native-diff.js";
import { identityForResult } from "../../agents/observation/model-identity.js";

import type { Executor, ExecutorResult } from "../../agents/contracts.js";
import { ExecutorFailure } from "../../agents/contracts.js";
import { currentSignal as evaluationSignal, throwIfCancelled as throwIfEvaluationInterrupted } from "../../shared/cancellation.js";
import { EvaluationInterrupted } from "../execution/interrupted.js";
import { freezeInputSnapshot, verifyInputSnapshot, type InputSnapshot, type PinnedInput } from "./input-snapshot.js";
import { loadBench } from "../../bench/read.js";
import { globalSkillRoots } from "../../agents/preflight.js";
import { spendingStopFrom, type SpendingStopCode } from "../execution/budget.js";
import { assertEvaluationOutputLayout, physicalPath } from "../targets/output-layout.js";

import type { ExperimentSummary, SessionOptions } from "./contracts.js";
export type { ExperimentSummary, SessionOptions } from './contracts.js';

type InputFingerprint = PinnedInput;
interface ConfigFingerprint { path: string; state: 'missing' | 'file'; sha256: string | null; trust?: { table: string; field: string; value: string } }
interface SkillInventory { root: string; entries: string[] }

function skillInventory(root: string): SkillInventory {
  if (!existsSync(root)) return { root, entries: ['missing'] };
  return { root, entries: [realpathSync(root), ...readdirSync(root).sort().map(entry => {
    const path = join(root, entry);
    return `${entry}:${lstatSync(path).isSymbolicLink() ? readlinkSync(path) : 'entry'}:${realpathSync(path)}`;
  })] };
}

function inside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  if (rel === '') return true;
  // path.relative returns an absolute path when two Windows paths are on different drives.
  if (isAbsolute(rel)) return false;
  return !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep);
}

function filesUnder(root: string, exclude?: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name === '.git' || (exclude && inside(exclude, join(root, child)))) continue;
      if (entry.isSymbolicLink()) throw new Error(`Unpinned symbolic link in experiment input: ${join(root, child)}`);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) out.push(child);
      else throw new Error(`Unsupported experiment input: ${join(root, child)}`);
    }
  };
  walk('');
  return out.sort();
}

function pin(label: string, root: string, exclude?: string): InputFingerprint {
  const files = filesUnder(root, exclude);
  return { label, root, files, sha256: hashFileSet(root, files), ...(exclude ? { exclude } : {}) };
}

function expand(spec: string, home: string): string {
  return spec === '~' ? home : spec.startsWith('~/') ? join(home, spec.slice(2)) : resolve(spec);
}

/** Only pure trust registrations for the declared workspaces are excluded from the byte contract. */
export function normalizeProjectTrust(text: string, trust: { table: string; field: string; value: string }, workspaces: readonly string[]): string {
  const allowed = new Set(workspaces.map(path => resolve(path)));
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const header = new RegExp(`^\\[${escape(trust.table)}\\.("(?:[^"\\\\\\n]|\\\\.)*"|'[^'\\n]*')\\]\\r?\\n([^[]*)`, 'gm');
  const stripped = text.replace(header, (block: string, quoted: string, body: string) => {
    let path: string;
    try { path = quoted.startsWith('"') ? JSON.parse(quoted) as string : quoted.slice(1, -1); }
    catch { return block; }
    const value = body.trim();
    return allowed.has(resolve(path)) &&
      (value === `${trust.field} = "${trust.value}"` || value === `${trust.field} = '${trust.value}'`) ? '' : block;
  });
  // Codex appends blank separator lines when registering projects. Preserve all other bytes.
  return stripped.replace(/\n+$/, '\n');
}

function configState(path: string, trust: ConfigFingerprint['trust'], workspaces: string[]): ConfigFingerprint {
  try {
    const raw = readFileSync(path, 'utf8');
    return { path, state: 'file', sha256: sha256Text(trust ? normalizeProjectTrust(raw, trust, workspaces) : raw), ...(trust ? { trust } : {}) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot fingerprint agent configuration: ${path}`);
    return { path, state: 'missing', sha256: null, ...(trust ? { trust } : {}) };
  }
}

function selectedSettings(agent: AgentDef, home: string, env: NodeJS.ProcessEnv): { path: string | null; fields: Record<string, string> } {
  const settings = agent.headless.runtime?.settings;
  if (!settings) return { path: null, fields: {} };
  const path = settings.homeOverride && env[settings.homeOverride.env]
    ? join(env[settings.homeOverride.env]!, settings.homeOverride.relativePath) : expand(settings.file, home);
  const fields: Record<string, string> = {};
  if (!existsSync(path)) return { path, fields };
  const text = readFileSync(path, 'utf8');
  if (settings.format === 'json') {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const key of settings.keys) if (typeof data[key] === 'string') fields[key] = data[key] as string;
  } else {
    const top = text.split(/^\s*\[/m)[0] ?? '';
    for (const key of settings.keys) {
      const line = top.split(/\r?\n/).find(line => line.trimStart().startsWith(`${key} `) || line.startsWith(`${key}=`));
      const match = line?.match(/=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
      if (match) fields[key] = match[1]!.startsWith('"') ? JSON.parse(match[1]!) as string : match[1]!.slice(1, -1);
    }
  }
  return { path, fields };
}

export class ExperimentSession {
  readonly groupDir: string;
  readonly planSha256: string;
  readonly plannedCalls: number;
  readonly maxCalls: number;
  private readonly configuredModel: string | null;
  private readonly inputs: InputFingerprint[];
  private readonly configs: ConfigFingerprint[];
  private readonly workspaces: string[];
  private readonly workspaceAliases: { logical: string; physical: string }[];
  private readonly trustWorkspaces: string[];
  private readonly inventories: SkillInventory[] = [];
  private callsStarted = 0;
  private callsFinished = 0;
  private stopReason: string | null = null;
  private stopCode: SpendingStopCode | undefined;
  private finished = false;
  private readonly guardFiles: NonNullable<SessionOptions['guardFiles']>;
  private readonly nativeDiffTool: boolean;
  private readonly inputSnapshot: InputSnapshot;

  constructor(options: SessionOptions) {
    const policy = (options.details.component as { policy?: { schemaVersion: number } } | undefined)?.policy;
    const requested = requestedClaimFor(String(options.details.mode), policy, options.details.stopOnExecutionError === true);
    const scope = measurementScope(options.bench, requested);
    if (options.details.measurementScope !== undefined) assertScopeMatches(options.details.measurementScope, options.bench, requested);
    assertBenchClaimSupported(scope);
    options = { ...options, details: { ...options.details, measurementScope: scope } };

    this.nativeDiffTool = options.details.nativeDiffTool !== undefined;
    this.guardFiles = (options.guardFiles ?? []).map(file => ({ ...file, path: resolve(file.path) }));
    for (const file of this.guardFiles) if (!lstatSync(file.path).isFile() || sha256File(file.path) !== file.sha256) {
      throw new Error(`Frozen ${file.label} file changed before planning.`);
    }
    this.plannedCalls = options.plannedCalls;
    this.maxCalls = validateCallBudget(options.plannedCalls, options.maxCalls);
    this.groupDir = resolve(options.groupDir);
    this.workspaces = options.workspaces.map(path => resolve(path));
    // CLI trust registration can use a canonical path while tmpdir() uses a system alias.
    // Freeze both names now; never broaden the allowlist by resolving changed links later.
    this.workspaceAliases = this.workspaces.map(logical => ({ logical, physical: physicalPath(logical) }));
    this.trustWorkspaces = [...new Set([...this.workspaces, ...this.workspaceAliases.map(alias => alias.physical)])];
    if (existsSync(this.groupDir)) throw new Error(`Run group directory already exists: ${this.groupDir}`);
    assertEvaluationOutputLayout(this.groupDir, { benchDir: options.bench.dir,
      targetDirs: [options.target.sourceDir, ...(options.baselineTarget ? [options.baselineTarget.sourceDir] : [])] });
    const packageRoot = PACKAGE_ROOT;
    this.inputs = [pin('bench', options.bench.dir, this.groupDir), pin('target', options.target.sourceDir), pin('implementation', join(packageRoot, 'dist'))];
    for (const metadata of [options.details['component'], options.details['reviewedPlan']]) if (metadata !== undefined) {
      const expected = (metadata as { implementationSha256?: unknown }).implementationSha256;
      if (typeof expected !== 'string' || expected !== this.inputs.find(input => input.label === 'implementation')!.sha256) {
        throw new Error('Evaluation implementation differs from the approved preview; no calls allowed.');
      }
    }
    if (options.baselineTarget) this.inputs.push(pin('baseline Skill', options.baselineTarget.sourceDir));
    this.configs = [];
    const env = options.env ?? process.env;
    let configured: Record<string, string> = {};
    let cliVersion: string | null = null;
    const warnings = ['Inherited agent configuration is not isolated; only recorded matrix paths and runtime files are checked. Toolchains, server-side models and unlisted Skills/plugins may remain unrecorded.'];
    if (options.agent && (!options.injected || options.homeDir !== undefined)) {
      const agent = getAgent(options.agent);
      const home = options.homeDir ?? homedir();
      const settings = selectedSettings(agent, home, env);
      configured = settings.fields;
      const override = agent.rules.userHomeOverride;
      const paths = new Set([...agent.rules.userFiles, ...agent.mcp.userFiles, ...agent.hooks.userFiles, ...agent.detect.userFiles].map(spec => {
        if (spec === agent.headless.runtime?.settings?.file && settings.path) return settings.path;
        if (override && env[override.env] && spec === agent.rules.userFiles[0]) return join(env[override.env]!, override.relativePath);
        return expand(spec, home);
      }));
      if (override?.overrideRelativePath && agent.rules.userFiles[0]) {
        const root = env[override.env] ?? dirname(expand(agent.rules.userFiles[0], home));
        paths.add(join(root, override.overrideRelativePath));
      }
      if (settings.path) paths.add(settings.path);
      const match = agent.headless.projectTrustConfigArg?.match(/^([^.]+)\.'\{workdir\}'\.([^=]+)='([^']+)'$/);
      const trust = match ? { table: match[1]!, field: match[2]!, value: match[3]! } : undefined;
      for (const path of paths) this.configs.push(configState(path, path === settings.path ? trust : undefined, this.trustWorkspaces));
      for (const root of globalSkillRoots(agent, home, env)) {
        this.inventories.push(skillInventory(root));
        if (!existsSync(root)) continue;
        for (const entry of readdirSync(root)) {
          const skillDir = join(root, entry);
          const manifest = join(skillDir, 'SKILL.md');
          if (existsSync(manifest) && (entry === options.target.name || parseFrontmatter(readFileSync(manifest, 'utf8'))?.['name'] === options.target.name) && options.target.kind === 'skill') {
            throw new Error(`Baseline contamination: evaluated Skill is already available globally at ${skillDir}. Use a controlled agent profile.`);
          }
        }
        // Installed directory aliases are normal; pin their resolved contents and their inventory.
        for (const entry of readdirSync(root)) {
          const path = realpathSync(join(root, entry));
          if (lstatSync(path).isDirectory()) this.inputs.push(pin('global Skill', path));
          else this.configs.push(configState(path, undefined, this.workspaces));
        }
      }
      if (agent.headless.runtime?.versionArgv && !options.injected) cliVersion = (options.versionProbe ?? probeVersion)(agent.headless.runtime.versionArgv);
      else if (options.versionProbe && agent.headless.runtime?.versionArgv) cliVersion = options.versionProbe(agent.headless.runtime.versionArgv);
    } else warnings.push('Injected executor: user configuration and CLI version were not automatically probed.');
    this.configuredModel = configured['model'] ?? null;
    const plan = { schemaVersion: 1, modelIdentityProtocol: 1, createdAt: new Date().toISOString(), nodeVersion: process.version,
      injectedExecutor: options.injected ?? false,
      packageVersion: (JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version,
      agent: options.agent ?? null, cliVersion, configuredSettings: configured, servedModel: 'unrecorded',
      plannedCalls: this.plannedCalls, maxCalls: this.maxCalls, workspaces: this.workspaces, workspaceAliases: this.workspaceAliases,
      inputs: this.inputs, guardFiles: this.guardFiles, configurations: this.configs, skillInventories: this.inventories, warnings, details: options.details };
    mkdirSync(dirname(this.groupDir), { recursive: true });
    // Claim exclusively; a failed setup removes only the fresh directory we own.
    mkdirSync(this.groupDir);
    try {
      this.inputSnapshot = freezeInputSnapshot(this.groupDir, this.inputs, this.guardFiles);
      if (loadBench(join(this.groupDir, '_inputs/bench')).contentSha256 !== options.bench.contentSha256) throw new Error('Sealed bench does not match the planned content hash; input bytes changed before sealing.');
      for (const input of this.inputs) if (pin(input.label, input.root, input.exclude).sha256 !== input.sha256) throw new Error(`Frozen ${input.label} input changed while sealing snapshots.`);
      for (const file of this.guardFiles) if (sha256File(file.path) !== file.sha256) throw new Error(`Frozen ${file.label} changed while sealing snapshots.`);
      throwIfEvaluationInterrupted();
      const bytes = JSON.stringify({ ...plan, inputSnapshot: this.inputSnapshot }, null, 2) + '\n';
      this.planSha256 = sha256Text(bytes);
      writeFileSync(join(this.groupDir, '_plan.json'), bytes, { flag: 'wx' });
      if (sha256File(join(this.groupDir, '_plan.json')) !== this.planSha256) throw new Error('Frozen plan write verification failed.');
    } catch (error) { rmSync(this.groupDir, { recursive: true, force: true }); throw error; }
  }

  check(): void {
    if (this.stopReason) throw new Error(this.stopReason);
    try {
      throwIfEvaluationInterrupted();
      verifyInputSnapshot(this.groupDir, { inputs: this.inputs, guardFiles: this.guardFiles, inputSnapshot: this.inputSnapshot });
      if (this.nativeDiffTool) {
        assertNativeDiffFile(join(this.groupDir, NATIVE_DIFF_SNAPSHOT));
        for (const workdir of this.workspaces) if (existsSync(workdir)) assertNativeDiffWorkspace(workdir);
      }
      for (const file of this.guardFiles) if (!lstatSync(file.path).isFile() || sha256File(file.path) !== file.sha256) {
        throw new Error(`Frozen ${file.label} file changed; no further calls.`);
      }
      for (const alias of this.workspaceAliases) if (physicalPath(alias.logical) !== alias.physical) {
        throw new Error(`Declared workspace alias changed: ${alias.logical}; no further calls.`);
      }
      for (const input of this.inputs) if (pin(input.label, input.root, input.exclude).sha256 !== input.sha256) throw new Error(`Frozen ${input.label} input changed; no further calls.`);
      for (const config of this.configs) {
        const current = configState(config.path, config.trust, this.trustWorkspaces);
        if (current.state !== config.state || current.sha256 !== config.sha256) throw new Error(`Agent configuration changed: ${config.path}; no further calls.`);
      }
      for (const inventory of this.inventories) if (JSON.stringify(skillInventory(inventory.root)) !== JSON.stringify(inventory)) {
        throw new Error(`Global Skill inventory changed: ${inventory.root}; no further calls.`);
      }
    } catch (error) { this.stopReason = (error as Error).message; throw error; }
  }

  /** Only this fresh session may hand its prepared directory to an engine. */
  assertPrepared(): void {
    if (this.finished || this.callsStarted !== 0 ||
        readdirSync(this.groupDir).sort().join() !== '_inputs,_inputs.json,_plan.json' ||
        sha256File(join(this.groupDir, '_plan.json')) !== this.planSha256) {
      throw new Error(`Run group directory already exists or preparation changed: ${this.groupDir}`);
    }
    verifyInputSnapshot(this.groupDir, { inputs: this.inputs, guardFiles: this.guardFiles, inputSnapshot: this.inputSnapshot });
  }

  wrap(executor: Executor, role: 'agent' | 'judge'): Executor {
    const annotate = (result: ExecutorResult): ExecutorResult => {
      const identity = identityForResult(result, executor.describe());
      return { ...result, modelIdentity: { ...identity, configured: role === 'agent' && executor.describe().kind === 'cli' ? this.configuredModel : identity.configured } };
    };
    return { describe: () => executor.describe(), run: async (prompt, workdir) => {
      try {
        this.check();
        if (this.callsStarted >= Math.min(this.plannedCalls, this.maxCalls)) { this.stopReason = 'Declared call ceiling reached; no further calls.'; throw new Error(this.stopReason); }
      } catch (error) {
        throw new ExecutorFailure((error as Error).message, { output: '' }, false);
      }
      const call = ++this.callsStarted;
      const ledger = join(this.groupDir, '_calls.jsonl');
      appendFileSync(ledger, JSON.stringify({ event: 'started', call, role, workdir, at: new Date().toISOString(), promptSha256: sha256Text(prompt) }) + '\n');
      try {
        const result = annotate(await executor.run(prompt, workdir));
        this.callsFinished++;
        appendFileSync(ledger, JSON.stringify({ event: 'finished', call, at: new Date().toISOString() }) + '\n');
        try { this.check(); } catch {
          if (role === 'judge') throw new ExecutorFailure(this.stopReason!, result);
          return { ...result, guardError: this.stopReason! };
        }
        return result;
      } catch (error) {
        if (error instanceof ExecutorFailure && error.executorInvoked) error.result.modelIdentity = annotate(error.result).modelIdentity;
        if (!this.stopReason) this.stopReason = evaluationSignal()?.aborted
          ? (evaluationSignal()!.reason as Error).message
          : `${role} executor failed; inspect the per-trial error receipt. No further calls.`;
        if (role === 'judge' && evaluationSignal()?.aborted) {
          const result = error instanceof ExecutorFailure ? error.result : null;
          writeFileSync(join(this.groupDir, `_interrupted-judge-${call}.json`), JSON.stringify({
            schemaVersion: 1, call, role, error: (error as Error).message, result,
            scope: 'Supplementary interrupted judge output and available usage. Independent judge-call receipts retain invocation accounting; primary Agent comparison stays separate.',
          }, null, 2) + '\n', { flag: 'wx' });
        }
        if (this.callsFinished < call) {
          this.callsFinished++;
          appendFileSync(ledger, JSON.stringify({ event: 'failed', call, at: new Date().toISOString() }) + '\n');
        }
        throw error;
      }
    } };
  }

  summary(): ExperimentSummary {
    return { schemaVersion: 1, status: this.stopReason ? 'stopped' : this.callsFinished === this.plannedCalls ? 'completed' : 'incomplete',
      plannedCalls: this.plannedCalls, maxCalls: this.maxCalls, callsStarted: this.callsStarted, callsFinished: this.callsFinished,
      stopReason: this.stopReason, ...(this.stopCode ? { stopCode: this.stopCode } : {}), planSha256: this.planSha256 };
  }

  settle(): void {
    try { this.check(); } catch { /* Preserve the first stop reason in the manifest. */ }
  }

  finish(error?: unknown, result?: { experiment?: ExperimentSummary; warnings?: string[] }, resultName = 'manifest.json'): void {
    if (this.finished) return;
    this.finished = true;
    const interruption = evaluationSignal()?.reason;
    if (interruption instanceof EvaluationInterrupted) {
      if (!this.stopReason) this.stopReason = interruption.message;
      writeFileSync(join(this.groupDir, '_interruption.json'), JSON.stringify({
        schemaVersion: 1, signal: interruption.signalName, receivedAt: interruption.receivedAt,
        exitCode: interruption.exitCode, automaticRetry: false,
      }, null, 2) + '\n', { flag: 'wx' });
    }
    const spendingStop = spendingStopFrom(error);
    if (spendingStop && !(interruption instanceof EvaluationInterrupted)) {
      this.stopCode = spendingStop.code;
      this.stopReason ??= spendingStop.message;
    }
    if (error && !this.stopReason) this.stopReason = 'Experiment setup or execution stopped; inspect the command error and retained receipts.';
    this.settle();
    if (result && JSON.stringify(result.experiment) !== JSON.stringify(this.summary())) {
      const path = join(this.groupDir, resultName);
      writeFileSync(join(this.groupDir, `_before-finalize-${resultName}`), readFileSync(path), { flag: 'wx' });
      result.experiment = this.summary();
      if (result.warnings) result.warnings.push('Experiment stopped during final verification; no installation recommendation. Inspect _session.json.');
      writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
    }
    writeFileSync(join(this.groupDir, '_session.json'), JSON.stringify(this.summary(), null, 2) + '\n', { flag: 'wx' });
    const files: Record<string, string> = {};
    const links: Record<string, string> = {};
    const walk = (rel: string): void => {
      for (const entry of readdirSync(join(this.groupDir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === '.git') continue;
        const child = rel ? `${rel}/${entry.name}` : entry.name;
        const path = join(this.groupDir, child);
        if (entry.isSymbolicLink()) links[child] = readlinkSync(path);
        else if (entry.isDirectory()) walk(child);
        else if (entry.isFile()) files[child] = sha256File(path);
      }
    };
    walk('');
    const index = { schemaVersion: 1, planSha256: this.planSha256, files, links };
    writeFileSync(join(this.groupDir, '_artifacts.json'), JSON.stringify(index, null, 2) + '\n', { flag: 'wx' });
  }
}
