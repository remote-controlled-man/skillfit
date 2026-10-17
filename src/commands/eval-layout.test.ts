import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit, runBenchCalibration, prepareBenchCalibration } from './bench.js';
import { runEval, type EvalOptions } from './eval.js';
import { runEvalCli } from './eval-cli.js';
import { readEvaluationReport } from './evaluation-report.js';
import { exportEvaluation } from './eval-export.js';
import { loadBench } from '../harness/bench.js';
import { hashFileSet, listFilesRecursive } from '../harness/hash.js';
import { assertEvaluationOutputLayout } from '../harness/evaluation-layout.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-layout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), old = join(root, 'old'), home = join(root, 'home');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  for (const [dir, body] of [[skill, 'new'], [old, 'old']]) {
    mkdirSync(dir!); writeFileSync(join(dir!, 'SKILL.md'), `---\nname: layout-skill\ndescription: Offline layout regression.\n---\n${body}\n`);
  }
  mkdirSync(home);
  const definition = JSON.parse(readFileSync(join(bench, 'bench.json'), 'utf8'));
  definition.tasks[0].shouldTrigger = true;
  writeFileSync(join(bench, 'bench.json'), JSON.stringify(definition));
  let calls = 0;
  const base: EvalOptions = { skillPath: skill, bench, agent: 'codex', trials: 1, maxCalls: 2, dryRun: false, yes: true,
    runsRoot: join(root, 'runs'), runGroup: 'study', judgeExecutor: null, log: () => {},
    sessionOptions: { homeDir: home, env: {}, versionProbe: () => null },
    executor: { describe: () => ({ kind: 'cli', model: 'offline-layout', detail: 'Injected offline test executor.' }), run: async () => {
      calls++; return { output: 'skillfit-ok', skillTriggered: true, tokens: { input: 10, cachedInput: 2, output: 3 } };
    } } };
  return { root, bench, skill, old, base, calls: () => calls };
}

