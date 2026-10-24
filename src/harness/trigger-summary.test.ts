import assert from 'node:assert/strict';
import { test } from 'node:test';
import { triggerMetrics as legacyMetrics } from './trigger.js';
import { triggerMetrics, type TriggerTaskSummary } from './trigger-summary.js';

test('standalone trigger calculation preserves single-arm denominators and unknown results', () => {
  assert.equal(legacyMetrics, triggerMetrics);
  const tasks: TriggerTaskSummary[] = [
    { id: 'yes', shouldTrigger: true, triggerClass: 'implicit', runs: 4, fired: 3, unknown: 2, errors: 1, passes: 3, tokens: { input: 10, output: 2 } },
    { id: 'no', shouldTrigger: false, runs: 2, fired: 1, unknown: 1, errors: 0, passes: 2, tokens: null },
  ];
  const result = triggerMetrics(tasks);
  assert.equal(result.recall, 0.75); assert.equal(result.falseTriggerRate, 0.5); assert.equal(result.precision, 0.75); assert.equal(result.f1, 0.75);
  assert.deepEqual(result.classRecall?.implicit?.runs, 4); assert.deepEqual(result.tokens, { input: 10, output: 2 });
  assert.equal(triggerMetrics([]).recall, null); assert.equal(triggerMetrics([]).precision, null);
});
