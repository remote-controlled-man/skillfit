// Read-only descriptive paired/all-invocation costs. No model calls or billing inference.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvalReport } from '../dist/commands/eval-report.js';
import { COST_METRICS, completeCost } from '../dist/harness/costs.js';
assert.ok(process.argv[2],'Pass the v2 recovery batch runs root.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runsRoot=resolve(process.argv[2]);
const declaration=JSON.parse(readFileSync(join(root,'evidence/plans/2026-10-12-normalize-url-v2-available.json'),'utf8'));
const cohorts=[];
for(const cohort of declaration.cohorts) {
  const runRoot=join(runsRoot,cohort.runGroup);
  const manifest=JSON.parse(readFileSync(join(runRoot,'manifest.json'),'utf8'));parseEvalReport(manifest);
  const metrics={};
  for(const population of ['paired','attempts']) {
    const {baseline,treatment}=manifest.overall.costs[population];metrics[population]={};
    for(const metric of COST_METRICS) {
      const exact=completeCost(baseline,metric)&&completeCost(treatment,metric);
      const totalChange=exact&&baseline.metrics[metric].knownTotal>0?treatment.metrics[metric].knownTotal/baseline.metrics[metric].knownTotal-1:null;
      const basePer=baseline.passes?baseline.metrics[metric].knownTotal/baseline.passes:null;
      const targetPer=treatment.passes?treatment.metrics[metric].knownTotal/treatment.passes:null;
      metrics[population][metric]={baseline:baseline.metrics[metric],treatment:treatment.metrics[metric],totalChange,
        perSuccess:{baseline:basePer,treatment:targetPer,knownLowerBound:!exact},
        perSuccessChange:exact&&basePer>0&&targetPer!==null?targetPer/basePer-1:null};
    }
  }
  const pairs=[];
  for(const task of manifest.tasks)for(let trial=1;trial<=cohort.trials;trial++) {
    const arms=Object.fromEntries(['baseline','treatment'].map(arm=>[arm,JSON.parse(readFileSync(join(runRoot,task.id,arm,`trial-${trial}`,'_result.json'),'utf8'))]));
    const graded=arms.baseline.error===null&&arms.treatment.error===null;
    const misses=Object.fromEntries(['baseline','treatment'].map(arm=>[arm,(arms[arm].checks??[]).filter(c=>!c.pass).map(c=>c.name)]));
    const changedChecks=graded?(arms.baseline.checks??[]).flatMap(check=>{
      const other=arms.treatment.checks?.find(c=>c.name===check.name);return other&&check.pass!==other.pass?[{name:check.name,change:other.pass?'improved':'regressed'}]:[];
    }):[];
    const costChanges={};
    if(graded&&arms.baseline.usageStatus==='final'&&arms.treatment.usageStatus==='final') {
      for(const field of ['input','cachedInput','output']) {
        const a=arms.baseline.tokens?.[field],b=arms.treatment.tokens?.[field];
        if(typeof a==='number'&&typeof b==='number') costChanges[field]={baseline:a,treatment:b,change:a>0?b/a-1:null};
      }
      const a=arms.baseline.tokens,b=arms.treatment.tokens;
      if(typeof a?.input==='number'&&typeof a.cachedInput==='number'&&typeof b?.input==='number'&&typeof b.cachedInput==='number') {
        const x=a.input-a.cachedInput,y=b.input-b.cachedInput;costChanges.uncachedInput={baseline:x,treatment:y,change:x>0?y/x-1:null};
      }
    }
    if(graded) costChanges.durationSeconds={baseline:arms.baseline.durationSeconds,treatment:arms.treatment.durationSeconds,
      change:arms.baseline.durationSeconds>0?arms.treatment.durationSeconds/arms.baseline.durationSeconds-1:null};
    pairs.push({task:task.id,trial,graded,
      baseline:{passed:arms.baseline.passed,score:arms.baseline.score,error:arms.baseline.error,readObserved:arms.baseline.skillTriggered,misses:misses.baseline},
      treatment:{passed:arms.treatment.passed,score:arms.treatment.score,error:arms.treatment.error,readObserved:arms.treatment.skillTriggered,misses:misses.treatment},
      timing:{baseline:arms.baseline.timing,treatment:arms.treatment.timing},
      changedChecks,costChanges});
  }
  cohorts.push({name:cohort.name,runGroup:cohort.runGroup,experiment:manifest.experiment,
    quality:{baseline:manifest.overall.conditions.baseline,treatment:manifest.overall.conditions.treatment,delta:manifest.overall.deltaPassRate,
      scoreDelta:manifest.overall.scoreDelta,verdict:manifest.overall.verdict,stats:manifest.overall.stats},
    runs:{paired:manifest.overall.costs.paired,attempts:manifest.overall.costs.attempts,notInvoked:manifest.overall.costs.notInvoked},metrics,pairs});
}
const availability=JSON.parse(readFileSync(join(runsRoot,declaration.cohorts[0].runGroup,'_availability/receipt.json'),'utf8'));
console.log(JSON.stringify({schemaVersion:1,method:'Cohorts remain separate; readiness spending is separate and never graded. Descriptive costs only, no significance/non-inferiority/billing inference. Model reruns reproduce procedure, not identical samples.',
  actualInvocations:cohorts.reduce((sum,c)=>sum+c.experiment.callsStarted,0)+(availability.executorInvoked?1:0),
  declaredInvocations:declaration.totalAgentInvocations,availability,cohorts},null,2));
