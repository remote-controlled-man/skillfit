import { measurementScope, measurementScopeText, type MeasurementScope } from './measurement-scope.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { loadBench, selectBenchTasks } from './bench.js';
import { resolveBenchDir } from './bench-location.js';
import { listFilesRecursive } from './hash.js';
import { runVerifier, verifierFailure } from './verifier.js';
import { MOCK_MARKER_FILE } from './constants.js';
import { verdictFromOutput, type VerifierCheck } from './verifier-summary.js';
import { throwIfEvaluationInterrupted, withEvaluationInterrupts } from './interruption.js';
import type { Bench, BenchTask } from './types.js';
import { benchDiagnostic, benchCheckEvidence, type BenchCheckCode, type BenchCheckEvidence,
  type BenchCheckReport, type BenchCheck as Check } from './bench-diagnostics.js';

const FIXTURE_SIZE_WARN_BYTES = 64 * 1024;

// benches/README.md: a verifier decomposes its acceptance criteria into 2–8 named checks.
const MIN_FACET_CHECKS = 2;
const MAX_FACET_CHECKS = 8;

// docs/metrics.md: >=30% of trigger-labelled tasks should be negative controls.
const NEGATIVE_CONTROL_TARGET = 0.3;
const NEGATIVE_CONTROL_PERCENT = 30;

interface MockMarkerOutputs {
  baseline?: { output?: string };
  treatment?: { output?: string };
}

