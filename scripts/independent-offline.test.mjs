import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const bench = fileURLToPath(new URL('../benches/contrib/oss-skill-independent/', import.meta.url));
const definition = JSON.parse(readFileSync(join(bench, 'bench.json'), 'utf8'));
const specs = JSON.parse(readFileSync(join(bench, 'task-specs.json'), 'utf8'));
const provenance = JSON.parse(readFileSync(join(bench, 'provenance.json'), 'utf8'));
const proposal = JSON.parse(readFileSync(new URL('../docs/plans/2026-10-15-independent-comparison-inputs.json', import.meta.url), 'utf8'));
function setup(t, task, fixed) {
  const directory = mkdtempSync(join(tmpdir(), 'skillfit-independent-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(join(bench, task.fixture), directory, { recursive: true });
  if (fixed) {
    const result = spawnSync(process.execPath, [join(bench, 'ground-truth/oracle-' + task.id + '.mjs'), directory], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
  } else copyFileSync(join(bench, 'ground-truth', task.id, 'regression.test.mjs'), join(directory, 'regression.test.mjs'));
  return directory;
}
function grade(task, directory) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [join(bench, 'verifiers', task.id + '.mjs'), directory], { encoding: 'utf8', timeout: 20000, env });
  assert.equal(result.error, undefined, result.stderr); assert.equal(result.signal, null);
  const value = JSON.parse(result.stdout.trim()); assert.equal(value.checks.length, 6);
  assert.equal(value.passed, result.status === 0);
  return { ...value, exitCode: result.status };
}

test('independent source tasks retain proposal identities, complete fixture/reference hashes and pinned Git blobs', () => {
  assert.deepEqual(definition.tasks.map(task => task.id), proposal.tasks.map(task => task.id));
  assert.equal(definition.tasks.length, 8);
  for (const task of provenance.tasks) {
    const declared = proposal.tasks.find(row => row.id === task.task); assert.ok(declared);
    assert.equal(task.before, declared.before); assert.equal(task.fix, declared.upstreamFix);
    for (const [directory, records] of [['fixtures', task.fixtureFiles], ['ground-truth', task.referenceFiles]]) for (const row of records) {
      assert.equal(createHash('sha256').update(readFileSync(join(bench, directory, task.task, row.path))).digest('hex'), row.sha256, task.task + ':' + row.path);
    }
    for (const file of declared.functionalFiles) {
      const row = file.path === 'package.json' ? task.packageRecords.find(row => row.arm === 'fixed') :
        task.sourceRecords.find(row => row.arm === 'fixed' && row.path === file.path);
      assert.ok(row, 'Complete functional upstream patch must have provenance: ' + file.path);
      assert.equal(row.rawGitBlobSha, file.fixedGitBlobSha);
    }
  }
});

for (const task of definition.tasks) test(`${task.id}: identical registered regression fails original and full functional maintainer fix passes 6/6`, t => {
  const original = grade(task, setup(t, task, false));
  assert.equal(original.exitCode, 1); assert.equal(original.checks[0].pass, true, 'original smoke and protected assets must work');
  assert.ok(original.checks.slice(1, 5).some(check => !check.pass), 'the defect itself must fail, not only a missing regression');
  const fixed = grade(task, setup(t, task, true));
  assert.equal(fixed.exitCode, 0); assert.ok(fixed.checks.every(check => check.pass));
  assert.ok(fixed.evidence.some(row => row.caseWitnesses.length > 0));
  assert.ok(fixed.evidence.every(row => row.originalFailed && row.referencePassed && row.finalPassed));
});

test('a constant passing regression does not create an original/fix witness', t => {
  const task = definition.tasks.find(row => row.id === 'commander-output-isolation'), directory = setup(t, task, true);
  writeFileSync(join(directory, 'regression.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';test('constant',()=>assert.equal(1,1));\n");
  const result = grade(task, directory); assert.equal(result.exitCode, 1); assert.ok(result.checks.slice(0, 5).every(row => row.pass));
  assert.equal(result.checks[5].pass, false);
});

test('a test file exiting zero without a registered test cannot create a witness', t => {
  const task = definition.tasks.find(row => row.id === 'timeout-infinity-abort'), directory = setup(t, task, true);
  writeFileSync(join(directory, 'regression.test.mjs'), 'process.exit(0);\n');
  const result = grade(task, directory); assert.equal(result.exitCode, 1); assert.equal(result.checks[5].pass, false);
});

test('modifying a protected vendored dependency is rejected even with the real functional fix', t => {
  const task = definition.tasks.find(row => row.id === 'limit-map-iteration-rejection'), directory = setup(t, task, true);
  const path = join(directory, 'vendor/yocto-queue/index.js'); writeFileSync(path, readFileSync(path, 'utf8') + '\n// altered\n');
  const result = grade(task, directory); assert.equal(result.exitCode, 1); assert.equal(result.checks[0].pass, false);
});

test('the incomplete maintainer context patch without its import mapping is rejected', t => {
  const task = definition.tasks.find(row => row.id === 'limit-async-context'), directory = setup(t, task, false);
  copyFileSync(join(bench, 'ground-truth', task.id, 'index.js'), join(directory, 'index.js'));
  const result = grade(task, directory); assert.equal(result.exitCode, 1); assert.equal(result.checks[0].pass, false);
  assert.ok(result.checks.slice(1, 5).some(row => !row.pass));
});
