import { COST_METRICS, summarizeCosts, type CostMetric, type CostObservation } from './costs.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Whole-cohort stop lines, distinct from relative adoption-policy cost caps. */
export type SpendingBudget = Record<CostMetric, number>;

export function parseSpendingBudget(value: unknown): SpendingBudget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('spendingBudget must be an object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !COST_METRICS.includes(key as CostMetric))) throw new Error('spendingBudget has unknown fields.');
  return Object.fromEntries(COST_METRICS.map(metric => {
    const amount = input[metric];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER ||
        (metric !== 'durationSeconds' && !Number.isSafeInteger(amount))) {
      throw new Error(`spendingBudget.${metric} must be a positive ${metric === 'durationSeconds' ? 'finite number' : 'safe integer'}.`);
    }
    return [metric, amount];
  })) as SpendingBudget;
}

export function spendingBudgetState(limits: SpendingBudget, observations: readonly CostObservation[]) {
  const counter = (value: number | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const normalized = observations.map(row => ({ ...row, tokens: row.tokens ? {
    input: counter(row.tokens.input), cachedInput: counter(row.tokens.cachedInput), output: counter(row.tokens.output),
  } : null }));
  const population = summarizeCosts({ baseline: normalized, treatment: [] }, { baseline: [], treatment: [] }).attempts.baseline;
  const reached = COST_METRICS.filter(metric => population.metrics[metric].knownTotal >= limits[metric]);
  const incomplete = COST_METRICS.filter(metric => population.metrics[metric].coverage.final !== population.runs);
  const executionFailed = observations.some(row => row.error !== null);
  const reason = executionFailed ? 'EXECUTION_FAILED' : incomplete.length ? 'FINAL_USAGE_MISSING' : reached.length ? 'SPENDING_BUDGET_REACHED' : null;
  return { schemaVersion: 1 as const, invocations: population.runs, metrics: population.metrics, reached, incomplete, reason };
}

export function assertSpendingCanContinue(state: ReturnType<typeof spendingBudgetState>): void {
  if (state.reason) throw new Error(`${state.reason}: no further agent calls; reached=${state.reached.join(',') || 'none'}, incomplete=${state.incomplete.join(',') || 'none'}. Retained spending is not discarded; no retry or replacement.`);
}

/** Informational on stopped evidence; a completed native audit verifies every event. */
export function spendingBudgetReport(runDir: string) {
  const planPath = join(runDir, '_plan.json');
  if (!existsSync(planPath)) return null;
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { details?: { spendingBudget?: unknown } };
  if (plan.details?.spendingBudget === undefined) return null;
  const limits = parseSpendingBudget(plan.details.spendingBudget), path = join(runDir, '_budget.jsonl');
  try {
    const events = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { state: ReturnType<typeof spendingBudgetState> }) : [];
    return { limits, events: events.length, latestState: events.at(-1)?.state ?? null, readError: null };
  } catch (error) { return { limits, events: null, latestState: null, readError: String(error) }; }
}
