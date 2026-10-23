import { resolveEvalInputs } from '../harness/eval-planning.js';
import { executeEvalPlan } from '../harness/eval-service.js';
import { evaluationPlanLines, evaluationPresentation } from './eval-display.js';
import type { EvalOptions } from '../harness/eval-options.js';
import type { RunManifest } from '../harness/report.js';
import type { TriggerManifest } from '../harness/trigger.js';
export { DEFAULT_EVAL_TRIALS, type EvalOptions, type EvalPreview } from '../harness/eval-options.js';

/** Legacy entry keeps dry-run null and human display; application operations own planning/dispatch. */
export async function runEval(options: EvalOptions): Promise<RunManifest | TriggerManifest | null> {
  const log = options.log ?? console.log;
  const resolved = resolveEvalInputs({ ...options, log });
  if (options.dryRun) {
    options.onPlan?.(resolved.preview);
    for (const line of evaluationPlanLines(resolved)) log(line);
    return null;
  }
  return executeEvalPlan(resolved, undefined, evaluationPresentation(log));
}
