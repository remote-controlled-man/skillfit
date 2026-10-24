import { measurementScope, requestedClaimFor, assertBenchClaimSupported } from './measurement-scope.js';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { getAgent } from '../agents.js';
import { parseFrontmatter } from '../frontmatter.js';
import { parseTriggerDetection } from './trigger-contract.js';
import { loadBench, selectBenchTasks } from './bench.js';
import { resolveBenchDir } from './bench-location.js';
import { RUN_GROUP_PATTERN } from './constants.js';
import { ApiExecutor, DEFAULT_API_TIMEOUT_MS } from './executors/api.js';
import { CliExecutor } from './executors/cli.js';
import { listFilesRecursive } from './hash.js';
import { assertNativeDiffFixtures, nativeDiffDescriptor } from './native-diff.js';
import { assertInstalledSkillFixtures, assertSkillRevisionTargets, collectInstalledSkillTarget, validateSkillInstallDir } from './installed-skill.js';
import { assertInputModeSupported } from './prompt.js';
import { collectInstalledSkillFingerprint } from './bundle.js';
import { installedUserSkills } from './receipts.js';
import { collectEvaluationTarget } from './target.js';

import type { Bench, EvaluationTarget, Executor, InputMode, SkillBundle } from './types.js';
import { parseExecutorTimeoutSeconds, parsePairOrder } from './eval-contract.js';
import { parseSpendingBudget } from './eval-budget.js';
import { INPUT_SNAPSHOT_POLICY } from './input-snapshot.js';
import { assertEvaluationOutputLayout } from './evaluation-layout.js';
import { inspectAgentEnvironment, assertAgentEnvironment,
  type AgentEnvironmentPreflight, type EnvironmentRole } from './agent-preflight.js';
import { CASE_PREFLIGHT_POLICY } from './eval-preflight.js';
import { validateCallBudget } from './experiment-session.js';
import { withSampling } from './types.js';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFileSet, sha256Text } from './hash.js';
import type { EvalOptions, EvalPreview, EvalPlanContext, ReviewedEvalPlan } from './eval-options.js';
import { DEFAULT_EVAL_TRIALS } from './eval-options.js';

export interface EvalResolutionDependencies { env?: NodeJS.ProcessEnv; now?: () => Date }

