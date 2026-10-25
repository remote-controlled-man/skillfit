import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpendingBudget, spendingBudgetState } from '../../agents/call-budget.js';
export * from '../../agents/call-budget.js';
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
