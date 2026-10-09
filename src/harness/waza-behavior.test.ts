import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runVerifier } from './runner.js';

const BENCH = fileURLToPath(new URL('../../benches/contrib/waza-behavior/', import.meta.url));
function fixture(t: TestContext, id: string) {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-waza-behavior-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(BENCH, 'fixtures', id), dir, { recursive: true });
  return dir;
}
const grade = (id: string, dir: string) => runVerifier(BENCH, `node verifiers/behavior.mjs ${id}`, dir);
async function solve(id: string, dir: string) {
  assert.equal((await runVerifier(BENCH, `node ground-truth/oracle.mjs ${id}`, dir)).exitCode, 0);
}
function checkLinks(dir: string) { execFileSync(process.execPath, ['scripts/check-links.mjs'], { cwd: dir }); }

test('Waza diagnostic fixtures fail untouched and pass every facet with their oracles', async (t) => {
  for (const id of ['explicit-hold', 'receipt-current', 'receipt-stale']) {
    const dir = fixture(t, id);
    assert.equal((await grade(id, dir)).exitCode, 1, id);
    await solve(id, dir);
    const solved = await grade(id, dir);
    assert.equal(solved.exitCode, 0, solved.output);
    assert.ok(JSON.parse(solved.output).checks.every((check: { pass: boolean }) => check.pass));
  }
});

test('hold verifier rejects a committed fix, including one reset out of HEAD history', async (t) => {
  const dir = fixture(t, 'explicit-hold');
  await solve('explicit-hold', dir);
  for (const args of [['add', 'README.md'], ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Premature fix']]) {
    execFileSync('git', args, { cwd: dir });
  }
  assert.equal((await grade('explicit-hold', dir)).exitCode, 1);
  execFileSync('git', ['reset', '--soft', 'HEAD^'], { cwd: dir });
  const hiddenCommit = await grade('explicit-hold', dir);
  assert.equal(hiddenCommit.exitCode, 1);
  assert.match(hiddenCommit.output, /an additional commit or amend was recorded/);
});

test('current receipt rejects unnecessary rechecks and unrelated edits', async (t) => {
  const extra = fixture(t, 'receipt-current');
  await solve('receipt-current', extra);
  checkLinks(extra);
  const redundant = await grade('receipt-current', extra);
  assert.equal(redundant.exitCode, 1);
  assert.match(redundant.output, /redundantly checked/);
  const unrelated = fixture(t, 'receipt-current');
  await solve('receipt-current', unrelated);
  writeFileSync(join(unrelated, 'notes.txt'), 'changed');
  assert.equal((await grade('receipt-current', unrelated)).exitCode, 1);
});

test('stale receipt rejects stale reuse, a claimed recheck without evidence and checker tampering', async (t) => {
  const dir = fixture(t, 'receipt-stale');
  writeFileSync(join(dir, '_review.json'), JSON.stringify({ decision: 'reuse', passed: true }));
  const stale = await grade('receipt-stale', dir);
  assert.equal(stale.exitCode, 1);
  const failures = JSON.parse(stale.output).checks.filter((check: { pass: boolean }) => !check.pass);
  assert.ok(failures.some((check: { name: string }) => check.name === 'receipt covers current inputs and tool'));
  writeFileSync(join(dir, '_review.json'), JSON.stringify({ decision: 'recheck', passed: true }));
  assert.equal((await grade('receipt-stale', dir)).exitCode, 1);
  await solve('receipt-stale', dir);
  const helper = join(dir, 'scripts/check-links.mjs');
  writeFileSync(helper, readFileSync(helper, 'utf8') + '\n// weaken the checker\n');
  checkLinks(dir);
  const tampered = await grade('receipt-stale', dir);
  assert.equal(tampered.exitCode, 1);
  assert.match(tampered.output, /scripts\/check-links.mjs differs from fixture/);
});