/** Resolved objects and descriptors stay internal; only preview is serialized. */
export interface ResolvedEvalInputs {
  dependencies: EvalResolutionDependencies; options: EvalOptions; bench: Bench; target: EvaluationTarget; baselineTarget?: EvaluationTarget;
  executor: Executor | null; judge: Executor | null; trials: number; runsRoot: string; runGroup: string;
  inputMode: InputMode; skillInstallDir?: string; skillSearchDirs: string[];
  preview: EvalPreview; inspect: () => AgentEnvironmentPreflight; notes: string[];
  promptEstimate: { baseline: number; treatment: number };
  competitors: { name: string; sourceDir: string; sha256: string }[];
}
function resolveExecutor(agent: string | undefined, target: EvaluationTarget, installed = false, executorTimeoutSeconds?: number, installDir?: string, env: NodeJS.ProcessEnv = process.env): Executor {
  if (agent) {
    const definition = getAgent(agent);
    return CliExecutor.forAgent(agent, {
      ...(executorTimeoutSeconds !== undefined ? { timeoutMs: executorTimeoutSeconds * 1000 } : {}),
      trustProjectConfig: target.kind === 'mcp' && definition.headless.projectTrustConfigArg !== undefined,
      ...(installed && definition.headless.streamJson ? { triggerSkillName: target.name } : {}),
      ...(installed && installDir ? { triggerSkillPaths: [`${validateSkillInstallDir(installDir)}/${target.name}/SKILL.md`] } : {}),
    });
  }
  return ApiExecutor.fromEnv(env, executorTimeoutSeconds === undefined ? {} : { timeoutMs: executorTimeoutSeconds * 1000 });
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

function resolveJudge(judgeAgent?: string, timeoutSeconds?: number, env: NodeJS.ProcessEnv = process.env): Executor | null {
  const flag = env['SKILLFIT_JUDGE'];
  if (!judgeAgent && (!flag || flag === '0' || flag === 'false')) return null;
  if (judgeAgent) {
    return CliExecutor.forAgent(judgeAgent, timeoutSeconds === undefined ? {} : { timeoutMs: timeoutSeconds * 1000 });
  }
  return new ApiExecutor({
      apiKey: env['SKILLFIT_JUDGE_API_KEY'] ?? env['SKILLFIT_API_KEY'] ?? env['OPENAI_API_KEY'],
      model: env['SKILLFIT_JUDGE_MODEL'] ?? env['SKILLFIT_API_MODEL'],
      baseUrl: env['SKILLFIT_JUDGE_BASE_URL'] ?? env['SKILLFIT_API_BASE_URL'],
      ...(timeoutSeconds === undefined ? {} : { timeoutMs: timeoutSeconds * 1000 }),
    });
}

function defaultRunGroup(now: Date = new Date()): string {
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `eval-${date}-${time}`;
}

function inspectEvalAgent(options: EvalOptions, target: EvaluationTarget, executor: Executor | null, judge: Executor | null,
  capabilityError?: string, resolutionError?: string, judgeError?: string, env: NodeJS.ProcessEnv = process.env): AgentEnvironmentPreflight {
  const roles: EnvironmentRole[] = [{ role: 'agent', definition: options.agent ? getAgent(options.agent) : undefined,
    executor: executor?.describe() ?? null, injected: options.executor !== undefined, resolutionError }];
  if (judge || judgeError) roles.push({ role: 'judge', definition: options.judgeAgent ? getAgent(options.judgeAgent) : undefined,
    executor: judge?.describe() ?? null, injected: options.judgeExecutor != null, resolutionError: judgeError });
  return inspectAgentEnvironment({ roles, mode: options.mode ?? 'inject', target, capabilityError,
    spendingBudget: options.spendingBudget !== undefined,
    homeDir: options.sessionOptions?.homeDir, env: options.sessionOptions?.env ?? env });
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

function resolveTriggerInputs(options: EvalOptions, bench: Bench, skill: SkillBundle, trials: number,
  notes: string[], dependencies: EvalResolutionDependencies): ResolvedEvalInputs {
  const env = dependencies.env ?? process.env, log = (line: string) => notes.push(line);
  const scope = measurementScope(bench, 'activation');
  if (options.judgeAgent || options.judgeExecutor) throw new Error('Trigger evaluation does not use a judge.');
  const executorTimeoutSeconds = parseExecutorTimeoutSeconds(options.executorTimeoutSeconds);
  const spendingBudget = options.spendingBudget === undefined ? undefined : parseSpendingBudget(options.spendingBudget);
  let executor = options.executor ?? null;
  let resolutionError: string | undefined;
  if (!executor) {
    if (!options.agent) {
      throw new Error(
        'trigger mode requires --agent (a CLI executor with trigger detection); API executors cannot measure skill triggering.',
      );
    }
    try {
      const definition = getAgent(options.agent);
      const alias = definition.sessions?.skillNameAliases === 'directory-and-frontmatter'
        ? parseFrontmatter(readFileSync(join(skill.sourceDir, 'SKILL.md'), 'utf8'))?.name : undefined;
      const identities = alias && /^[a-z0-9][a-z0-9-]{0,63}(?::[a-z0-9][a-z0-9-]{0,63})?$/.test(alias) ? [alias] : [];
      executor = CliExecutor.forAgent(options.agent, { triggerSkillName: skill.name, triggerSkillIdentities: identities,
        ...(options.skillInstallDir ? { triggerSkillPaths: [`${validateSkillInstallDir(options.skillInstallDir)}/${skill.name}/SKILL.md`] } : {}),
        timeoutMs: executorTimeoutSeconds * 1000 });
    } catch (error) {
      resolutionError = (error as Error).message;
      log(`Note: ${(error as Error).message}`);
    }
  }
  const agent = options.agent ? getAgent(options.agent) : null;
  const installDir = options.skillInstallDir ?? agent?.skills.projectDirs[0];
  const runsRoot = options.runsRoot ?? resolve('runs');
  const runGroup = options.runGroup ?? defaultRunGroup(dependencies.now?.());

  const plannedCalls = bench.tasks.filter(task => task.shouldTrigger !== undefined).length * trials;
  const maxCalls = validateCallBudget(plannedCalls, options.maxCalls);
  const inspect = () => inspectEvalAgent(options, skill, executor, null, undefined, resolutionError, undefined, env);
  const agentPreflight = inspect();

  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  assertEvaluationOutputLayout(join(runsRoot, runGroup), { benchDir: bench.dir, targetDirs: [skill.sourceDir] });
  const competitors = options.competeInstalled && options.agent
    ? installedUserSkills(getAgent(options.agent), options.sessionOptions?.homeDir ?? homedir(), options.sessionOptions?.env ?? env)
      .filter((entry) => entry.name !== skill.name)
      .map((entry) => ({ name: entry.name, sourceDir: entry.dir, sha256: collectInstalledSkillFingerprint(entry.dir).sha256 }))
    : [];
  const observation = parseTriggerDetection(executor?.describe().triggerDetection);
  const detection = observation ? observation.method === 'skill-file-read-command' ? 'skill-read' as const : 'skill-tool' as const
    : agent?.headless.streamJson?.wireShape === 'codex-items' ? 'skill-read' as const : agent ? 'skill-tool' as const : 'unrecorded' as const;
  const installedFingerprint = collectInstalledSkillFingerprint(skill.sourceDir);
  const competition = { mode: competitors.length ? 'installed' as const : 'alone' as const, skills: competitors };
  const preview: EvalPreview = { measurementScope: scope, mode: 'trigger', target: { kind: 'skill', name: skill.name, sourceDir: skill.sourceDir,
    sha256: skill.sha256, files: skill.files }, baseline: null,
    bench: { name: bench.name, dir: bench.dir, sha256: bench.contentSha256, taskIds: bench.tasks.map(task => task.id) },
    executor: executor?.describe() ?? null, judge: null, inputMode: 'workspace', installDir: installDir ?? null,
    trials, plannedCalls, maxCalls, outputDir: join(runsRoot, runGroup),
    agentPreflight, casePreflight: { ...CASE_PREFLIGHT_POLICY, status: 'pending' }, inputSnapshot: { ...INPUT_SNAPSHOT_POLICY },
    executorTimeoutSeconds, ...(spendingBudget ? { spendingBudget } : {}),
    installedFingerprint: { sha256: installedFingerprint.sha256, files: installedFingerprint.files }, competition, detection,
    ...(observation ? { triggerDetection: observation } : {}) };

  let promptBytes = 0;
  for (const task of bench.tasks) {
    const file = join(bench.dir, task.promptTrigger ?? task.prompt);
    if (existsSync(file)) promptBytes += statSync(file).size;
  }
  return { dependencies, options: { ...options, runsRoot, runGroup }, bench, target: skill, executor, judge: null, trials, runsRoot, runGroup,
    inputMode: 'workspace', skillInstallDir: installDir, skillSearchDirs: [], preview, inspect, notes,
    promptEstimate: { baseline: Math.ceil(promptBytes / 4), treatment: Math.ceil(skill.payload.length / 4) }, competitors };
}
export function resolveEvalInputs(options: EvalOptions, dependencies: EvalResolutionDependencies = {}): ResolvedEvalInputs {
  const executorTimeoutSeconds = parseExecutorTimeoutSeconds(options.executorTimeoutSeconds ??
    (!options.agent && !options.executor ? DEFAULT_API_TIMEOUT_MS / 1000 : undefined));
  const notes: string[] = [], log = (line: string) => notes.push(line);
  const env = dependencies.env ?? process.env;
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
  const scope = measurementScope(bench, requestedClaimFor(options.mode ?? 'inject', options.component?.policy ?? options.policy, !!options.stopOnExecutionError));
  if (!options.dryRun) assertBenchClaimSupported(scope);
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
    if (options.pairOrder !== undefined) throw new Error('pairOrder is only available for paired experiments.');
    if (target.kind !== 'skill') {
      throw new Error('trigger mode is only available for Skill targets; rules and MCP targets use paired inject-mode workspaces.');
    }
    return resolveTriggerInputs(options, bench, target as SkillBundle, trials, notes, dependencies);
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
    executor = options.executor ?? resolveExecutor(options.agent, target, installed, executorTimeoutSeconds, options.skillInstallDir, env);
  } catch (error) {
    resolutionError = (error as Error).message;
    log(`Note: ${(error as Error).message}`);
  }
  if (options.stopOnExecutionError && executor?.describe().kind !== 'mock') throw new Error('stopOnExecutionError requires an offline mock executor.');
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
  try { judge = options.judgeExecutor !== undefined ? options.judgeExecutor : resolveJudge(options.judgeAgent, executorTimeoutSeconds, env); }
  catch (error) { judgeError = (error as Error).message; }
  const inspect = () => inspectEvalAgent(options, target, executor, judge, capabilityError, resolutionError, judgeError, env);
  const agentPreflight = inspect();
  if (capabilityError) assertAgentEnvironment(agentPreflight);
  const spendingBudget = options.spendingBudget === undefined ? undefined : parseSpendingBudget(options.spendingBudget);
  if (options.judgeAgent && options.judgeAgent === options.agent) {
    log('Warning: judge and executor are the same agent — self-preference bias risk (docs/metrics.md L4).');
  }
  const runsRoot = options.runsRoot ?? resolve('runs');
  const runGroup = options.runGroup ?? defaultRunGroup(dependencies.now?.());
  const plannedCalls = bench.tasks.length * trials * (judge ? 4 : 2);
  const maxCalls = validateCallBudget(plannedCalls, options.maxCalls);
  const pairOrder = parsePairOrder(options.pairOrder);

  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  assertEvaluationOutputLayout(join(runsRoot, runGroup), { benchDir: bench.dir,
    targetDirs: [target.sourceDir, ...(baselineTarget ? [baselineTarget.sourceDir] : [])] });
  const preview: EvalPreview = {
    measurementScope: scope,
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
  };

  return { dependencies, options: { ...options, runsRoot, runGroup }, bench, target, baselineTarget, executor, judge, trials, runsRoot, runGroup,
    inputMode, skillInstallDir, skillSearchDirs, preview, inspect, notes,
    promptEstimate: estimatePromptTokens(bench, target, inputMode), competitors: [] };
}
/** Deterministic wire construction; no I/O, clock, display or confirmation. */
export function buildEvalPlan<T extends object>(inputs: { preview: EvalPreview }, implementationSha256: string, context: EvalPlanContext<T>) {
  const data = { schemaVersion: 1 as const, kind: 'skillfit.eval-plan' as const,
    ...context.fields, implementationSha256, evaluation: inputs.preview };
  return { ...data, sha256: sha256Text(JSON.stringify(data)) };
}

export function implementationFingerprint(): string {
  const dir = fileURLToPath(new URL('../../dist', import.meta.url));
  return hashFileSet(dir, listFilesRecursive(dir));
}

/** Shared read-only preparation, independent of command execution or presentation. */
export function prepareEvaluation<T extends object>(options: EvalOptions, context: EvalPlanContext<T>, dependencies: EvalResolutionDependencies = {}) {
  const implementationSha256 = implementationFingerprint();
  const resolved = resolveEvalInputs({ ...options, dryRun: true }, dependencies);
  if (existsSync(resolved.preview.outputDir)) throw new Error('Run group already exists; declare a fresh group without overwriting evidence.');
  const plan = buildEvalPlan(resolved, implementationSha256, context);
  const executionOptions = { ...options, runsRoot: dirname(resolved.preview.outputDir), runGroup: basename(resolved.preview.outputDir) };
  return { plan, resolved, options: executionOptions, context,
    assertCurrent: (preview: EvalPreview) => {
      if (buildEvalPlan({ preview }, implementationFingerprint(), context).sha256 !== plan.sha256) throw new Error('Plan changed before execution; no calls allowed.');
    } };
}
export function confirmEvalPlan(expected: string | undefined, actual: string): void {
  if (!expected || !/^[0-9a-f]{64}$/i.test(expected) || expected.toLowerCase() !== actual) {
    throw new Error('Execution requires --plan-sha matching the current dry-run plan; inputs, policy, executor or implementation changed.');
  }
}

export function plannedEvalResult<T extends ReviewedEvalPlan>(plan: T) {
  return { schemaVersion: 1 as const, kind: 'skillfit.eval-result' as const, status: 'planned' as const, plan,
    measurementScope: plan.evaluation.measurementScope,
    acceptance: { decision: 'inconclusive' as const, eligibleForUpgrade: false, automaticUpgrade: false as const,
      reasons: [{ code: 'PLAN_ONLY', message: 'No agent call or outcome is available.' }] } };
}
