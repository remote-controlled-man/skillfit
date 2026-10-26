import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {casesFor} from './cases.mjs';
import {files,regressionEvidence,testRun} from './regression-evidence.mjs';
const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function grade(task, supplied) {
  const run = resolve(supplied), canonical = join(bench,'tasks',task,'fixture');
  const checks = [], check = (name, fn) => {try {fn(); checks.push({name,pass:true});} catch(error) {checks.push({name,pass:false,detail:String(error.message).slice(0,300)});}};
  check('supplied assets unchanged and ordinary smoke tests pass', () => {
    for (const file of files(canonical).filter(file => file !== 'index.js')) {
      assert.equal(existsSync(join(run,file)),true); assert.equal(lstatSync(join(run,file)).isSymbolicLink(),false);
      assert.deepEqual(readFileSync(join(run,file)),readFileSync(join(canonical,file)));
    }
    assert.equal(lstatSync(join(run,'index.js')).isSymbolicLink(),false);
    const result = testRun(run,['test.mjs']); assert.equal(result.completed && result.passed && result.tests && result.noSkips,true);
  });
  try {
    const result = spawnSync(process.execPath,[join(bench,'verifiers/probe.mjs'),task,run],{encoding:'utf8',timeout:5000});
    assert.ok(!result.error && result.signal == null && result.status === 0, 'probe did not complete');
    const value = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.deepEqual(value.checks.map(row => row.name),casesFor(undefined,task).map(([name]) => name));
    assert.ok(value.checks.every(row => typeof row.pass === 'boolean')); checks.push(...value.checks);
  } catch(error) {checks.push({name:'public behavior probe completeness',pass:false,detail:error.message});}
  let evidence = [];
  check('retained regression passes submission and upstream fix but fails original', () => {
    evidence = regressionEvidence(run,canonical,join(bench,'tasks',task,'reference'),'index.js');
    assert.ok(evidence.length > 0 && evidence.every(row => row.finalPassed) && evidence.some(row => row.caseWitnesses.length > 0));
  });
  const passed = checks.every(row => row.pass);
  console.log(JSON.stringify({passed,score:checks.filter(row=>row.pass).length/checks.length,checks,evidence}));
  process.exitCode = passed ? 0 : 1;
}
