
import { measurementScope, measurementScopeText, type MeasurementScope } from "../evaluation/measurement/scope.js";
import { inspectBenchIntegrity } from "../bench/gates/check.js";
import { CasePreflightFailed } from "./eval-preflight-error.js";
import { resolve } from 'node:path';
import { loadBench, selectBenchTasks } from "../bench/read.js";
import { resolveBenchDir } from "../bench/location.js";
import type { BenchTask } from "../bench/contracts.js";
import { confirm as confirmPrompt } from "./confirm.js";
import { prepareBenchChange, applyBenchChange, draftBenchChange, type BenchInitOptions, type BenchAddOptions } from "../bench/authoring.js";
export type { BenchInitOptions, BenchAddOptions } from "../bench/authoring.js";
export { applyBenchWrites } from "../bench/authoring.js";
import { benchDiagnostic, type BenchCheckCode, type BenchCheckEvidence, type BenchCheckReport, type BenchDiagnostic } from "../bench/diagnostics.js";
export type { BenchCheckReport } from "../bench/diagnostics.js";
import { throwIfCancelled as throwIfEvaluationInterrupted } from "../shared/cancellation.js";
import { withEvaluationInterrupts } from './evaluation-host.js';
import type { Check } from "./doctor.js";
import { assertAgentEnvironment, renderAgentEnvironment } from "../agents/preflight.js";
import { calibrationCasePreflight, executeCalibration, prepareCalibration, type BenchCheckCalibrateOptions } from "../evaluation/application/calibration.js";
export { captureSourceFiles } from "./bench-source.js";
export { prepareBenchCalibration } from "../evaluation/application/calibration.js";
export type { BenchCheckCalibrateOptions, BenchCalibrationPreview } from "../evaluation/application/calibration.js";

export interface BenchCheckOptions {
  dir?: string;
  /** Internal eval scope; preserves the full bench fingerprint. */
  taskIds?: string[];
  log?: (msg: string) => void;
  calibrate?: BenchCheckCalibrateOptions | false;
}

export async function runBenchInit(options: BenchInitOptions): Promise<{ dir: string; created: string[] } | null> {
  const change = prepareBenchChange({ operation: 'init', options });
  const log = options.log ?? ((message: string) => console.log(message));
  if (options.dryRun) { for (const line of change.lines.preview) log(line); return null; }
  change.assertCurrent();
  if (!options.yes && !await (options.confirm ?? confirmPrompt)(change.confirmation)) { log('Aborted — nothing was written.'); return null; }
  const result = applyBenchChange(change);
  for (const line of change.lines.after) log(line);
  return result;
}

export async function runBenchAdd(options: BenchAddOptions): Promise<{ dir: string; taskId: string; files: string[] } | null> {
  const run = async () => {
    const change = prepareBenchChange({ operation: 'add', options });
    const log = options.log ?? ((message: string) => console.log(message));
    for (const line of change.lines.before) log(line);
    if (options.dryRun) { for (const line of change.lines.preview) log(line); return null; }
    if (!options.yes && !await (options.confirm ?? confirmPrompt)(change.confirmation)) { log('Aborted — nothing was written.'); return null; }
    if (change.draft) await draftBenchChange(change, log);
    const result = applyBenchChange(change);
    for (const line of change.lines.after) log(line);
    return result;
  };
  return options.dryRun ? run() : withEvaluationInterrupts(run);
}

function renderCheck({ status, message }: Check): string {
  return `[${status}] ${message}`;
}

export async function runBenchCheck(options: BenchCheckOptions): Promise<BenchCheckReport> {
  return withEvaluationInterrupts(() => runBenchCheckWithinInterrupts(options));
}

export async function runBenchCalibration(options: BenchCheckOptions & { calibrate: BenchCheckCalibrateOptions }): Promise<BenchCheckReport> {
  return withEvaluationInterrupts(() => runBenchCheckWithinInterrupts(options, true));
}

