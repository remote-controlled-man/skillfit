import { BenchClaimUnsupported } from '../harness/measurement-scope.js';
import { RecordedStatisticsNumericError } from '../harness/eval-manifest.js';
import { CasePreflightFailed } from '../harness/eval-preflight.js';
import { AgentPreflightFailed } from '../harness/agent-preflight.js';
import { runComponentEvaluation } from '../harness/eval-service.js';
import { evaluationPresentation } from './eval-display.js';
import type { ComponentRunOptions } from '../harness/eval-options.js';
export { readEvaluation as reportEvalComponent } from '../harness/eval-read-service.js';
export type { EvalReportOptions, ComponentRunOptions } from '../harness/eval-options.js';

export function componentError(error: unknown, code = 'INVALID_OR_FAILED_EVALUATION') {
  const numericError = error instanceof RecordedStatisticsNumericError ? error : null;
  return { schemaVersion: 1, kind: 'skillfit.eval-error', status: 'error',
    error: { code: numericError?.code ?? (error instanceof BenchClaimUnsupported ? error.code : error instanceof CasePreflightFailed ? 'CASE_PREFLIGHT_FAILED' : error instanceof AgentPreflightFailed ? 'AGENT_PREFLIGHT_FAILED' : code),
      message: error instanceof Error ? error.message : String(error), ...(numericError ? { details: numericError.details } : {}) },
    ...(error instanceof AgentPreflightFailed ? { agentPreflight: error.agentPreflight } : {}),
    ...(error instanceof CasePreflightFailed ? { casePreflight: error.preflight } : {}),
    acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false } };
}

export async function runEvalComponent(requestPath: string, options: ComponentRunOptions) {
  return runComponentEvaluation(requestPath, options, evaluationPresentation(options.log));
}
