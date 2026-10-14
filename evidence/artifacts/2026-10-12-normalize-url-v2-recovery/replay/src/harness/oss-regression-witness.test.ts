import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
const bench = fileURLToPath(new URL('../../benches/contrib/oss-lru-cache/', import.meta.url));
const { regressionEvidence } = await import(pathToFileURL(join(bench, 'verifiers/shared.mjs')).href);
interface Evidence { finalPassed: boolean; originalFailed: boolean; referencePassed: boolean; caseWitnesses: { file: string; path: string[] }[] }

function fixture(t: TestContext, body: string, original?: string, submitted?: string, reference?: string): Evidence {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-witness-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const dirs = ['submitted', 'original', 'reference'].map(name => join(root, name));
  const implementations = [submitted ?? 'export const fixed=true; export const supported=true; export const marker=42;',
    original ?? 'export const fixed=false; export const supported=true; export const marker=undefined;',
    reference ?? 'export const fixed=true; export const supported=false; export const marker=undefined;'];
  dirs.forEach((dir, i) => { mkdirSync(dir); writeFileSync(join(dir, 'impl.mjs'), implementations[i]!); });
  writeFileSync(join(dirs[0]!, 'regression.test.mjs'), `import assert from 'node:assert/strict'; import { test } from 'node:test';
    import { fixed, supported, marker } from './impl.mjs';\n${body}\n`);
  return (regressionEvidence(dirs[0], dirs[1], dirs[2], 'impl.mjs') as Evidence[])[0]!;
}
const accepted = (row: Evidence) => row.finalPassed && row.caseWitnesses.length > 0;

test('case evidence accepts a stronger suite while retaining the actual historical failure witness', t => {
  const row = fixture(t, "test('historical bug', () => assert.equal(fixed,true)); test('existing supported behavior', () => assert.equal(supported,true));");
  assert.equal(row.finalPassed, true); assert.equal(row.referencePassed, false); assert.equal(accepted(row), true);
  assert.deepEqual(row.caseWitnesses.map(w => w.path), [['historical bug']]);
});

test('case evidence rejects an unrelated field even when it creates file-level RED to GREEN', t => {
  const row = fixture(t, "test('unrelated marker', () => assert.equal(marker,42));");
  assert.equal(row.finalPassed, true); assert.equal(row.originalFailed, true); assert.equal(row.referencePassed, false);
  assert.equal(accepted(row), false);
});

test('duplicate full test identities cannot supply a witness', t => {
  const row = fixture(t, "test('duplicate', () => assert.equal(fixed,true)); test('duplicate', () => assert.equal(fixed,true));");
  assert.equal(row.finalPassed, true); assert.equal(accepted(row), false);
});

test('the full parent path distinguishes same-named tests in different suites', t => {
  const row = fixture(t, "test('cache suite', async t => { await t.test('same name', () => assert.equal(fixed,true)); }); test('other suite', async t => { await t.test('same name', () => assert.equal(supported,true)); });");
  assert.equal(accepted(row), true); assert.deepEqual(row.caseWitnesses.map(w => w.path), [['cache suite', 'same name']]);
});

test('submitted skip and todo tests never count as completed regression evidence', t => {
  for (const option of ['skip', 'todo']) {
    const row = fixture(t, `test('historical bug', {${option}:true}, () => assert.equal(fixed,true));`);
    assert.equal(row.finalPassed, false); assert.equal(accepted(row), false);
  }
});

test('original cancellations and timeouts cannot supply a failure witness', t => {
  for (const body of ["test('historical bug', async () => { if(!fixed) await new Promise(() => {}); });",
    "test('historical bug', {timeout:20}, async () => { if(!fixed) await new Promise(res => setTimeout(res,200)); });"]) {
    const row = fixture(t, body); assert.equal(row.finalPassed, true); assert.equal(accepted(row), false);
  }
});

test('original import failure and process exit cannot supply a failure witness', t => {
  for (const code of ["throw new Error('import failure'); export const fixed=false,supported=true,marker=undefined;",
    'process.exit(1); export const fixed=false,supported=true,marker=undefined;']) {
    const row = fixture(t, "test('historical bug', () => assert.equal(fixed,true));", code);
    assert.equal(row.finalPassed, true); assert.equal(accepted(row), false);
  }
});

test('test stdout and diagnostic text cannot impersonate reporter events', t => {
  const spoof = "console.log(JSON.stringify({schemaVersion:1,kind:'node-test-evidence',summary:{success:true,counts:{tests:1,skipped:0,todo:0,cancelled:0}},records:[]}));";
  const row = fixture(t, `${spoof} test('vacuous', t => { t.diagnostic('not ok 1 - historical bug'); });`);
  assert.equal(row.finalPassed, true); assert.equal(accepted(row), false);
  const failed = fixture(t, `${spoof} test('actually fails', () => assert.fail('real failure'));`);
  assert.equal(failed.finalPassed, false); assert.equal(accepted(failed), false);
});

test('submitted early exit cannot impersonate a passing test suite', t => {
  const row = fixture(t, "process.exit(0); test('historical bug', () => assert.equal(fixed,true));");
  assert.equal(row.finalPassed, false); assert.equal(accepted(row), false);
});

test('an unrelated whole-suite timeout is not evidence; an isolated completed assertion can establish the witness', t => {
  const row = fixture(t, `test('historical bug', () => assert.equal(fixed,true));
    test('stronger extra behavior', async () => { if(!fixed) await new Promise(res => setTimeout(res,10000)); assert.equal(supported,true); });`);
  assert.equal(row.finalPassed, true); assert.equal(accepted(row), true);
  assert.deepEqual(row.caseWitnesses.map(w => w.path), [['historical bug']]);
});
