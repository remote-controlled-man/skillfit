import { isDeepStrictEqual } from 'node:util';
import type { Bench, BenchClaim } from './types.js';

export const BENCH_CLAIMS: readonly BenchClaim[] = ['quality', 'efficiency', 'activation'];

export function parseBenchClaims(value: unknown, label = 'claims'): BenchClaim[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(c => !BENCH_CLAIMS.includes(c)) || new Set(value).size !== value.length) {
    throw new Error(`${label} must be a nonempty, duplicate-free array of quality, efficiency or activation.`);
  }
  return [...value] as BenchClaim[];
}


export interface MeasurementScope {
  schemaVersion: 1;
  benchSchemaVersion: 1 | 2;
  taskClaims: { taskId: string; claims: BenchClaim[] | null }[];
  requestedClaim: BenchClaim | null;
  assessment: 'supported' | 'unsupported' | 'legacy-unrecorded' | 'not-applicable';
}

function assessment(scope: Pick<MeasurementScope, 'benchSchemaVersion' | 'taskClaims' | 'requestedClaim'>): MeasurementScope['assessment'] {
  if (scope.requestedClaim === null) return 'not-applicable';
  if (scope.benchSchemaVersion === 1) return 'legacy-unrecorded';
  return scope.taskClaims.every(t => t.claims?.includes(scope.requestedClaim!)) ? 'supported' : 'unsupported';
}

/** Caller supplies the selected cohort in original bench order; never filter by claim. */
export function measurementScope(bench: Bench, requestedClaim: BenchClaim | null): MeasurementScope {
  const data = { benchSchemaVersion: bench.schemaVersion as 1 | 2, requestedClaim,
    taskClaims: bench.tasks.map(t => ({ taskId: t.id, claims: bench.schemaVersion === 2 ? parseBenchClaims(t.claims, `${t.id} claims`) : null })) };
  return parseMeasurementScope({ schemaVersion: 1, ...data, assessment: assessment(data) })!;
}

export function parseMeasurementScope(value: unknown): MeasurementScope | undefined {
  if (value === undefined) return undefined;
  const obj = (v: unknown, required: string[], label: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label} must be an object.`);
    const r = v as Record<string, unknown>;
    if (Object.keys(r).some(k => !required.includes(k)) || required.some(k => !Object.hasOwn(r, k))) throw new Error(`${label} has missing or unknown fields.`);
    return r;
  };
  const r = obj(value, ['schemaVersion', 'benchSchemaVersion', 'taskClaims', 'requestedClaim', 'assessment'], 'measurementScope');
  if (r.schemaVersion !== 1) throw new Error(`Unsupported measurementScope schemaVersion: ${String(r.schemaVersion)}.`);
  if (r.benchSchemaVersion !== 1 && r.benchSchemaVersion !== 2) throw new Error('measurementScope.benchSchemaVersion must be 1 or 2.');
  if (r.requestedClaim !== null && !BENCH_CLAIMS.includes(r.requestedClaim as BenchClaim)) throw new Error('measurementScope.requestedClaim is invalid.');
  if (!Array.isArray(r.taskClaims) || !r.taskClaims.length) throw new Error('measurementScope.taskClaims must be nonempty.');
  const taskClaims = r.taskClaims.map(v => {
    const t = obj(v, ['taskId', 'claims'], 'measurementScope.taskClaims row');
    if (typeof t.taskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(t.taskId)) throw new Error('measurementScope taskId is invalid.');
    if (r.benchSchemaVersion === 1 && t.claims !== null) throw new Error('Schema 1 measurementScope claims must remain unrecorded (null).');
    return { taskId: t.taskId, claims: r.benchSchemaVersion === 1 ? null : parseBenchClaims(t.claims, `${t.taskId} claims`) };
  });
  if (new Set(taskClaims.map(t => t.taskId)).size !== taskClaims.length) throw new Error('measurementScope has repeated task IDs.');
  const scope: MeasurementScope = { schemaVersion: 1 as const, benchSchemaVersion: r.benchSchemaVersion, taskClaims,
    requestedClaim: r.requestedClaim as BenchClaim | null, assessment: r.assessment as MeasurementScope['assessment'] };
  if (scope.assessment !== assessment(scope)) throw new Error('measurementScope assessment contradicts its task claims and requestedClaim.');
  return scope;
}

export class BenchClaimUnsupported extends Error {
  readonly code = 'BENCH_CLAIM_UNSUPPORTED';
  constructor(readonly scope: MeasurementScope) {
    super(`BENCH_CLAIM_UNSUPPORTED: selected schema 2 tasks do not all support ${scope.requestedClaim} (unsupported: ${scope.taskClaims.filter(t => !t.claims?.includes(scope.requestedClaim!)).map(t => t.taskId).join(', ')}); use a suitable bench or explicitly select tasks. No calls may start.`);
    this.name = 'BenchClaimUnsupported';
  }
}

export function assertBenchClaimSupported(scope: MeasurementScope): void {
  if (scope.assessment === 'unsupported') throw new BenchClaimUnsupported(scope);
}

export function requestedClaimFor(mode: string, policy?: { schemaVersion: number }, diagnosticOnly = false): BenchClaim | null {
  return mode === 'calibration' || diagnosticOnly ? null : mode === 'trigger' ? 'activation' : policy?.schemaVersion === 2 ? 'efficiency' : 'quality';
}

export function assertScopeMatches(value: unknown, bench: Bench, claim: BenchClaim | null): void {
  if (!isDeepStrictEqual(parseMeasurementScope(value), measurementScope(bench, claim))) throw new Error('measurementScope differs from the frozen bench, task order or requested objective.');
}

export function measurementScopeText(scope?: MeasurementScope): string {
  if (!scope) return 'Measurement scope: unrecorded (legacy record); no declaration inferred.';
  return `Measurement scope: ${scope.assessment}; requested ${scope.requestedClaim ?? 'none (diagnostic only)'}; bench schema ${scope.benchSchemaVersion}; ` +
    scope.taskClaims.map(t => `${t.taskId}=[${t.claims?.join(', ') ?? 'legacy-unrecorded'}]`).join('; ') +
    '. Claims describe design support, not validity, power or adoption; quality covers these fixtures and deterministic checks only.';
}

/** Difficulty is an observation, never a power estimate or a cost qualification. */
export function claimDiagnostics(rate: number | null, scope?: MeasurementScope, taskId?: string) {
  const claims = scope?.taskClaims.find(t => t.taskId === taskId)?.claims;
  return {
    baselineBand: rate === null ? 'unmeasured' : rate >= 0.9 ? 'ceiling' : rate <= 0.1 ? 'floor' : 'between-floor-and-ceiling',
    qualityHeadroom: rate === null ? 'unmeasured' : rate >= 0.9 ? 'limited-at-ceiling' : rate <= 0.1 ? 'limited-at-floor' : 'potential-headroom-not-a-power-guarantee',
    efficiencyEligibility: `${claims == null ? 'legacy-unrecorded' : claims.includes('efficiency') ? 'declared' : 'unsupported'}; requires-paired-costs, variance, final coverage and no regressions`,
    activationCoverage: `${claims == null ? 'legacy-unrecorded' : claims.includes('activation') ? 'declared' : 'unsupported'}; inspect observed positive/negative labels and detection coverage`,
  };
}
