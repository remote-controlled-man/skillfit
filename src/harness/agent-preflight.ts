import { accessSync, constants, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, win32 } from 'node:path';
import { loadMatrix, skillUserDirSpecs, type AgentDef } from '../agents.js';
import { parseFrontmatter } from '../frontmatter.js';
import type { EvaluationTarget, ExecutorDescriptor } from './types.js';

import type { AgentEnvironmentCheck, AgentEnvironmentPreflight } from './agent-preflight-contract.js';
export type { AgentEnvironmentCheck, AgentEnvironmentPreflight } from './agent-preflight-contract.js';
export { assertRecordedAgentEnvironment, agentEnvironmentReportLines } from './agent-preflight-contract.js';

export interface EnvironmentRole {
  role: 'agent' | 'judge';
  definition?: AgentDef;
  executor: ExecutorDescriptor | null;
  injected: boolean;
  resolutionError?: string;
}

/** Read PATH only; never run which/where, an agent, a login command or an API. */
export function findExecutable(binary: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string | null {
  const windows = platform === 'win32';
  // Match Node's first lexicographically sorted key when Windows env keys repeat by case.
  const entries = Object.entries(env).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const value = (key: string) => entries.find(([name]) => windows ? name.toLowerCase() === key.toLowerCase() : name === key)?.[1];
  const path = value('PATH') ?? '';
  const hasPath = /[\\/]/.test(binary) || isAbsolute(binary) || (windows && win32.isAbsolute(binary));
  const directories = hasPath ? [''] : path.split(windows ? ';' : ':').map(dir => dir.replace(/^"(.*)"$/, '$1'))
    .filter(dir => isAbsolute(dir) || (windows && win32.isAbsolute(dir)));
  const extensions = windows ? (value('PATHEXT') ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [];
  const names = windows && !extensions.some(ext => binary.toLowerCase().endsWith(ext.toLowerCase()))
    ? extensions.map(ext => binary + ext) : [binary];
  for (const dir of directories) for (const name of names) {
    const file = resolve(dir.replace(/^"(.*)"$/, '$1'), name);
    try {
      if (!statSync(file).isFile()) continue;
      accessSync(file, windows ? constants.F_OK : constants.X_OK);
      return realpathSync(file);
    } catch { /* Continue searching; config directories are not executable evidence. */ }
  }
  return null;
}

export function globalSkillRoots(agent: AgentDef, home: string, env: NodeJS.ProcessEnv): string[] {
  return [...new Set([...skillUserDirSpecs(agent, env), ...agent.skills.sharedDirs.filter(path => path.startsWith('~/'))]
    .map(path => path.startsWith('~/') ? join(home, path.slice(2)) : resolve(path)))];
}

function report(checks: AgentEnvironmentCheck[]): AgentEnvironmentPreflight {
  const matrix = loadMatrix(), count = (status: AgentEnvironmentCheck['status']) => checks.filter(check => check.status === status).length;
  return { schemaVersion: 1, kind: 'skillfit.agent-preflight', scope: 'offline-agent-environment',
    status: count('FAIL') ? 'blocked' : 'ready', matrix: { schemaVersion: matrix.schemaVersion, verifiedAt: matrix.verifiedAt }, checks,
    summary: { failures: count('FAIL'), passed: count('PASS'), unknown: count('UNKNOWN'), info: count('INFO') },
    cost: { modelCalls: 0, cliInvocations: 0 } };
}

export function agentTokenCounters(agent: AgentDef): string[] {
  return agent.headless.streamJson?.wireShape === 'codex-items'
    ? ['input', 'cachedInput', 'output'] : agent.headless.usageFromSessionLog ? ['input', 'output'] : [];
}

export function inspectAgentEnvironment(options: { roles: EnvironmentRole[]; mode: 'inject' | 'installed' | 'trigger';
  target: EvaluationTarget; capabilityError?: string; spendingBudget?: boolean; homeDir?: string; env?: NodeJS.ProcessEnv }): AgentEnvironmentPreflight {
  const checks: AgentEnvironmentCheck[] = [], env = options.env ?? process.env;
  const home = options.homeDir ?? homedir();
  const names = new Set([options.target.name]);
  if (options.target.kind === 'skill') {
    try { const name = parseFrontmatter(readFileSync(join(options.target.sourceDir, 'SKILL.md'), 'utf8'))?.name?.trim(); if (name) names.add(name); }
    catch { /* Some legacy injectable bundles have no root SKILL.md. */ }
  }
  for (const role of options.roles) {
    const agent = role.definition;
    const add = (code: AgentEnvironmentCheck['code'], status: AgentEnvironmentCheck['status'], message: string,
      remediation: string | null = null, paths: string[] = []) => checks.push({ code, status, message, remediation, paths, role: role.role, agent: agent?.id ?? null });
    const trigger = role.role === 'agent' && options.mode === 'trigger';
    const argv = trigger ? agent?.headless.streamJson?.argv : agent?.headless.streamJson?.argv ?? agent?.headless.argv;
    const binary = argv?.[0] ?? agent?.headless.argv[0] ?? agent?.detect.binaries[0];
    if (role.injected) add('EXECUTOR_INJECTED', 'UNKNOWN', 'Injected executor: installed CLI availability and runtime capabilities are not attested.');
    else if (agent && binary) {
      const path = findExecutable(binary, env);
      add('CLI_AVAILABLE', path ? 'PASS' : 'FAIL', path ? `CLI executable is available: ${binary}.` : `CLI executable is missing or not executable on PATH: ${binary}.`,
        path ? null : 'Install the selected agent CLI or fix PATH, then create a fresh preview.', path ? [path] : []);
    } else if (!agent && role.executor?.kind === 'api') add('CLI_AVAILABLE', 'INFO', 'API executor: no local agent CLI is required.');

    let error = (role.role === 'agent' ? options.capabilityError : undefined) ?? role.resolutionError;
    if (agent && !argv?.[0]) error ??= options.mode === 'trigger' && role.role === 'agent'
      ? `Agent "${agent.id}" has no headless streamJson command template; trigger detection is unavailable for it.`
      : `Agent "${agent.id}" has no usable headless command template.`;
    if (trigger && agent && (!agent.headless.streamJson?.wireShape ||
        (agent.headless.streamJson.wireShape !== 'codex-items' && !agent.sessions?.skillKey))) {
      error ??= `Agent "${agent.id}" needs a matrix wireShape and Skill identity key for trigger detection.`;
    }
    if (agent && role.role === 'agent' && ['installed', 'trigger'].includes(options.mode) && !agent.skills.projectDirs.length) {
      error ??= `Agent "${agent.id}" has no matrix-defined project Skill directory for ${options.mode} mode.`;
    }
    if (!role.injected && !role.executor && !error) error = 'No executor available; pass --agent or set SKILLFIT_API_KEY.';
    add('MATRIX_CAPABILITY', error ? 'FAIL' : role.injected && !agent ? 'UNKNOWN' : 'PASS', error ??
      (agent ? 'Declared matrix capabilities match this evaluation; installed CLI flag compatibility was not probed.' : 'Executor supports the declared evaluation surface.'),
      error ? 'Select a compatible agent/input/mode or correct its configuration, then create a fresh preview.' : null);
    if (agent && !role.injected) {
      // These are adapter capabilities declared by matrix wire shape, not a probe
      // or a guarantee that this installed CLI/provider will return final counters.
      const metrics = agentTokenCounters(agent);
      const missing = ['input', 'cachedInput', 'output'].filter(metric => !metrics.includes(metric));
      const blocked = options.spendingBudget && missing.length > 0;
      add('USAGE_CAPABILITY', blocked ? 'FAIL' : options.spendingBudget ? 'PASS' : 'INFO',
        `CLI adapter token counters: ${metrics.join(', ') || 'none'}. ${blocked
          ? `Whole-batch spending limits require unavailable counters: ${missing.join(', ')}; no calls may start.`
          : 'Actual missing/partial final counters remain unknown and stop a budgeted batch.'}`,
        blocked ? 'Choose an adapter/provider with all required counters or explicitly review a new plan without token spending limits; unknown usage cannot be treated as zero.' : null);
    } else add('USAGE_CAPABILITY', 'UNKNOWN', 'Final token/cache coverage cannot be confirmed offline for this API or injected executor; runtime spending guards still require complete final counters.');
    add('AUTHENTICATION', 'UNKNOWN', 'Login and credential validity cannot be confirmed offline; no authentication command, credential file or network probe was used.',
      'Confirm authentication separately before authorizing a live run.');

    if (role.role !== 'agent' || options.target.kind !== 'skill') continue;
    if (!agent || (role.injected && options.homeDir === undefined)) {
      add('GLOBAL_SKILL_SCAN', 'UNKNOWN', 'Global Skill availability was not inspected for this injected/unconfigured executor.'); continue;
    }
    const roots = globalSkillRoots(agent, home, env), conflicts: string[] = [], unreadable: string[] = [];
    for (const root of roots) {
      try {
        for (const entry of readdirSync(root).sort()) {
          const dir = join(root, entry), manifest = join(dir, 'SKILL.md');
          try {
            if (!statSync(manifest).isFile()) continue;
            if (names.has(entry) || names.has(parseFrontmatter(readFileSync(manifest, 'utf8'))?.name?.trim() ?? '')) conflicts.push(dir);
          } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(String((error as NodeJS.ErrnoException).code))) unreadable.push(dir); }
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') unreadable.push(root); }
    }
    add('GLOBAL_SKILL_CONFLICT', conflicts.length ? 'FAIL' : 'PASS', conflicts.length
      ? 'Baseline contamination risk: a globally available Skill has the evaluated directory/frontmatter name; it may be loaded in baseline too.'
      : 'No matching Skill was found among readable direct entries of matrix-listed user/global Skill roots.',
      conflicts.length ? 'Use a controlled agent profile without the conflicting Skill, then create a fresh preview. No global Skill was changed.' : null, conflicts);
    add('GLOBAL_SKILL_SCAN', unreadable.length ? 'UNKNOWN' : 'INFO', unreadable.length
      ? 'Some global Skill entries could not be inspected; absence of contamination is not established.'
      : 'Only matrix-listed user/global roots were inspected. Inherited project, plugin and unlisted Skill scopes remain uncontrolled.', null, unreadable.length ? unreadable : roots);
  }
  return report(checks);
}

export class AgentPreflightFailed extends Error {
  constructor(readonly agentPreflight: AgentEnvironmentPreflight) {
    super('Agent environment preflight blocked evaluation; no agent or judge calls were made.\n' +
      agentPreflight.checks.filter(check => check.status === 'FAIL').map(check =>
        `[FAIL] ${check.role}/${check.code}: ${check.message}${check.paths.length ? ` Paths: ${check.paths.join(', ')}` : ''} ${check.remediation ?? ''}`).join('\n'));
    this.name = 'AgentPreflightFailed';
  }
}

export function assertAgentEnvironment(preflight: AgentEnvironmentPreflight): void {
  if (preflight.status === 'blocked') throw new AgentPreflightFailed(preflight);
}

export function assertAgentEnvironmentUnchanged(before: AgentEnvironmentPreflight, after: AgentEnvironmentPreflight): void {
  assertAgentEnvironment(after);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new AgentPreflightFailed(report([...after.checks, {
    code: 'ENVIRONMENT_CHANGED', status: 'FAIL', role: 'agent', agent: null,
    message: 'Agent environment changed during offline case preflight.', remediation: 'Create a fresh preview before execution.', paths: [],
  }]));
}

export function renderAgentEnvironment(preflight: AgentEnvironmentPreflight): string {
  return [`Agent preflight: ${preflight.status} (offline; login remains unknown)`, ...preflight.checks.map(check =>
    `[${check.status}] ${check.role}/${check.code}: ${check.message}${check.paths.length ? ` Paths: ${check.paths.join(', ')}` : ''}${check.remediation ? ` Remedy: ${check.remediation}` : ''}`)].join('\n');
}
