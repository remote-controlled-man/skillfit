import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2]);
const graderDir = path.dirname(fileURLToPath(import.meta.url));
const canonicalFixture = path.resolve(graderDir, '../fixtures/async-queue');

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name.startsWith('_') || entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function isTestCandidate(relative) {
  return /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\.mjs$/i.test(relative);
}

function runOneTest(root, relative) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', path.join(root, ...relative.split('/'))], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5_000,
    windowsHide: true,
    env,
  });
}

function completedWith(result, predicate) {
  return !result.error && result.signal == null && typeof result.status === 'number' && predicate(result.status);
}

function copyNonHarnessWorkspace(destination) {
  fs.cpSync(runDir, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(runDir, source).replaceAll('\\', '/');
      return relative === '' || (!relative.split('/').some((segment) => segment === '.git') && !path.basename(source).startsWith('_'));
    },
  });
}

function collectTestAssetEvidence() {
  const candidates = listFiles(runDir)
    .map((file) => path.relative(runDir, file).replaceAll('\\', '/'))
    .filter(isTestCandidate)
    .filter((relative) => !fs.existsSync(path.join(canonicalFixture, ...relative.split('/'))));
  return candidates.map((relative) => {
    const finalPath = path.join(runDir, ...relative.split('/'));
    const finalResult = runOneTest(runDir, relative);
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'async-queue-evidence-'));
    let originalFailed = false;
    try {
      copyNonHarnessWorkspace(temporaryRoot);
      fs.copyFileSync(
        path.join(canonicalFixture, 'src/task-queue.mjs'),
        path.join(temporaryRoot, 'src/task-queue.mjs'),
      );
      originalFailed = completedWith(runOneTest(temporaryRoot, relative), (status) => status !== 0);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
    return {
      path: relative,
      initialExists: false,
      nonEmpty: fs.statSync(finalPath).size > 0,
      finalPassed: completedWith(finalResult, (status) => status === 0),
      originalFailed,
    };
  });
}

const evidence = { testAssets: collectTestAssetEvidence() };
let TaskQueue;
try {
  ({ TaskQueue } = await import(pathToFileURL(path.join(runDir, 'src/task-queue.mjs'))));
} catch (error) {
  console.log(JSON.stringify({ score: 0, maxScore: 6, passed: false, failures: [`import: ${error.message}`], evidence }));
  process.exit(1);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function ticks(count) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function tracked(promise) {
  const state = { settled: false, value: undefined, error: undefined };
  promise.then(
    (value) => {
      state.settled = true;
      state.value = value;
    },
    (error) => {
      state.settled = true;
      state.error = error;
    },
  );
  return state;
}

const checks = [
  ['results map to the right enqueue call', async () => {
    const queue = new TaskQueue();
    const events = [];
    const first = queue.enqueue(() => { events.push('first'); return 1; });
    const second = queue.enqueue(() => { events.push('second'); return 2; });
    const third = queue.enqueue(() => { events.push('third'); return 3; });
    assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 3]);
    assert.deepEqual(events, ['first', 'second', 'third']);
  }],
  ['onIdle resolves immediately when already idle', async () => {
    const queue = new TaskQueue();
    const idle = tracked(queue.onIdle());
    await ticks(4);
    assert.equal(idle.settled, true);
  }],
  ['a rejected task neither hangs its caller nor strands queued tasks', async () => {
    const queue = new TaskQueue();
    const events = [];
    const okBefore = queue.enqueue(() => { events.push('ok-before'); return 'a'; });
    const failing = queue.enqueue(() => { events.push('failing'); throw new Error('boom'); });
    const okAfter = queue.enqueue(() => { events.push('ok-after'); return 'c'; });
    assert.equal(await okBefore, 'a');
    await assert.rejects(failing, /boom/);
    const afterState = tracked(okAfter);
    await ticks(12);
    assert.equal(afterState.settled, true, 'task queued behind a rejection never ran');
    assert.equal(afterState.value, 'c');
    const later = queue.enqueue(() => { events.push('later'); return 'd'; });
    assert.equal(await later, 'd');
    assert.deepEqual(events, ['ok-before', 'failing', 'ok-after', 'later']);
  }],
  ['enqueue during flight queues behind the running task', async () => {
    const queue = new TaskQueue();
    const events = [];
    const gate = deferred();
    const running = queue.enqueue(async () => {
      events.push('A:start');
      await gate.promise;
      events.push('A:end');
      return 'a';
    });
    await ticks(4);
    assert.deepEqual(events, ['A:start']);
    const queued = queue.enqueue(() => { events.push('B:start'); return 'b'; });
    await ticks(6);
    assert.deepEqual(events, ['A:start'], 'a queued task started while another was mid-flight');
    gate.resolve();
    assert.equal(await running, 'a');
    assert.equal(await queued, 'b');
    assert.deepEqual(events, ['A:start', 'A:end', 'B:start']);
  }],
  ['onIdle waits for in-flight work', async () => {
    const queue = new TaskQueue();
    const gate = deferred();
    const running = queue.enqueue(async () => {
      await gate.promise;
      return 1;
    });
    await ticks(4);
    const idle = tracked(queue.onIdle());
    await ticks(4);
    assert.equal(idle.settled, false, 'onIdle resolved while a task was still running');
    gate.resolve();
    await running;
    await ticks(4);
    assert.equal(idle.settled, true);
  }],
  ['onIdle resolves only after the last task promise settles', async () => {
    const queue = new TaskQueue();
    const gate = deferred();
    const last = tracked(queue.enqueue(async () => {
      await gate.promise;
      return 'done';
    }));
    const idle = queue.onIdle();
    gate.resolve();
    await idle;
    assert.equal(last.settled, true, 'onIdle resolved before the last task promise settled');
    assert.equal(last.value, 'done');
  }],
];

const failures = [];
for (const [name, check] of checks) {
  try {
    await check();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}
const passed = failures.length === 0;
console.log(JSON.stringify({ score: checks.length - failures.length, maxScore: checks.length, passed, failures, evidence }));
process.exit(passed ? 0 : 1);
