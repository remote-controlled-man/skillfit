import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from './bench.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');

function makeBench(t: import('node:test').TestContext, benchJson: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-bench-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'fixture\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'do it\n');
  writeFileSync(join(dir, 'verifiers', 't1.mjs'), 'process.exit(0);\n');
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(benchJson));
  return dir;
}

const validTask = {
  id: 't1',
  fixture: 'fixtures/t1',
  prompt: 'prompts/t1.md',
  verifier: 'node verifiers/t1.mjs',
};

test('loadBench loads the bundled code-review bench', () => {
  const bench = loadBench(BUNDLED_CODE_REVIEW);
  assert.equal(bench.name, 'code-review');
  assert.equal(bench.schemaVersion, 1);
  assert.equal(bench.tasks.length, 3);
  assert.equal(bench.tasks[0]?.id, 'review-r1');
  assert.equal(bench.tasks[0]?.rubric, 'ground-truth/r1.md');
  assert.equal(bench.tasks[1]?.id, 'review-r2');
  assert.equal(bench.tasks[1]?.verifier, 'node verifiers/review-r2.mjs');
  assert.equal(bench.tasks[2]?.id, 'review-r3');
  assert.equal(bench.tasks[2]?.rubric, 'ground-truth/r3.md');
  assert.match(bench.contentSha256, /^[0-9a-f]{64}$/);
});

test('loadBench accepts a valid synthetic bench', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [validTask] });
  const bench = loadBench(dir);
  assert.equal(bench.tasks.length, 1);
  assert.equal(bench.tasks[0]?.verifier, 'node verifiers/t1.mjs');
});

test('loadBench rejects unsupported schemaVersion', (t) => {
  const dir = makeBench(t, { schemaVersion: 2, tasks: [validTask] });
  assert.throws(() => loadBench(dir), /Unsupported bench schemaVersion 2/);
});

test('loadBench rejects a missing bench.json', () => {
  assert.throws(() => loadBench(join(tmpdir(), 'skillfit-no-such-bench')), /missing bench\.json/);
});

test('loadBench rejects an empty task list', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [] });
  assert.throws(() => loadBench(dir), /at least one task/);
});

test('loadBench rejects a missing fixture directory', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [{ ...validTask, fixture: 'fixtures/nope' }] });
  assert.throws(() => loadBench(dir), /fixture directory not found/);
});

test('loadBench rejects a missing verifier script', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [{ ...validTask, verifier: 'node verifiers/nope.mjs' }] });
  assert.throws(() => loadBench(dir), /missing file: verifiers\/nope\.mjs/);
});

test('loadBench rejects duplicate task ids', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [validTask, validTask] });
  assert.throws(() => loadBench(dir), /Duplicate task id/);
});

test('loadBench rejects paths escaping the bench directory', (t) => {
  const dir = makeBench(t, { schemaVersion: 1, tasks: [{ ...validTask, fixture: '../elsewhere' }] });
  assert.throws(() => loadBench(dir), /relative path inside the bench directory/);
});
