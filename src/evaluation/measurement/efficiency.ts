import { completeCost, type RunCosts } from "./costs.js";

const RESAMPLES = 10000, SEED = 20261013;

/** Separate cost evidence; never changes the quality verdict or fills unknown usage. */
export function efficiencyEvidence(tasks: readonly { id: string; costs: RunCosts | null }[]) {
  const protocol = { metric: 'uncachedInput' as const, population: 'attempts' as const,
    denominator: 'successful task executions' as const, method: 'paired-task-percentile-bootstrap' as const,
    resamplingUnit: 'whole task blocks retaining both arms and all trials' as const,
    confidenceLevel: 0.95, resamples: RESAMPLES, seed: SEED };
  const rows = tasks.map(task => {
    const arms = task.costs?.attempts;
    if (!arms || !completeCost(arms.baseline, 'uncachedInput') || !completeCost(arms.treatment, 'uncachedInput') ||
        !arms.baseline.passes || !arms.treatment.passes || arms.baseline.metrics.uncachedInput.knownTotal <= 0) return null;
    const baseline = arms.baseline.metrics.uncachedInput.knownTotal, treatment = arms.treatment.metrics.uncachedInput.knownTotal;
    return { id: task.id, baseline, treatment, baselineSuccesses: arms.baseline.passes, treatmentSuccesses: arms.treatment.passes,
      changeFraction: (treatment / arms.treatment.passes) / (baseline / arms.baseline.passes) - 1 };
  });
  if (!rows.length || rows.some(row => row === null)) return { ...protocol, tasksCompared: 0,
    improvedTasks: 0, improvedTaskFraction: null, taskChanges: null, point: null, ci: null,
    unavailableReason: 'Every task needs final uncached-input coverage, positive baseline spending and successes in both arms.' };
  const blocks = rows as NonNullable<typeof rows[number]>[];
  const ratio = (selected: readonly typeof blocks[number][]) => {
    let b = 0, t = 0, bs = 0, ts = 0;
    for (const row of selected) { b += row.baseline; t += row.treatment; bs += row.baselineSuccesses; ts += row.treatmentSuccesses; }
    return (t / ts) / (b / bs) - 1;
  };
  let state = SEED >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const samples: number[] = [];
  for (let n = 0; n < RESAMPLES; n++) {
    const selected = Array.from({ length: blocks.length }, () => blocks[Math.floor(random() * blocks.length)]!);
    samples.push(ratio(selected));
  }
  samples.sort((a, b) => a - b);
  const improvedTasks = blocks.filter(row => row.changeFraction < 0).length;
  return { ...protocol, tasksCompared: blocks.length, improvedTasks, improvedTaskFraction: improvedTasks / blocks.length,
    taskChanges: blocks.map(({ id, changeFraction }) => ({ id, changeFraction })), point: ratio(blocks),
    ci: { lo: samples[Math.floor(0.025 * RESAMPLES)]!, hi: samples[Math.floor(0.975 * RESAMPLES)]! }, unavailableReason: null };
}
