import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeExperiment, type TrialOutcome } from "./trial-summary.js";

function outcome(taskId: string, condition: TrialOutcome['condition'], trial: number, passed: boolean, extra: Partial<TrialOutcome> = {}): TrialOutcome {
  return { taskId, condition, trial, passed, runDir: 'unused', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z',
    durationSeconds: 1, verifierExitCode: passed ? 0 : 1, verifierPassed: passed, score: passed ? 1 : 0, checks: null, error: null,
    output: 'unused', tokens: { input: 10, cachedInput: 2, output: 1 }, executorInvoked: true, usageStatus: 'final', gitInitialized: true, ...extra };
}

test('pure paired summary keeps task-local pairing and partial attempts while excluding errored pairs', () => {
  const tasks = [
    { id: 'first', outcomes: {
      baseline: [outcome('first', 'baseline', 1, false), outcome('first', 'baseline', 2, false, { error: 'offline failure', verifierExitCode: null, verifierPassed: null, score: null, tokens: { input: 9 }, usageStatus: 'partial' })],
      treatment: [outcome('first', 'treatment', 1, true), outcome('first', 'treatment', 2, true)],
    }, judgeResults: [] },
    { id: 'second', outcomes: { baseline: [outcome('second', 'baseline', 1, true)], treatment: [outcome('second', 'treatment', 1, false)] }, judgeResults: [] },
  ];
  const before = JSON.stringify(tasks), result = summarizeExperiment(tasks);
  assert.deepEqual(result.tasks.map(t => t.outcomes), [{ baseline: [false], treatment: [true] }, { baseline: [true], treatment: [false] }]);
  assert.equal(result.overall.conditions.baseline.trials, 2); assert.equal(result.overall.conditions.baseline.errors, 1);
  assert.equal(result.overall.conditions.treatment.trials, 2); assert.equal(result.overall.deltaPassRate, 0);
  assert.deepEqual(result.overall.stats.discordant, { improved: 1, regressed: 1 });
  assert.equal(result.overall.stats.mcnemarP, 1); assert.equal(result.overall.verdict, 'inconclusive');
  assert.equal(result.overall.costs!.attempts.baseline.metrics.input.knownTotal, 29);
  assert.equal(result.overall.costs!.attempts.baseline.metrics.input.coverage.partial, 1);
  assert.equal(result.overall.costs!.paired.baseline.metrics.input.knownTotal, 20);
  assert.equal(JSON.stringify(tasks), before);
});
