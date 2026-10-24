export interface AgentEnvironmentCheck {
  code: 'CLI_AVAILABLE' | 'MATRIX_CAPABILITY' | 'EXECUTOR_INJECTED' | 'AUTHENTICATION' |
    'GLOBAL_SKILL_CONFLICT' | 'GLOBAL_SKILL_SCAN' | 'ENVIRONMENT_CHANGED' | 'USAGE_CAPABILITY';
  role: 'agent' | 'judge';
  agent: string | null;
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'INFO';
  message: string;
  remediation: string | null;
  paths: string[];
}

export interface AgentEnvironmentPreflight {
  schemaVersion: 1;
  kind: 'skillfit.agent-preflight';
  scope: 'offline-agent-environment';
  status: 'ready' | 'blocked';
  matrix: { schemaVersion: number; verifiedAt: string };
  checks: AgentEnvironmentCheck[];
  summary: { failures: number; passed: number; unknown: number; info: number };
  cost: { modelCalls: 0; cliInvocations: 0 };
}

/** Validate saved metadata without consulting today's machine or implying login. */
export function assertRecordedAgentEnvironment(value: unknown): asserts value is AgentEnvironmentPreflight {
  const p = value as AgentEnvironmentPreflight | null;
  if (!p || p.schemaVersion !== 1 || p.kind !== 'skillfit.agent-preflight' || p.scope !== 'offline-agent-environment' ||
    p.status !== 'ready' || p.cost?.modelCalls !== 0 || p.cost?.cliInvocations !== 0 || !Array.isArray(p.checks) || !p.checks.length ||
    !p.matrix || !Number.isSafeInteger(p.matrix.schemaVersion) || typeof p.matrix.verifiedAt !== 'string') throw new Error('Invalid recorded Agent environment preflight.');
  for (const check of p.checks) {
    if (!check || !['PASS', 'UNKNOWN', 'INFO'].includes(check.status) || !['agent', 'judge'].includes(check.role) ||
      typeof check.code !== 'string' || typeof check.message !== 'string' || !Array.isArray(check.paths) || check.paths.some(path => typeof path !== 'string') ||
      (check.agent !== null && typeof check.agent !== 'string') || (check.remediation !== null && typeof check.remediation !== 'string') ||
      (check.code === 'AUTHENTICATION' && (check.status !== 'UNKNOWN' || check.paths.length))) throw new Error('Invalid recorded Agent environment check.');
  }
  if (!p.checks.some(check => check.role === 'agent' && check.code === 'AUTHENTICATION')) throw new Error('Recorded Agent preflight has no primary agent.');
  for (const role of new Set(p.checks.map(check => check.role))) if (!p.checks.some(check => check.role === role && check.code === 'AUTHENTICATION' && check.status === 'UNKNOWN')) {
    throw new Error('Recorded Agent preflight must retain unknown offline authentication.');
  }
  if (!p.summary || p.summary.failures !== 0 || p.summary.passed !== p.checks.filter(check => check.status === 'PASS').length ||
    p.summary.unknown !== p.checks.filter(check => check.status === 'UNKNOWN').length || p.summary.info !== p.checks.filter(check => check.status === 'INFO').length) {
    throw new Error('Recorded Agent preflight summary is inconsistent.');
  }
}

/** Human reports omit local paths; JSON retains the original saved checks. */
export function agentEnvironmentReportLines(value: unknown): string[] {
  if (value == null) return [];
  try { assertRecordedAgentEnvironment(value); }
  catch { return ['Agent preflight: invalid/unverified saved metadata; inspect the JSON record.']; }
  return [`Agent preflight: ${value.status}; ${value.summary.unknown} unknown check(s); authentication remains unknown offline.`,
    ...value.checks.map(check => `[${check.status}] ${check.role}/${check.code}: ${check.message}`)];
}
