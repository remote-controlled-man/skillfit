import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('usage: node range-parser.mjs <run-dir>');
  process.exit(2);
}
const graderDir = path.dirname(fileURLToPath(import.meta.url));
const canonicalFixture = path.resolve(graderDir, '../fixtures/range-parser');
const ORIGINAL_SOURCE = 'src/range-parser.mjs';

const CHECK_NAMES = [
  'list sorted and unique',
  'ascending range',
  'descending range',
  'mixed input',
  'negative values and ranges',
  'invalid input rejected with TypeError',
  'maxItems enforced with RangeError',
  'suite is a real red-to-green regression test',
];

function emit(score, failures, checkList) {
  console.log(JSON.stringify({
    score,
    maxScore: CHECK_NAMES.length,
    passed: failures.length === 0,
    failures,
    checks: checkList,
  }));
  process.exit(failures.length === 0 ? 0 : 1);
}

function scrubbedEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function completedWith(result, predicate) {
  return (
    !result.error &&
    result.signal == null &&
    typeof result.status === 'number' &&
    predicate(result.status)
  );
}

function copyNonHarnessWorkspace(destination) {
  fs.cpSync(runDir, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(runDir, source).replaceAll('\\', '/');
      return (
        relative === '' ||
        (!relative.split('/').some((segment) => segment === '.git') &&
          !path.basename(source).startsWith('_'))
      );
    },
  });
}

function runSuite(root) {
  return spawnSync(process.execPath, ['--test'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: scrubbedEnv(),
  });
}

let parseRange;
try {
  ({ parseRange } = await import(pathToFileURL(path.join(runDir, ORIGINAL_SOURCE))));
} catch (error) {
  emit(
    0,
    [`import: ${error.message}`],
    CHECK_NAMES.map((name) => ({ name, pass: false })),
  );
}

const checks = [
  ['list sorted and unique', () => assert.deepEqual(parseRange('3, 1, 3, 2'), [1, 2, 3])],
  ['ascending range', () => assert.deepEqual(parseRange('1-3'), [1, 2, 3])],
  ['descending range', () => assert.deepEqual(parseRange('3-1'), [1, 2, 3])],
  ['mixed input', () => assert.deepEqual(parseRange('1-2, 5, 8-7'), [1, 2, 5, 7, 8])],
  ['negative values and ranges', () => assert.deepEqual(parseRange('-3--1, 2'), [-3, -2, -1, 2])],
  // One contract, four inputs: an empty segment, a decimal, bare text, and a non-string. The
  // earlier version scored these as four separate checks, which inflated the facet count without
  // adding a distinction anyone would act on — they all assert the same rejection rule.
  ['invalid input rejected with TypeError', () => {
    assert.throws(() => parseRange('1,,2'), TypeError, 'empty segment');
    assert.throws(() => parseRange('1.5'), TypeError, 'decimal');
    assert.throws(() => parseRange('abc'), TypeError, 'bare text');
    assert.throws(() => parseRange(null), TypeError, 'non-string');
  }],
  ['maxItems enforced with RangeError', () => {
    assert.throws(() => parseRange('1-5', { maxItems: 4 }), RangeError);
  }],
  // Replaces two checks that graded the *text* of the test directory — counting `test(` occurrences
  // and matching /negative|maxItems|invalid|reject/i — both satisfiable by writing empty tests
  // containing the right words. This grades what a regression test is for: it must fail against the
  // original buggy implementation and pass against the final one.
  ['suite is a real red-to-green regression test', () => {
    const finalResult = runSuite(runDir);
    assert.ok(
      completedWith(finalResult, (status) => status === 0),
      `the test suite does not pass against the final implementation: ${String(finalResult.stdout ?? '').slice(-400)}`,
    );
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'range-parser-red-'));
    try {
      copyNonHarnessWorkspace(temporaryRoot);
      fs.copyFileSync(
        path.join(canonicalFixture, ...ORIGINAL_SOURCE.split('/')),
        path.join(temporaryRoot, ...ORIGINAL_SOURCE.split('/')),
      );
      const originalResult = runSuite(temporaryRoot);
      assert.ok(
        completedWith(originalResult, (status) => status !== 0),
        'the test suite still passes against the original buggy implementation — it detects none of the seeded bugs, so it is not a regression test',
      );
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
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
emit(checks.length - failures.length, failures, checkList);
