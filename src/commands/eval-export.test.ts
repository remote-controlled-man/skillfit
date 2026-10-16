import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from './bench.js';
import { runEval } from './eval.js';
import { exportEvaluation } from './eval-export.js';
import { reportEvalComponent } from './eval-component.js';
import { MockExecutor } from '../harness/executors/mock.js';
import { packageFiles, packageMember, verifyReplayPackage } from '../harness/replay-package.js';
import { sha256File, sha256Text } from '../harness/hash.js';
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
  const before = await reportEvalComponent(f.run);
  rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true });
  const movedRun = join(f.root, 'moved native run'); renameSync(f.run, movedRun); f.run = movedRun;
  const plan = await exportEvaluation(f.run, f.output, { log: () => {} });
  assert.equal(plan.status, 'planned'); assert.equal(plan.modelCalls, 0); assert.ok(!existsSync(f.output));
  assert.equal(plan.inputSource, 'sealed-snapshot');
  await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  assert.equal(readFileSync(join(f.run, '_plan.json'), 'utf8'), originalPlan);
  const moved = join(f.root, 'received package'); renameSync(f.output, moved);
  rmSync(f.run, { recursive: true });
  const checksum = spawnSync(process.execPath, [join(moved, 'reproduce.mjs'), '--verify-only'], { encoding: 'utf8' });
  assert.equal(checksum.status, 0, checksum.stderr); assert.equal(JSON.parse(checksum.stdout).modelCalls, 0);
  const replay = spawnSync(process.execPath, [join(moved, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr);
  const data = JSON.parse(replay.stdout); assert.equal(data.evidence.verified, true); assert.equal(data.acceptance.automaticUpgrade, false);
  assert.deepEqual(data.costs, 'costs' in before ? before.costs : null);
  assert.deepEqual(data.casePreflight, JSON.parse(originalPlan).details.casePreflight, 'export retains the original probes, including offline timing and unknowns');
  const inspected = await reportEvalComponent(moved, { replay: true });
  assert.ok('portablePackage' in inspected && inspected.portablePackage.integrityVerified);
  assert.equal(f.calls(), 2);
});

test('stopped exports preserve partial costs and cannot become completed evidence', async t => {
  const f = await fixture(t, true), before = await reportEvalComponent(f.run);
  assert.equal(before.status, 'stopped');
  rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true });
  await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  const replay = spawnSync(process.execPath, [join(f.output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr);
  const data = JSON.parse(replay.stdout); assert.equal(data.status, 'stopped'); assert.equal(data.evidence.verified, false);
  assert.deepEqual(data.costs, 'costs' in before ? before.costs : null);
  assert.equal(data.acceptance.eligibleForUpgrade, false); assert.equal(f.calls(), 1);
});

test('changed original inputs do not prevent export; nested destinations and collisions still fail', async t => {
  const f = await fixture(t), original = readFileSync(join(f.run, '_artifacts.json'), 'utf8');
  await assert.rejects(() => exportEvaluation(f.run, join(f.run, 'bad'), { yes: true, log: () => {} }), /outside/);
  mkdirSync(f.output); await assert.rejects(() => exportEvaluation(f.run, f.output, { yes: true, log: () => {} }), /already exists/);
  rmSync(f.output, { recursive: true });
  writeFileSync(join(f.skill, 'SKILL.md'), 'changed');
  await assert.rejects(() => exportEvaluation(f.run, join(f.skill, 'bad'), { yes: true, log: () => {} }), /outside/);
  await exportEvaluation(f.run, f.output, { yes: true, log: () => {} });
  assert.equal(readFileSync(join(f.output, 'inputs/target/SKILL.md'), 'utf8'), '# Synthetic export test\n');
  assert.equal(readFileSync(join(f.run, '_artifacts.json'), 'utf8'), original);
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
  assert.equal((await exportEvaluation(f.run, f.output, { log: () => {} })).status, 'planned');
  const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'report', 'eval', f.run, '--export', f.output,
    '--input-root', `target=${restored}`, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'planned'); assert.ok(!existsSync(f.output));
  await exportEvaluation(f.run, f.output, { yes: true, inputRoots: [`target=${restored}`], log: () => {} });
  assert.equal(verifyReplayPackage(f.output).hasManifest, true);
  assert.equal(f.calls(), 2);
});

