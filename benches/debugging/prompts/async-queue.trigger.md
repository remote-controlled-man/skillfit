# Task: diagnose and fix the async task queue

The repository in your current working directory contains `src/task-queue.mjs`. Users report three intermittent problems:

- when one task rejects, tasks queued behind it silently never run;
- a task enqueued while another task is still running sometimes starts immediately instead of waiting its turn;
- `onIdle()` sometimes resolves before the last enqueued task's returned promise has settled.

`TaskQueue.enqueue(fn)` must run tasks serially, in enqueue order, and return a promise for `fn`'s result (fulfilled with its value, rejected with its error). `onIdle()` must resolve only when the queue is empty and nothing is running. The queue is pure promise scheduling: do not use timers.

Find the causes and fix them without changing the public class API.

Run the visible tests with `node --test test/*.test.mjs`. After you finish, a hidden grading suite runs additional behavioral checks against this code.
