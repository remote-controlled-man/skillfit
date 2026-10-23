import { runEvaluation } from '../harness/eval-service.js';
import { evaluationPresentation } from './eval-display.js';
import type { EvalOptions } from '../harness/eval-options.js';

/** Preserve each entry's confirmation and display contract. */
export async function runEvalCli(options: EvalOptions, expectedPlanSha256?: string, context: object = {}) {
  const log = options.dryRun ? options.log : options.log ?? console.log;
  return runEvaluation({ ...options, log }, expectedPlanSha256, { kind: 'legacy', fields: context }, evaluationPresentation(log));
}
