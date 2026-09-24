import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-document-queue.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '## Ordering guarantees',
    '',
    'Tasks run one at a time, in the order they were enqueued. enqueue() never starts a task concurrently',
    'with one already in flight, so the queue is safe for work that must not interleave.',
    '',
    'A task that rejects settles only its own promise. The tasks queued behind it still run, in order: a',
    'failure neither abandons the queue nor discards the backlog.',
    '',
    'onIdle() resolves once every enqueued task has finished and the promise its enqueue() returned has',
    'settled. It never fires while work is in flight, and it does not fire in the gap between a task',
    'completing and its caller being resumed. Calling it on an already-idle queue resolves immediately.',
    '',
  ].join('\n'),
  'utf8',
);
