import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { hashFileSet, listFilesRecursive } from '../dist/harness/hash.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'docs/examples/prepare-native-diff-probe.mjs');
const execute = args => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });

test('probe preparation previews without writes, copies exact inputs and cannot overwrite an attempt', t => {
  const out = join(root, 'runs', `native-diff-probe-test-${randomUUID()}`);
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const preview = execute(['--out', out]);
  assert.equal(preview.status, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.modelCalls, 0);
  assert.equal(plan.authorizedLiveCalls, 0);
  assert.equal(existsSync(out), false);
  const prepared = execute(['--write', out]);
  assert.equal(prepared.status, 0, prepared.stderr);
  const request = JSON.parse(readFileSync(join(out, 'request.json'), 'utf8'));
  assert.equal(request.purpose, 'development');
  assert.equal(request.pairOrder, 'balanced');
  assert.equal(request.trials, 2);
  assert.equal(request.maxCalls, 4);
  assert.equal(request.policy.minTasks, 8);
  assert.equal(request.policy.minTrialsPerTask, 5);
  const bench = JSON.parse(readFileSync(join(out, 'bench/bench.json'), 'utf8'));
  assert.deepEqual(bench.tasks.map(task => task.id), ['duration-large-digits']);
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'bench/bench.original.json'), 'utf8')),
    JSON.parse(readFileSync(join(root, 'benches/contrib/oss-skill-followup/bench.json'), 'utf8')));
  for (const name of ['baseline', 'candidate']) {
    assert.equal(hashFileSet(join(out, name), listFilesRecursive(join(out, name))), plan.sourceInventory[name].sha256);
  }
  const before = hashFileSet(out, listFilesRecursive(out));
  const repeat = execute(['--write', out]);
  assert.notEqual(repeat.status, 0);
  assert.match(repeat.stderr, /Destination already exists/);
  assert.equal(hashFileSet(out, listFilesRecursive(out)), before);
});

test('probe preparation rejects output outside the owned runs directory', () => {
  const attempt = execute(['--write', join(root, `probe-outside-${randomUUID()}`)]);
  assert.notEqual(attempt.status, 0);
  assert.match(attempt.stderr, /fresh direct child/);
});
