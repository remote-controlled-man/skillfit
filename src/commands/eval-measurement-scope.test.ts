import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit, runBenchCheck } from './bench.js';
import { runEvalCli } from './eval-cli.js';
import { runEvalComponent, reportEvalComponent, componentError } from './eval-component.js';
import { prepareBenchSelfTest, runBenchSelfTest } from './bench-self-test.js';
import { exportEvaluation } from './eval-export.js';
import { spawnSync } from 'node:child_process';
import { parseAcceptancePolicy } from '../harness/eval-contract.js';

async function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-scope-mode-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill');
  await runBenchInit({ dir: bench, schemaVersion: 2, yes: true, log: () => {} });
  mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '---\nname: offline\ndescription: Offline scope regression.\n---\nCheck output.');
  const path = join(bench, 'bench.json'), raw = JSON.parse(readFileSync(path, 'utf8'));
  const options = { skillPath: skill, bench, dryRun: false, yes: true, trials: 1, maxCalls: 2,
    runsRoot: join(root, 'runs'), runGroup: 'saved', log: () => {}, sessionOptions: { homeDir: root, env: {} },
    executor: { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => ({ output: 'skillfit-ok', tokens: { input: 100, cachedInput: 20, output: 2 } }) } };
  return { root, bench, skill, path, raw, options, save: () => writeFileSync(path, JSON.stringify(raw)) };
}

test('request policy 2 derives efficiency without a new request objective and survives portable replay', async t => {
  const f = await setup(t); f.raw.tasks[0].claims = ['efficiency']; f.save();
  const request = join(f.root, 'request.json');
  writeFileSync(request, JSON.stringify({ schemaVersion: 1, baselineSkill: null, candidateSkill: f.skill, bench: f.bench,
    agent: 'codex', purpose: 'validation', pairOrder: 'balanced', executorTimeoutSeconds: 30, trials: 1, maxCalls: 2,
    runsRoot: f.options.runsRoot, runGroup: 'saved', policy: parseAcceptancePolicy({ schemaVersion: 2, objective: 'efficiency' }) }));
  const injected = { executor: f.options.executor, skillInstallDir: 'skills', sessionOptions: f.options.sessionOptions };
  const planned = await runEvalComponent(request, { ...injected, dryRun: true });
  assert.ok('plan' in planned); assert.equal(planned.plan.evaluation.measurementScope?.requestedClaim, 'efficiency');
  const result = await runEvalComponent(request, { ...injected, dryRun: false, expectedPlanSha256: planned.plan.sha256 });
  assert.ok('measurementScope' in result); assert.equal(result.measurementScope?.assessment, 'supported');
  assert.equal(result.acceptance.eligibleForUpgrade, false);
  const run = join(f.options.runsRoot, 'saved'), output = join(f.root, 'portable');
  const qualityPolicy = join(f.root, 'quality-policy.json');
  writeFileSync(qualityPolicy, JSON.stringify(parseAcceptancePolicy()));
  const otherObjective = await reportEvalComponent(run, { policyPath: qualityPolicy });
  assert.deepEqual(otherObjective.measurementScope, result.measurementScope, 'report overrides cannot rewrite the frozen efficiency target');
  assert.equal(otherObjective.evidence.verified, true);
  assert.equal(otherObjective.acceptance.eligibleForUpgrade, false);
  assert.ok(otherObjective.acceptance.reasons.some(r => r.code === 'BENCH_CLAIM_UNSUPPORTED'));
  await exportEvaluation(run, output, { yes: true, log: () => {} });
  rmSync(run, { recursive: true }); rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true });
  const saved = await reportEvalComponent(output);
  assert.deepEqual(saved.measurementScope, result.measurementScope); assert.equal(saved.evidence.verified, true);
  const replay = spawnSync(process.execPath, [join(output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr);
  assert.deepEqual(JSON.parse(replay.stdout).measurementScope, result.measurementScope);
});

