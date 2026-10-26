import { COST_METRICS, invocationPopulation as population, completeCost, type CostMetric, type CostObservation, type CostPopulation } from '../../agents/accounting.js';
export { COST_METRICS, completeCost, type CostMetric, type CostObservation, type CostMeasure, type CostPopulation } from '../../agents/accounting.js';
import { CONDITIONS } from "./paired-contract.js";
import { type Condition } from "../../resources/contracts.js";

export interface RunCosts {
  schemaVersion: 1;
  paired: Record<Condition, CostPopulation>;
  attempts: Record<Condition, CostPopulation>;
  notInvoked: Record<Condition, number>;
}

/** Quality uses surviving pairs. Spending also includes errors and the dropped successful partner. */
export function summarizeCosts(
  outcomes: Record<Condition, readonly CostObservation[]>,
  survivors: Record<Condition, readonly CostObservation[]>,
): RunCosts {
  return {
    schemaVersion: 1,
    paired: { baseline: population(survivors.baseline), treatment: population(survivors.treatment) },
    attempts: {
      baseline: population(outcomes.baseline.filter(r => r.executorInvoked)),
      treatment: population(outcomes.treatment.filter(r => r.executorInvoked)),
    },
    notInvoked: {
      baseline: outcomes.baseline.filter(r => !r.executorInvoked).length,
      treatment: outcomes.treatment.filter(r => !r.executorInvoked).length,
    },
  };
}

const METRIC_LABELS: Record<CostMetric, string> = {
  input: 'Input tokens', cachedInput: 'Cached input tokens', uncachedInput: 'Uncached input tokens',
  output: 'Output tokens', durationSeconds: 'Elapsed seconds',
};

function totalLabel(value: CostPopulation, metric: CostMetric, perSuccess: boolean): string {
  const measure = value.metrics[metric];
  if (perSuccess && value.passes === 0) return 'n/a (no successes)';
  if (value.runs === 0 || measure.coverage.final + measure.coverage.partial === 0) return 'unrecorded';
  const amount = measure.knownTotal / (perSuccess ? value.passes : 1);
  const formatted = metric === 'durationSeconds' || perSuccess ? amount.toFixed(3) : String(amount);
  return `${completeCost(value, metric) ? '' : '>= '}${formatted}`;
}

function deltaLabel(baseline: CostPopulation, treatment: CostPopulation, metric: CostMetric, perSuccess: boolean): string {
  if (!completeCost(baseline, metric) || !completeCost(treatment, metric) ||
      (perSuccess && (baseline.passes === 0 || treatment.passes === 0))) return 'n/a';
  const base = baseline.metrics[metric].knownTotal / (perSuccess ? baseline.passes : 1);
  const target = treatment.metrics[metric].knownTotal / (perSuccess ? treatment.passes : 1);
  if (base === 0) return 'n/a (zero baseline)';
  const delta = (target / base - 1) * 100;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

/** Shared English rows for the terminal summary and portable Markdown report. */
export function renderCostLines(costs: RunCosts): string[] {
  const lines: string[] = [];
  for (const scope of ['paired', 'attempts'] as const) {
    const { baseline, treatment } = costs[scope];
    lines.push(scope === 'paired' ? 'Surviving graded pairs:' : 'All agent executor invocations (including failures and excluded partners):');
    lines.push(`- Runs B/T: ${baseline.runs}/${treatment.runs}; successful tasks B/T: ${baseline.passes}/${treatment.passes}`);
    lines.push('', '| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |',
      '|---|---:|---:|---:|---|---:|---|');
    for (const metric of COST_METRICS) {
      const coverage = (value: CostPopulation): string => {
        const c = value.metrics[metric].coverage;
        return `${c.final}/${c.partial}/${c.unknown}`;
      };
      lines.push(`| ${METRIC_LABELS[metric]} | ${totalLabel(baseline, metric, false)} | ${totalLabel(treatment, metric, false)} | ${deltaLabel(baseline, treatment, metric, false)} | ${totalLabel(baseline, metric, true)} / ${totalLabel(treatment, metric, true)} | ${deltaLabel(baseline, treatment, metric, true)} | ${coverage(baseline)} / ${coverage(treatment)} |`);
    }
    lines.push('');
  }
  lines.push(`- Not invoked B/T: ${costs.notInvoked.baseline}/${costs.notInvoked.treatment} (guard/setup refusals; excluded from spending totals).`);
  lines.push('- Cached input is included in input. Uncached input = input - cached input; unrecorded cache usage is unknown, never zero.');
  lines.push('- Per success = all spending in that population / successful tasks, including graded failures. >= marks a known lower bound; incomplete usage suppresses changes.');
  lines.push('- Descriptive agent usage and elapsed time only; no billing estimate, cost significance claim, or judge usage included.');
  return lines;
}

/** Compare task sums to pooled costs without recomputing rounded rates. */
export function assertCostTotals(overall: RunCosts, tasks: readonly RunCosts[]): void {
  for (const condition of CONDITIONS) {
    if (overall.notInvoked[condition] !== tasks.reduce((sum, t) => sum + t.notInvoked[condition], 0)) throw new Error('costs.notInvoked disagrees with task totals');
    for (const scope of ['paired', 'attempts'] as const) {
      const pooled = overall[scope][condition];
      for (const field of ['runs', 'passes'] as const) {
        if (pooled[field] !== tasks.reduce((sum, t) => sum + t[scope][condition][field], 0)) throw new Error(`costs.${scope}.${condition}.${field} disagrees with task totals`);
      }
      for (const metric of COST_METRICS) {
        const total = tasks.reduce((sum, t) => sum + t[scope][condition].metrics[metric].knownTotal, 0);
        if (Math.abs(total - pooled.metrics[metric].knownTotal) > 1e-6) throw new Error(`costs.${scope}.${condition}.${metric} disagrees with task totals`);
        for (const status of ['final', 'partial', 'unknown'] as const) {
          if (pooled.metrics[metric].coverage[status] !== tasks.reduce((sum, t) => sum + t[scope][condition].metrics[metric].coverage[status], 0)) throw new Error(`costs.${scope}.${condition}.${metric}.coverage disagrees with task totals`);
        }
      }
    }
  }
}
