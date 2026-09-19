import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskQueue } from '../src/task-queue.mjs';

test('runs enqueued tasks and resolves with their results', async () => {
  const queue = new TaskQueue();
  const first = queue.enqueue(() => 'first');
  const second = queue.enqueue(() => 'second');
  assert.equal(await first, 'first');
  assert.equal(await second, 'second');
});

test('onIdle resolves once the queue drains', async () => {
  const queue = new TaskQueue();
  const done = queue.enqueue(() => 42);
  await queue.onIdle();
  assert.equal(await done, 42);
});
