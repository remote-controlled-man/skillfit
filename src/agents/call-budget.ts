import type { Executor, ExecutorRunOptions, TokenBudgetLimits } from './contracts.js';
import { COST_METRICS, invocationPopulation, type CostMetric, type CostObservation } from './accounting.js';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

/** Whole-cohort stop lines, distinct from relative adoption-policy cost caps. */
export type TokenBudget = TokenBudgetLimits;
export type SpendingBudget = TokenBudget & { durationSeconds: number | null };
export type SpendingStopCode = 'EXECUTION_FAILED' | 'FINAL_USAGE_MISSING' | 'SPENDING_BUDGET_REACHED';

/** Only controlled budget diagnostics may be copied into a durable session stop reason. */
export class SpendingBudgetStop extends Error {
  constructor(readonly code: SpendingStopCode, state: ReturnType<typeof spendingBudgetState>) {
    super(`${code}: no further agent calls; reached=${state.reached.join(',') || 'none'}, incomplete=${state.incomplete.join(',') || 'none'}. Retained spending is not discarded; no retry or replacement.`);
    this.name = 'SpendingBudgetStop';
  }
}

export function spendingStopFrom(error: unknown): SpendingBudgetStop | null {
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current) && seen.size < 8) {
    if (current instanceof SpendingBudgetStop) return current;
    seen.add(current); current = current.cause;
  }
  return null;
}

export function parseSpendingBudget(value: unknown): SpendingBudget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('spendingBudget must be an object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !COST_METRICS.includes(key as CostMetric))) throw new Error('spendingBudget has unknown fields.');
  return Object.fromEntries(COST_METRICS.map(metric => {
    const amount = input[metric];
    if (metric === 'durationSeconds' && amount === null) return [metric, null];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER ||
        (metric !== 'durationSeconds' && !Number.isSafeInteger(amount))) {
      throw new Error(`spendingBudget.${metric} must be a positive ${metric === 'durationSeconds' ? 'finite number' : 'safe integer'}.`);
    }
    return [metric, amount];
  })) as unknown as SpendingBudget;
}

export function spendingBudgetState(limits: SpendingBudget, observations: readonly CostObservation[]) {
  const counter = (value: number | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const normalized = observations.map(row => ({ ...row, tokens: row.tokens ? {
    input: counter(row.tokens.input), cachedInput: counter(row.tokens.cachedInput), output: counter(row.tokens.output),
  } : null }));
  const population = invocationPopulation(normalized.filter(row => row.executorInvoked));
  const reached = COST_METRICS.filter(metric => limits[metric] !== null && population.metrics[metric].knownTotal >= limits[metric]);
  const incomplete = COST_METRICS.filter(metric => population.metrics[metric].coverage.final !== population.runs);
  const executionFailed = observations.some(row => row.error !== null);
  const liveStop = limits.durationSeconds === null && reached.length > 0 && observations.some(row => row.budgetStop === 'SPENDING_BUDGET_REACHED');
  const reason: SpendingStopCode | null = liveStop ? 'SPENDING_BUDGET_REACHED' : executionFailed ? 'EXECUTION_FAILED' : incomplete.length ? 'FINAL_USAGE_MISSING' : reached.length ? 'SPENDING_BUDGET_REACHED' : null;
  return { schemaVersion: 1 as const, invocations: population.runs, metrics: population.metrics, reached, incomplete, reason };
}

export function assertSpendingCanContinue(state: ReturnType<typeof spendingBudgetState>): void {
  if (state.reason) throw new SpendingBudgetStop(state.reason, state);
}

export type BudgetCallIdentity = { taskId: string; trial: number } &
  ({ condition: 'baseline' | 'treatment' | 'installed' } | { role: 'judge'; callIndex: 1 | 2 } | { role: 'drafter' });

/** One serial stop-line recorder for every executor role and evaluation mode. */
export function createSpendingBudgetRecorder(options: { budget?: SpendingBudget; groupDir: string }) {
  const observations: CostObservation[] = [];
  const event = (phase: 'before-call' | 'after-call', identity: BudgetCallIdentity) => {
    if (!options.budget) return null;
    const state = spendingBudgetState(options.budget, observations);
    appendFileSync(join(options.groupDir, '_budget.jsonl'), JSON.stringify({ phase, ...identity, state }) + '\n', 'utf8');
    return state;
  };
  return {
    before(identity: BudgetCallIdentity): ExecutorRunOptions | undefined {
      const state = event('before-call', identity);
      if (state) assertSpendingCanContinue(state);
      if (state && options.budget?.durationSeconds === null) {
        const tokenBudget = Object.fromEntries((['input', 'cachedInput', 'uncachedInput', 'output'] as const).map(metric =>
          [metric, options.budget![metric] - state.metrics[metric].knownTotal])) as unknown as TokenBudget;
        return { tokenBudget };
      }
    },
    after(identity: BudgetCallIdentity, observation: CostObservation): void {
      observations.push(observation);
      const state = event('after-call', identity);
      if (state && (state.incomplete.length || state.reason === 'EXECUTION_FAILED' || observation.budgetStop !== undefined)) assertSpendingCanContinue(state);
    },
  };
}


/** Capability is checked before dispatch for every role; no implicit unlimited fallback. */
export function assertTokenBudgetSupport(executors: readonly (Executor | null)[], timeout: number | null | undefined, budget?: SpendingBudget): void {
  if (timeout === null && budget?.durationSeconds !== null) throw new Error('Disabling the Agent deadline requires explicit Token-only spending limits (durationSeconds: null).');
  if (budget?.durationSeconds === null && executors.some(executor => executor && !executor.supportsLiveTokenBudget)) {
    throw new Error('Token-only spending limits require during-call usage observation on every executor role; this adapter does not support it.');
  }
}
