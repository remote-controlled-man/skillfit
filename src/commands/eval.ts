import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents.js';
import { loadBench, selectBenchTasks } from '../harness/bench.js';
import { RUN_GROUP_PATTERN } from '../harness/constants.js';
import { ExperimentSession, validateCallBudget, type SessionOptions } from '../harness/experiment-session.js';
import { ApiExecutor, DEFAULT_API_TIMEOUT_MS } from '../harness/executors/api.js';
import { CliExecutor } from '../harness/executors/cli.js';
import { listFilesRecursive } from '../harness/hash.js';
import { assertNativeDiffFixtures, nativeDiffDescriptor, type NativeDiffDescriptor } from '../harness/native-diff.js';
import { assertInstalledSkillFixtures, assertSkillRevisionTargets, collectInstalledSkillTarget } from '../harness/installed-skill.js';
import { assertInputModeSupported } from '../harness/prompt.js';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS, renderSummary, type RunManifest } from '../harness/report.js';
import { runExperiment, withSampling } from '../harness/runner.js';
import { collectInstalledSkillFingerprint } from '../harness/bundle.js';
import { installedUserSkills } from '../harness/receipts.js';
import { collectEvaluationTarget } from '../harness/target.js';
import {
  renderTriggerSummary,
  runTriggerExperiment,
  type TriggerManifest,
} from '../harness/trigger.js';
import type { Bench, EvaluationTarget, Executor, InputMode, PairOrder, SkillBundle } from '../harness/types.js';
import { parseExecutorTimeoutSeconds, parsePairOrder, type ComponentMetadata } from '../harness/eval-contract.js';
import { parseSpendingBudget, type SpendingBudget } from '../harness/eval-budget.js';
import { withEvaluationInterrupts, throwIfEvaluationInterrupted } from '../harness/interruption.js';
import { CASE_PREFLIGHT_POLICY, checkEvalCases } from './eval-preflight.js';
import { INPUT_SNAPSHOT_POLICY } from '../harness/input-snapshot.js';
import type { ReviewedEvalPlan } from './eval-plan.js';
import { inspectAgentEnvironment, assertAgentEnvironment, assertAgentEnvironmentUnchanged, renderAgentEnvironment,
  type AgentEnvironmentPreflight, type EnvironmentRole } from '../harness/agent-preflight.js';

export interface EvalPreview {
  mode: 'inject' | 'installed';
  target: { kind: EvaluationTarget['kind']; name: string; sourceDir: string; sha256: string; files: string[] };
  baseline: { name: string; sourceDir: string; sha256: string; files: string[] } | null;
  bench: { name: string; dir: string; sha256: string; taskIds: string[] };
  executor: ReturnType<Executor['describe']> | null;
  judge: ReturnType<Executor['describe']> | null;
  inputMode: InputMode;
  installDir: string | null;
  trials: number;
  plannedCalls: number;
  maxCalls: number;
  outputDir: string;
  casePreflight: typeof CASE_PREFLIGHT_POLICY & { status: 'pending' };
  agentPreflight: AgentEnvironmentPreflight;
  inputSnapshot: typeof INPUT_SNAPSHOT_POLICY;
  pairOrder?: PairOrder;
  executorTimeoutSeconds?: number;
  nativeDiffTool?: NativeDiffDescriptor;
  spendingBudget?: SpendingBudget;
}

export interface EvalOptions {
  /** A Skill directory or a directory containing skillfit-experiment.json. */
  skillPath: string;
  /** Previous complete Skill version; available only in installed mode. */
  baselineSkillPath?: string;
  bench?: string;
  taskIds?: string[];
  trials?: number;
  pairOrder?: PairOrder;
  executorTimeoutSeconds?: number;
  maxCalls?: number;
  spendingBudget?: SpendingBudget;
  sessionOptions?: Pick<SessionOptions, 'homeDir' | 'env' | 'versionProbe'>;
  agent?: string;
  judgeAgent?: string;
  mode?: 'inject' | 'installed' | 'trigger';
  inputMode?: InputMode;
  dryRun: boolean;
  yes: boolean;
  executor?: Executor;
  judgeExecutor?: Executor | null;
  runsRoot?: string;
  runGroup?: string;
  skillInstallDir?: string;
  /** With trigger mode, copy the user's other matrix user-level Skills into each trial. */
  competeInstalled?: boolean;
  log?: (msg: string) => void;
  onPlan?: (plan: EvalPreview) => void;
  component?: ComponentMetadata;
  reviewedPlan?: ReviewedEvalPlan;
  guardFiles?: SessionOptions['guardFiles'];
}

