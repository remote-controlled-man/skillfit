import type { CasePreflight } from './eval-preflight.js';

export class CasePreflightFailed extends Error {
  constructor(readonly preflight: CasePreflight) {
    super('Offline case preflight blocked evaluation; no agent or judge calls were made.\n' +
      preflight.checks.filter(c => c.status === 'FAIL').map(c =>
        `[FAIL] ${c.code}${c.taskId ? ` (${c.taskId})` : ''}: ${c.message}${c.remediation ? ` Remedy: ${c.remediation}` : ''}`).join('\n'));
    this.name = 'CasePreflightFailed';
  }
}
