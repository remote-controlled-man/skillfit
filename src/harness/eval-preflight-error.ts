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

export class CasePreflightFailed extends Error {
  constructor(readonly preflight: CasePreflight) {
    super('Offline case preflight blocked evaluation; no agent or judge calls were made.\n' +
      preflight.checks.filter(c => c.status === 'FAIL').map(c =>
        `[FAIL] ${c.code}${c.taskId ? ` (${c.taskId})` : ''}: ${c.message}${c.remediation ? ` Remedy: ${c.remediation}` : ''}`).join('\n'));
    this.name = 'CasePreflightFailed';
  }
}
