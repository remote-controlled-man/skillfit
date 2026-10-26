import type { Condition } from "../../resources/contracts.js";
export type PairOrder = 'baseline-first' | 'balanced';


/** Keep each pair adjacent; alternate the first arm across both tasks and trials. */
export function pairConditions(order: PairOrder, taskIndex: number, trial: number): readonly Condition[] {
  return order === 'balanced' && (taskIndex + trial - 1) % 2 === 1
    ? ['treatment', 'baseline'] : ['baseline', 'treatment'];
}

export type InputMode = 'snapshot' | 'workspace';


export const CONDITIONS: readonly Condition[] = ['baseline', 'treatment'];
