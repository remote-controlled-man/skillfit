import { resolveEvalInputs } from "../evaluation/application/planning.js";
import { executeEvalPlan } from '../composition.js';
import { evaluationPlanLines, evaluationPresentation } from "./eval-display.js";
import type { EvalOptions } from "../evaluation/application/options.js";
import type { RunManifest } from "../evaluation/measurement/report.js";
import type { TriggerManifest } from "../evaluation/execution/activation.js";
export { DEFAULT_EVAL_TRIALS, type EvalOptions, type EvalPreview } from "../evaluation/application/options.js";

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