export const DEFAULT_EVAL_TRIALS = 5;

function bundledBenchesRoot(): string {
  return fileURLToPath(new URL('../../benches', import.meta.url));
}

function resolveBenchDir(bench: string | undefined): string {
  const root = bundledBenchesRoot();
  const candidates = existsSync(root)
    ? readdirSync(root)
        .map((entry) => join(root, entry))
        .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, 'bench.json')))
    : [];
  if (bench) {
    const dir = resolve(bench);
    if (existsSync(join(dir, 'bench.json'))) {
      return dir;
    }
    const byName = candidates.find((candidate) => candidate.split(/[\\/]/).pop() === bench);
    if (byName) {
      return byName;
    }
    throw new Error(`Not a bench directory (missing bench.json): ${dir}`);
  }
  if (candidates.length === 1 && candidates[0]) {
    return candidates[0];
  }
  if (candidates.length === 0) {
    throw new Error(`No bundled benches found under ${root}; pass --bench <path>`);
  }
  const names = candidates.map((dir) => `  --bench ${dir.split(/[\\/]/).pop() ?? dir}`).join('\n');
  throw new Error(`More than one bundled bench is available; pick one explicitly:\n${names}`);
}

function resolveExecutor(agent: string | undefined, target: EvaluationTarget, installed = false, executorTimeoutSeconds?: number): Executor {
  if (agent) {
    const definition = getAgent(agent);
    return CliExecutor.forAgent(agent, {
      ...(executorTimeoutSeconds !== undefined ? { timeoutMs: executorTimeoutSeconds * 1000 } : {}),
      trustProjectConfig: target.kind === 'mcp' && definition.headless.projectTrustConfigArg !== undefined,
      ...(installed && definition.headless.streamJson ? { triggerSkillName: target.name } : {}),
    });
  }
  return ApiExecutor.fromEnv(process.env, executorTimeoutSeconds === undefined ? {} : { timeoutMs: executorTimeoutSeconds * 1000 });
}

/**
 * An API executor has no filesystem access, so it cannot satisfy a `verifierKind: "command"` task.
 * Left unchecked, buildTaskPrompt still tells the model the repository "is also your current working
 * directory: inspect, edit, and run things there directly", nothing is ever written into the run
 * directory, every command verifier fails, both arms score 0 — and the run then reports a verdict
 * plus a floor warning that blames bench difficulty for an executor mismatch. Fail at plan time.
 */
function assertExecutorSupportsBench(executor: Executor | null, bench: Bench): void {
  if (!executor || executor.describe().kind !== 'api') return;
  const commandTasks = bench.tasks
    .filter((task) => (task.verifierKind ?? 'output') === 'command')
    .map((task) => task.id);
  if (commandTasks.length === 0) return;
  throw new Error(
    `${bench.name} has ${commandTasks.length} task(s) graded by running a command inside the run directory ` +
      `(${commandTasks.join(', ')}), which an API executor cannot do — it has no filesystem access, so nothing ` +
      'would be written and both arms would score 0. Use --agent <id> for a CLI executor that works in the run ' +
      'directory, or re-grade those tasks as verifierKind "output".',
  );
}

function resolveJudge(judgeAgent?: string): Executor | null {
  const flag = process.env['SKILLFIT_JUDGE'];
  if (!judgeAgent && (!flag || flag === '0' || flag === 'false')) return null;
  if (judgeAgent) {
    return CliExecutor.forAgent(judgeAgent);
  }
  try {
    return new ApiExecutor({
      apiKey: process.env['SKILLFIT_JUDGE_API_KEY'] ?? process.env['SKILLFIT_API_KEY'] ?? process.env['OPENAI_API_KEY'],
      model: process.env['SKILLFIT_JUDGE_MODEL'] ?? process.env['SKILLFIT_API_MODEL'],
      baseUrl: process.env['SKILLFIT_JUDGE_BASE_URL'] ?? process.env['SKILLFIT_API_BASE_URL'],
    });
  } catch {
    return null;
  }
}

