import type { TokenUsage } from './contracts.js';
export const COST_METRICS = ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds'] as const;
export type CostMetric = typeof COST_METRICS[number];
export interface CostObservation {
  executorInvoked: boolean;
  passed: boolean;
  error: string | null;
  durationSeconds: number;
  tokens: TokenUsage | null;
  usageStatus: 'final' | 'partial' | 'unknown';
}
export interface CostMeasure {
  /** Sum of available observations, including partial receipts. */
  knownTotal: number;
  coverage: { final: number; partial: number; unknown: number };
}
export interface CostPopulation {
  runs: number;
  passes: number;
  metrics: Record<CostMetric, CostMeasure>;
}
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function metricValue(record: CostObservation, metric: CostMetric): number | undefined {
  if (metric === 'durationSeconds') return count(record.durationSeconds);
  if (record.usageStatus === 'unknown') return undefined;
  const input = count(record.tokens?.input);
  const cached = count(record.tokens?.cachedInput);
  if (metric === 'cachedInput' || metric === 'uncachedInput') {
    // A cache count without a compatible input total cannot establish a partition.
    if (input === undefined || cached === undefined || cached > input) return undefined;
    return metric === 'cachedInput' ? cached : input - cached;
  }
  return count(record.tokens?.[metric]);
}
export function invocationPopulation(records: readonly CostObservation[]): CostPopulation {
  const metrics = Object.fromEntries(COST_METRICS.map(metric => {
    const measure: CostMeasure = { knownTotal: 0, coverage: { final: 0, partial: 0, unknown: 0 } };
    for (const record of records) {
      const value = metricValue(record, metric);
      const status = value === undefined ? 'unknown' : metric === 'durationSeconds' ? 'final' : record.usageStatus;
      measure.coverage[status]++;
      if (value !== undefined) measure.knownTotal += value;
    }
    return [metric, measure];
  })) as Record<CostMetric, CostMeasure>;
  return { runs: records.length, passes: records.filter(r => r.error === null && r.passed).length, metrics };
}
export function completeCost(population: CostPopulation, metric: CostMetric): boolean {
  return population.runs > 0 && population.metrics[metric].coverage.final === population.runs;
}
