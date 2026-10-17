import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadBench } from './bench.js';
import { parseVerifierTimeoutSeconds } from './verifier-timeout.js';
import { runTrial, runVerifier } from './runner.js';
import { collectSkillBundle } from './bundle.js';
import { runTriggerExperiment } from './trigger.js';
import { runBenchCheck, runBenchInit } from '../commands/bench.js';
import { manageBench } from '../commands/bench-manage.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-verifier-deadline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), run = join(root, 'run'), skill = join(root, 'skill');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  mkdirSync(run); mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: timeout-skill\ndescription: Offline deadline regression.\n---\nCheck output.\n');
  return { root, bench, run, skill, manifest: join(bench, 'bench.json') };
}

test('case deadlines validate, persist through editing, and keep the historical default when absent', async t => {
  const f = await fixture(t), raw = JSON.parse(readFileSync(f.manifest, 'utf8'));
  assert.equal(parseVerifierTimeoutSeconds(), 120);
  assert.equal(loadBench(f.bench).tasks[0]!.verifierTimeoutSeconds, undefined);
  for (const value of [0, -1, 1.2, 3601, '5', null]) {
    raw.tasks[0].verifierTimeoutSeconds = value; writeFileSync(f.manifest, JSON.stringify(raw));
    assert.throws(() => loadBench(f.bench), /verifierTimeoutSeconds/);
  }
  raw.tasks[0].verifierTimeoutSeconds = 600; writeFileSync(f.manifest, JSON.stringify(raw));
  assert.equal(loadBench(f.bench).tasks[0]!.verifierTimeoutSeconds, 600);
  manageBench({ dir: f.bench, taskId: 'example-task', action: 'edit', set: ['verifierTimeoutSeconds=900'], yes: true, log: () => {} });
  assert.equal(loadBench(f.bench).tasks[0]!.verifierTimeoutSeconds, 900);
  manageBench({ dir: f.bench, taskId: 'example-task', action: 'edit', unset: ['verifierTimeoutSeconds'], yes: true, log: () => {} });
  assert.equal(loadBench(f.bench).tasks[0]!.verifierTimeoutSeconds, undefined);
});

test('a verifier uses its configured deadline and a longer deadline permits the same offline command', async t => {
  const f = await fixture(t);
  writeFileSync(join(f.bench, 'slow.mjs'), "setTimeout(()=>{console.log(JSON.stringify({passed:true}));},1500);");
  const stopped = await runVerifier(f.bench, 'node slow.mjs', f.run, 1);
  assert.equal(stopped.exitCode, null); assert.match(stopped.error!, /timed out after 1000ms/);
  const completed = await runVerifier(f.bench, 'node slow.mjs', f.run, 5);
  assert.equal(completed.exitCode, 0); assert.equal(completed.error, null);
});

test('bench check uses the case deadline for oracle commands', async t => {
  const f = await fixture(t), raw = JSON.parse(readFileSync(f.manifest, 'utf8'));
  raw.tasks[0].verifierTimeoutSeconds = 1;
  raw.tasks[0].oracle = 'node slow-oracle.mjs';
  writeFileSync(join(f.bench, 'slow-oracle.mjs'), 'setTimeout(()=>process.exit(0),1500);');
  writeFileSync(f.manifest, JSON.stringify(raw));
  const report = await runBenchCheck({ dir: f.bench, log: () => {} });
  assert.ok(report.checks.some(check => check.code === 'ORACLE' && check.status === 'FAIL' && check.message.includes('timed out after 1000ms')));
});

test('paired and trigger execution classify a case deadline as an ungraded error and retain usage', async t => {
  const f = await fixture(t), raw = JSON.parse(readFileSync(f.manifest, 'utf8'));
  raw.tasks[0].verifierTimeoutSeconds = 1; raw.tasks[0].shouldTrigger = true;
  raw.tasks[0].verifier = 'node slow.mjs';
  writeFileSync(join(f.bench, 'slow.mjs'), 'setTimeout(()=>process.exit(0),1500);');
  writeFileSync(f.manifest, JSON.stringify(raw));
  const bench = loadBench(f.bench), skill = collectSkillBundle(f.skill, 'timeout-skill');
  const executor = { describe: () => ({ kind: 'cli', model: 'injected-offline-stub' }), run: async () => ({ output: 'done', tokens: { input: 20, cachedInput: 5, output: 3 }, skillTriggered: true }) };
  const paired = await runTrial({ bench, target: skill, executor, trials: 1, runsRoot: f.root, runGroup: 'paired' }, 'example-task', 'baseline', 1);
  assert.equal(paired.verifierPassed, null); assert.match(paired.error!, /timed out after 1000ms/); assert.equal(paired.tokens!.input, 20);
  await runTriggerExperiment({ bench, skill, executor, trials: 1, runsRoot: f.root, runGroup: 'trigger', skillInstallDir: 'skills' });
  const trigger = JSON.parse(readFileSync(join(f.root, 'trigger/example-task/installed/trial-1/_result.json'), 'utf8'));
  assert.match(trigger.error, /timed out after 1000ms/); assert.equal(trigger.tokens.input, 20);
});