function defaultRunGroup(now: Date = new Date()): string {
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `eval-${date}-${time}`;
}

function inspectEvalAgent(options: EvalOptions, target: EvaluationTarget, executor: Executor | null, judge: Executor | null,
  capabilityError?: string, resolutionError?: string, judgeError?: string): AgentEnvironmentPreflight {
  const roles: EnvironmentRole[] = [{ role: 'agent', definition: options.agent ? getAgent(options.agent) : undefined,
    executor: executor?.describe() ?? null, injected: options.executor !== undefined, resolutionError }];
  if (judge || judgeError) roles.push({ role: 'judge', definition: options.judgeAgent ? getAgent(options.judgeAgent) : undefined,
    executor: judge?.describe() ?? null, injected: options.judgeExecutor != null, resolutionError: judgeError });
  return inspectAgentEnvironment({ roles, mode: options.mode ?? 'inject', target, capabilityError,
    homeDir: options.sessionOptions?.homeDir, env: options.sessionOptions?.env });
}

function sessionFor(options: EvalOptions, bench: Bench, target: EvaluationTarget, trials: number,
  runsRoot: string, runGroup: string, armNames: string[], plannedCalls: number,
  details: Record<string, unknown>, baselineTarget?: EvaluationTarget): ExperimentSession {
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  return new ExperimentSession({ bench, target, baselineTarget, groupDir: join(runsRoot, runGroup), plannedCalls,
    maxCalls: options.maxCalls, agent: options.agent, injected: options.executor !== undefined,
    ...options.sessionOptions, guardFiles: options.guardFiles,
    workspaces: bench.tasks.flatMap(task => armNames.flatMap(arm =>
      Array.from({ length: trials }, (_, i) => join(runsRoot, runGroup, task.id, arm, `trial-${i + 1}`)))),
    details: { ...details, ...(options.taskIds ? { taskIds: bench.tasks.map(task => task.id) } : {}) } });
}

function estimatePromptTokens(bench: Bench, target: EvaluationTarget, inputMode: InputMode): { baseline: number; treatment: number } {
  let fixtureBytes = 0;
  let promptBytes = 0;
  for (const task of bench.tasks) {
    const fixtureDir = join(bench.dir, task.fixture);
    for (const rel of inputMode === 'snapshot' ? listFilesRecursive(fixtureDir) : []) {
      if (rel.split(/[\\/]/).some((part) => part === '.git' || part.startsWith('_')) || rel === '.skillfit-mock.json') continue;
      fixtureBytes += statSync(join(fixtureDir, rel)).size;
    }
    promptBytes += statSync(join(bench.dir, task.prompt)).size;
  }
  const estimate = (bytes: number) => Math.ceil(bytes / 4);
  const baseline = estimate(fixtureBytes + promptBytes);
  return { baseline, treatment: baseline + estimate(target.payload?.length ?? 0) };
}

