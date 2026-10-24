import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents.js';
import { loadBench } from '../harness/bench.js';
import { resolveBenchDir } from '../harness/bench-location.js';
import { controlFile, loadBenchControls, selectControlSuites, type ControlExpected, type ControlSuite } from '../harness/bench-controls.js';
import { RUN_GROUP_PATTERN } from '../harness/constants.js';
import { ControlExecutor } from '../harness/executors/control.js';
import { collectInstalledSkillTarget } from '../harness/installed-skill.js';
import { sha256Text } from '../harness/hash.js';
import { assertEvaluationOutputLayout } from '../harness/evaluation-layout.js';
import { EvaluationInterrupted, evaluationSignal, throwIfEvaluationInterrupted, withEvaluationInterrupts } from '../harness/interruption.js';
import { readComponentJson } from '../harness/eval-contract.js';
import { prepareEvaluation, confirmEvalPlan } from '../harness/eval-planning.js';
import { runEvaluation } from '../harness/eval-service.js';
import { evaluationPresentation } from './eval-display.js';
import { confirm } from './confirm.js';
import type { EvalOptions, SelfTestPlanContext } from '../harness/eval-options.js';

export interface BenchSelfTestOptions {
  dir: string;
  controls?: string;
  suites?: string[];
  runsRoot?: string;
  runGroup?: string;
  dryRun?: boolean;
  yes?: boolean;
  json?: boolean;
  expectedPlanSha256?: string;
  confirm?: (question: string) => Promise<boolean>;
  log?: (line: string) => void;
}
const isolation = () => ({
  synthetic: true as const, harnessModelCalls: 0 as const,
  simulatedUsage: { tokens: null, providerDurationSeconds: null },
  supportedModes: ['inject', 'installed'], unsupported: ['trigger', 'rules', 'mcp', 'judge', 'drafting'],
  acceptance: { decision: 'inconclusive' as const, eligibleForUpgrade: false as const, automaticUpgrade: false as const,
    reasons: [{ code: 'SYNTHETIC_SELF_TEST', message: 'Synthetic controls validate the harness, not model efficacy, discovery or adoption.' }] },
});
export function selfTestError(error: unknown) {
  return { schemaVersion: 1 as const, kind: 'skillfit.bench-self-test' as const, status: 'error' as const,
    ...isolation(), simulatedExecutorInvocations: null, localDurationMs: null, plan: null, suites: [],
    error: { code: 'INVALID_OR_FAILED_SELF_TEST', message: error instanceof Error ? error.message : String(error) } };
}
function available(path: string): void {
  try { lstatSync(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  throw new Error(`Self-test output already exists; choose a fresh run group: ${path}`);
}

export async function prepareBenchSelfTest(options: BenchSelfTestOptions) {
  const bench = loadBench(resolveBenchDir(options.dir)), controlsFile = options.controls ?? 'controls.json';
  try { controlFile(bench.dir, controlsFile); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { configured: false as const, bench: { name: bench.name, dir: bench.dir, sha256: bench.contentSha256 } };
  }
  const controls = loadBenchControls(bench, controlsFile), suites = selectControlSuites(controls.suites, options.suites);
  const runsRoot = resolve(options.runsRoot ?? 'runs');
  const runGroup = options.runGroup ?? `self-test-${new Date().toISOString().replace(/[^0-9]/g, '')}`;
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error('Invalid self-test run group.');
  const outputDir = join(runsRoot, runGroup), skillPath = fileURLToPath(new URL('../../benches/_self-test/target', import.meta.url));
  available(outputDir);
  assertEvaluationOutputLayout(outputDir, { benchDir: bench.dir, targetDirs: [skillPath] });
  const target = collectInstalledSkillTarget(skillPath);
  const executions = [];
  for (const suite of suites) {
    const installation = suite.mode === 'installed' ? { dir: getAgent(suite.agent!).skills.projectDirs[0]!, name: target.name, sha256: target.sha256 } : undefined;
    const executor = new ControlExecutor(bench, suite, join(outputDir, suite.id), installation);
    const base: EvalOptions = { skillPath, bench: bench.dir, taskIds: suite.taskIds, mode: suite.mode,
      ...(suite.agent ? { agent: suite.agent } : {}), inputMode: suite.mode === 'installed' ? 'workspace' : 'snapshot',
      trials: suite.trials, maxCalls: suite.taskIds.length * suite.trials * 2, runsRoot: outputDir, runGroup: suite.id,
      executor, judgeExecutor: null, sessionOptions: { env: {} }, stopOnExecutionError: true,
      dryRun: true, yes: true, log: options.log ?? (() => {}) };
    const context: SelfTestPlanContext = { kind: 'self-test', fields: { selfTest: { schemaVersion: 1, controlsSha256: controls.sha256,
      suite, stopOnExecutionError: true } } };
    const prepared = prepareEvaluation(base, context);
    executions.push({ suite, executor, prepared });
  }
  const data = { schemaVersion: 1 as const, kind: 'skillfit.bench-self-test-plan' as const,
    bench: { name: bench.name, dir: bench.dir, sha256: bench.contentSha256 },
    controls: { path: controlsFile, sha256: controls.sha256 }, outputDir,
    stopStrategy: 'stop-on-first-unexpected-error-or-mismatch' as const,
    suites: executions.map(({ suite, prepared }) => ({ ...suite, evaluation: prepared.plan })),
    plannedSimulatedExecutorInvocations: executions.reduce((n, e) => n + e.prepared.plan.evaluation.plannedCalls, 0),
    synthetic: true as const, harnessModelCalls: 0 as const };
  return { configured: true as const, executions, plan: { ...data, sha256: sha256Text(JSON.stringify(data)) },
    options: { ...options, runGroup, runsRoot } };
}

export interface ControlObserved {
  status: 'completed' | 'stopped' | 'error'; statisticalVerdict: ControlExpected['statisticalVerdict']; mcnemarP: number | null;
  errorCode: 'SIMULATED_EXECUTOR_FAILURE' | null;
  tasks: ControlExpected['tasks'];
}
function observe(runDir: string, suite: ControlSuite, complete: boolean): ControlObserved {
  const rows = suite.taskIds.map(id => ({ taskId: id, baseline: { graded: 0, passes: 0, errors: 0 }, treatment: { graded: 0, passes: 0, errors: 0 } }));
  let errorCode: ControlObserved['errorCode'] = null;
  for (const row of rows) for (const condition of ['baseline', 'treatment'] as const) for (let trial = 1; trial <= suite.trials; trial++) {
    const file = join(runDir, row.taskId, condition, `trial-${trial}`, '_result.json');
    if (!existsSync(file)) continue;
    const receipt = readComponentJson(file).value as { error: string | null; passed: boolean };
    if (receipt.error !== null) { row[condition].errors++; if (receipt.error === 'SIMULATED_EXECUTOR_FAILURE') errorCode = receipt.error; }
    else { row[condition].graded++; if (receipt.passed) row[condition].passes++; }
  }
  const session = existsSync(join(runDir, '_session.json')) ? readComponentJson(join(runDir, '_session.json')).value as { status: string } : null;
  const manifest = complete ? readComponentJson(join(runDir, 'manifest.json')).value as { overall: { verdict: ControlExpected['statisticalVerdict']; stats: { mcnemarP: number } } } : null;
  return { status: complete && session?.status === 'completed' ? 'completed' : session?.status === 'stopped' ? 'stopped' : 'error',
    statisticalVerdict: manifest?.overall.verdict ?? null, mcnemarP: manifest?.overall.stats.mcnemarP ?? null, errorCode, tasks: rows };
}
function compare(expected: ControlExpected, actual: ControlObserved): string[] {
  const reasons: string[] = [];
  for (const field of ['status', 'statisticalVerdict'] as const) if (expected[field] !== actual[field]) reasons.push(`${field}: expected ${expected[field]}, observed ${actual[field]}.`);
  if (expected.errorCode && actual.errorCode !== expected.errorCode) reasons.push('The declared synthetic error was not observed.');
  if (expected.mcnemarPRange) {
    const { minInclusive: min, maxExclusive: max } = expected.mcnemarPRange;
    if (actual.mcnemarP === null || actual.mcnemarP < min || actual.mcnemarP >= max) reasons.push(`McNemar p is outside [${min}, ${max}).`);
  }
  for (const row of expected.tasks) for (const arm of ['baseline', 'treatment'] as const) for (const field of ['graded', 'passes', 'errors'] as const) {
    if (row[arm][field] !== actual.tasks.find(t => t.taskId === row.taskId)![arm][field]) reasons.push(`${row.taskId}/${arm}/${field} differs from the declared control.`);
  }
  return reasons;
}
interface SuiteResult {
  id: string; purpose: ControlSuite['purpose']; mode: ControlSuite['mode']; taskIds: string[];
  status: 'not-run' | 'passed' | 'failed' | 'error' | 'interrupted';
  runDir: string; observed: ControlObserved | null; reasons: string[]; evaluation: unknown;
}

export async function runBenchSelfTest(options: BenchSelfTestOptions) {
  const started = performance.now(), prepared = await prepareBenchSelfTest(options);
  if (!prepared.configured) return { schemaVersion: 1 as const, kind: 'skillfit.bench-self-test' as const, status: 'not-configured' as const,
    ...isolation(), bench: prepared.bench, plan: null, suites: [], simulatedExecutorInvocations: 0, localDurationMs: Math.round(performance.now() - started), error: null };
  const { plan, executions } = prepared;
  const result = { schemaVersion: 1 as const, kind: 'skillfit.bench-self-test' as const,
    status: 'planned' as 'planned' | 'passed' | 'failed' | 'interrupted' | 'error', ...isolation(), plan,
    simulatedExecutorInvocations: 0, localDurationMs: 0, error: null as null | { code: string; message: string },
    suites: executions.map(({ suite }) => ({ id: suite.id, purpose: suite.purpose, mode: suite.mode, taskIds: suite.taskIds,
      status: 'not-run', runDir: join(plan.outputDir, suite.id), observed: null, reasons: [], evaluation: null }) as SuiteResult) };
  if (options.dryRun) { result.localDurationMs = Math.round(performance.now() - started); return result; }
  if (options.json && !options.runGroup) throw new Error('JSON self-test execution requires --run-group from the preview.');
  if (options.json || options.expectedPlanSha256 !== undefined) confirmEvalPlan(options.expectedPlanSha256, plan.sha256);
  else if (!options.yes && !await (options.confirm ?? confirm)(`Run ${plan.plannedSimulatedExecutorInvocations} synthetic control invocations with zero harness model calls in ${plan.outputDir}? [y/N] `)) {
    result.localDurationMs = Math.round(performance.now() - started); return result;
  }
  const current = await prepareBenchSelfTest(prepared.options);
  if (!current.configured || current.plan.sha256 !== plan.sha256) throw new Error('Self-test plan changed before execution; nothing started.');
  available(plan.outputDir);
  mkdirSync(dirname(plan.outputDir), { recursive: true }); mkdirSync(plan.outputDir);
  writeFileSync(join(plan.outputDir, '_self-test-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  try {
    await withEvaluationInterrupts(async () => {
      for (const [i, execution] of executions.entries()) {
        throwIfEvaluationInterrupted();
        const row = result.suites[i]!;
        try {
          row.evaluation = await runEvaluation({ ...execution.prepared.options, dryRun: false }, execution.prepared.plan.sha256,
            { kind: 'self-test', fields: { selfTest: execution.prepared.plan.selfTest } }, evaluationPresentation(options.log));
          throwIfEvaluationInterrupted();
          const completed = existsSync(join(row.runDir, 'manifest.json'));
          row.observed = observe(row.runDir, execution.suite, completed);
          row.reasons = compare(execution.suite.expected, row.observed);
          if (row.observed.status === 'stopped' && row.observed.errorCode !== 'SIMULATED_EXECUTOR_FAILURE') row.reasons.push('Unexpected execution errors cannot pass a synthetic error control.');
          const report = row.evaluation as { evidence?: { verified: boolean }; acceptance?: { eligibleForUpgrade: boolean } };
          if (completed && report.evidence?.verified !== true) row.reasons.push('Native evaluation audit did not verify the synthetic outcomes.');
          if (report.acceptance?.eligibleForUpgrade !== false) row.reasons.push('Synthetic evaluation unexpectedly became eligible for adoption.');
          row.status = row.reasons.length ? 'failed' : 'passed';
        } catch (error) {
          row.status = evaluationSignal()?.aborted ? 'interrupted' : 'error';
          row.reasons = [error instanceof Error ? error.message : String(error)];
          if (existsSync(row.runDir)) row.observed = observe(row.runDir, execution.suite, false);
          throwIfEvaluationInterrupted();
        }
        if (row.status !== 'passed') { result.status = 'failed'; return; }
      }
      result.status = 'passed';
    });
  } catch (error) {
    result.status = error instanceof EvaluationInterrupted ? 'interrupted' : 'error';
    result.error = { code: error instanceof EvaluationInterrupted ? error.signalName : 'SELF_TEST_EXECUTION_ERROR', message: error instanceof Error ? error.message : String(error) };
  } finally {
    result.simulatedExecutorInvocations = executions.reduce((n, e) => n + e.executor.invocations, 0);
    result.localDurationMs = Math.round(performance.now() - started);
    writeFileSync(join(plan.outputDir, '_self-test.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  return result;
}

export function selfTestExitCode(result: { status: string }): number {
  return ['planned', 'passed'].includes(result.status) ? 0 : result.status === 'error' ? 2 : 1;
}