/** Build a historical plan without inventing snapshots for old evidence. */
function legacy(run: string): void {
  const plan = JSON.parse(readFileSync(join(run, '_plan.json'), 'utf8')); delete plan.inputSnapshot;
  rmSync(join(run, '_inputs'), { recursive: true }); rmSync(join(run, '_inputs.json'));
  const bytes = JSON.stringify(plan, null, 2) + '\n', planSha256 = sha256Text(bytes);
  writeFileSync(join(run, '_plan.json'), bytes);
  const manifest = JSON.parse(readFileSync(join(run, 'manifest.json'), 'utf8'));
  manifest.experiment.planSha256 = planSha256; writeFileSync(join(run, 'manifest.json'), JSON.stringify(manifest));
  const session = JSON.parse(readFileSync(join(run, '_session.json'), 'utf8'));
  session.planSha256 = planSha256; writeFileSync(join(run, '_session.json'), JSON.stringify(session));
  writeFileSync(join(run, '_artifacts.json'), JSON.stringify({ schemaVersion: 1, planSha256,
    files: Object.fromEntries(packageFiles(run).filter(path => path !== '_artifacts.json').map(path => [path, sha256File(join(run, path))])), links: {} }));
}

test('historical runs retain matching-root recovery and never acquire synthetic snapshots', async t => {
  const f = await fixture(t); legacy(f.run);
  const restored = join(f.root, 'restored'); renameSync(f.skill, restored);
  await assert.rejects(exportEvaluation(f.run, f.output, { log: () => {} }));
  const plan = await exportEvaluation(f.run, f.output, { yes: true, inputRoots: [`target=${restored}`], log: () => {} });
  assert.equal(plan.inputSource, 'original-or-recovered');
  assert.ok(!existsSync(join(f.run, '_inputs')));
  assert.equal(verifyReplayPackage(f.output).hasManifest, true);
  writeFileSync(join(restored, 'SKILL.md'), 'wrong revision');
  await assert.rejects(exportEvaluation(f.run, join(f.root, 'bad'), { inputRoots: [`target=${restored}`], log: () => {} }), /changed|unavailable/);
});

test('snapshot damage never falls back to matching originals, even after resealing the outer inventory', async t => {
  for (const damage of ['missing', 'changed', 'extra', 'link', 'index'] as const) await t.test(damage, async t => {
    const f = await fixture(t), file = join(f.run, '_inputs/target/SKILL.md');
    if (damage === 'missing') rmSync(file);
    if (damage === 'changed') writeFileSync(file, 'tampered');
    if (damage === 'extra') writeFileSync(join(f.run, '_inputs/extra'), 'unlisted');
    if (damage === 'link') { rmSync(file); symlinkSync(join(f.skill, 'SKILL.md'), file); }
    if (damage === 'index') writeFileSync(join(f.run, '_inputs.json'), '{}');
    if (damage !== 'link') {
      const index = JSON.parse(readFileSync(join(f.run, '_artifacts.json'), 'utf8'));
      index.files = Object.fromEntries(packageFiles(f.run).filter(path => path !== '_artifacts.json').map(path => [path, sha256File(join(f.run, path))]));
      writeFileSync(join(f.run, '_artifacts.json'), JSON.stringify(index));
    }
    await assert.rejects(exportEvaluation(f.run, f.output, { yes: true, inputRoots: [`target=${f.skill}`], log: () => {} }));
    assert.ok(!existsSync(f.output)); assert.equal(f.calls(), 2);
    const report = await reportEvalComponent(f.run); assert.ok('evidence' in report && !report.evidence.verified);
  });
});

test('copies preserve empty fixture directories and executable local verifiers', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-empty-input-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), run = join(root, 'runs/saved');
  mkdirSync(join(bench, 'empty'), { recursive: true }); mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '# Offline empty-fixture test');
  const verifier = join(bench, 'check.mjs');
  writeFileSync(verifier, "import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';const p=join(process.argv[2],'_output.md');process.exit(existsSync(p)&&readFileSync(p,'utf8')==='answer'?0:1);");
  chmodSync(verifier, 0o755);
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'empty', fixture: 'empty', prompt: 'prompt.md', verifier: 'node check.mjs' }] }));
  writeFileSync(join(bench, 'prompt.md'), 'Give the expected answer.');
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => ({ output: 'answer' }) };
  await runEval({ skillPath: skill, bench, executor, judgeExecutor: null, trials: 1, dryRun: false, yes: true, runsRoot: join(root, 'runs'), runGroup: 'saved', log: () => {} });
  rmSync(bench, { recursive: true }); rmSync(skill, { recursive: true });
  const output = join(root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
  assert.ok(lstatSync(join(output, 'inputs/bench/empty')).isDirectory());
  if (process.platform !== 'win32') assert.ok(lstatSync(join(output, 'inputs/bench/check.mjs')).mode & 0o111);
  const replay = spawnSync(process.execPath, [join(output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replay.status, 0, replay.stderr); assert.equal(JSON.parse(replay.stdout).evidence.verified, true);
});