function formatK(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function renderPlan(
  bench: Bench,
  target: EvaluationTarget,
  executor: Executor | null,
  judge: Executor | null,
  trials: number,
  runsRoot: string,
  runGroup: string,
  inputMode: InputMode,
  baselineTarget?: EvaluationTarget,
): string {
  const lines: string[] = [];
  lines.push('Experiment plan (dry run)');
  lines.push(`Target   : ${target.name} (${target.kind}, ${target.files.length} files, bundle sha256 ${target.sha256.slice(0, 12)}…)`);
  if (baselineTarget) {
    lines.push(`Baseline : ${baselineTarget.name} (${baselineTarget.files.length} files, bundle sha256 ${baselineTarget.sha256.slice(0, 12)}…)`);
    lines.push('Compare  : previous Skill in baseline vs target Skill in treatment; measures revision effects, not benefit over no Skill');
  } else if (inputMode === 'workspace' && target.kind === 'skill') lines.push('Baseline : no Skill installed by the harness (inherited configuration still applies)');
  if (target.kind !== 'skill') {
    lines.push('           applied as project files; treatment material is never injected into the prompt');
  }
  lines.push(`Bench    : ${bench.name} @ ${bench.dir}`);
  lines.push(`           ${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…`);
  lines.push(`Input    : ${inputMode === 'workspace' ? 'workspace files on disk (no inline repository snapshot)' : 'inline repository snapshot'}`);
  const estimate = estimatePromptTokens(bench, target, inputMode);
  lines.push(
    `Est. cost: ~${formatK(estimate.baseline)} prompt-tokens/run baseline, ~${formatK(estimate.treatment)} treatment (estimate, before replies)`,
  );
  if (inputMode === 'workspace') lines.push('           initial prompt only; agent file reads and replies are not estimated');
  const descriptor = executor?.describe();
  lines.push(
    `Executor : ${descriptor ? `${descriptor.kind} (${descriptor.model})${descriptor.detail ? ` — ${descriptor.detail}` : ''}` : 'unresolved (pass --agent or set SKILLFIT_API_KEY)'}`,
  );
  const judgeDescriptor = judge?.describe();
  lines.push(`Judge    : ${judgeDescriptor ? `${judgeDescriptor.kind} (${judgeDescriptor.model})` : 'disabled'}`);
  const totalRuns = bench.tasks.length * 2 * trials;
  lines.push(`Trials   : ${trials} per condition (${bench.tasks.length} task(s) × 2 conditions × ${trials} = ${totalRuns} runs)`);
  if (bench.tasks.length < CONCLUSIVE_TASKS || trials < CONCLUSIVE_TRIALS) {
    lines.push(`Scale    : below ${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials per condition; any result will be indicative for broader claims.`);
  }
  lines.push('Tasks    :');
  for (const task of bench.tasks) {
    lines.push(`- ${task.id}: fixture ${task.fixture}, verifier \`${task.verifier}\`${task.rubric ? `, rubric ${task.rubric}` : ''}`);
  }
  lines.push(`Output   : ${join(runsRoot, runGroup)} (not created)`);
  lines.push('Dry run — nothing was written.');
  return lines.join('\n');
}

function renderTriggerPlan(
  bench: Bench,
  skill: SkillBundle,
  executor: Executor | null,
  trials: number,
  runsRoot: string,
  runGroup: string,
  installDir: string | undefined,
): string {
  const lines: string[] = [];
  lines.push('Trigger experiment plan (dry run)');
  lines.push(`Skill    : ${skill.name} (${skill.files.length} files, bundle sha256 ${skill.sha256.slice(0, 12)}…)`);
  lines.push(`           installed into ${installDir ?? 'unresolved'} of each run directory — never injected into the prompt`);
  lines.push(`Bench    : ${bench.name} @ ${bench.dir}`);
  lines.push(`           ${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…`);
  const descriptor = executor?.describe();
  lines.push(
    `Executor : ${descriptor ? `${descriptor.kind} (${descriptor.model})${descriptor.detail ? ` — ${descriptor.detail}` : ''}` : 'unresolved (pass --agent with a streamJson-capable CLI)'}`,
  );
  {
    let promptBytes = 0;
    for (const task of bench.tasks) {
      const file = join(bench.dir, task.promptTrigger ?? task.prompt);
      if (existsSync(file)) promptBytes += statSync(file).size;
    }
    const bodyTokens = Math.ceil(skill.payload.length / 4);
    lines.push(
      `Est. cost: ~${formatK(Math.ceil(promptBytes / 4))} prompt-tokens/run; skill body ~${formatK(bodyTokens)} loads only if triggered (estimate, before replies)`,
    );
  }
  lines.push(`Trials   : ${trials} per task (single arm: skill installed)`);
  lines.push('Tasks    :');
  for (const task of bench.tasks) {
    const label =
      task.shouldTrigger === undefined
        ? 'unlabeled — skipped'
        : task.shouldTrigger
          ? 'should trigger'
          : 'should NOT trigger (negative control)';
    lines.push(`- ${task.id}: ${label}`);
  }
  lines.push(`Output   : ${join(runsRoot, runGroup)} (not created)`);
  lines.push('Dry run — nothing was written.');
  return lines.join('\n');
}

async function runEvalTrigger(
  options: EvalOptions,
  bench: Bench,
  skill: SkillBundle,
  trials: number,
  log: (msg: string) => void,
): Promise<TriggerManifest | null> {
  let executor = options.executor ?? null;
  let resolutionError: string | undefined;
  if (!executor) {
    if (!options.agent) {
      throw new Error(
        'trigger mode requires --agent (a CLI executor with trigger detection); API executors cannot measure skill triggering.',
      );
    }
    try {
      executor = CliExecutor.forAgent(options.agent, { triggerSkillName: skill.name });
    } catch (error) {
      resolutionError = (error as Error).message;
      log(`Note: ${(error as Error).message}`);
    }
  }
  const agent = options.agent ? getAgent(options.agent) : null;
  const installDir = options.skillInstallDir ?? agent?.skills.projectDirs[0];
  const runsRoot = options.runsRoot ?? resolve('runs');
  const runGroup = options.runGroup ?? defaultRunGroup();

  const plannedCalls = bench.tasks.filter(task => task.shouldTrigger !== undefined).length * trials;
  const maxCalls = validateCallBudget(plannedCalls, options.maxCalls);
  const inspect = () => inspectEvalAgent(options, skill, executor, null, undefined, resolutionError);
  const agentPreflight = inspect();

  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  const competitors = options.competeInstalled && options.agent
    ? installedUserSkills(getAgent(options.agent), options.sessionOptions?.homeDir ?? homedir(), options.sessionOptions?.env ?? process.env)
      .filter((entry) => entry.name !== skill.name)
      .map((entry) => ({ name: entry.name, sourceDir: entry.dir, sha256: collectInstalledSkillFingerprint(entry.dir).sha256 }))
    : [];
  const detection = options.agent === 'codex' ? 'skill-read' as const : options.agent ? 'skill-tool' as const : 'unrecorded' as const;
  const competeLine = competitors.length === 0
    ? 'Compete  : alone (recall is an upper bound)'
    : `Compete  : ${competitors.map((entry) => entry.name).join(', ')}`;

  if (options.dryRun) {
    log(renderTriggerPlan(bench, skill, executor, trials, runsRoot, runGroup, installDir));
    log(renderAgentEnvironment(agentPreflight));
    log('Case preflight: pending; required before execution. Dry run does not execute verifiers or oracles.');
    log(competeLine);
    log(`Calls    : ${plannedCalls} planned; ceiling ${maxCalls} (agent calls only)`);
    return null;
  }
  assertAgentEnvironment(agentPreflight);
  if (!executor) {
    throw new Error('No executor available for trigger mode; pass --agent.');
  }
  if (!installDir) {
    throw new Error(
      'trigger mode needs a skill install directory: pass --agent (the matrix provides one) or skillInstallDir.',
    );
  }
  return withEvaluationInterrupts(async () => {
    if (existsSync(join(runsRoot, runGroup))) throw new Error(`Run group directory already exists: ${join(runsRoot, runGroup)}`);
    const eligible = { ...bench, tasks: bench.tasks.filter(t => t.shouldTrigger !== undefined) };
    const casePreflight = await checkEvalCases(eligible, [skill], false, log);
    assertAgentEnvironmentUnchanged(agentPreflight, inspect());
    throwIfEvaluationInterrupted();
    log(renderTriggerPlan(bench, skill, executor, trials, runsRoot, runGroup, installDir).replace(' (dry run)', '').replace(' (not created)', '').replace('Dry run — nothing was written.', `Calls    : ${plannedCalls} planned; ceiling ${maxCalls}`));
    log(competeLine);
    log(renderAgentEnvironment(agentPreflight));
    const session = sessionFor(options, bench, skill, trials, runsRoot, runGroup, ['installed'], plannedCalls,
      { mode: 'trigger', trials, executor: executor.describe(), casePreflight, agentPreflight });
    let manifest: TriggerManifest;
    try {
      manifest = await runTriggerExperiment({
        bench,
        skill,
        executor: session.wrap(executor, 'agent'),
        session,
        trials,
        runsRoot,
        runGroup,
        skillInstallDir: installDir,
        competitors,
        detection,
        log,
      });
      throwIfEvaluationInterrupted();
    } catch (error) { session.finish(error); throw error; }
    session.finish(undefined, manifest);
    log(renderTriggerSummary(manifest, join(runsRoot, runGroup, 'manifest.json')));
    return manifest;
  });
}

export async function runEval(options: EvalOptions): Promise<RunManifest | TriggerManifest | null> {
  if (options.spendingBudget !== undefined && options.mode === 'trigger') throw new Error('spendingBudget applies only to paired evaluations.');
  const executorTimeoutSeconds = parseExecutorTimeoutSeconds(options.executorTimeoutSeconds ??
    (!options.agent && !options.executor ? DEFAULT_API_TIMEOUT_MS / 1000 : undefined));
  const log = options.log ?? ((msg: string) => console.log(msg));
  const installed = options.mode === 'installed';
  if (options.baselineSkillPath !== undefined && !installed) {
    throw new Error('--baseline-skill requires --mode installed.');
  }
  if (installed && options.inputMode !== undefined && options.inputMode !== 'workspace') {
    throw new Error('installed mode requires workspace input; omit --input or use --input workspace.');
  }
  const inputMode = options.inputMode ?? (installed ? 'workspace' : 'snapshot');
  assertInputModeSupported(inputMode, null);
  if (options.mode === 'trigger' && options.inputMode !== undefined) {
    throw new Error('--input applies only to paired modes; trigger mode already presents files on disk.');
  }
  if (options.competeInstalled && options.mode !== 'trigger') {
    throw new Error('--compete-installed applies only to --mode trigger.');
  }
  if (options.competeInstalled && !options.agent) {
    throw new Error('--compete-installed needs --agent so other user Skills can be read from the matrix directories.');
  }
  const trials = options.trials ?? DEFAULT_EVAL_TRIALS;
  if (!Number.isInteger(trials) || trials < 1 || trials > 20) {
    throw new Error(`--trials must be an integer between 1 and 20, got ${trials}`);
  }
  const benchDir = resolveBenchDir(options.bench);
  const bench = selectBenchTasks(loadBench(benchDir), options.taskIds);
  let target = collectEvaluationTarget(options.skillPath);
  let baselineTarget: EvaluationTarget | undefined;
  let skillInstallDir: string | undefined;
  let skillSearchDirs: string[] = [];
  if (installed) {
    if (target.kind !== 'skill') throw new Error('installed mode is only available for Skill targets.');
    target = collectInstalledSkillTarget(options.skillPath);
    if (options.baselineSkillPath !== undefined) {
      baselineTarget = collectInstalledSkillTarget(options.baselineSkillPath);
      assertSkillRevisionTargets(target, baselineTarget);
    }
    skillSearchDirs = options.agent ? getAgent(options.agent).skills.projectDirs : [];
    skillInstallDir = options.skillInstallDir ?? skillSearchDirs[0];
    if (!skillInstallDir) throw new Error('installed mode needs --agent with a matrix-defined project Skill directory.');
    assertInstalledSkillFixtures(bench, target, skillInstallDir, skillSearchDirs);
    assertNativeDiffFixtures(bench);
  }

  if ((options.mode ?? 'inject') === 'trigger') {
    if (options.executorTimeoutSeconds !== undefined) throw new Error('executorTimeoutSeconds is only available for paired experiments.');
    if (options.pairOrder !== undefined) throw new Error('pairOrder is only available for paired experiments.');
    if (target.kind !== 'skill') {
      throw new Error('trigger mode is only available for Skill targets; rules and MCP targets use paired inject-mode workspaces.');
    }
    return runEvalTrigger(options, bench, target as SkillBundle, trials, log);
  }

  if (target.kind !== 'skill' && options.agent) {
    const agent = getAgent(options.agent);
    const expected = (target.kind === 'mcp' ? agent.mcp.projectFiles : agent.rules.projectFiles)
      .map((path) => path.split('\\').join('/'));
    const treatmentFiles = listFilesRecursive(target.overlays.treatment as string);
    if (!expected.some((path) => treatmentFiles.includes(path))) {
      throw new Error(
        `${target.kind} treatment for ${agent.id} must include one of its matrix-defined project files: ${expected.join(', ')}`,
      );
    }
    for (const condition of ['baseline', 'treatment'] as const) {
      const overlay = target.overlays[condition];
      if (!overlay) continue;
      const unexpected = listFilesRecursive(overlay).filter((path) => !expected.includes(path));
      if (unexpected.length > 0) {
        throw new Error(
          `${target.kind} ${condition} overlay may contain only matrix-defined project config files (${expected.join(', ')}); unexpected: ${unexpected.join(', ')}`,
        );
      }
    }
  }

  let executor: Executor | null = null;
  let resolutionError: string | undefined;
  try {
    executor = options.executor ?? resolveExecutor(options.agent, target, installed, executorTimeoutSeconds);
  } catch (error) {
    resolutionError = (error as Error).message;
    log(`Note: ${(error as Error).message}`);
  }
  let capabilityError: string | undefined;
  try {
    if (inputMode === 'workspace' && !options.agent && !options.executor) {
      throw new Error('workspace input requires --agent <id> for a CLI executor; API keys do not provide filesystem access.');
    }
    if (target.kind !== 'skill' && !options.agent && !options.executor) {
      throw new Error(`${target.kind} experiments require --agent because API executors do not load project configuration files.`);
    }
    assertExecutorSupportsBench(executor, bench);
    assertInputModeSupported(inputMode, executor);
    if (target.kind !== 'skill' && executor?.describe().kind === 'api') {
      throw new Error(`${target.kind} experiments require a CLI executor; API executors cannot load project configuration files.`);
    }
  } catch (error) { capabilityError = (error as Error).message; }
  let judge: Executor | null = null, judgeError: string | undefined;
  try { judge = options.judgeExecutor !== undefined ? options.judgeExecutor : resolveJudge(options.judgeAgent); }
  catch (error) { judgeError = (error as Error).message; }
  const inspect = () => inspectEvalAgent(options, target, executor, judge, capabilityError, resolutionError, judgeError);
  const agentPreflight = inspect();
  if (capabilityError) assertAgentEnvironment(agentPreflight);
  const spendingBudget = options.spendingBudget === undefined ? undefined : parseSpendingBudget(options.spendingBudget);
  if (spendingBudget && judge) throw new Error('spendingBudget requires a paired evaluation without a judge; judge usage is not covered.');
  if (options.judgeAgent && options.judgeAgent === options.agent) {
    log('Warning: judge and executor are the same agent — self-preference bias risk (docs/metrics.md L4).');
  }
  const runsRoot = options.runsRoot ?? resolve('runs');
  const runGroup = options.runGroup ?? defaultRunGroup();
  const plannedCalls = bench.tasks.length * trials * (judge ? 4 : 2);
  const maxCalls = validateCallBudget(plannedCalls, options.maxCalls);
  const pairOrder = parsePairOrder(options.pairOrder);

  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  options.onPlan?.({
    mode: installed ? 'installed' : 'inject',
    agentPreflight,
    casePreflight: { ...CASE_PREFLIGHT_POLICY, status: 'pending' },
    inputSnapshot: { ...INPUT_SNAPSHOT_POLICY },
    target: { kind: target.kind, name: target.name, sourceDir: target.sourceDir, sha256: target.sha256, files: target.files },
    baseline: baselineTarget ? { name: baselineTarget.name, sourceDir: baselineTarget.sourceDir, sha256: baselineTarget.sha256, files: baselineTarget.files } : null,
    bench: { name: bench.name, dir: bench.dir, sha256: bench.contentSha256, taskIds: bench.tasks.map(t => t.id) },
    executor: executor ? withSampling(executor.describe()) : null, judge: judge ? withSampling(judge.describe()) : null, inputMode,
    installDir: skillInstallDir ?? null, trials, plannedCalls, maxCalls, pairOrder,
    ...(spendingBudget ? { spendingBudget } : {}),
    ...(installed ? { nativeDiffTool: nativeDiffDescriptor() } : {}),
    executorTimeoutSeconds, outputDir: join(runsRoot, runGroup),
  });

  if (options.dryRun) {
    log(renderPlan(bench, target, executor, judge, trials, runsRoot, runGroup, inputMode, baselineTarget));
    log(renderAgentEnvironment(agentPreflight));
    log('Case preflight: pending; required before execution. Dry run does not execute verifiers or oracles.');
    log(`Calls    : ${plannedCalls} planned; ceiling ${maxCalls} (includes both judge orders when enabled)`);
    log(`Pair order: ${pairOrder}; arms remain adjacent`);
    if (spendingBudget) log(`Spending stop lines: ${JSON.stringify(spendingBudget)}; checked between calls, in-flight overshoot remains possible`);
    log(`Agent deadline: ${executorTimeoutSeconds}s per invocation in both arms`);
    if (skillInstallDir) {
      log('Tool     : native untracked-file diff helper in both arms (version 1; environment correction)');
      log('Delivery : complete Skill resources installed ' + (baselineTarget ? 'in both conditions' : 'only in treatment') + ' at ' + skillInstallDir + '/' + target.name);
      log('           identical prompts; native discovery is not guaranteed; inherited configuration still applies');
    }
    return null;
  }
  assertAgentEnvironment(agentPreflight);
  if (!executor) {
    throw new Error('No executor available; pass --agent or set SKILLFIT_API_KEY.');
  }

  return withEvaluationInterrupts(async () => {
    if (existsSync(join(runsRoot, runGroup))) throw new Error(`Run group directory already exists: ${join(runsRoot, runGroup)}`);
    const casePreflight = await checkEvalCases(bench, [target, ...(baselineTarget ? [baselineTarget] : [])], installed, log);
    assertAgentEnvironmentUnchanged(agentPreflight, inspect());
    throwIfEvaluationInterrupted();
    log(renderPlan(bench, target, executor, judge, trials, runsRoot, runGroup, inputMode, baselineTarget).replace(' (dry run)', '').replace(' (not created)', '').replace('Dry run — nothing was written.', `Calls    : ${plannedCalls} planned; ceiling ${maxCalls}`));
    log(renderAgentEnvironment(agentPreflight));
    const session = sessionFor(options, bench, target, trials, runsRoot, runGroup, ['baseline', 'treatment'], plannedCalls,
      { mode: installed ? 'installed' : 'inject', inputMode, trials, pairOrder, casePreflight, agentPreflight,
        ...(options.reviewedPlan ? { reviewedPlan: options.reviewedPlan } : {}),
        ...(spendingBudget ? { spendingBudget } : {}),
        ...(installed ? { nativeDiffTool: nativeDiffDescriptor() } : {}),
        executorTimeoutSeconds, executor: executor.describe(), judge: judge?.describe() ?? null,
        ...(options.component ? { component: options.component } : {}),
        ...(baselineTarget ? { baselineTarget: { name: baselineTarget.name, sourceDir: baselineTarget.sourceDir, bundleSha256: baselineTarget.sha256, files: baselineTarget.files } } : {}) }, baselineTarget);
    let manifest: RunManifest;
    try {
      manifest = await runExperiment({
        bench,
        target,
        baselineTarget,
        component: options.component,
        pairOrder,
        ...(spendingBudget ? { spendingBudget } : {}),
        inputMode,
        ...(skillInstallDir ? { skillInstallDir, skillSearchDirs } : {}),
        executor: session.wrap(executor, 'agent'),
        judge: judge ? session.wrap(judge, 'judge') : null,
        session,
        trials,
        runsRoot,
        runGroup,
        log,
      });
      throwIfEvaluationInterrupted();
    } catch (error) { session.finish(error); throw error; }
    session.finish(undefined, manifest);
    log(renderSummary(manifest, join(runsRoot, runGroup, 'manifest.json')));
    return manifest;
  });
}
