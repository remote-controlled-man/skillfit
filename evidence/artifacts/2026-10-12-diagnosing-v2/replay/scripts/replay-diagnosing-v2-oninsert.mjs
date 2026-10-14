// Offline development counterexample replay; this is not a model/Skill efficacy trial.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runVerifier } from '../dist/harness/runner.js';
import { verdictFromOutput } from '../dist/harness/verifier-summary.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const control=resolve(process.argv[2]??join(root,'evidence/artifacts/2026-10-12-diagnosing-v2/oninsert-control'));
const bench=join(root,'evidence/inputs/diagnosing-v2-lru-regression');
const temp=mkdtempSync(join(tmpdir(),'skillfit-v2-oninsert-replay-'));
try {
  const before=join(temp,'before'),after=join(temp,'after');
  cpSync(join(control,'before'),before,{recursive:true});cpSync(join(control,'after'),after,{recursive:true});
  const runTest=dir=>spawnSync(process.execPath,['--test','oninsert-application-history.test.mjs'],{cwd:dir,encoding:'utf8'});
  const red=runTest(before),green=runTest(after);assert.equal(red.status,1);assert.equal(green.status,0);
  // Restore the exact original v1 test set for its original scored observation.
  unlinkSync(join(before,'oninsert-application-history.test.mjs'));
  const b=await runVerifier(bench,'node verifiers/fetch-lifecycle.mjs',before);
  const a=await runVerifier(bench,'node verifiers/fetch-lifecycle.mjs',after);
  const previous=verdictFromOutput(b.output),fixed=verdictFromOutput(a.output);
  assert.equal(previous.score,8/9);assert.equal(fixed.score,1);assert.equal(a.exitCode,0);
  console.log(JSON.stringify({schemaVersion:1,modelCalls:0,before:previous.score,after:fixed.score,
    regressionRed:red.status,regressionGreen:green.status,method:'Manual development repair control, with v1-authored assertion corrected to the public API contract; no frozen grader or canonical fixture edits.'},null,2));
} finally {rmSync(temp,{recursive:true,force:true});}
