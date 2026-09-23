import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2]);
let parseRange;
try {
  ({ parseRange } = await import(pathToFileURL(path.join(runDir, 'src/range-parser.mjs'))));
} catch (error) {
  console.log(JSON.stringify({ score: 0, maxScore: 12, passed: false, failures: [`import: ${error.message}`] }));
  process.exit(1);
}

const checks = [
  ['list sorted and unique', () => assert.deepEqual(parseRange('3, 1, 3, 2'), [1, 2, 3])],
  ['ascending range', () => assert.deepEqual(parseRange('1-3'), [1, 2, 3])],
  ['descending range', () => assert.deepEqual(parseRange('3-1'), [1, 2, 3])],
  ['mixed input', () => assert.deepEqual(parseRange('1-2, 5, 8-7'), [1, 2, 5, 7, 8])],
  ['negative values', () => assert.deepEqual(parseRange('-3--1, 2'), [-3, -2, -1, 2])],
  ['empty segment rejected', () => assert.throws(() => parseRange('1,,2'), TypeError)],
  ['decimal rejected', () => assert.throws(() => parseRange('1.5'), TypeError)],
  ['text rejected', () => assert.throws(() => parseRange('abc'), TypeError)],
  ['non-string rejected', () => assert.throws(() => parseRange(null), TypeError)],
  ['maxItems enforced', () => assert.throws(() => parseRange('1-5', { maxItems: 4 }), RangeError)],
];

const failures = [];
for (const [name, check] of checks) {
  try { check(); } catch (error) { failures.push(`${name}: ${error.message}`); }
}
const testRoot = path.join(runDir, 'test');
const testSource = fs.existsSync(testRoot)
  ? fs.readdirSync(testRoot).filter((name) => name.endsWith('.mjs')).map((name) => fs.readFileSync(path.join(testRoot, name), 'utf8')).join('\n')
  : '';
const testCount = (testSource.match(/\btest\s*\(/g) || []).length;
const regressionChecks = [
  ['regression breadth', testCount >= 4],
  ['boundary regression cases', /negative|maxItems|invalid|reject/i.test(testSource)],
];
const regressionScore = regressionChecks.filter(([, passed]) => passed).length;
const behaviorScore = checks.length - failures.length;
const checkList = [
  ...checks.map(([name]) => ({ name, pass: !failures.some((f) => f.startsWith(`${name}:`)) })),
  ...regressionChecks.map(([name, ok]) => ({ name, pass: ok })),
];
const passed = failures.length === 0 && regressionScore === regressionChecks.length;
console.log(JSON.stringify({
  score: behaviorScore + regressionScore,
  maxScore: checks.length + regressionChecks.length,
  passed,
  behaviorScore,
  regressionScore,
  testCount,
  failures,
  checks: checkList,
}));
process.exit(passed ? 0 : 1);
