export { parseExecutorTimeoutSeconds } from '../../agents/timeout.js';
import { record, keys, numeric } from "../../shared/json.js";
export { record, keys, text, numeric } from "../../shared/json.js";
import { sha256Text } from '../../shared/digest.js';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS } from "./report.js";

import type { PairOrder } from "./paired-contract.js";
interface PolicyBase {
  minTasks: number;
  minTrialsPerTask: number;
  maxCostIncreaseFraction: { uncachedInput: number; output: number; durationSeconds: number };
}
export interface QualityPolicy extends PolicyBase {
  schemaVersion: 1;
  minDeltaPassRate: number;
}
export interface EfficiencyPolicy extends PolicyBase {
  schemaVersion: 2;
  objective: 'efficiency';
  minUncachedInputReductionFraction: number;
  minImprovedTaskFraction: number;
  maxCostIncreaseFraction: PolicyBase['maxCostIncreaseFraction'] & { input: number; cachedInput: number };
}
export type AcceptancePolicy = QualityPolicy | EfficiencyPolicy;
export interface ComponentMetadata {
  schemaVersion: 1;
  requestSha256: string;
  previewSha256: string;
  implementationSha256: string;
  policySha256: string;
  purpose: 'development' | 'validation';
  policy: AcceptancePolicy;
  synthetic: boolean;
}

export function parsePairOrder(value: unknown = 'baseline-first', label = 'pairOrder'): PairOrder {
  if (value !== 'baseline-first' && value !== 'balanced') throw new Error(`${label} must be baseline-first or balanced.`);
  return value;
}
export function parseAcceptancePolicy(value: unknown = {}): AcceptancePolicy {
  const p = record(value, 'policy');
  if (p.schemaVersion === 2) {
    keys(p, ['schemaVersion', 'objective', 'minTasks', 'minTrialsPerTask', 'minUncachedInputReductionFraction', 'minImprovedTaskFraction', 'maxCostIncreaseFraction'], 'policy');
    if (p.objective !== 'efficiency') throw new Error('policy.objective must be efficiency for schemaVersion 2.');
    const costs = record(p.maxCostIncreaseFraction ?? {}, 'policy.maxCostIncreaseFraction');
    keys(costs, ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds'], 'policy.maxCostIncreaseFraction');
    return {
      schemaVersion: 2, objective: 'efficiency',
      minTasks: numeric(p.minTasks ?? CONCLUSIVE_TASKS, 'policy.minTasks', CONCLUSIVE_TASKS, 10000, true),
      minTrialsPerTask: numeric(p.minTrialsPerTask ?? CONCLUSIVE_TRIALS, 'policy.minTrialsPerTask', CONCLUSIVE_TRIALS, 20, true),
      minUncachedInputReductionFraction: numeric(p.minUncachedInputReductionFraction ?? 0.1, 'policy.minUncachedInputReductionFraction', 0.01, 1),
      minImprovedTaskFraction: numeric(p.minImprovedTaskFraction ?? 0.75, 'policy.minImprovedTaskFraction', 0.75, 1),
      maxCostIncreaseFraction: {
        input: numeric(costs.input ?? 0, 'policy.maxCostIncreaseFraction.input', 0),
        cachedInput: numeric(costs.cachedInput ?? 0, 'policy.maxCostIncreaseFraction.cachedInput', 0),
        uncachedInput: numeric(costs.uncachedInput ?? 0, 'policy.maxCostIncreaseFraction.uncachedInput', 0),
        output: numeric(costs.output ?? 0, 'policy.maxCostIncreaseFraction.output', 0),
        durationSeconds: numeric(costs.durationSeconds ?? 0, 'policy.maxCostIncreaseFraction.durationSeconds', 0),
      },
    };
  }
  // Preserve the exact version-1 normalization and property order: historical
  // policy hashes bind these bytes, not just equivalent field values.
  keys(p, ['schemaVersion', 'minTasks', 'minTrialsPerTask', 'minDeltaPassRate', 'maxCostIncreaseFraction'], 'policy');
  if (p.schemaVersion !== undefined && p.schemaVersion !== 1) throw new Error('policy.schemaVersion must be 1 or 2.');
  const costs = record(p.maxCostIncreaseFraction ?? {}, 'policy.maxCostIncreaseFraction');
  keys(costs, ['uncachedInput', 'output', 'durationSeconds'], 'policy.maxCostIncreaseFraction');
  return {
    schemaVersion: 1,
    minTasks: numeric(p.minTasks ?? CONCLUSIVE_TASKS, 'policy.minTasks', CONCLUSIVE_TASKS, 10000, true),
    minTrialsPerTask: numeric(p.minTrialsPerTask ?? CONCLUSIVE_TRIALS, 'policy.minTrialsPerTask', CONCLUSIVE_TRIALS, 20, true),
    minDeltaPassRate: numeric(p.minDeltaPassRate ?? 0, 'policy.minDeltaPassRate', 0, 1),
    maxCostIncreaseFraction: {
      uncachedInput: numeric(costs.uncachedInput ?? 0, 'policy.maxCostIncreaseFraction.uncachedInput', 0),
      output: numeric(costs.output ?? 0, 'policy.maxCostIncreaseFraction.output', 0),
      durationSeconds: numeric(costs.durationSeconds ?? 0, 'policy.maxCostIncreaseFraction.durationSeconds', 0),
    },
  };
}
export function policyHash(policy: AcceptancePolicy): string { return sha256Text(JSON.stringify(policy)); }