test('efficiency requests and activation execution refuse incompatible tasks before local probes or executor calls', async t => {
  const f = await setup(t); f.raw.tasks[0].shouldTrigger = false; f.save();
  let calls = 0;
  const executor = { describe: () => ({ kind: 'cli', model: 'offline-stub' }), run: async () => { calls++; return { output: 'skillfit-ok' }; } };
  const marker = join(f.root, 'probe-started');
  writeFileSync(join(f.bench, 'verifiers/example-task.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'started');process.exit(1);`);
  const request = join(f.root, 'request.json');
  writeFileSync(request, JSON.stringify({ schemaVersion: 1, baselineSkill: null, candidateSkill: f.skill, bench: f.bench,
    agent: 'codex', purpose: 'validation', trials: 1, maxCalls: 2, runsRoot: f.options.runsRoot, runGroup: 'saved',
    policy: { schemaVersion: 2, objective: 'efficiency' } }));
  const injected = { executor, skillInstallDir: 'skills', sessionOptions: f.options.sessionOptions };
  const preview = await runEvalComponent(request, { ...injected, dryRun: true }); assert.ok('plan' in preview);
  assert.equal(preview.measurementScope?.assessment, 'unsupported');
  await assert.rejects(runEvalComponent(request, { ...injected, dryRun: false, expectedPlanSha256: preview.plan.sha256 }), error => {
    assert.equal(componentError(error).error.code, 'BENCH_CLAIM_UNSUPPORTED'); return true;
  });
  await assert.rejects(runEvalCli({ ...f.options, executor, mode: 'trigger', skillInstallDir: 'skills' }), /BENCH_CLAIM_UNSUPPORTED/);
  const { existsSync } = await import('node:fs');
  assert.equal(calls, 0); assert.equal(existsSync(marker), false); assert.equal(existsSync(f.options.runsRoot), false);
});

test('trigger requests activation for both labels and calibration declares no efficacy target', async t => {
  const f = await setup(t);
  const packages: { output: string; scope: unknown }[] = [];
  for (const shouldTrigger of [false, true]) {
    f.raw.tasks[0].claims = ['activation']; f.raw.tasks[0].shouldTrigger = shouldTrigger; f.save();
    const runGroup = `trigger-${shouldTrigger}`;
    const trigger = await runEvalCli({ ...f.options, runGroup, mode: 'trigger', skillInstallDir: 'skills',
      executor: { describe: () => ({ kind: 'cli', model: 'offline-stub' }), run: async () => ({ output: 'skillfit-ok', skillTriggered: shouldTrigger }) } });
    assert.equal(trigger.measurementScope?.requestedClaim, 'activation'); assert.ok('evidence' in trigger); assert.equal(trigger.evidence.verified, true);
    const output = join(f.root, `portable-${runGroup}`);
    await exportEvaluation(join(f.options.runsRoot, runGroup), output, { yes: true, log: () => {} });
    packages.push({ output, scope: trigger.measurementScope });
  }
  await runBenchCheck({ dir: f.bench, calibrate: { ...f.options, executor: f.options.executor, runGroup: 'calibration' }, log: () => {} });
  const calibration = await reportEvalComponent(join(f.options.runsRoot, 'calibration'));
  assert.equal(calibration.measurementScope?.requestedClaim, null); assert.equal(calibration.measurementScope?.assessment, 'not-applicable');
  assert.equal(calibration.evidence.verified, true);
  assert.ok('summary' in calibration && calibration.summary && 'tasks' in calibration.summary);
  assert.ok('diagnostics' in calibration.summary.tasks[0]!);
  assert.match(JSON.stringify(calibration.summary.tasks[0]!.diagnostics), /requires-paired-costs/);
  const output = join(f.root, 'portable-calibration');
  await exportEvaluation(join(f.options.runsRoot, 'calibration'), output, { yes: true, log: () => {} });
  packages.push({ output, scope: calibration.measurementScope });
  rmSync(f.options.runsRoot, { recursive: true }); rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true });
  for (const saved of packages) {
    const current = await reportEvalComponent(saved.output);
    assert.equal(current.evidence.verified, true); assert.deepEqual(current.measurementScope, saved.scope);
    const replay = spawnSync(process.execPath, [join(saved.output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(replay.status, 0, replay.stderr);
    assert.deepEqual(JSON.parse(replay.stdout).measurementScope, saved.scope);
  }
});

test('schema 2 self-test stays diagnostic even when tasks only declare efficiency', async t => {
  const f = await setup(t), example = fileURLToPath(new URL('../../benches/_self-test/example/', import.meta.url));
  rmSync(f.bench, { recursive: true }); cpSync(example, f.bench, { recursive: true });
  const raw = JSON.parse(readFileSync(f.path, 'utf8')); raw.schemaVersion = 2;
  for (const task of raw.tasks) task.claims = ['efficiency']; writeFileSync(f.path, JSON.stringify(raw));
  const prepared = await prepareBenchSelfTest({ dir: f.bench, runsRoot: f.options.runsRoot, runGroup: 'controls', yes: true, log: () => {} });
  assert.ok(prepared.configured);
  assert.ok(prepared.plan.suites.every(s => s.evaluation.evaluation.measurementScope?.assessment === 'not-applicable'));
  const result = await runBenchSelfTest({ dir: f.bench, runsRoot: f.options.runsRoot, runGroup: 'controls', yes: true, log: () => {} });
  assert.equal(result.status, 'passed'); assert.equal(result.harnessModelCalls, 0);
});
