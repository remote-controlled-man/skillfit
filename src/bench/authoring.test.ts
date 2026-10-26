import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { prepareBenchChange, applyBenchChange } from "./authoring.js";
import { loadBench } from "./read.js";
import { runOfflineBenchCheck } from './gates/check.js';

function root(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-authoring-port-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return dir;
}

test('authoring preparation exposes a schema-2 starter without creating output or invoking UI', t => {
  const cwd = root(t), dir = join(cwd, 'case');
  const change = prepareBenchChange({ operation: 'init', options: { cwd, dir, schemaVersion: 2, kind: 'command',
    confirm: async () => { throw Error('Preparation must not confirm'); },
    log: () => { throw Error('Preparation must not render'); } } });
  assert.equal(existsSync(dir), false);
  assert.ok(change.writes.some(write => write.target === join(dir, 'bench.json')));
  assert.equal(change.draft, false);
  applyBenchChange(change);
  assert.deepEqual(loadBench(dir).tasks[0]?.claims, ['quality']);
});

test('new starters keep one task together and grade it through the manifest', async t => {
  const cwd = root(t);
  for (const kind of ['output', 'command'] as const) {
    const dir = join(cwd, kind);
    const change = prepareBenchChange({ operation: 'init', options: { cwd, dir, kind } });
    assert.equal(existsSync(dir), false);
    applyBenchChange(change);
    const task = loadBench(dir).tasks[0]!;
    assert.equal(task.fixture, 'tasks/example-task/fixture');
    assert.equal(task.prompt, 'tasks/example-task/prompt.md');
    assert.equal(task.promptTrigger, 'tasks/example-task/prompt.trigger.md');
    assert.equal(task.verifier, 'node tasks/example-task/verify.mjs');
    assert.equal(task.oracle, 'node tasks/example-task/reference/oracle.mjs');
    assert.equal(task.rubric, 'tasks/example-task/reference/answer.md');
    assert.equal(existsSync(join(dir, task.fixture, 'reference')), false);
    assert.equal((await runOfflineBenchCheck({ dir, log: () => {} })).failures, 0);
  }
});

test('a prepared capture applies its private bytes and rejects later source or target changes', t => {
  const cwd = root(t), dir = join(cwd, 'case'), sourceDir = join(cwd, 'source');
  applyBenchChange(prepareBenchChange({ operation: 'init', options: { cwd, dir } }));
  mkdirSync(sourceDir); writeFileSync(join(sourceDir, 'answer.txt'), 'original');
  const request = { operation: 'add' as const, options: { cwd, benchDir: dir, sourceDir, freeze: true,
    include: ['answer.txt'], prompt: 'Return answer', expect: 'original', task: 'capture' } };
  const prepare = () => prepareBenchChange(request, { now: () => new Date('2026-10-24T00:00:00Z') });
  const first = prepare();
  assert.ok(first.sourceSha256 && first.targetSha256);
  assert.ok(!existsSync(join(dir, 'tasks/capture')));
  writeFileSync(join(sourceDir, 'answer.txt'), 'changed');
  assert.throws(() => applyBenchChange(first), /source changed/i);
  writeFileSync(join(sourceDir, 'answer.txt'), 'original');
  const next = prepare();
  const view = next.writes.find(write => Buffer.isBuffer(write.content))!;
  (view.content as Buffer).fill(0);
  applyBenchChange(next);
  const captured = loadBench(dir).tasks.find(task => task.id === 'capture')!;
  assert.equal(captured.fixture, 'tasks/capture/fixture');
  assert.equal(readFileSync(join(dir, captured.fixture, 'answer.txt'), 'utf8'), 'original');
  assert.ok(existsSync(join(dir, 'bench.json.skillfit-bak')));
  assert.throws(() => applyBenchChange(next), /outputs changed/i);
});

test('prepared management refuses fixture drift and never unregisters task files', t => {
  const cwd = root(t), dir = join(cwd, 'case');
  applyBenchChange(prepareBenchChange({ operation: 'init', options: { cwd, dir } }));
  const fixture = join(dir, loadBench(dir).tasks[0]!.fixture, 'answer.txt');
  const options = { dir, taskId: 'example-task', action: 'edit' as const, set: ['shouldTrigger=true'] };
  const change = prepareBenchChange({ operation: 'edit', options });
  const before = readFileSync(join(dir, 'bench.json'), 'utf8');
  writeFileSync(fixture, 'changed');
  assert.throws(() => applyBenchChange(change), /source changed/i);
  assert.equal(readFileSync(join(dir, 'bench.json'), 'utf8'), before);
  assert.equal(readFileSync(fixture, 'utf8'), 'changed');
});


test('starter write failure removes its own partial file and leaves no invalid registration', t => {
  const cwd = root(t), dir = join(cwd, 'case');
  const change = prepareBenchChange({ operation: 'init', options: { cwd, dir } }, {
    writeFile: ((file: Parameters<typeof writeFileSync>[0]) => {
      writeFileSync(file, 'partial'); throw Error('injected disk failure');
    }) as typeof writeFileSync,
  });
  assert.throws(() => applyBenchChange(change), /injected disk failure/);
  assert.ok(!existsSync(join(dir, 'bench.json')));
  assert.ok(!existsSync(join(dir, 'tasks')));
});
