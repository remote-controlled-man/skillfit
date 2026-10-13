import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExecutionDeadline } from './execution-timing.js';

function fake(timeoutMs = 600_000) {
  const time = { wall: 0, mono: 0 };
  const deadline = new ExecutionDeadline(timeoutMs, { wallNow: () => time.wall, monotonicNow: () => time.mono });
  return { time, deadline };
}

test('recorded sleep-sized wall gap is an infrastructure anomaly, not active compute', () => {
  const { time, deadline } = fake();
  for (let i = 1; i <= 113; i++) { time.wall = time.mono = i * 1000; deadline.observe(); }
  // On clocks which exclude suspend, a resume still reveals the wall/monotonic discontinuity.
  time.wall = 2_178_775; time.mono = 114_000; deadline.observe();
  assert.match(deadline.timingError!, /discontinuity/);
  assert.equal(deadline.exceeded, false);
  const timing = deadline.snapshot();
  assert.equal(timing.wallElapsedMs, 2_178_775);
  assert.equal(timing.elapsedMs, 114_000);
  assert.equal(timing.maxClockSkewMs, 2_064_775);
});

test('suspend or stalled event loop is detected even when both clocks advance together', () => {
  const { time, deadline } = fake();
  time.wall = time.mono = 1000; deadline.observe();
  time.wall = time.mono = 2_178_775; deadline.observe();
  assert.match(deadline.timingError!, /observation gap/);
  assert.equal(deadline.exceeded, true);
});

test('backward wall adjustment cannot produce a negative elapsed cost', () => {
  const { time, deadline } = fake();
  time.wall = -100_000; time.mono = 1000; deadline.observe();
  assert.match(deadline.timingError!, /discontinuity/);
  assert.equal(deadline.snapshot().elapsedMs, 1000);
  assert.equal(deadline.snapshot().wallElapsedMs, -100_000);
});

test('normal deadline records actual timeout firing and termination delay without clamping', () => {
  const { time, deadline } = fake(2000);
  time.wall = time.mono = 1000; deadline.observe();
  assert.equal(deadline.exceeded, false);
  time.wall = time.mono = 2025; deadline.observe(); deadline.markTermination(true);
  time.wall = time.mono = 2075; deadline.observe();
  assert.equal(deadline.timingError, null);
  assert.equal(deadline.snapshot().timeoutFiredAfterMs, 2025);
  assert.equal(deadline.snapshot().terminationDelayMs, 50);
});

test('invalid timeout values cannot silently become a one-millisecond Node timer', () => {
  for (const n of [0, -1, Infinity, NaN, 1.5, 2_147_483_648]) assert.throws(() => fake(n), /timeoutMs/);
});
