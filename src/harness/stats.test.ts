import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MIN_DISCORDANT_FOR_SIGNIFICANCE,
  mcnemarExactP,
  pairedDeltaBootstrapCI,
  pairedScoreBootstrapCI,
  wilson95,
} from './stats.js';

test('mcnemarExactP matches reference values', () => {
  assert.equal(mcnemarExactP(6, 0), 0.03125);
  assert.equal(mcnemarExactP(5, 0), 0.0625);
  assert.equal(mcnemarExactP(9, 0), 0.00390625);
  assert.equal(mcnemarExactP(3, 3), 1);
  assert.equal(mcnemarExactP(0, 0), 1);
});

/** Independent integer binomial coefficients; truncate at 64 bits before binary64 conversion. */
function integerReferenceP(b: number, c: number): number {
  const n = b + c;
  let coefficient = 1n, lowerTail = 1n;
  for (let i = 1; i <= Math.min(b, c); i++) {
    coefficient = coefficient * BigInt(n - i + 1) / BigInt(i);
    lowerTail += coefficient;
  }
  return Math.min(1, Number((2n * lowerTail << 64n) / (1n << BigInt(n))) / 2 ** 64);
}

test('mcnemarExactP remains accurate across the normal/subnormal and legacy zero boundaries', () => {
  for (const n of [1022, 1023, 1074, 1075, 1200, 2000, 20000]) {
    for (const offset of [0, 1, 5, 25, 45]) {
      const b = Math.ceil(n / 2) + offset, c = n - b;
      const actual = mcnemarExactP(b, c), expected = integerReferenceP(b, c);
      assert.ok(Math.abs(actual - expected) < 5e-13, `${b}/${c}: ${actual} versus ${expected}`);
      assert.equal(actual, mcnemarExactP(c, b));
      assert.ok(actual >= 0 && actual <= 1);
    }
  }
  assert.equal(mcnemarExactP(600, 600), 1);
  assert.ok(Math.abs(mcnemarExactP(601, 599) - 0.9769718547313974) < 5e-15);
  assert.ok(Math.abs(mcnemarExactP(50001, 49999) - integerReferenceP(50001, 49999)) < 5e-13);
});

test('mcnemarExactP preserves representable tiny tails and permits genuine floating-point underflow', () => {
  for (const n of [1022, 1023, 1074, 1075, 1076, 2000]) {
    assert.equal(mcnemarExactP(n, 0), 2 ** (1 - n));
    assert.equal(mcnemarExactP(0, n), 2 ** (1 - n));
  }
  for (const n of [1074, 1075, 1076, 1080, 1085, 1100]) {
    // The two-term integer tail is 2*(1+n)/2^n. Scale from the smallest
    // subnormal to avoid the reference itself losing 2^-n before multiplication.
    const expected = Number.MIN_VALUE * (n + 1) / 2 ** (n - 1075);
    const actual = mcnemarExactP(n - 1, 1);
    assert.ok(Math.abs(actual - expected) <= Number.MIN_VALUE, `${n - 1}/1: ${actual} versus ${expected}`);
  }
});

test('mcnemarExactP stays monotonic with increasing imbalance at a fixed large pair count', () => {
  let previous = 1;
  for (let b = 600; b <= 1200; b++) {
    const p = mcnemarExactP(b, 1200 - b);
    assert.ok(p <= previous, `${b}/${1200 - b}: ${p} exceeds ${previous}`);
    previous = p;
  }
});

test('mcnemarExactP keeps exact-test decisions on both sides of 0.05', () => {
  for (const b of [1043, 1044, 1045, 1046]) {
    const expected = integerReferenceP(b, 2000 - b);
    assert.equal(mcnemarExactP(b, 2000 - b) < 0.05, expected < 0.05);
  }
  assert.ok(integerReferenceP(1044, 956) > 0.05);
  assert.ok(integerReferenceP(1045, 955) < 0.05);
});

test('mcnemarExactP rejects invalid or unsafe discordant counts', () => {
  for (const [b, c] of [[-1, 1], [1, -1], [0.5, 1], [NaN, 1], [1, Infinity], [2 ** 53, 0], [Number.MAX_SAFE_INTEGER, 1]]) {
    assert.throws(() => mcnemarExactP(b!, c!), RangeError);
  }
});

test('mcnemarExactP never increases as discordance grows more one-sided', () => {
  let previous = 1;
  for (let k = 1; k <= 15; k++) {
    const p = mcnemarExactP(k, 0);
    assert.ok(p <= previous, `p(${k},0)=${p} exceeds p(${k - 1},0)=${previous}`);
    assert.equal(mcnemarExactP(0, k), p);
    previous = p;
  }
});

test('MIN_DISCORDANT_FOR_SIGNIFICANCE is the first discordant count reaching p < 0.05', () => {
  assert.equal(MIN_DISCORDANT_FOR_SIGNIFICANCE, 6);
  assert.ok(mcnemarExactP(MIN_DISCORDANT_FOR_SIGNIFICANCE, 0) < 0.05);
  assert.ok(mcnemarExactP(MIN_DISCORDANT_FOR_SIGNIFICANCE - 1, 0) >= 0.05);
});

function task(baseline: boolean[], treatment: boolean[]) {
  return { baseline, treatment };
}

function scoreTask(baseline: number[], treatment: number[]) {
  return { baseline, treatment };
}

