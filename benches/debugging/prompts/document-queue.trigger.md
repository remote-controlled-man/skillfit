# Task: document the queue's ordering guarantees

The repository in your current working directory contains `src/task-queue.mjs`. It is correct as written
and its tests pass. Nothing is broken and nothing needs fixing.

It ships undocumented and callers keep asking the same questions. Write the "Ordering guarantees" section
of its README: what runs concurrently, what happens to the tasks behind one that rejects, and when
`onIdle()` resolves relative to the promises `enqueue()` returned.

Do not modify any file.
