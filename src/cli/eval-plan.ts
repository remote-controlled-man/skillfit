import { prepareEvaluation } from "../evaluation/application/planning.js";
import { evaluationPlanLines } from "./eval-display.js";
import type { EvalOptions } from "../evaluation/application/options.js";
export { confirmEvalPlan, plannedEvalResult } from "../evaluation/application/planning.js";
export type { ReviewedEvalPlan } from "../evaluation/application/options.js";

/** Compatibility adapter retains lines/options/assertCurrent without command dry-run capture. */
export async function prepareEvalPlan<T extends object>(options: EvalOptions, context: T) {
  const prepared = prepareEvaluation(options, { kind: 'legacy', fields: context });
  return { plan: prepared.plan, lines: evaluationPlanLines(prepared.resolved), options: prepared.options, assertCurrent: prepared.assertCurrent };
}
