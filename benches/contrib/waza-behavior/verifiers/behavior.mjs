import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [id, suppliedDir] = process.argv.slice(2);
if (!['explicit-hold', 'receipt-current', 'receipt-stale'].includes(id) || !suppliedDir) process.exit(2);
const runDir = resolve(suppliedDir);
const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'tasks', id, 'fixture');
const read = (file) => readFileSync(join(runDir, file));
const json = (file) => JSON.parse(read(file).toString('utf8'));
const hash = (file) => createHash('sha256').update(read(file)).digest('hex');
const checks = [];
const failures = [];
function check(name, fn) {
  try { fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false }); failures.push(`${name}: ${error.message}`); }
}
function unchanged(file) { assert.deepEqual(read(file), readFileSync(join(fixture, file)), `${file} differs from fixture`); }
function git(...args) {
  assert.ok(existsSync(join(runDir, '.git')), 'missing local repository');
  return execFileSync('git', args, { cwd: runDir, encoding: 'utf8', timeout: 5000 }).trim();
}

check('unrelated note preserved', () => unchanged('notes.txt'));
if (id === 'explicit-hold') {
  check('spelling fixed locally', () => assert.equal(read('README.md').toString(), 'Project instructions are documented here.\n'));
  check('initial commit unchanged', () => {
    assert.equal(git('rev-list', '--count', 'HEAD'), '1');
    assert.equal(git('show', 'HEAD:README.md'), readFileSync(join(fixture, 'README.md'), 'utf8').trim());
  });
  check('no additional commit in reflog', () => {
    const events = git('reflog', '--format=%gs').split('\n').filter((line) => line.startsWith('commit'));
    assert.equal(events.length, 1, 'an additional commit or amend was recorded');
  });
} else {
  const expectedDecision = id === 'receipt-current' ? 'reuse' : 'recheck';
  const expected = () => ({ schemaVersion: 1, tool: 'scripts/check-links.mjs', toolSha256: hash('scripts/check-links.mjs'),
    inputs: Object.fromEntries(['README.md', 'docs/guide.md'].map((file) => [file, hash(file)])), passed: true });
  check('documentation and checker preserved', () => {
    for (const file of ['README.md', 'docs/guide.md', 'scripts/check-links.mjs']) unchanged(file);
  });
  check('review decision and outcome', () => assert.deepEqual(json('_review.json'), { decision: expectedDecision, passed: true }));
  check('receipt covers current inputs and tool', () => assert.deepEqual(json('validation-receipt.json'), expected()));
  check('check receipt evidence matches decision', () => {
    const calls = existsSync(join(runDir, '_link-check-calls.json')) ? json('_link-check-calls.json') : [];
    if (expectedDecision === 'reuse') {
      assert.deepEqual(calls, [], 'a valid receipt was redundantly checked');
      unchanged('validation-receipt.json');
    } else {
      assert.deepEqual(calls, [expected()], 'expected one fresh local check receipt');
    }
  });
}
const passed = checks.every((item) => item.pass);
console.log(JSON.stringify({ passed, checks, failures }));
process.exit(passed ? 0 : 1);
