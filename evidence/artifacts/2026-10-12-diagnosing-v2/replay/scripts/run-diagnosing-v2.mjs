// Explicit live pilot entry point. Never imported by the offline tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runEval } from '../dist/commands/eval.js';
import { runBenchCheck } from '../dist/commands/bench.js';
import { loadBench } from '../dist/harness/bench.js';
import { collectInstalledSkillTarget } from '../dist/harness/installed-skill.js';
import { hashFileSet, listFilesRecursive, sha256File } from '../dist/harness/hash.js';
import { getAgent } from '../dist/agents.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({options:{
  phase:{type:'string',default:'plan'},
  'runs-root':{type:'string',default:join(tmpdir(),'skillfit-diagnosing-v2-20261012')},
}});
assert.ok(['plan','regression','transfer'].includes(values.phase),'phase must be plan, regression or transfer');
const declaration = JSON.parse(readFileSync(join(root,'evidence/plans/2026-10-12-diagnosing-v2.json'),'utf8'));
const runsRoot = resolve(values['runs-root']);
// Additional user-referenced instruction file; matrix-listed rules locate its parent.
const rulesSpec=getAgent(declaration.configured.agent).rules.userFiles[0];
const rulesPath=rulesSpec.replace(/^~\//,homedir()+'/');
const rtkPath=join(dirname(rulesPath),'RTK.md');
const checkExtraInstruction=()=>assert.equal(sha256File(rtkPath),declaration.environment.rtkSha256,'Referenced RTK instruction changed; retain this cohort and declare a fresh pilot.');
checkExtraInstruction();
for (const input of [declaration.baseline,declaration.treatment]) {
  assert.equal(collectInstalledSkillTarget(join(root,input.path)).sha256,input.sha256,'Frozen Skill changed; declare a new study.');
}
assert.equal(hashFileSet(join(root,'dist'),listFilesRecursive(join(root,'dist'))),declaration.runner.compiledSha256,'Frozen compiled runner changed.');
assert.equal(sha256File(fileURLToPath(import.meta.url)),declaration.runner.entrypointSha256,'Frozen entry point changed.');
for (const cohort of declaration.cohorts) assert.equal(loadBench(join(root,cohort.bench.path)).contentSha256,cohort.bench.sha256,'Frozen bench changed.');
if (values.phase === 'transfer') {
  const previous=JSON.parse(readFileSync(join(runsRoot,declaration.cohorts[0].runGroup,'_session.json'),'utf8'));
  assert.equal(previous.status,'completed','Execution errors/drift stop this pilot; retain partial records without replacement calls.');
}
for (const cohort of declaration.cohorts) {
  if (values.phase !== 'plan' && values.phase !== cohort.name) continue;
  const bench=join(root,cohort.bench.path);
  const gate=await runBenchCheck({dir:bench});
  assert.equal(gate.failures,0,'Offline bench gate failed.');
  await runEval({skillPath:join(root,declaration.treatment.path),baselineSkillPath:join(root,declaration.baseline.path),
    bench,mode:'installed',inputMode:'workspace',agent:declaration.configured.agent,judgeExecutor:null,
    trials:cohort.trials,maxCalls:cohort.calls,dryRun:values.phase==='plan',yes:true,runsRoot,runGroup:cohort.runGroup});
  checkExtraInstruction();
}