const SAMPLE_TASKS = [
  task([true, false, true, false, true], [true, true, true, false, true]),
  task([false, false, true, false, false], [true, false, true, true, false]),
  task([true, true, false, true, false], [true, true, true, true, true]),
  task([false, true, false, false, true], [false, true, true, false, true]),
  task([true, false, false, false, false], [true, false, true, false, true]),
  task([false, false, false, true, false], [true, false, false, true, true]),
  task([true, true, true, false, false], [true, true, false, true, true]),
  task([false, false, false, false, false], [false, true, false, false, true]),
];

test('pairedDeltaBootstrapCI is deterministic for a fixed seed', () => {
  const first = pairedDeltaBootstrapCI(SAMPLE_TASKS);
  const second = pairedDeltaBootstrapCI(SAMPLE_TASKS);
  assert.deepEqual(first, second);
});

test('pairedDeltaBootstrapCI brackets the pooled delta', () => {
  const result = pairedDeltaBootstrapCI(SAMPLE_TASKS, { resamples: 500 });
  assert.ok(result !== null);
  assert.equal(result.resamples, 500);
  assert.equal(result.point, 27 / 40 - 14 / 40);
  assert.ok(result.lo <= result.point);
  assert.ok(result.point <= result.hi);
});

test('pairedDeltaBootstrapCI returns a positive lower bound when treatment always wins', () => {
  const tasks = Array.from({ length: 8 }, () => task([false, false, false], [true, true, true]));
  const result = pairedDeltaBootstrapCI(tasks);
  assert.ok(result !== null);
  assert.equal(result.point, 1);
  assert.ok(result.lo > 0);
});

test('pairedDeltaBootstrapCI returns null when there are no trials', () => {
  assert.equal(pairedDeltaBootstrapCI([]), null);
  assert.equal(pairedDeltaBootstrapCI([task([], [])]), null);
});

test('pairedDeltaBootstrapCI stays finite when some tasks have no graded survivors', () => {
  const graded = task([false, true], [true, true]);
  const empty = task([], []);
  for (let seed = 1; seed <= 40; seed++) {
    const mixed = pairedDeltaBootstrapCI([empty, graded], { seed, resamples: 300 });
    const only = pairedDeltaBootstrapCI([graded], { seed, resamples: 300 });
    assert.ok(mixed);
    assert.ok(only);
    assert.equal(Number.isFinite(mixed.lo) && Number.isFinite(mixed.hi), true);
    assert.equal(mixed.point, only.point);
  }
});

test('wilson95 handles empty and saturated arms', () => {
  assert.deepEqual(wilson95(0, 0), { lo: 0, hi: 1 });
  const zero = wilson95(0, 3);
  assert.equal(zero.lo, 0);
  assert.ok(zero.hi > 0.4 && zero.hi < 0.7, `hi=${zero.hi}`);
  const full = wilson95(3, 3);
  assert.ok(full.lo > 0.3 && full.lo < 0.6, `lo=${full.lo}`);
  assert.equal(full.hi, 1);
});

const SAMPLE_SCORE_TASKS = [
  scoreTask([0.5, 0.75], [1, 1]),
  scoreTask([0.25, 0.5], [0.75, 1]),
  scoreTask([1, 0.5], [1, 1]),
  scoreTask([0, 0.25], [0.5, 0.75]),
];

test('pairedScoreBootstrapCI is deterministic for a fixed seed', () => {
  const first = pairedScoreBootstrapCI(SAMPLE_SCORE_TASKS);
  const second = pairedScoreBootstrapCI(SAMPLE_SCORE_TASKS);
  assert.deepEqual(first, second);
});

test('pairedScoreBootstrapCI brackets the pooled score delta', () => {
  const result = pairedScoreBootstrapCI(SAMPLE_SCORE_TASKS, { resamples: 500 });
  assert.ok(result !== null);
  assert.equal(result.resamples, 500);
  const baselineMean = (0.5 + 0.75 + 0.25 + 0.5 + 1 + 0.5 + 0 + 0.25) / 8;
  const treatmentMean = (1 + 1 + 0.75 + 1 + 1 + 1 + 0.5 + 0.75) / 8;
  assert.equal(result.point, treatmentMean - baselineMean);
  assert.ok(result.lo <= result.point);
  assert.ok(result.point <= result.hi);
});

test('pairedScoreBootstrapCI returns a positive lower bound when treatment always outscores', () => {
  const tasks = Array.from({ length: 8 }, () => scoreTask([0.2, 0.4], [0.8, 1]));
  const result = pairedScoreBootstrapCI(tasks);
  assert.ok(result !== null);
  assert.ok(result.point > 0);
  assert.ok(result.lo > 0);
});

test('pairedScoreBootstrapCI matches pairedDeltaBootstrapCI on 0/1 inputs', () => {
  const asScores = SAMPLE_TASKS.map((t) => ({
    baseline: t.baseline.map((pass) => (pass ? 1 : 0)),
    treatment: t.treatment.map((pass) => (pass ? 1 : 0)),
  }));
  assert.deepEqual(pairedScoreBootstrapCI(asScores), pairedDeltaBootstrapCI(SAMPLE_TASKS));
});

test('pairedScoreBootstrapCI returns null when there are no scored trials', () => {
  assert.equal(pairedScoreBootstrapCI([]), null);
  assert.equal(pairedScoreBootstrapCI([scoreTask([], [])]), null);
});
