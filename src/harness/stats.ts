export const MIN_DISCORDANT_FOR_SIGNIFICANCE = 6;

export function mcnemarExactP(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.max(b, c);
  let tail = 0;
  let term = 0.5 ** n;
  for (let i = 0; i <= n; i++) {
    if (i >= k) tail += term;
    term *= (n - i) / (i + 1);
  }
  return Math.min(1, 2 * tail);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PairedOutcomes {
  baseline: boolean[];
  treatment: boolean[];
}

export interface PairedScores {
  baseline: number[];
  treatment: number[];
}

function pooledDelta(tasks: readonly PairedScores[]): number {
  let baselineSum = 0;
  let baselineTrials = 0;
  let treatmentSum = 0;
  let treatmentTrials = 0;
  for (const task of tasks) {
    baselineTrials += task.baseline.length;
    treatmentTrials += task.treatment.length;
    for (const value of task.baseline) baselineSum += value;
    for (const value of task.treatment) treatmentSum += value;
  }
  return treatmentSum / treatmentTrials - baselineSum / baselineTrials;
}

function pairedBootstrapCI(
  tasks: readonly PairedScores[],
  options: { resamples?: number; alpha?: number; seed?: number } = {},
): { point: number; lo: number; hi: number; resamples: number } | null {
  const resamples = options.resamples ?? 2000;
  const alpha = options.alpha ?? 0.05;
  const seed = options.seed ?? 20260919;
  const totalTrials = tasks.reduce(
    (sum, task) => sum + task.baseline.length + task.treatment.length,
    0,
  );
  if (totalTrials === 0) return null;
  const point = pooledDelta(tasks);
  const rand = mulberry32(seed);
  const deltas: number[] = [];
  for (let r = 0; r < resamples; r++) {
    const sample: PairedScores[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const picked = tasks[Math.floor(rand() * tasks.length)];
      if (picked !== undefined) sample.push(picked);
    }
    deltas.push(pooledDelta(sample));
  }
  deltas.sort((x, y) => x - y);
  const percentile = (q: number): number => {
    const index = Math.min(deltas.length - 1, Math.max(0, Math.floor(q * deltas.length)));
    return deltas[index] ?? 0;
  };
  return { point, lo: percentile(alpha / 2), hi: percentile(1 - alpha / 2), resamples };
}

export function pairedDeltaBootstrapCI(
  tasks: PairedOutcomes[],
  options: { resamples?: number; alpha?: number; seed?: number } = {},
): { point: number; lo: number; hi: number; resamples: number } | null {
  return pairedBootstrapCI(
    tasks.map((task) => ({
      baseline: task.baseline.map((pass) => (pass ? 1 : 0)),
      treatment: task.treatment.map((pass) => (pass ? 1 : 0)),
    })),
    options,
  );
}

export function pairedScoreBootstrapCI(
  tasks: PairedScores[],
  options: { resamples?: number; alpha?: number; seed?: number } = {},
): { point: number; lo: number; hi: number; resamples: number } | null {
  return pairedBootstrapCI(tasks, options);
}

export function wilson95(passes: number, trials: number): { lo: number; hi: number } {
  if (trials === 0) return { lo: 0, hi: 1 };
  const z = 1.96;
  const z2 = z * z;
  const p = passes / trials;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)) / denominator;
  return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) };
}