async function probeVerifier(
  benchDir: string,
  verifier: string,
  output: string | null,
  timeoutSeconds?: number,
): Promise<{ exitCode: number | null; error: string | null; output: string; checks: readonly VerifierCheck[] | null }> {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
  try {
    if (output !== null) {
      writeFileSync(join(dir, '_output.md'), output, 'utf8');
    }
    const result = await runVerifier(benchDir, verifier, dir, timeoutSeconds);
    return {
      exitCode: result.exitCode,
      error: result.error,
      output: result.output,
      checks: verdictFromOutput(result.output)?.checks ?? null,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function facetCountCheck(taskId: string, checks: readonly VerifierCheck[] | null): Check | null {
  // `checks` is optional in the verifier contract; with no checks there is no graded signal to gate.
  if (checks === null) return null;
  if (checks.length >= MIN_FACET_CHECKS && checks.length <= MAX_FACET_CHECKS) {
    return {
      status: 'PASS',
      message: `${taskId}: ${checks.length} facet check(s), within the ${MIN_FACET_CHECKS}–${MAX_FACET_CHECKS} contract`,
    };
  }
  const why =
    checks.length < MIN_FACET_CHECKS
      ? 'a single check is binary pass/fail in facet costume — it carries none of the graded signal facet scores exist to provide'
      : 'the trial score is dominated by whatever these checks happen to measure, and the per-facet table stops being readable';
  return {
    status: 'WARN',
    message: `${taskId}: ${checks.length} facet check(s) — outside the ${MIN_FACET_CHECKS}–${MAX_FACET_CHECKS} range in benches/README.md (${why})`,
  };
}

export function copyFixture(fixtureDir: string, dest: string): void {
  for (const rel of listFilesRecursive(fixtureDir)) {
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(fixtureDir, rel)));
  }
}

type OracleGateOutcome = (
  | { kind: 'oracle-failed'; exitCode: number | null; reason: string | null }
  | { kind: 'verifier-failed'; reason: string | null }
  | { kind: 'low-score'; score: number }
  | { kind: 'pass'; score: number | null }) & { result: Awaited<ReturnType<typeof runVerifier>>; command: string };

export async function runOracleGate(
  benchDir: string,
  fixtureDir: string,
  oracle: string,
  verifier: string,
  timeoutSeconds?: number,
  record?: (name: string, result: Awaited<ReturnType<typeof runVerifier>>) => void,
): Promise<OracleGateOutcome> {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
  try {
    copyFixture(fixtureDir, dir);
    const oracleRun = await runVerifier(benchDir, oracle, dir, timeoutSeconds);
    record?.('oracle', oracleRun);
    if (oracleRun.error !== null || oracleRun.exitCode !== 0) {
      return {
        kind: 'oracle-failed',
        result: oracleRun,
        command: oracle,
        exitCode: oracleRun.exitCode,
        reason: oracleRun.error !== null || oracleRun.exitCode === null ? verifierFailure('oracle', oracle, oracleRun.error) : null,
      };
    }
    const graded = await runVerifier(benchDir, verifier, dir, timeoutSeconds);
    record?.('oracle-verifier', graded);
    if (graded.error !== null || graded.exitCode !== 0) {
      return {
        kind: 'verifier-failed',
        result: graded,
        command: verifier,
        reason: graded.error !== null || graded.exitCode === null ? verifierFailure('verifier', verifier, graded.error) : null,
      };
    }
    const score = verdictFromOutput(graded.output)?.score ?? null;
    if (score !== null && score < 1) {
      return { kind: 'low-score', score, result: graded, command: verifier };
    }
    return { kind: 'pass', score, result: graded, command: verifier };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function probeOracle(
  benchDir: string,
  fixture: string,
  oracle: string,
  verifier: string,
  timeoutSeconds?: number,
): Promise<{ status: Check['status']; message: string; evidence: BenchCheckEvidence }> {
  const gate = await runOracleGate(benchDir, join(benchDir, fixture), oracle, verifier, timeoutSeconds);
  switch (gate.kind) {
    case 'oracle-failed':
      return {
        status: 'FAIL',
        evidence: benchCheckEvidence(gate.result, gate.command),
        message:
          gate.reason ??
          `oracle command itself failed (exit ${gate.exitCode}) — the reference solution cannot run`,
      };
    case 'verifier-failed':
      return {
        status: 'FAIL',
        evidence: benchCheckEvidence(gate.result, gate.command),
        message:
          gate.reason ?? 'oracle solution does not pass the verifier — the task is unwinnable or the oracle is stale',
      };
    case 'low-score':
      return {
        status: 'FAIL',
        evidence: benchCheckEvidence(gate.result, gate.command),
        message: `oracle passes the verifier but scores ${gate.score.toFixed(2)} on its checks — the checks are stricter than the exit code`,
      };
    case 'pass':
      return {
        status: 'PASS',
        evidence: benchCheckEvidence(gate.result, gate.command),
        message: `oracle solution passes the verifier${gate.score !== null ? ' with full checks' : ''}`,
      };
  }
}

export type BenchDiagnosticSink = (code: BenchCheckCode, status: Check['status'], message: string,
  task?: BenchTask, evidence?: BenchCheckEvidence) => void;

/** Probe a loaded selection with disposable copies; no executor or calibration. */
export async function inspectBenchIntegrity(bench: Bench, push: BenchDiagnosticSink): Promise<void> {
  let labeledTasks = 0;
  let negativeTasks = 0;
  for (const task of bench.tasks) {
    const taskPush = (code: BenchCheckCode, status: Check['status'], message: string, evidence?: BenchCheckEvidence) =>
      push(code, status, message, task, evidence);
    let facetChecks: readonly VerifierCheck[] | null = null;
    if ((task.verifierKind ?? 'output') === 'command') {
      const fixtureCopy = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
      try {
        copyFixture(join(bench.dir, task.fixture), fixtureCopy);
        const pristine = await runVerifier(bench.dir, task.verifier, fixtureCopy, task.verifierTimeoutSeconds);
        facetChecks = verdictFromOutput(pristine.output)?.checks ?? null;
        if (pristine.error !== null || pristine.exitCode === null) {
          // Without this branch a verifier that cannot even be spawned reads as a clean NOP gate:
          // "fails on the untouched fixture" is exactly what `exitCode !== 0` looks like.
          taskPush('UNTOUCHED_FIXTURE', 'FAIL', `${task.id}: ${verifierFailure('verifier', task.verifier, pristine.error)}`, benchCheckEvidence(pristine, task.verifier));
        } else if (pristine.exitCode === 0) {
          taskPush(
            'UNTOUCHED_FIXTURE', 'FAIL',
            `${task.id}: command verifier already passes on the untouched fixture — the task is solved or the verifier is broken`, benchCheckEvidence(pristine, task.verifier),
          );
        } else {
          taskPush(
            'UNTOUCHED_FIXTURE', 'PASS',
            `${task.id}: command verifier fails on the untouched fixture (the failure reproduces)`, benchCheckEvidence(pristine, task.verifier),
          );
        }
      } finally {
        rmSync(fixtureCopy, { recursive: true, force: true });
      }
    } else {
      const missing = await probeVerifier(bench.dir, task.verifier, null, task.verifierTimeoutSeconds);
      if (missing.error !== null || missing.exitCode === null) {
        taskPush('MISSING_OUTPUT', 'FAIL', `${task.id}: ${verifierFailure('verifier', task.verifier, missing.error)}`, benchCheckEvidence(missing, task.verifier));
      } else if (missing.exitCode === 0) {
        taskPush('MISSING_OUTPUT', 'FAIL', `${task.id}: verifier does not reject a missing _output.md`, benchCheckEvidence(missing, task.verifier));
      } else {
        taskPush('MISSING_OUTPUT', 'PASS', `${task.id}: verifier rejects missing output`, benchCheckEvidence(missing, task.verifier));
      }
      const empty = await probeVerifier(bench.dir, task.verifier, '', task.verifierTimeoutSeconds);
      facetChecks = empty.checks;
      if (empty.error !== null || empty.exitCode === null) {
        taskPush('EMPTY_OUTPUT', 'FAIL', `${task.id}: ${verifierFailure('verifier', task.verifier, empty.error)}`, benchCheckEvidence(empty, task.verifier));
      } else if (empty.exitCode === 0) {
        taskPush('EMPTY_OUTPUT', 'FAIL', `${task.id}: verifier passes an empty output — it cannot tell success from silence`, benchCheckEvidence(empty, task.verifier));
      } else {
        taskPush('EMPTY_OUTPUT', 'PASS', `${task.id}: verifier rejects empty output`, benchCheckEvidence(empty, task.verifier));
      }
    }

    const facetGate = facetCountCheck(task.id, facetChecks);
    if (facetGate) taskPush('FACET_COUNT', facetGate.status, facetGate.message);

    if (task.oracle) {
      const oracleResult = await probeOracle(bench.dir, task.fixture, task.oracle, task.verifier, task.verifierTimeoutSeconds);
      taskPush('ORACLE', oracleResult.status, `${task.id}: ${oracleResult.message}`, oracleResult.evidence);
    } else {
      taskPush(
        'ORACLE', 'WARN',
        `${task.id}: no oracle — task winnability is unverified (nothing proves a correct solution passes this verifier; register one with --oracle or write ground-truth/oracle-${task.id}.mjs)`,
      );
    }

    const markerPath = join(bench.dir, task.fixture, MOCK_MARKER_FILE);
    if ((task.verifierKind ?? 'output') === 'command') {
      taskPush(
        'MOCK_COVERAGE', 'INFO',
        `${task.id}: command verifier — mock-arm probes not applicable (a mock writes _output.md text, not file edits)${
          task.oracle
            ? '; offline coverage comes from the oracle and NOP gates above'
            : '; with no oracle registered, nothing offline shows this task is solvable'
        }`,
      );
    } else if (existsSync(markerPath)) {
      try {
        const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as MockMarkerOutputs;
        for (const arm of ['baseline', 'treatment'] as const) {
          const behavior = marker[arm];
          if (behavior?.output === undefined) {
            taskPush(arm === 'baseline' ? 'MOCK_BASELINE' : 'MOCK_TREATMENT', 'INFO', `${task.id}: no mock ${arm} output — this arm was not probed`);
            continue;
          }
          const probe = await probeVerifier(bench.dir, task.verifier, behavior.output, task.verifierTimeoutSeconds);
          taskPush(
            arm === 'baseline' ? 'MOCK_BASELINE' : 'MOCK_TREATMENT', probe.error !== null || probe.exitCode === null ? 'FAIL' : 'INFO',
            `${task.id}: mock ${arm} output → ${probe.error !== null || probe.exitCode === null ? verifierFailure('verifier', task.verifier, probe.error) : `verifier ${probe.exitCode === 0 ? 'pass' : 'fail'}`}`, benchCheckEvidence(probe, task.verifier),
          );
        }
      } catch (error) {
        throwIfEvaluationInterrupted();
        taskPush('MOCK_MARKER', 'FAIL', `${task.id}: ${MOCK_MARKER_FILE} is unreadable (${(error as Error).message})`);
      }
    } else {
      taskPush('MOCK_COVERAGE', 'INFO', `${task.id}: no ${MOCK_MARKER_FILE} (offline mock runs will produce empty outputs)`);
    }

    const fixtureDir = join(bench.dir, task.fixture);
    const fixtureBytes = listFilesRecursive(fixtureDir)
      .map((rel) => statSync(join(fixtureDir, rel)).size)
      .reduce((sum, size) => sum + size, 0);
    if (fixtureBytes > FIXTURE_SIZE_WARN_BYTES) {
      taskPush(
        'FIXTURE_SIZE', 'WARN',
        `${task.id}: fixture is ${Math.round(fixtureBytes / 1024)} KB — inject mode inlines it into every prompt; keep it lean`,
      );
    } else {
      taskPush('FIXTURE_SIZE', 'PASS', `${task.id}: fixture size ${Math.round(fixtureBytes / 1024)} KB`);
    }

    if (task.shouldTrigger === undefined) {
      taskPush('TRIGGER_LABEL', 'INFO', `${task.id}: no shouldTrigger label (trigger mode will skip this task)`);
    } else {
      labeledTasks++;
      if (task.shouldTrigger === false) negativeTasks++;
    }
  }

  if (labeledTasks > 0) {
    const fraction = negativeTasks / labeledTasks;
    const percent = Math.round(fraction * 100);
    if (negativeTasks === 0) {
      push(
        'NEGATIVE_CONTROLS', 'WARN',
        'no shouldTrigger:false (negative-control) tasks — trigger mode cannot measure false-trigger rate (see docs/metrics.md)',
      );
    } else if (fraction < NEGATIVE_CONTROL_TARGET) {
      push(
        'NEGATIVE_CONTROLS', 'WARN',
        `${negativeTasks}/${labeledTasks} labeled task(s) are negative controls (${percent}%) — below the ${NEGATIVE_CONTROL_PERCENT}% target in docs/metrics.md, so false-trigger rate rests on a thin sample`,
      );
    } else {
      push(
        'NEGATIVE_CONTROLS', 'PASS',
        `${negativeTasks}/${labeledTasks} labeled task(s) are negative controls (${percent}%) — at or above the ${NEGATIVE_CONTROL_PERCENT}% target`,
      );
    }
  }

}

/** Shared offline entry for callers that need data rather than a CLI summary. */
export async function runOfflineBenchCheck(options: { dir?: string; taskIds?: string[]; log?: (line: string) => void }): Promise<BenchCheckReport> {
  return withEvaluationInterrupts(async () => {
    let dir = resolve(options.dir ?? '.');
    const checks: BenchCheckReport['checks'] = [];
    let identity: BenchCheckReport['bench'] = null;
    let scope: MeasurementScope | undefined;
    const result = (): BenchCheckReport => ({ dir, bench: identity, ...(scope ? { measurementScope: scope } : {}), checks,
      failures: checks.filter(check => check.status === 'FAIL').length,
      warnings: checks.filter(check => check.status === 'WARN').length });
    const push: BenchDiagnosticSink = (code, status, message, task, evidence) => {
      throwIfEvaluationInterrupted();
      checks.push(benchDiagnostic(code, status, message, task, evidence));
      options.log?.(`[${status}] ${message}`);
    };
    let bench;
    try {
      dir = resolveBenchDir(options.dir ?? '.');
      bench = selectBenchTasks(loadBench(dir), options.taskIds);
    } catch (error) {
      push('BENCH_LOAD', 'FAIL', `bench does not load: ${(error as Error).message}`);
      return result();
    }
    scope = measurementScope(bench, null); options.log?.(measurementScopeText(scope));
    identity = { name: bench.name, sha256: bench.contentSha256, taskCount: bench.tasks.length };
    push('BENCH_LOAD', 'PASS', `bench.json valid (${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…)`);
    await inspectBenchIntegrity(bench, push);
    return result();
  });
}
