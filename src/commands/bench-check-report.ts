import type { BenchCheckReport } from '../harness/bench-diagnostics.js';
export { benchDiagnostic, benchCheckEvidence } from '../harness/bench-diagnostics.js';
export type { BenchCheckCode, BenchCheckEvidence, BenchCheckReport, BenchDiagnostic } from '../harness/bench-diagnostics.js';

export function benchCheckJson(report: BenchCheckReport) {
  if (report.checks.some(c => c.code === 'CALIBRATION')) throw new Error('JSON bench checks must be offline; calibration results are not supported.');
  return { schemaVersion: 1, kind: 'skillfit.bench-check', status: report.failures ? 'failed' : 'passed',
    scope: 'offline-integrity', ...(report.measurementScope ? { measurementScope: report.measurementScope } : {}), dir: report.dir, bench: report.bench, checks: report.checks,
    summary: { total: report.checks.length, passed: report.checks.filter(c => c.status === 'PASS').length,
      warnings: report.warnings, failures: report.failures, info: report.checks.filter(c => c.status === 'INFO').length },
    error: null };
}

export function benchCheckError(error: unknown) {
  return { schemaVersion: 1, kind: 'skillfit.bench-check', status: 'error', scope: 'offline-integrity',
    dir: null, bench: null, checks: [], summary: null,
    error: { code: 'INVALID_OR_FAILED_CHECK', message: error instanceof Error ? error.message : String(error) } };
}
