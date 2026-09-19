# Ground truth — async-queue

Fixture layout: `src/task-queue.mjs` holds the buggy queue; `test/basic.test.mjs` holds the two visible tests (they pass even against the buggy code — the real grading is the verifier's behavioral checks).

## Bug list (3, all in `src/task-queue.mjs`)

1. **A rejection abandons the queue**: `_drain()`'s `catch` calls `item.reject(error)` and then `return`s, so every task still queued behind the rejected one is stranded and never runs. The loop must continue to the next item after rejecting the failed task's promise.
2. **The pump guard is released when draining starts, not when it ends**: `_schedule()` sets `this.pumping = false` inside the `queueMicrotask` callback before `_drain()` has processed anything. An `enqueue()` that lands while a task is mid-flight then sees `pumping === false` and spawns a second concurrent `_drain()` loop, so the new task starts immediately instead of queueing behind the running one. `pumping` must stay `true` until the drain loop has emptied the queue (release it in a `finally` after the loop).
3. **Idle waiters fire before the task's promise settles**: inside `_drain()`, `_flushIdle()` is called before `item.resolve(value)`, so `onIdle()` can resolve while the last task's returned promise is still pending. The task's promise must settle first; only then may idle waiters be released. (Because of bug 2, `onIdle()` can also resolve mid-flight via the `!this.pumping` fast path; fixing the guard fixes that path too.)

## Verified fixed implementation

```js
export class TaskQueue {
  constructor() {
    this.items = [];
    this.pumping = false;
    this.idleWaiters = [];
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.items.push({ fn, resolve, reject });
      this._schedule();
    });
  }

  onIdle() {
    if (!this.pumping && this.items.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  _schedule() {
    if (this.pumping) return;
    this.pumping = true;
    queueMicrotask(() => {
      void this._drain();
    });
  }

  async _drain() {
    try {
      while (this.items.length > 0) {
        const item = this.items.shift();
        try {
          const value = await item.fn();
          item.resolve(value);
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      this.pumping = false;
      this._flushIdle();
    }
  }

  _flushIdle() {
    if (this.pumping || this.items.length > 0) return;
    const waiters = this.idleWaiters.splice(0, this.idleWaiters.length);
    for (const resolve of waiters) resolve();
  }
}
```

Verified 2026-09-19: this exact source scores 6/6 (exit 0) against `verifiers/async-queue.mjs`; the pristine fixture scores 2/6 (exit 1, only "results map to the right enqueue call" and "onIdle resolves immediately when already idle" pass).

## What the grader checks

6 behavioral checks, imported directly from the run directory's `src/task-queue.mjs`, using only deferreds and awaited microtask ticks (no timers, no wall clock):

1. Results map to the right enqueue call — three tasks resolve in order with their own values (passes on the buggy code).
2. `onIdle()` resolves immediately when already idle (passes on the buggy code).
3. A rejected task neither hangs its caller nor strands queued tasks — bug 1.
4. `enqueue()` during flight queues behind the running task — bug 2.
5. `onIdle()` waits for in-flight work — bug 2/3 (fast path on the released guard).
6. `onIdle()` resolves only after the last task's promise settles — bug 3.

The JSON summary also carries an `evidence.testAssets` collector (informational only, does not affect the score): any test file the agent added is re-run against the final code and against the pristine fixture implementation to show whether it is a real red→green regression test.
