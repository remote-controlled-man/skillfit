import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents.js';
import { assertAgentEnvironment, assertAgentEnvironmentUnchanged, inspectAgentEnvironment, renderAgentEnvironment,
  type AgentEnvironmentPreflight } from '../harness/agent-preflight.js';
import { loadBench, selectBenchTasks } from '../harness/bench.js';
import { RUN_GROUP_PATTERN } from '../harness/constants.js';
import { summarizeCosts } from '../harness/costs.js';
import { createSpendingBudgetRecorder, parseSpendingBudget, type SpendingBudget } from '../harness/eval-budget.js';
import { parseExecutorTimeoutSeconds } from '../harness/eval-contract.js';
import { assertEvaluationOutputLayout } from '../harness/evaluation-layout.js';
import { ExperimentSession, validateCallBudget, type SessionOptions } from '../harness/experiment-session.js';
import { CliExecutor } from '../harness/executors/cli.js';
import { hashFileSet, listFilesRecursive, sha256File, sha256Text } from '../harness/hash.js';
import { throwIfEvaluationInterrupted } from '../harness/interruption.js';
import { assertInputModeSupported } from '../harness/prompt.js';
import { runTrial, type ExperimentPlan, type TrialOutcome } from '../harness/runner.js';
import type { Bench, Executor, ExecutorDescriptor, InputMode, SkillBundle } from '../harness/types.js';
import type { Check } from './doctor.js';
import type { BenchCheckReport } from './bench-check-report.js';
import type { CasePreflight } from './eval-preflight.js';

export interface BenchCheckCalibrateOptions {
  maxCalls?: number;
  sessionOptions?: Pick<SessionOptions, 'homeDir' | 'env' | 'versionProbe'>;
  guardFiles?: SessionOptions['guardFiles'];
  taskIds?: string[];
  agent?: string;
  inputMode?: InputMode;
  dryRun?: boolean;
  trials?: number;
  executor?: Executor;
  runsRoot?: string;
  runGroup?: string;
  spendingBudget?: SpendingBudget;
  executorTimeoutSeconds?: number;
  reviewedPlanSha256?: string;
}

export interface BenchCalibrationPreview {
  schemaVersion: 1;
  kind: 'skillfit.calibration-plan';
  implementationSha256: string;
  bench: { dir: string; name: string; sha256: string; taskIds: string[] };
  agent: string | null;
  executor: ExecutorDescriptor | null;
  inputMode: InputMode;
  trials: number;
  plannedCalls: number;
  maxCalls: number;
  executorTimeoutSeconds: number;
  spendingBudget?: SpendingBudget;
  runGroup: string;
  runsRoot: string;
  outputDir: string;
  guardFiles: NonNullable<SessionOptions['guardFiles']>;
  agentPreflight: AgentEnvironmentPreflight;
  casePreflight: { schemaVersion: 1; scope: 'offline-case-integrity'; required: true; status: 'pending' };
  planSha256: string;
}

type CalibrationInput = { dir?: string; taskIds?: string[]; calibrate: BenchCheckCalibrateOptions };
interface PreparedCalibration {
  bench: Bench;
  executor: Executor | null;
  options: BenchCheckCalibrateOptions;
  plan: BenchCalibrationPreview;
  inspect: () => AgentEnvironmentPreflight;
}

function emptySkill(sourceDir: string): SkillBundle {
  return { kind: 'skill', name: 'calibration-none', sourceDir, files: [], sha256: '0'.repeat(64), payload: '', overlays: {} };
}

