import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from './bench.js';
import { runEval } from './eval.js';
import { exportEvaluation } from './eval-export.js';
import { reportEvalComponent } from './eval-component.js';
import { MockExecutor } from '../harness/executors/mock.js';
import { packageMember, verifyReplayPackage } from '../harness/replay-package.js';
import { loadBench } from '../harness/bench.js';
import { collectEvaluationTarget } from '../harness/target.js';
import { ExperimentSession } from '../harness/experiment-session.js';
import { runTrial } from '../harness/runner.js';
import { ExecutorFailure, type Executor } from '../harness/types.js';

async function fixture(t: TestContext, stopped = false) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-export-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), runsRoot = join(root, 'runs'), run = join(runsRoot, 'saved');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# Synthetic export test\n');
  const mock = new MockExecutor(); let calls = 0;
  const executor: Executor = { describe: () => mock.describe(), run: async (...args) => {
    calls++; if (stopped) throw new ExecutorFailure('synthetic stop', { output: 'partial result', tokens: { input: 9, cachedInput: 3, output: 2 }, usageStatus: 'partial' });
    return mock.run(...args);
  } };
  if (!stopped) await runEval({ skillPath: skill, bench, taskIds: ['example-task'], trials: 1, maxCalls: 2,
    executor, judgeExecutor: null, dryRun: false, yes: true, runsRoot, runGroup: 'saved', log: () => {} });
  else {
    const target = collectEvaluationTarget(skill), loaded = loadBench(bench);
    const session = new ExperimentSession({ bench: loaded, target, groupDir: run, workspaces: [join(run, 'example-task/baseline/trial-1')],
      plannedCalls: 2, maxCalls: 2, injected: true, details: { mode: 'inject' } });
    await runTrial({ bench: loaded, target, executor: session.wrap(executor, 'agent'), trials: 1, runsRoot, runGroup: 'saved', log: () => {} }, 'example-task', 'baseline', 1);
    session.finish(new Error('synthetic stop'));
  }
  return { root, bench, skill, run, output: join(root, 'portable'), calls: () => calls };
}

test('export previews are read-only and complete packages replay after original paths disappear', async t => {
  const f = await fixture(t), originalPlan = readFileSync(join(f.run, '_plan.json'), 'utf8');
  const plan = await exportEvaluation(f.run, f.output, { log: () => {} });
  assert.equal(plan.status, 'planned'); assert.equal(plan.modelCalls, 0); assert.ok(!existsSync(f.output));
  await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  assert.equal(readFileSync(join(f.run, '_plan.json'), 'utf8'), originalPlan);
  const moved = join(f.root, 'received package'); renameSync(f.output, moved);
  rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true }); rmSync(f.run, { recursive: true });
  const checksum = spawnSync(process.execPath, [join(moved, 'reproduce.mjs'), '--verify-only'], { encoding: 'utf8' });
  assert.equal(checksum.status, 0, checksum.stderr); assert.equal(JSON.parse(checksum.stdout).modelCalls, 0);
  const replay = spawnSync(process.execPath, [join(moved, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr);
  const data = JSON.parse(replay.stdout); assert.equal(data.evidence.verified, true); assert.equal(data.acceptance.automaticUpgrade, false);
  const inspected = await reportEvalComponent(moved, { replay: true });
  assert.ok('portablePackage' in inspected && inspected.portablePackage.integrityVerified);
  assert.equal(f.calls(), 2);
});

test('stopped exports preserve partial costs and cannot become completed evidence', async t => {
  const f = await fixture(t, true), before = await reportEvalComponent(f.run);
  assert.equal(before.status, 'stopped');
  await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  const replay = spawnSync(process.execPath, [join(f.output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr);
  const data = JSON.parse(replay.stdout); assert.equal(data.status, 'stopped'); assert.equal(data.evidence.verified, false);
  assert.deepEqual(data.costs, 'costs' in before ? before.costs : null);
  assert.equal(data.acceptance.eligibleForUpgrade, false); assert.equal(f.calls(), 1);
});

test('missing inputs, nested destinations and collisions fail without modifying evidence', async t => {
  const f = await fixture(t), original = readFileSync(join(f.run, '_artifacts.json'), 'utf8');
  await assert.rejects(() => exportEvaluation(f.run, join(f.run, 'bad'), { yes: true, log: () => {} }), /outside/);
  mkdirSync(f.output); await assert.rejects(() => exportEvaluation(f.run, f.output, { yes: true, log: () => {} }), /already exists/);
  rmSync(f.output, { recursive: true });
  writeFileSync(join(f.skill, 'SKILL.md'), 'changed');
  await assert.rejects(() => exportEvaluation(f.run, f.output, { yes: true, log: () => {} }), /input changed|unavailable/);
  assert.ok(!existsSync(f.output)); assert.equal(readFileSync(join(f.run, '_artifacts.json'), 'utf8'), original);
});

test('portable inspections reject changed files, extra files and unsafe paths', async t => {
  const f = await fixture(t); await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  for (const path of ['../escape', '/absolute', 'C:/escape', 'a\\b', '.git/config']) assert.throws(() => packageMember(f.output, path), /Unsafe/);
  writeFileSync(join(f.output, 'extra'), 'unexpected'); assert.throws(() => verifyReplayPackage(f.output), /inventory/); rmSync(join(f.output, 'extra'));
  writeFileSync(join(f.output, 'run/manifest.json'), '{}');
  await assert.rejects(() => reportEvalComponent(f.output, { replay: true }), /hash mismatch/);
  const verify = spawnSync(process.execPath, [join(f.output, 'reproduce.mjs'), '--verify-only'], { encoding: 'utf8' });
  assert.equal(verify.status, 2); assert.equal(f.calls(), 2);
});

test('restored input roots still require original fingerprints and CLI exports are plans by default', async t => {
  const f = await fixture(t), restored = join(f.root, 'restored-skill');
  renameSync(f.skill, restored);
  await assert.rejects(() => exportEvaluation(f.run, f.output, { log: () => {} }));
  const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'report', 'eval', f.run, '--export', f.output,
    '--input-root', `target=${restored}`, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'planned'); assert.ok(!existsSync(f.output));
  await exportEvaluation(f.run, f.output, { yes: true, inputRoots: [`target=${restored}`], log: () => {} });
  assert.equal(verifyReplayPackage(f.output).hasManifest, true);
  assert.equal(f.calls(), 2);
});
