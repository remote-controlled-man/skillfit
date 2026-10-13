import { CONDITIONS } from './types.js';
export const COST_METRICS = ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds'];
function count(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function metricValue(record, metric) {
    if (metric === 'durationSeconds')
        return count(record.durationSeconds);
    if (record.usageStatus === 'unknown')
        return undefined;
    const input = count(record.tokens?.input);
    const cached = count(record.tokens?.cachedInput);
    if (metric === 'cachedInput' || metric === 'uncachedInput') {
        // A cache count without a compatible input total cannot establish a partition.
        if (input === undefined || cached === undefined || cached > input)
            return undefined;
        return metric === 'cachedInput' ? cached : input - cached;
    }
    return count(record.tokens?.[metric]);
}
function population(records) {
    const metrics = Object.fromEntries(COST_METRICS.map(metric => {
        const measure = { knownTotal: 0, coverage: { final: 0, partial: 0, unknown: 0 } };
        for (const record of records) {
            const value = metricValue(record, metric);
            const status = value === undefined ? 'unknown' : metric === 'durationSeconds' ? 'final' : record.usageStatus;
            measure.coverage[status]++;
            if (value !== undefined)
                measure.knownTotal += value;
        }
        return [metric, measure];
    }));
    return { runs: records.length, passes: records.filter(r => r.error === null && r.passed).length, metrics };
}
/** Quality uses surviving pairs. Spending also includes errors and the dropped successful partner. */
export function summarizeCosts(outcomes, survivors) {
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
export function completeCost(population, metric) {
    return population.runs > 0 && population.metrics[metric].coverage.final === population.runs;
}
const METRIC_LABELS = {
    input: 'Input tokens', cachedInput: 'Cached input tokens', uncachedInput: 'Uncached input tokens',
    output: 'Output tokens', durationSeconds: 'Elapsed seconds',
};
function totalLabel(value, metric, perSuccess) {
    const measure = value.metrics[metric];
    if (perSuccess && value.passes === 0)
        return 'n/a (no successes)';
    if (value.runs === 0 || measure.coverage.final + measure.coverage.partial === 0)
        return 'unrecorded';
    const amount = measure.knownTotal / (perSuccess ? value.passes : 1);
    const formatted = metric === 'durationSeconds' || perSuccess ? amount.toFixed(3) : String(amount);
    return `${completeCost(value, metric) ? '' : '>= '}${formatted}`;
}
function deltaLabel(baseline, treatment, metric, perSuccess) {
    if (!completeCost(baseline, metric) || !completeCost(treatment, metric) ||
        (perSuccess && (baseline.passes === 0 || treatment.passes === 0)))
        return 'n/a';
    const base = baseline.metrics[metric].knownTotal / (perSuccess ? baseline.passes : 1);
    const target = treatment.metrics[metric].knownTotal / (perSuccess ? treatment.passes : 1);
    if (base === 0)
        return 'n/a (zero baseline)';
    const delta = (target / base - 1) * 100;
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
}
/** Shared English rows for the terminal summary and portable Markdown report. */
export function renderCostLines(costs) {
    const lines = [];
    for (const scope of ['paired', 'attempts']) {
        const { baseline, treatment } = costs[scope];
        lines.push(scope === 'paired' ? 'Surviving graded pairs:' : 'All agent executor invocations (including failures and excluded partners):');
        lines.push(`- Runs B/T: ${baseline.runs}/${treatment.runs}; successful tasks B/T: ${baseline.passes}/${treatment.passes}`);
        lines.push('', '| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |', '|---|---:|---:|---:|---|---:|---|');
        for (const metric of COST_METRICS) {
            const coverage = (value) => {
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
export function assertCostTotals(overall, tasks) {
    for (const condition of CONDITIONS) {
        if (overall.notInvoked[condition] !== tasks.reduce((sum, t) => sum + t.notInvoked[condition], 0))
            throw new Error('costs.notInvoked disagrees with task totals');
        for (const scope of ['paired', 'attempts']) {
            const pooled = overall[scope][condition];
            for (const field of ['runs', 'passes']) {
                if (pooled[field] !== tasks.reduce((sum, t) => sum + t[scope][condition][field], 0))
                    throw new Error(`costs.${scope}.${condition}.${field} disagrees with task totals`);
            }
            for (const metric of COST_METRICS) {
                const total = tasks.reduce((sum, t) => sum + t[scope][condition].metrics[metric].knownTotal, 0);
                if (Math.abs(total - pooled.metrics[metric].knownTotal) > 1e-6)
                    throw new Error(`costs.${scope}.${condition}.${metric} disagrees with task totals`);
                for (const status of ['final', 'partial', 'unknown']) {
                    if (pooled.metrics[metric].coverage[status] !== tasks.reduce((sum, t) => sum + t[scope][condition].metrics[metric].coverage[status], 0))
                        throw new Error(`costs.${scope}.${condition}.${metric}.coverage disagrees with task totals`);
                }
            }
        }
    }
}