function resolveCalibration(input: CalibrationInput): PreparedCalibration {
  const options = input.calibrate;
  const bench = selectBenchTasks(loadBench(resolve(input.dir ?? '.')), input.taskIds ?? options.taskIds);
  const trials = options.trials ?? 2;
  if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error(`calibration trials must be an integer between 1 and 20, got ${trials}`);
  const plannedCalls = bench.tasks.length * trials, maxCalls = validateCallBudget(plannedCalls, options.maxCalls);
  const inputMode = options.inputMode ?? 'snapshot', executorTimeoutSeconds = parseExecutorTimeoutSeconds(options.executorTimeoutSeconds);
  const spendingBudget = options.spendingBudget === undefined ? undefined : parseSpendingBudget(options.spendingBudget);
  if (options.executor && options.executorTimeoutSeconds !== undefined) {
    throw new Error('executorTimeoutSeconds cannot configure an injected executor; configure its timeout directly.');
  }
  const definition = options.agent ? getAgent(options.agent) : undefined;
  let executor: Executor | null = null, resolutionError: string | undefined, capabilityError: string | undefined;
  try {
    executor = options.executor ?? (definition ? CliExecutor.forAgent(definition.id, {
      timeoutMs: executorTimeoutSeconds * 1000,
      ...(definition.headless.streamJson ? { triggerSkillName: 'calibration-none' } : {}),
    }) : null);
  } catch (error) { resolutionError = (error as Error).message; }
  try {
    if (executor) {
      assertInputModeSupported(inputMode, executor);
      if (executor.describe().kind === 'api' && bench.tasks.some(task => (task.verifierKind ?? 'output') === 'command')) {
        throw new Error('Command-verifier calibration needs a filesystem-capable CLI executor; an API executor cannot edit the workspace.');
      }
    }
  } catch (error) { capabilityError = (error as Error).message; }
  const inspect = () => inspectAgentEnvironment({ roles: [{ role: 'agent', definition, executor: executor?.describe() ?? null,
    injected: options.executor !== undefined, resolutionError: resolutionError ?? (!executor ? '--calibrate needs --agent (a CLI executor for real runs)' : undefined) }],
    mode: 'inject', target: emptySkill(bench.dir), capabilityError,
    homeDir: options.sessionOptions?.homeDir, env: options.sessionOptions?.env });
  const agentPreflight = inspect();
  const runsRoot = resolve(options.runsRoot ?? 'runs');
  const runGroup = options.runGroup ?? `calibrate-${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}`;
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  const outputDir = join(runsRoot, runGroup);
  assertEvaluationOutputLayout(outputDir, { benchDir: bench.dir });
  if (existsSync(outputDir)) throw new Error(`Run group directory already exists: ${outputDir}`);
  const guardFiles = (options.guardFiles ?? []).map(file => ({ ...file, path: resolve(file.path) }));
  for (const file of guardFiles) if (sha256File(file.path) !== file.sha256) throw new Error(`Frozen ${file.label} file changed before planning.`);
  const implementationDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const data = { schemaVersion: 1 as const, kind: 'skillfit.calibration-plan' as const,
    implementationSha256: hashFileSet(implementationDir, listFilesRecursive(implementationDir)),
    bench: { dir: bench.dir, name: bench.name, sha256: bench.contentSha256, taskIds: bench.tasks.map(task => task.id) },
    agent: options.agent ?? null, executor: executor?.describe() ?? null, inputMode, trials, plannedCalls, maxCalls,
    executorTimeoutSeconds, ...(spendingBudget ? { spendingBudget } : {}), runsRoot, runGroup, outputDir, guardFiles, agentPreflight,
    casePreflight: { schemaVersion: 1 as const, scope: 'offline-case-integrity' as const, required: true as const, status: 'pending' as const } };
  const plan = { ...data, planSha256: sha256Text(JSON.stringify(data)) };
  if (options.reviewedPlanSha256 !== undefined && options.reviewedPlanSha256.toLowerCase() !== plan.planSha256) {
    throw new Error('Calibration plan changed before execution; inputs, budget, executor or implementation changed. No calls allowed.');
  }
  return { bench, executor, options, plan, inspect };
}

/** A preview reads fingerprints and PATH only; it runs no verifier, oracle or agent. */
export function prepareBenchCalibration(input: CalibrationInput): BenchCalibrationPreview {
  return resolveCalibration(input).plan;
}

export function prepareCalibration(input: CalibrationInput): PreparedCalibration {
  return resolveCalibration(input);
}

export function calibrationCasePreflight(bench: Bench, report: BenchCheckReport, durationMs: number): CasePreflight {
  const checks: CasePreflight['checks'] = report.checks.map(check => ({ ...check,
    status: (check.code === 'ORACLE' && check.status === 'WARN') ||
      ((check.code === 'MOCK_BASELINE' || check.code === 'MOCK_TREATMENT') && check.status === 'INFO' && check.evidence === null) ||
      (check.code === 'MOCK_COVERAGE' && check.status === 'INFO' && bench.tasks.some(task => task.id === check.taskId && (task.verifierKind ?? 'output') === 'output'))
      ? 'UNKNOWN' : check.status }));
  if (loadBench(bench.dir).contentSha256 !== bench.contentSha256) checks.push({ code: 'INPUT_CHANGED', status: 'FAIL',
    message: 'Bench content changed during offline calibration preflight.', taskId: null, location: { path: 'bench.json', field: null },
    remediation: 'Fix the inputs and create a fresh calibration plan.', evidence: null });
  const count = (status: CasePreflight['checks'][number]['status']) => checks.filter(check => check.status === status).length;
  return { schemaVersion: 1, kind: 'skillfit.eval-preflight', scope: 'offline-case-integrity', status: count('FAIL') ? 'blocked' : 'ready',
    bench: { dir: bench.dir, sha256: bench.contentSha256, taskIds: bench.tasks.map(task => task.id) }, checks,
    summary: { failures: count('FAIL'), warnings: count('WARN'), unknown: count('UNKNOWN'), passed: count('PASS'), info: count('INFO') },
    cost: { modelCalls: 0, durationMs } };
}

