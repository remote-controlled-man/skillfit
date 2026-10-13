import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checksFor } from './cases.mjs';
import { files, regressionEvidence, testRun } from './regression-evidence.mjs';

const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = resolve(process.argv[2]);
const canonical = join(bench, 'fixtures/query-shape');
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({name, pass: true}); }
  catch (error) { checks.push({name, pass: false, detail: String(error.message).slice(0, 400)}); } };
check('existing assets unchanged and smoke tests pass', () => {
  for (const file of files(canonical).filter(p => p !== 'index.js')) {
    assert.equal(existsSync(join(run,file)), true);
    assert.equal(lstatSync(join(run,file)).isSymbolicLink(), false);
    assert.deepEqual(readFileSync(join(run,file)), readFileSync(join(canonical,file)));
  }
  assert.equal(lstatSync(join(run,'index.js')).isSymbolicLink(), false);
  const smoke = testRun(run, ['test.mjs']);
  assert.equal(smoke.completed && smoke.passed && smoke.tests && smoke.noSkips, true);
});
try {
  const result = spawnSync(process.execPath, [join(bench,'verifiers/probe.mjs'),run], {encoding:'utf8', timeout:5000});
  assert.equal(result.error == null && result.signal == null && result.status === 0, true, 'runtime probe did not complete');
  const value = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.deepEqual(value.checks?.map(c=>c.name), checksFor(undefined).map(([name])=>name));
  assert.ok(value.checks.every(c=>typeof c.pass === 'boolean'));
  checks.push(...value.checks);
} catch (error) { checks.push({name:'runtime probe completeness',pass:false,detail:error.message}); }
let evidence = [];
check('retained regression has submission-pass/original-fail/reference-pass case evidence', () => {
  evidence = regressionEvidence(run, canonical, join(bench,'ground-truth/query-shape'), 'index.js');
  assert.ok(evidence.length > 0 && evidence.every(row=>row.finalPassed) && evidence.some(row=>row.caseWitnesses.length > 0));
});
const passed = checks.every(row=>row.pass);
console.log(JSON.stringify({passed,score:checks.filter(row=>row.pass).length/checks.length,checks,evidence}));
process.exit(passed ? 0 : 1);
