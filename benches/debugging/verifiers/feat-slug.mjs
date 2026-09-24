import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('usage: node feat-slug.mjs <run-dir>');
  process.exit(2);
}
const graderDir = path.dirname(fileURLToPath(import.meta.url));
const canonicalFixture = path.resolve(graderDir, '../fixtures/feat-slug');
const VISIBLE_TEST = 'test/slug.test.mjs';

function scrubbedEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

// The visible suite is the task's specification, so it is also the thing an agent can edit to win.
// Grading by running it in place let a run pass by replacing its assertions; comparing it against
// the canonical fixture first is what makes running it meaningful.
function visibleTestTampered() {
  const canonical = path.join(canonicalFixture, ...VISIBLE_TEST.split('/'));
  const actual = path.join(runDir, ...VISIBLE_TEST.split('/'));
  if (!fs.existsSync(canonical)) return false;
  if (!fs.existsSync(actual)) return true;
  const normalize = (file) => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').trim();
  return normalize(canonical) !== normalize(actual);
}

let slugify;
try {
  ({ slugify } = await import(pathToFileURL(path.join(runDir, 'src/slug.mjs'))));
} catch (error) {
  console.log(JSON.stringify({
    score: 0,
    maxScore: 6,
    passed: false,
    failures: [`import: ${error.message}`],
    checks: [
      { name: 'visible suite unmodified', pass: false },
      { name: 'visible tests pass', pass: false },
      { name: 'separator runs collapse', pass: false },
      { name: 'surrounding noise trimmed', pass: false },
      { name: 'empty and symbol-only input', pass: false },
      { name: 'non-ascii stays well-formed', pass: false },
    ],
  }));
  process.exit(1);
}

function runVisibleTests() {
  return spawnSync(process.execPath, ['--test', path.join(runDir, ...VISIBLE_TEST.split('/'))], {
    cwd: runDir,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
    env: scrubbedEnv(),
  });
}

// A slug shape that follows from the visible contract without pinning anything the task leaves open:
// no leading or trailing separator, and no collapsed run longer than one.
function assertWellFormedSlug(value) {
  assert.equal(typeof value, 'string', 'slugify must return a string');
  assert.ok(!value.startsWith('-'), `slug starts with a separator: ${JSON.stringify(value)}`);
  assert.ok(!value.endsWith('-'), `slug ends with a separator: ${JSON.stringify(value)}`);
  assert.ok(!value.includes('--'), `slug has an uncollapsed separator run: ${JSON.stringify(value)}`);
}

const checks = [
  ['visible suite unmodified', () => assert.equal(visibleTestTampered(), false, `${VISIBLE_TEST} differs from the fixture copy — the task's specification was edited, not satisfied`)],
  ['visible tests pass', () => {
    const result = runVisibleTests();
    assert.ok(!result.error, `node --test could not run: ${result.error?.message ?? 'unknown'}`);
    assert.equal(result.status, 0, `the visible suite failed:\n${(result.stdout ?? '') + (result.stderr ?? '')}`);
  }],
  ['separator runs collapse', () => {
    assert.equal(slugify('a---b'), 'a-b');
    assert.equal(slugify('a  b'), 'a-b');
    assert.equal(slugify('a__b'), 'a-b');
    assert.equal(slugify('a!@#b'), 'a-b');
  }],
  ['surrounding noise trimmed', () => {
    assert.equal(slugify('--hello--'), 'hello');
    assert.equal(slugify('  hello  '), 'hello');
    assert.equal(slugify('!hello!'), 'hello');
  }],
  ['empty and symbol-only input', () => {
    assert.equal(slugify(''), '');
    assert.equal(slugify('!!!'), '');
    assert.equal(slugify('___'), '');
    assert.equal(slugify('   '), '');
  }],
  // Deliberately shape-only. The visible suite never specifies accent handling, and folding
  // ("cafe-bar") and dropping ("caf-bar") are both defensible readings, so pinning either would
  // grade an invented requirement. What is pinned follows from the trim/collapse contract.
  ['non-ascii stays well-formed', () => {
    for (const input of ['Café Déjà--Vu!!', 'naïve_über-cool', '你好 world', 'Ωμέγα']) {
      assertWellFormedSlug(slugify(input));
    }
  }],
];

const failures = [];
const checkList = [];
for (const [name, check] of checks) {
  try {
    check();
    checkList.push({ name, pass: true });
  } catch (error) {
    checkList.push({ name, pass: false });
    failures.push(`${name}: ${error.message}`);
  }
}
const passed = failures.length === 0;
console.log(JSON.stringify({
  score: checks.length - failures.length,
  maxScore: checks.length,
  passed,
  failures,
  checks: checkList,
}));
process.exit(passed ? 0 : 1);
