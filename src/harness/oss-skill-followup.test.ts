import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test, type TestContext} from 'node:test';

const bench = fileURLToPath(new URL('../../benches/contrib/oss-skill-followup/', import.meta.url));
const provenance = JSON.parse(readFileSync(join(bench, 'provenance.json'), 'utf8')) as {
  tasks: {task: string; beforeSourceSha256: string; fixedSourceSha256: string}[];
};
interface Check {name: string; pass: boolean}
function run(script: string, args: string[]) {
  const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [join(bench, script), ...args], {encoding: 'utf8', timeout: 20000, env});
  assert.equal(result.error, undefined); assert.equal(result.signal, null);
  return {status: result.status, value: JSON.parse(result.stdout.trim().split('\n').at(-1)!) as {passed?: boolean; score?: number; checks: Check[]}};
}
function scratch(t: TestContext, id: string) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-followup-integrity-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  cpSync(join(bench, 'fixtures', id), root, {recursive: true});
  return root;
}

test('followup sources retain exact independent parent and maintainer bytes', () => {
  assert.equal(provenance.tasks.length, 8);
  for (const task of provenance.tasks) {
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(hash(join(bench, 'fixtures', task.task, 'index.js')), task.beforeSourceSha256);
    assert.equal(hash(join(bench, 'ground-truth', task.task, 'index.js')), task.fixedSourceSha256);
    assert.notEqual(task.beforeSourceSha256, task.fixedSourceSha256);
  }
});

for (const task of provenance.tasks) test(`followup ${task.task}: original behavior fails and full maintainer repair passes`, t => {
  const root = scratch(t, task.task);
  const original = run('verifiers/probe.mjs', [task.task, root]);
  assert.equal(original.status, 0); assert.equal(original.value.checks.length, 4);
  assert.ok(original.value.checks.some(check => !check.pass), 'the original must fail actual public behavior, not only lack a regression file');
  const oracle = spawnSync(process.execPath, [join(bench, `ground-truth/oracle-${task.task}.mjs`), root], {encoding: 'utf8'});
  assert.equal(oracle.status, 0);
  const fixed = run(`verifiers/${task.task}.mjs`, [root]);
  assert.equal(fixed.status, 0); assert.equal(fixed.value.passed, true); assert.equal(fixed.value.score, 1);
  assert.equal(fixed.value.checks.length, 6); assert.ok(fixed.value.checks.every(check => check.pass));
});

test('followup outcome verification rejects a changed supplied clock helper', t => {
  const id = 'debounce-timer-boundary', root = scratch(t, id);
  const oracle = spawnSync(process.execPath, [join(bench, `ground-truth/oracle-${id}.mjs`), root], {encoding: 'utf8'});
  assert.equal(oracle.status, 0);
  writeFileSync(join(root, 'test-clock.mjs'), readFileSync(join(root, 'test-clock.mjs'), 'utf8') + '\n// changed supplied helper\n');
  const result = run(`verifiers/${id}.mjs`, [root]);
  assert.equal(result.status, 1); assert.equal(result.value.passed, false);
  assert.equal(result.value.checks[0]!.pass, false);
});
