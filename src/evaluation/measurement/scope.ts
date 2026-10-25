import type { BenchClaim } from '../../bench/contracts.js';
import type { MeasurementScope } from '../../bench/scope.js';
export * from '../../bench/scope.js';
export function requestedClaimFor(mode: string, policy?: { schemaVersion: number }, diagnosticOnly = false): BenchClaim | null {
  return mode === 'calibration' || diagnosticOnly ? null : mode === 'trigger' ? 'activation' : policy?.schemaVersion === 2 ? 'efficiency' : 'quality';
}
export function claimDiagnostics(rate: number | null, scope?: MeasurementScope, taskId?: string) {
  const claims = scope?.taskClaims.find(t => t.taskId === taskId)?.claims;
  return {
    baselineBand: rate === null ? 'unmeasured' : rate >= 0.9 ? 'ceiling' : rate <= 0.1 ? 'floor' : 'between-floor-and-ceiling',
    qualityHeadroom: rate === null ? 'unmeasured' : rate >= 0.9 ? 'limited-at-ceiling' : rate <= 0.1 ? 'limited-at-floor' : 'potential-headroom-not-a-power-guarantee',
    efficiencyEligibility: `${claims == null ? 'legacy-unrecorded' : claims.includes('efficiency') ? 'declared' : 'unsupported'}; requires-paired-costs, variance, final coverage and no regressions`,
    activationCoverage: `${claims == null ? 'legacy-unrecorded' : claims.includes('activation') ? 'declared' : 'unsupported'}; inspect observed positive/negative labels and detection coverage`,
  };
}
