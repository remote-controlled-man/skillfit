import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MIN_DISCORDANT_FOR_SIGNIFICANCE,
  mcnemarExactP,
  pairedDeltaBootstrapCI,
  wilson95,
} from './stats.js';

test('mcnemarExactP matches reference values', () => {
  assert.equal(mcnemarExactP(6, 0), 0.03125);
  assert.equal(mcnemarExactP(5, 0), 0.0625);
  assert.equal(mcnemarExactP(9, 0), 0.00390625);
  assert.equal(mcnemarExactP(3, 3), 1);
  assert.equal(mcnemarExactP(0, 0), 1);
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

test('wilson95 handles empty and saturated arms', () => {
  assert.deepEqual(wilson95(0, 0), { lo: 0, hi: 1 });
  const zero = wilson95(0, 3);
  assert.equal(zero.lo, 0);
  assert.ok(zero.hi > 0.4 && zero.hi < 0.7, `hi=${zero.hi}`);
  const full = wilson95(3, 3);
  assert.ok(full.lo > 0.3 && full.lo < 0.6, `lo=${full.lo}`);
  assert.equal(full.hi, 1);
});
