import { CasePreflightFailed } from './eval-preflight-error.js';
export { CasePreflightFailed } from './eval-preflight-error.js';
import { loadBench } from './bench.js';
import { collectInstalledSkillTarget } from './installed-skill.js';
import { throwIfEvaluationInterrupted } from './interruption.js';
import { collectEvaluationTarget } from './target.js';
import type { Bench, EvaluationTarget } from './types.js';
import { runOfflineBenchCheck } from './bench-check.js';
import type { BenchDiagnostic } from './bench-diagnostics.js';

export const CASE_PREFLIGHT_POLICY = { schemaVersion: 1, scope: 'offline-case-integrity', required: true } as const;

export interface CaseDiagnostic extends Omit<BenchDiagnostic, 'code' | 'status'> {
  code: BenchDiagnostic['code'] | 'LIVE_DIFFICULTY' | 'INPUT_CHANGED' | 'CHECK_ERROR';
  status: BenchDiagnostic['status'] | 'UNKNOWN';
}

export interface CasePreflight {
  schemaVersion: 1;
  kind: 'skillfit.eval-preflight';
  scope: 'offline-case-integrity';
  status: 'ready' | 'blocked';
  bench: { dir: string; sha256: string; taskIds: string[] };
  checks: CaseDiagnostic[];
  summary: { failures: number; warnings: number; unknown: number; passed: number; info: number };
  cost: { modelCalls: 0; durationMs: number };
}

function globalCheck(code: CaseDiagnostic['code'], status: CaseDiagnostic['status'], message: string): CaseDiagnostic {
  return { code, status, message, taskId: null, location: { path: 'bench.json', field: null },
    remediation: status === 'FAIL' ? 'Fix the inputs or check error and run a fresh preview before executing.' : null, evidence: null };
}

/** Runs only trusted local bench commands in disposable directories; never an executor. */
export async function checkEvalCases(bench: Bench, targets: readonly EvaluationTarget[], installed: boolean,
  log: (line: string) => void): Promise<CasePreflight> {
  const started = performance.now();
  let checks: CaseDiagnostic[];
  try {
    const result = await runOfflineBenchCheck({ dir: bench.dir, taskIds: bench.tasks.map(t => t.id), log: () => {} });
    checks = result.checks.map(check => {
      const unknown = (check.code === 'ORACLE' && check.status === 'WARN') ||
        ((check.code === 'MOCK_BASELINE' || check.code === 'MOCK_TREATMENT') && check.status === 'INFO' && check.evidence === null) ||
        (check.code === 'MOCK_COVERAGE' && check.status === 'INFO' &&
          bench.tasks.some(t => t.id === check.taskId && (t.verifierKind ?? 'output') === 'output'));
      return { ...check, status: unknown ? 'UNKNOWN' : check.status };
    });
  } catch (error) {
    throwIfEvaluationInterrupted();
    checks = [globalCheck('CHECK_ERROR', 'FAIL', error instanceof Error ? error.message : String(error))];
  }
  throwIfEvaluationInterrupted();
  // Verifiers are executable local code. Never freeze inputs mutated during a probe
  // as if those were the inputs approved in the preview.
  try {
    if (loadBench(bench.dir).contentSha256 !== bench.contentSha256 || targets.some(target =>
      (installed ? collectInstalledSkillTarget(target.sourceDir) : collectEvaluationTarget(target.sourceDir)).sha256 !== target.sha256)) {
      checks.push(globalCheck('INPUT_CHANGED', 'FAIL', 'Bench or target content changed during offline preflight.'));
    }
  } catch (error) {
    checks.push(globalCheck('INPUT_CHANGED', 'FAIL', `Inputs became unreadable during offline preflight: ${String(error)}`));
  }
  checks.push(globalCheck('LIVE_DIFFICULTY', 'UNKNOWN',
    'Offline probes do not measure live agent difficulty, Skill benefit, or generalization. No calibration or model call was performed.'));
  const count = (status: CaseDiagnostic['status']) => checks.filter(c => c.status === status).length;
  const report: CasePreflight = { schemaVersion: 1, kind: 'skillfit.eval-preflight', scope: 'offline-case-integrity',
    status: count('FAIL') ? 'blocked' : 'ready', bench: { dir: bench.dir, sha256: bench.contentSha256, taskIds: bench.tasks.map(t => t.id) },
    checks, summary: { failures: count('FAIL'), warnings: count('WARN'), unknown: count('UNKNOWN'), passed: count('PASS'), info: count('INFO') },
    cost: { modelCalls: 0, durationMs: Math.round(performance.now() - started) } };
  log(`Case preflight: ${report.status}; ${report.summary.failures} failure(s), ${report.summary.warnings} warning(s), ${report.summary.unknown} unknown(s); ${report.cost.durationMs}ms offline, 0 model calls`);
  for (const c of checks.filter(c => c.status !== 'PASS' && c.status !== 'INFO')) log(`[${c.status}] ${c.code}: ${c.message}`);
  if (report.status === 'blocked') throw new CasePreflightFailed(report);
  return report;
}