test('bench Git directories/worktree files do not change input hashes; real task bytes still do', async t => {
  const f = await fixture(t), original = loadBench(f.bench).contentSha256;
  assert.equal(original, hashFileSet(f.bench, listFilesRecursive(f.bench)), 'Git-free fingerprints keep their previous meaning.');
  mkdirSync(join(f.bench, '.git')); writeFileSync(join(f.bench, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const nested = join(f.bench, 'fixtures', 'example-task', '.git'); writeFileSync(nested, 'gitdir: /unread-worktree-metadata\n');
  assert.equal(loadBench(f.bench).contentSha256, original);
  writeFileSync(join(f.bench, '.git', 'HEAD'), 'ref: refs/heads/other\n');
  assert.equal(loadBench(f.bench).contentSha256, original);
  rmSync(join(f.bench, '.git'), { recursive: true }); writeFileSync(join(f.bench, '.git'), 'gitdir: /unread-worktree-metadata\n');
  assert.equal(loadBench(f.bench).contentSha256, original);
  writeFileSync(join(f.bench, 'prompts', 'example-task.md'), 'Changed actual task.');
  assert.notEqual(loadBench(f.bench).contentSha256, original);
  const definition = JSON.parse(readFileSync(join(f.bench, 'bench.json'), 'utf8'));
  definition.tasks[0].prompt = '.git'; writeFileSync(join(f.bench, 'bench.json'), JSON.stringify(definition));
  assert.throws(() => loadBench(f.bench), /cannot reference Git metadata/);
});

for (const mode of ['inject', 'installed', 'trigger', 'calibration'] as const) test(`${mode}: Git-root benches seal and audit without Git data`, async t => {
  const f = await fixture(t);
  mkdirSync(join(f.bench, '.git')); writeFileSync(join(f.bench, '.git', 'HEAD'), 'metadata before preview');
  const group = join(f.base.runsRoot!, f.base.runGroup!);
  if (mode === 'calibration') {
    const calibrate = { executor: f.base.executor!, trials: 1, maxCalls: 1, runsRoot: f.base.runsRoot, runGroup: f.base.runGroup };
    const preview = prepareBenchCalibration({ dir: f.bench, calibrate });
    writeFileSync(join(f.bench, '.git', 'HEAD'), 'metadata after preview');
    assert.equal(prepareBenchCalibration({ dir: f.bench, calibrate }).planSha256, preview.planSha256);
    await runBenchCalibration({ dir: f.bench, calibrate: { ...calibrate, reviewedPlanSha256: preview.planSha256 }, log: () => {} });
  } else {
    const base = { ...f.base, mode, ...(mode === 'installed' ? { baselineSkillPath: f.old } : {}) };
    const preview = await runEvalCli({ ...base, dryRun: true });
    writeFileSync(join(f.bench, '.git', 'HEAD'), 'metadata after preview');
    assert.equal((await runEvalCli({ ...base, dryRun: true })).plan.sha256, preview.plan.sha256);
    const executed = await runEvalCli(base, preview.plan.sha256);
    assert.equal(executed.status, 'completed', 'executionError' in executed ? String(executed.executionError) : 'Expected a completed offline run.');
  }
  assert.equal(existsSync(join(group, '_inputs', 'bench', '.git')), false);
  const report = await readEvaluationReport(group, { replay: true });
  assert.equal(report.status, 'completed', readFileSync(join(group, '_session.json'), 'utf8'));
  assert.equal(report.evidence.verified, true, report.evidence.reasons.join('; '));
  const calls = f.calls(); assert.equal(calls, mode === 'calibration' || mode === 'trigger' ? 1 : 2);
  if (mode === 'inject') {
    const portable = join(f.root, 'portable');
    await exportEvaluation(group, portable, { yes: true, log: () => {} });
    const moved = join(f.root, 'moved'); renameSync(portable, moved);
    rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true }); rmSync(group, { recursive: true });
    const replay = spawnSync(process.execPath, [join(moved, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(replay.status, 0, replay.stderr); assert.equal(JSON.parse(replay.stdout).evidence.verified, true);
    assert.equal(f.calls(), calls);
  }
});

test('every preview rejects output inside inputs before probes, calls or directories, including aliases', async t => {
  const f = await fixture(t), marker = join(f.root, 'verifier-ran');
  writeFileSync(join(f.bench, 'verifiers', 'example-task.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'probed');process.exit(1);`);
  const alias = join(f.root, 'bench-alias'); symlinkSync(f.bench, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const roots = [join(f.bench, 'runs'), join(f.bench, 'fixtures', 'example-task', 'runs'), join(f.skill, 'runs'), join(alias, 'new', 'runs'), join(f.root, '.git', 'runs')];
  for (const mode of ['inject', 'installed', 'trigger'] as const) {
    for (const runsRoot of [...roots, ...(mode === 'installed' ? [join(f.old, 'runs')] : [])]) {
      await assert.rejects(runEvalCli({ ...f.base, mode, runsRoot, dryRun: true,
        ...(mode === 'installed' ? { baselineSkillPath: f.old } : {}) }), /output must be outside/);
      assert.equal(existsSync(join(runsRoot, 'study')), false);
    }
  }
  for (const runsRoot of [roots[0]!, roots[3]!, roots[4]!]) assert.throws(() => prepareBenchCalibration({ dir: f.bench,
    calibrate: { executor: f.base.executor!, trials: 1, runsRoot, runGroup: 'study' } }), /output must be outside/);
  await assert.rejects(runEval({ ...f.base, runsRoot: roots[0] }), /output must be outside/);
  assert.equal(existsSync(marker), false); assert.equal(f.calls(), 0);
  assert.throws(() => assertEvaluationOutputLayout(fileURLToPath(new URL('../not-created', import.meta.url)), { benchDir: f.bench }), /output must be outside/);
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../cli.js', import.meta.url)), 'eval', f.skill,
    '--bench', f.bench, '--agent', 'codex', '--runs-root', roots[0]!, '--run-group', 'study', '--dry-run', '--json'],
  { encoding: 'utf8', env: { PATH: '' } });
  assert.equal(cli.status, 2); assert.equal(JSON.parse(cli.stdout).kind, 'skillfit.eval-error');
  assert.equal(existsSync(marker), false); assert.equal(f.calls(), 0);
});
