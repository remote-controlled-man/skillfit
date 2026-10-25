import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runVerifier } from "./execution/paired.js";

const BENCH = fileURLToPath(new URL("../../benches/contrib/waza-behavior/", import.meta.url));
function fixture(t: TestContext, id: string) {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-waza-behavior-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(BENCH, 'fixtures', id), dir, { recursive: true });
  return dir;
}
const grade = (id: string, dir: string) => runVerifier(BENCH, `node verifiers/behavior.mjs ${id}`, dir);
async function solve(id: string, dir: string) {
  assert.equal((await runVerifier(BENCH, `node ground-truth/oracle.mjs ${id}`, dir)).exitCode, 0);
}
function checkLinks(dir: string) { execFileSync(process.execPath, ['scripts/check-links.mjs'], { cwd: dir }); }

test('Waza diagnostic fixtures fail untouched and pass every facet with their oracles', async (t) => {
  for (const id of ['explicit-hold', 'receipt-current', 'receipt-stale']) {
    const dir = fixture(t, id);
    assert.equal((await grade(id, dir)).exitCode, 1, id);
    await solve(id, dir);
    const solved = await grade(id, dir);
    assert.equal(solved.exitCode, 0, solved.output);
    assert.ok(JSON.parse(solved.output).checks.every((check: { pass: boolean }) => check.pass));
  }
});

test('hold verifier rejects a committed fix, including one reset out of HEAD history', async (t) => {
  const dir = fixture(t, 'explicit-hold');
  await solve('explicit-hold', dir);
  for (const args of [['add', 'README.md'], ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Premature fix']]) {
    execFileSync('git', args, { cwd: dir });
  }
  assert.equal((await grade('explicit-hold', dir)).exitCode, 1);
  execFileSync('git', ['reset', '--soft', 'HEAD^'], { cwd: dir });
  const hiddenCommit = await grade('explicit-hold', dir);
  assert.equal(hiddenCommit.exitCode, 1);
  assert.match(hiddenCommit.output, /an additional commit or amend was recorded/);
});

test('current receipt rejects unnecessary rechecks and unrelated edits', async (t) => {
  const extra = fixture(t, 'receipt-current');
  await solve('receipt-current', extra);
  checkLinks(extra);
  const redundant = await grade('receipt-current', extra);
  assert.equal(redundant.exitCode, 1);
  assert.match(redundant.output, /redundantly checked/);
  const unrelated = fixture(t, 'receipt-current');
  await solve('receipt-current', unrelated);
  writeFileSync(join(unrelated, 'notes.txt'), 'changed');
  assert.equal((await grade('receipt-current', unrelated)).exitCode, 1);
});

test('stale receipt rejects stale reuse, a claimed recheck without evidence and checker tampering', async (t) => {
  const dir = fixture(t, 'receipt-stale');
  writeFileSync(join(dir, '_review.json'), JSON.stringify({ decision: 'reuse', passed: true }));
  const stale = await grade('receipt-stale', dir);
  assert.equal(stale.exitCode, 1);
  const failures = JSON.parse(stale.output).checks.filter((check: { pass: boolean }) => !check.pass);
  assert.ok(failures.some((check: { name: string }) => check.name === 'receipt covers current inputs and tool'));
  writeFileSync(join(dir, '_review.json'), JSON.stringify({ decision: 'recheck', passed: true }));
  assert.equal((await grade('receipt-stale', dir)).exitCode, 1);
  await solve('receipt-stale', dir);
  const helper = join(dir, 'scripts/check-links.mjs');
  writeFileSync(helper, readFileSync(helper, 'utf8') + '\n// weaken the checker\n');
  checkLinks(dir);
  const tampered = await grade('receipt-stale', dir);
  assert.equal(tampered.exitCode, 1);
  assert.match(tampered.output, /scripts\/check-links.mjs differs from fixture/);
});

test('hold initialization overrides disabled global reflog without changing global configuration', async (t) => {
  const dir = fixture(t, 'explicit-hold');
  const globalConfig = join(dir, '_global-git-config');
  writeFileSync(globalConfig, '[core]\nlogAllRefUpdates = false\n');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: globalConfig };
  const runner = new URL("./execution/paired.js", import.meta.url).href;
  const script = `import {gitInit} from ${JSON.stringify(runner)};
    if(!await gitInit(process.argv[1]))throw new Error('Git initialization failed');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script, dir], { env });
  await solve('explicit-hold', dir);
  const result = await grade('explicit-hold', dir);
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(readFileSync(globalConfig, 'utf8'), '[core]\nlogAllRefUpdates = false\n');

  const oracleDir = fixture(t, 'explicit-hold');
  execFileSync(process.execPath, [join(BENCH, 'ground-truth/oracle.mjs'), 'explicit-hold', oracleDir], { env });
  assert.equal((await grade('explicit-hold', oracleDir)).exitCode, 0);
});

test('unavailable command-task reflog excludes both arms before any executor calls', (t) => {
  const root = fixture(t, 'receipt-current');
  const runner = new URL("./execution/paired.js", import.meta.url).href;
  const benchModule = new URL("../bench/read.js", import.meta.url).href;
  const script = `import {runExperiment} from ${JSON.stringify(runner)};
    import {loadBench} from ${JSON.stringify(benchModule)};
    let calls=0;
    const bench=loadBench(${JSON.stringify(BENCH)});bench.tasks=bench.tasks.filter(t=>t.id==='explicit-hold');
    const manifest=await runExperiment({bench,target:{kind:'skill',name:'offline',sourceDir:process.argv[1],files:[],sha256:'0'.repeat(64),payload:null,overlays:{}},
      executor:{describe:()=>({kind:'mock',model:'offline'}),run:async()=>{calls++;return {output:'must not run'};}},
      inputMode:'workspace',trials:1,runsRoot:process.argv[1],runGroup:'excluded'});
    console.log(JSON.stringify({calls,overall:manifest.overall.conditions}));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script, root], { encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.logAllRefUpdates', GIT_CONFIG_VALUE_0: 'false' } });
  const result = JSON.parse(output);
  assert.equal(result.calls, 0);
  for (const condition of ['baseline', 'treatment']) {
    assert.equal(result.overall[condition].trials, 0);
    assert.equal(result.overall[condition].errors, 1);
    const receipt = JSON.parse(readFileSync(join(root, 'excluded', 'explicit-hold', condition, 'trial-1', '_result.json'), 'utf8'));
    assert.match(receipt.error, /Git initialization or reflog verification failed/);
    assert.equal(receipt.verifierExitCode, null);
  }
});

