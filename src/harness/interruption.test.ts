import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluationSignal, withEvaluationInterrupts } from './interruption.js';

const counts = () => [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];

test('normal and failed operations restore signal handlers and asynchronous context', async () => {
  const before = counts();
  assert.equal(evaluationSignal(), undefined);
  assert.equal(await withEvaluationInterrupts(async () => {
    assert.ok(evaluationSignal()); await Promise.resolve(); assert.ok(evaluationSignal()); return 'done';
  }), 'done');
  assert.deepEqual(counts(), before); assert.equal(evaluationSignal(), undefined);
  await assert.rejects(withEvaluationInterrupts(async () => { throw new Error('offline setup failed'); }), /offline setup failed/);
  assert.deepEqual(counts(), before); assert.equal(evaluationSignal(), undefined);
});

test('concurrent operations keep distinct cancellation contexts and clean up all handlers', async () => {
  const before = counts();
  const signals = await Promise.all([1, 2].map(() => withEvaluationInterrupts(async () => {
    const signal = evaluationSignal(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(evaluationSignal(), signal); return signal;
  })));
  assert.notEqual(signals[0], signals[1]); assert.deepEqual(counts(), before);
  assert.equal(evaluationSignal(), undefined);
});