async function runBenchCheckWithinInterrupts(options: BenchCheckOptions, strictCalibration = false): Promise<BenchCheckReport> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  let dir = resolve(options.dir ?? '.');
  const checks: BenchDiagnostic[] = [];
  let identity: BenchCheckReport['bench'] = null;
  let scope: MeasurementScope | undefined;
  const push = (code: BenchCheckCode, status: Check['status'], message: string, task?: BenchTask, evidence?: BenchCheckEvidence): void => {
    throwIfEvaluationInterrupted();
    checks.push(benchDiagnostic(code, status, message, task, evidence));
    log(renderCheck({ status, message }));
  };

  let bench;
  try {
    dir = resolveBenchDir(options.dir ?? '.');
    bench = selectBenchTasks(loadBench(dir), options.taskIds ?? (options.calibrate ? options.calibrate.taskIds : undefined));
  } catch (error) {
    push('BENCH_LOAD', 'FAIL', `bench does not load: ${(error as Error).message}`);
    return finish(dir, checks, log, false, identity, scope);
  }
  scope = measurementScope(bench, null); log(measurementScopeText(scope));
  identity = { name: bench.name, sha256: bench.contentSha256, taskCount: bench.tasks.length };
  push('BENCH_LOAD', 'PASS', `bench.json valid (${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…)`);
  const calibration = options.calibrate ? prepareCalibration({ dir, taskIds: options.taskIds, calibrate: options.calibrate }) : null;
  if (calibration) {
    log(renderAgentEnvironment(calibration.plan.agentPreflight));
    if (options.calibrate && options.calibrate.dryRun) {
      push('CALIBRATION', 'INFO', `calibration executor: ${calibration.plan.executor?.detail ?? calibration.plan.executor?.model ?? 'unavailable'}`);
      push('CALIBRATION', 'INFO', `calibration plan: ${bench.tasks.length} task(s) × ${calibration.plan.trials} baseline run(s), input ${calibration.plan.inputMode}; ${calibration.plan.plannedCalls} calls, ceiling ${calibration.plan.maxCalls}; deadline ${calibration.plan.executorTimeoutSeconds}s; no verifier, oracle or agent started and no run directory created`);
      push('CALIBRATION', 'INFO', `Plan SHA-256: ${calibration.plan.planSha256}; fresh output ${calibration.plan.outputDir}`);
      return finish(dir, checks, log, true, identity, scope);
    }
    try { assertAgentEnvironment(calibration.plan.agentPreflight); }
    catch (error) {
      if (strictCalibration) throw error;
      push('CALIBRATION', 'FAIL', (error as Error).message);
      return finish(dir, checks, log, true, identity, scope);
    }
  }
  const offlineStarted = performance.now();

  await inspectBenchIntegrity(bench, push);

  if (calibration) {
    const offlineReport = { dir, bench: identity, checks, failures: checks.filter(check => check.status === 'FAIL').length,
      warnings: checks.filter(check => check.status === 'WARN').length };
    const casePreflight = calibrationCasePreflight(bench, offlineReport, Math.round(performance.now() - offlineStarted));
    log(`Case preflight: ${casePreflight.status}; ${casePreflight.summary.failures} failure(s), ${casePreflight.summary.warnings} warning(s), ${casePreflight.summary.unknown} unknown(s); 0 model calls`);
    for (const check of casePreflight.checks.filter(check => check.status === 'UNKNOWN')) log(`[UNKNOWN] ${check.code}: ${check.message}`);
    if (casePreflight.status === 'blocked') {
      if (strictCalibration) {
        throw new CasePreflightFailed(casePreflight);
      }
      push('CALIBRATION', 'FAIL', 'Offline case preflight blocked calibration; no agent calls or run directory were created. Fix every hard failure before a fresh plan.');
      for (const check of casePreflight.checks.filter(check => check.code === 'INPUT_CHANGED')) push('CALIBRATION', 'FAIL', check.message);
    } else {
      await executeCalibration(calibration, casePreflight, (status, message) => push('CALIBRATION', status, message), log);
    }
  }

  return finish(dir, checks, log, options.calibrate !== false && options.calibrate !== undefined, identity, scope);
}

function finish(
  dir: string,
  checks: BenchDiagnostic[],
  log: (msg: string) => void,
  calibrated = false,
  bench: BenchCheckReport['bench'] = null,
  scope?: MeasurementScope,
): BenchCheckReport {
  const failures = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;
  const passes = checks.filter((c) => c.status === 'PASS').length;
  log('');
  log(`Summary: ${passes} passed, ${warnings} warning(s), ${failures} failure(s)`);
  if (!calibrated) {
    log('Next: calibrate difficulty against a real agent —');
    log(`  skillfit eval <skill-path> --bench ${dir} --agent <id> --trials 5`);
    log('  quality-improvement target: baseline pass rate 30–70%; --calibrate warns outside 10–90% (docs/reference/metrics.md L0).');
    log('  efficiency needs paired costs, variance, coverage and regression checks; activation needs positive/negative labels and observed detection coverage.');
  }
  return { dir, bench, ...(scope ? { measurementScope: scope } : {}), checks, failures, warnings };
}