test('unavailable trigger-task Git setup makes no executor call and is excluded from trigger rates', (t) => {
  const root = fixture(t, 'receipt-current');
  const trigger = new URL("./execution/activation.js", import.meta.url).href;
  const bundle = new URL("../resources/skill.js", import.meta.url).href;
  const benchModule = new URL("../bench/read.js", import.meta.url).href;
  mkdirSync(join(root, 'skill'));
  writeFileSync(join(root, 'skill', 'SKILL.md'), '# offline trigger fixture\n');
  const script = `import {runTriggerExperiment} from ${JSON.stringify(trigger)};
    import {collectSkillBundle} from ${JSON.stringify(bundle)};
    import {loadBench} from ${JSON.stringify(benchModule)};
    let calls=0;
    const bench=loadBench(${JSON.stringify(BENCH)});bench.tasks=bench.tasks.filter(t=>t.id==='explicit-hold');
    const manifest=await runTriggerExperiment({bench,skill:collectSkillBundle(process.argv[1]+'/skill','offline'),
      executor:{describe:()=>({kind:'stub',model:'offline'}),run:async()=>{calls++;return {output:'done',skillTriggered:true};}},
      trials:1,runsRoot:process.argv[1],runGroup:'trigger-excluded',skillInstallDir:'project-skills'});
    console.log(JSON.stringify({calls,manifest}));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script, root], { encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.logAllRefUpdates', GIT_CONFIG_VALUE_0: 'false' } });
  const { calls, manifest } = JSON.parse(output);
  assert.equal(calls, 0);
  assert.equal(manifest.tasks[0].errors, 1);
  assert.equal(manifest.metrics.positives.runs, 0);
  assert.equal(manifest.metrics.negatives.runs, 0);
  const receipt = JSON.parse(readFileSync(join(root, 'trigger-excluded', 'explicit-hold', 'installed', 'trial-1', '_result.json'), 'utf8'));
  assert.match(receipt.error, /Git initialization or reflog verification failed/);
  assert.equal(receipt.triggered, null);
});
