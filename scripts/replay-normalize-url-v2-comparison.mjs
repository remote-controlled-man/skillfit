// Read-only offline regrade and cost audit. No model or agent CLI invocation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBench } from '../dist/harness/bench.js';
import { runVerifier } from '../dist/harness/runner.js';
import { summarizeCosts } from '../dist/harness/costs.js';
import { verdictFromOutput } from '../dist/harness/verifier-summary.js';
import { parseEvalReport } from '../dist/commands/eval-report.js';
import { collectInstalledSkillTarget } from '../dist/harness/installed-skill.js';

assert.ok(process.argv[2], 'Pass a retained v2 recovery batch run-group directory.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runRoot=resolve(process.argv[2]);
const declaration=JSON.parse(readFileSync(join(root,'evidence/plans/2026-10-12-normalize-url-v2-comparison.json'),'utf8'));
const manifest=JSON.parse(readFileSync(join(runRoot,'manifest.json'),'utf8'));
parseEvalReport(manifest);
const cohort=declaration.cohorts.find(c=>c.runGroup===manifest.runGroup);
assert.ok(cohort,'Run group does not belong to this declaration.');
const bench=loadBench(join(root,cohort.bench.path));
assert.equal(bench.contentSha256,cohort.bench.sha256,'Frozen bench changed.');
const rows=[],all={baseline:[],treatment:[]},survivors={baseline:[],treatment:[]};
let invocationCount=0;
for (const task of bench.tasks) {
  const taskAll={baseline:[],treatment:[]},taskSurvivors={baseline:[],treatment:[]};
  for(let trial=1;trial<=cohort.trials;trial++) {
    const pair={};
    for(const arm of ['baseline','treatment']) {
      const dir=join(runRoot,task.id,arm,`trial-${trial}`);
      const receipt=JSON.parse(readFileSync(join(dir,'_result.json'),'utf8'));
      assert.equal(typeof receipt.executorInvoked,'boolean','Invocation coverage unrecorded.');
      assert.ok(['final','partial','unknown'].includes(receipt.usageStatus),'Usage status unrecorded.');
      pair[arm]=receipt;all[arm].push(receipt);taskAll[arm].push(receipt);
      if(receipt.executorInvoked) invocationCount++;
      assert.equal(receipt.timing.clock,'performance.now','New receipts require monotonic cost timing.');
      if(receipt.executorInvoked) {
        assert.ok(receipt.timing.execution,'CLI timing diagnostics are missing.');
        assert.equal(receipt.timing.execution.timeoutMs,declaration.configured.timeoutSeconds*1000);
        assert.ok(receipt.durationSeconds>=receipt.timing.execution.elapsedMs/1000-0.002,'Trial interval cannot be shorter than its CLI interval.');
      }
      assert.equal(collectInstalledSkillTarget(join(dir,manifest.skillDelivery.installDir,manifest.target.name)).sha256,
        receipt.target.bundleSha256,'Installed resources differ from the recorded arm.');
      if(receipt.error!==null) {rows.push({task:task.id,arm,trial,excluded:true,invoked:receipt.executorInvoked,error:receipt.error});continue;}
      assert.equal(receipt.timing.execution.anomaly,null,'An interrupted invocation cannot be a graded success.');
      assert.equal(receipt.timing.execution.timeoutFiredAfterMs,null,'A timed-out invocation cannot be graded.');
      const result=await runVerifier(bench.dir,task.verifier,dir);
      const summary=verdictFromOutput(result.output);
      assert.notEqual(result.exitCode,null,'Offline verifier unavailable.');assert.ok(summary);
      assert.equal(result.exitCode,receipt.verifierExitCode);assert.equal(result.exitCode===0,receipt.passed);
      assert.equal(summary.score,receipt.score);
      assert.deepEqual(summary.checks?.map(({name,pass})=>({name,pass})),receipt.checks?.map(({name,pass})=>({name,pass})));
      rows.push({task:task.id,arm,trial,excluded:false,matched:true,passed:receipt.passed,score:receipt.score});
    }
    if(pair.baseline.error===null&&pair.treatment.error===null) for(const arm of ['baseline','treatment']) {
      survivors[arm].push(pair[arm]);taskSurvivors[arm].push(pair[arm]);
    }
  }
  assert.deepEqual(summarizeCosts(taskAll,taskSurvivors),manifest.tasks.find(t=>t.id===task.id).costs,'Per-task cost receipt audit differs.');
}
assert.deepEqual(summarizeCosts(all,survivors),manifest.overall.costs,'Overall cost receipt audit differs.');
const ledger=readFileSync(join(runRoot,'_calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(row=>JSON.parse(row));
assert.equal(ledger.filter(row=>row.event==='started'&&row.role==='agent').length,invocationCount,'Call ledger and invocation receipts disagree.');
assert.equal(new Set(ledger.filter(row=>row.event==='started').map(row=>row.promptSha256)).size,1,'Prompts must be identical across this one-task paired batch.');
console.log(JSON.stringify({schemaVersion:1,cohort:cohort.name,runGroup:manifest.runGroup,benchSha256:bench.contentSha256,
  matched:rows.filter(row=>row.matched).length,excluded:rows.filter(row=>row.excluded).length,
  invocationCount,costsMatch:true,rows},null,2));
