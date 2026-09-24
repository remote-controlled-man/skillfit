import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskQueue } from '../src/task-queue.mjs';

test('runs enqueued tasks in order', async () => {
  const queue = new TaskQueue();
  const order = [];
  await Promise.all([
    queue.enqueue(async () => { order.push(1); return 1; }),
    queue.enqueue(async () => { order.push(2); return 2; }),
  ]);
  assert.deepEqual(order, [1, 2]);
});

test('a rejected task does not strand the queue', async () => {
  const queue = new TaskQueue();
  const ran = [];
  const first = queue.enqueue(async () => { throw new Error('boom'); });
  const second = queue.enqueue(async () => { ran.push('second'); });
  await assert.rejects(first, /boom/);
  await second;
  assert.deepEqual(ran, ['second']);
});