export async function executeCalibration(prepared: PreparedCalibration, casePreflight: CasePreflight,
  push: (status: Check['status'], message: string) => void, log: (message: string) => void): Promise<void> {
  const { bench, executor, options, plan, inspect } = prepared;
  if (casePreflight.status !== 'ready' || casePreflight.checks.some(check => check.status === 'FAIL') ||
      casePreflight.bench.sha256 !== bench.contentSha256 ||
      JSON.stringify(casePreflight.bench.taskIds) !== JSON.stringify(plan.bench.taskIds)) {
    throw new Error('Offline case preflight blocked calibration; matching ready evidence is required before any agent call.');
  }
  assertAgentEnvironment(plan.agentPreflight);
  if (!executor) throw new Error('--calibrate needs --agent (a CLI executor for real runs)');
  assertAgentEnvironmentUnchanged(plan.agentPreflight, inspect());
  throwIfEvaluationInterrupted();
  const emptySkillDir = mkdtempSync(join(tmpdir(), 'skillfit-calibrate-'));
  const outcomes: TrialOutcome[] = [];
  // Retain the declared cohort even when a stop line prevents its later tasks.
  const taskResults = bench.tasks.map(task => ({ id: task.id, passes: 0, completed: 0, errors: 0 }));
  let session: ExperimentSession | undefined, failure: unknown;
  try {
    log(renderAgentEnvironment(plan.agentPreflight));
    session = new ExperimentSession({ bench, target: emptySkill(emptySkillDir), groupDir: plan.outputDir,
      plannedCalls: plan.plannedCalls, maxCalls: plan.maxCalls, agent: options.agent, injected: options.executor !== undefined,
      ...options.sessionOptions, guardFiles: options.guardFiles,
      workspaces: bench.tasks.flatMap(task => Array.from({ length: plan.trials }, (_, index) => join(plan.outputDir, task.id, 'baseline', `trial-${index + 1}`))),
      details: { mode: 'calibration', inputMode: plan.inputMode, trials: plan.trials, executor: executor.describe(),
        executorTimeoutSeconds: plan.executorTimeoutSeconds, ...(plan.spendingBudget ? { spendingBudget: plan.spendingBudget } : {}),
        taskIds: plan.bench.taskIds, agentPreflight: plan.agentPreflight, casePreflight, reviewedPlan: plan } });
    const runPlan: ExperimentPlan = { bench, target: emptySkill(emptySkillDir), inputMode: plan.inputMode,
      executor: session.wrap(executor, 'agent'), trials: plan.trials, runsRoot: plan.runsRoot, runGroup: plan.runGroup, log };
    const budget = createSpendingBudgetRecorder({ budget: plan.spendingBudget, groupDir: session.groupDir });
    push('INFO', `calibration: ${plan.trials} run(s) per task with no skill installed (baseline difficulty; input ${plan.inputMode}); ${plan.plannedCalls} calls, ceiling ${plan.maxCalls}; deadline ${plan.executorTimeoutSeconds}s`);
    let discriminative = 0, tasksRun = 0;
    for (const [taskIndex, task] of bench.tasks.entries()) {
      const taskResult = taskResults[taskIndex]!;
      for (let trial = 1; trial <= plan.trials; trial++) {
        throwIfEvaluationInterrupted();
        const identity = { taskId: task.id, condition: 'baseline' as const, trial };
        budget.before(identity);
        const outcome = await runTrial(runPlan, task.id, 'baseline', trial);
        outcomes.push(outcome);
        if (outcome.error !== null) taskResult.errors++;
        else { taskResult.completed++; if (outcome.passed) taskResult.passes++; }
        budget.after(identity, outcome);
        throwIfEvaluationInterrupted();
      }
      const { passes, completed, errors } = taskResult;
      if (!completed) { push('WARN', `${task.id}: no completed runs${errors ? ` (${errors} ungraded run(s))` : ''} — cannot assess difficulty`); continue; }
      tasksRun++;
      const rate = passes / completed;
      if (rate >= .9) push('WARN', `${task.id}: baseline ${passes}/${completed} — too easy (saturated; cannot discriminate skill effects)`);
      else if (rate <= .1) push('WARN', `${task.id}: baseline ${passes}/${completed} — too hard or broken (floor)`);
      else { discriminative++; push('PASS', `${task.id}: baseline ${passes}/${completed} — discriminative band`); }
    }
    session.settle();
    if (session.summary().status !== 'completed') push('FAIL', 'Calibration stopped or incomplete; inspect _session.json and _calls.jsonl before a fresh plan.');
    if (!tasksRun) push('FAIL', `calibration ran 0 task(s): difficulty unmeasured (runs under ${plan.runGroup})`);
    else push(discriminative === tasksRun ? 'PASS' : 'INFO', `calibration: ${discriminative}/${tasksRun} task(s) in the discriminative band (runs under ${plan.runGroup}; use --trials 3+ for steadier reads)`);
  } catch (error) { failure = error; throw error; }
  finally {
    try {
      if (session) {
        const result = { schemaVersion: 1, runGroup: plan.runGroup, inputMode: plan.inputMode, trials: plan.trials, tasks: taskResults,
          costs: summarizeCosts({ baseline: outcomes, treatment: [] }, { baseline: [], treatment: [] }), experiment: session.summary() };
        writeFileSync(join(session.groupDir, '_calibration.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        session.finish(failure, result, '_calibration.json');
      }
    } finally { rmSync(emptySkillDir, { recursive: true, force: true }); }
  }
}
