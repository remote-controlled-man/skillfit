export const MIN_DISCORDANT_FOR_SIGNIFICANCE = 6;

export function mcnemarExactP(b: number, c: number): number {
  const n = b + c;
  if (!Number.isSafeInteger(b) || b < 0 || !Number.isSafeInteger(c) || c < 0 || !Number.isSafeInteger(n)) {
    throw new RangeError('Discordant counts and their sum must be non-negative safe integers.');
  }
  if (n === 0) return 1;
  // With no discordance in one direction, the two-sided tail is exactly 2^(1-n).
  if (b === 0 || c === 0) return 2 ** (1 - n);
  const k = Math.max(b, c);
  if (n <= 1022) {
    // Retain the existing small-sample values while the initial mass is normal binary64.
    let tail = 0;
    let term = 0.5 ** n;
    for (let i = 0; i <= n; i++) {
      if (i >= k) tail += term;
      term *= (n - i) / (i + 1);
    }
    return Math.min(1, 2 * tail);
  }

  // Scale the upper mode to 1 instead of starting at 2^-n (zero at n >= 1075).
  // All subsequent weights decrease. Symmetry supplies the normalizer without
  // factorials, large coefficients or subtracting an almost-one lower tail.
  const mode = Math.ceil(n / 2);
  if (k === mode) return 1;
  let term = 1, half = 1, tail = 0;
  for (let i = mode + 1; i <= n; i++) {
    term *= (n - i + 1) / i;
    if (term === 0) break; // Later terms can only be smaller; true tiny tails may round to zero.
    half += term;
    if (i >= k) tail += term;
  }
  return Math.min(1, 2 * tail / (2 * half - (n % 2 === 0 ? 1 : 0)));
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

function gradedTasks(tasks: readonly PairedScores[]): PairedScores[] {
  return tasks.filter((task) => task.baseline.length > 0 && task.treatment.length > 0);
}

function pooledDelta(tasks: readonly PairedScores[]): number {
  let baselineSum = 0;
  let baselineTrials = 0;
  let treatmentSum = 0;
  let treatmentTrials = 0;
  for (const task of gradedTasks(tasks)) {
    baselineTrials += task.baseline.length;
    treatmentTrials += task.treatment.length;
    for (const value of task.baseline) baselineSum += value;
    for (const value of task.treatment) treatmentSum += value;
  }
  if (baselineTrials === 0 || treatmentTrials === 0) return Number.NaN;
  return treatmentSum / treatmentTrials - baselineSum / baselineTrials;
}

function pairedBootstrapCI(
  tasks: readonly PairedScores[],
  options: { resamples?: number; alpha?: number; seed?: number } = {},
): { point: number; lo: number; hi: number; resamples: number } | null {
  const resamples = options.resamples ?? 2000;
  const alpha = options.alpha ?? 0.05;
  const seed = options.seed ?? 20260919;
  // A task whose surviving pairs were all excluded has no graded trials. Leaving it in the
  // resample pool makes a draw of only those tasks divide by zero. It does not change the point
  // estimate, so drop it before resampling.
  const graded = gradedTasks(tasks);
  if (graded.length === 0) return null;
  const point = pooledDelta(graded);
  const rand = mulberry32(seed);
  const deltas: number[] = [];
  for (let r = 0; r < resamples; r++) {
    const sample: PairedScores[] = [];
    for (let i = 0; i < graded.length; i++) {
      const picked = graded[Math.floor(rand() * graded.length)];
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
