import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { inspectBench, manageBench } from "./bench-manage.js";
import { applyBenchWrites, runBenchInit } from "./bench.js";
import { loadBench } from "../bench/read.js";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));
async function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-manage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'bench'); await runBenchInit({ dir, kind: 'command', yes: true, log: () => {} });
  return { root, dir, path: join(dir, 'bench.json') };
}

test('case listing/showing and default edit plans are read-only', async t => {
  const { dir, path } = await setup(t), before = readFileSync(path, 'utf8');
  assert.equal(inspectBench(dir).tasks.length, 1);
  assert.equal(inspectBench(dir, 'example-task').tasks[0]!.verifierKind, 'command');
  assert.throws(() => inspectBench(dir, 'missing'), /Unknown task/);
  const result = manageBench({ dir, taskId: 'example-task', action: 'edit', set: ['shouldTrigger=false'], log: () => {} });
  assert.equal(result.status, 'planned'); assert.equal(result.after!.shouldTrigger, false);
  assert.equal(readFileSync(path, 'utf8'), before); assert.ok(!existsSync(path + '.skillfit-bak'));
});

test('case edits verify schema, preserve first backups and unregister without deleting shared files', async t => {
  const { dir, path } = await setup(t);
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  raw.tasks.push({ ...raw.tasks[0], id: 'real-task', provenance: 'keep me' });
  writeFileSync(path, JSON.stringify(raw)); const before = readFileSync(path, 'utf8');
  const base = { dir, taskId: 'real-task', yes: true, log: () => {} };
  assert.equal(manageBench({ ...base, action: 'edit', set: ['shouldTrigger=true'] }).status, 'applied');
  assert.equal(readFileSync(path + '.skillfit-bak', 'utf8'), before);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).tasks[1].provenance, 'keep me');
  manageBench({ ...base, action: 'edit', unset: ['shouldTrigger'] });
  assert.equal(readFileSync(path + '.skillfit-bak', 'utf8'), before);
  const result = manageBench({ ...base, taskId: 'example-task', action: 'remove' });
  assert.equal(result.status, 'applied');
  assert.deepEqual(loadBench(dir).tasks.map(task => task.id), ['real-task']);
  assert.ok(existsSync(join(dir, 'tasks/example-task/fixture/index.js')));
  assert.ok(existsSync(join(dir, 'tasks/example-task/verify.mjs')));
  assert.throws(() => manageBench({ ...base, action: 'remove' }), /last task/);
});

test('invalid edits, repeated fields and rollback never replace a valid bench', async t => {
  const { dir, path } = await setup(t), before = readFileSync(path, 'utf8');
  for (const set of [['id=renamed'], ['fixture=../outside'], ['verifier='], ['shouldTrigger=maybe'], ['shouldTrigger=true', 'shouldTrigger=false']]) {
    assert.throws(() => manageBench({ dir, taskId: 'example-task', action: 'edit', set, yes: true, log: () => {} }));
    assert.equal(readFileSync(path, 'utf8'), before);
  }
  assert.throws(() => applyBenchWrites(dir, [{ target: path, content: '{' }]));
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('a dangling backup symlink cannot write outside the case directory', async t => {
  const { root, dir, path } = await setup(t), outside = join(root, 'outside');
  try { symlinkSync(outside, path + '.skillfit-bak', 'file'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('File symlinks require platform privileges.'); return; } throw error; }
  const before = readFileSync(path, 'utf8');
  assert.throws(() => manageBench({ dir, taskId: 'example-task', action: 'edit', set: ['shouldTrigger=true'], yes: true, log: () => {} }), /unsafe backup/);
  assert.equal(readFileSync(path, 'utf8'), before); assert.ok(!existsSync(outside));
});

test('case-management CLI returns JSON plans and structured errors without prompts', async t => {
  const { dir, path } = await setup(t), before = readFileSync(path, 'utf8');
  for (const args of [['list', dir], ['show', dir, 'example-task'], ['edit', dir, 'example-task', '--set', 'shouldTrigger=false']]) {
    const result = spawnSync(process.execPath, [CLI, 'bench', ...args, '--json'], { encoding: 'utf8', input: '', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).schemaVersion, 1);
  }
  assert.equal(readFileSync(path, 'utf8'), before);
  const bad = spawnSync(process.execPath, [CLI, 'bench', 'show', dir, 'missing', '--json'], { encoding: 'utf8' });
  assert.equal(bad.status, 2); assert.equal(JSON.parse(bad.stdout).kind, 'skillfit.bench-error');
});
