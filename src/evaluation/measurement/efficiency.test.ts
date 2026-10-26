import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeCosts, type CostObservation } from "./costs.js";
import { efficiencyEvidence } from "./efficiency.js";

function row(id: string, baseline: number, treatment: number, passes = 5) {
  const observations = (tokens: number): CostObservation[] => Array.from({ length: 5 }, (_, n) => ({
    executorInvoked: true, passed: n < passes, error: null, durationSeconds: 1,
    tokens: { input: tokens, cachedInput: 0, output: 1 }, usageStatus: 'final',
  }));
  const all = { baseline: observations(baseline), treatment: observations(treatment) };
  return { id, costs: summarizeCosts(all, all) };
}

test('whole task bootstrap reproduces proportional savings without pretending trials are independent tasks', () => {
  const tasks = Array.from({ length: 8 }, (_, n) => row('task-' + n, (n + 1) * 100, (n + 1) * 80));
  const result = efficiencyEvidence(tasks);
  assert.equal(result.tasksCompared, 8); assert.equal(result.improvedTasks, 8);
  assert.ok(Math.abs(result.point! + 0.2) < 1e-12);
  assert.ok(Math.abs(result.ci!.lo + 0.2) < 1e-12); assert.ok(Math.abs(result.ci!.hi + 0.2) < 1e-12);
  assert.deepEqual(efficiencyEvidence(tasks), result);
  assert.equal(result.seed, 20261013); assert.equal(result.resamples, 10000);
});

test('a single dominant cheapened task does not establish a stable broad reduction', () => {
  const tasks = Array.from({ length: 8 }, (_, n) => row('task-' + n, n ? 100 : 100000, 100));
  const result = efficiencyEvidence(tasks);
  assert.ok(result.point! < -0.9); assert.equal(result.ci!.hi, 0);
  assert.equal(result.improvedTaskFraction, 1 / 8);
});

test('uncached input includes unsuccessful invocations and uses successes rather than scheduled trials', () => {
  const task = row('failed-spending', 100, 80, 3);
  const all = task.costs.attempts;
  // Same totals, fewer candidate successes: average call savings hide extra spending per success.
  all.treatment.passes = 2;
  const result = efficiencyEvidence([task]);
  assert.ok(Math.abs(result.point! - 0.2) < 1e-12);
  assert.equal(result.improvedTasks, 0);
});

test('missing final task usage, absent costs and zero-success tasks cannot be dropped to improve a bound', () => {
  for (const mutation of [
    (task: ReturnType<typeof row>) => { task.costs.attempts.treatment.metrics.uncachedInput.coverage = { final: 4, partial: 1, unknown: 0 }; },
    (task: ReturnType<typeof row>) => { task.costs.attempts.treatment.passes = 0; },
    (task: ReturnType<typeof row>) => { task.costs.attempts.baseline.metrics.uncachedInput.knownTotal = 0; },
  ]) {
    const tasks = Array.from({ length: 8 }, (_, n) => row('task-' + n, 100, 50)); mutation(tasks[0]!);
    const result = efficiencyEvidence(tasks);
    assert.equal(result.ci, null); assert.equal(result.taskChanges, null); assert.match(result.unavailableReason!, /Every task/);
  }
  assert.equal(efficiencyEvidence([{ id: 'missing', costs: null }]).point, null);
  assert.equal(efficiencyEvidence([]).ci, null);
});
