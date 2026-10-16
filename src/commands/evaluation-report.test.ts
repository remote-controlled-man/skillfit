import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchCheck, runBenchInit } from './bench.js';
import { runEval } from './eval.js';
import { readEvaluationReport } from './evaluation-report.js';
import { runEvalReport } from './eval-report.js';
import { exportEvaluation } from './eval-export.js';
import { ExperimentSession } from '../harness/experiment-session.js';
import { collectEvaluationTarget } from '../harness/target.js';
import { loadBench } from '../harness/bench.js';
import { ExecutorFailure, type Executor } from '../harness/types.js';

const CLI = fileURLToPath(new URL('../cli.js', import.meta.url));
async function fixture(t: TestContext, ids: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-report-modes-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), runsRoot = join(root, 'runs');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  const path = join(bench, 'bench.json'), body = JSON.parse(readFileSync(path, 'utf8')), original = body.tasks[0];
  body.tasks = ids.map(id => {
    const prompt = `prompts/${id}.md`; writeFileSync(join(bench, prompt), `CASE ${id}\nReply with skillfit-ok.\n`);
    return { ...original, id, prompt, promptTrigger: prompt, shouldTrigger: !id.startsWith('neg'),
      ...(id === 'pos-fired' ? { triggerClass: 'explicit' } : id === 'pos-missed' ? { triggerClass: 'implicit' } : id === 'pos-unknown' ? { triggerClass: 'contextual' } : {}) };
  });
  writeFileSync(path, JSON.stringify(body)); mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# Synthetic mode-report test\n');
  let calls = 0; const perTask = new Map<string, number>();
  const executor: Executor = { describe: () => ({ kind: 'stub', model: 'offline-report-fixture' }), run: async (_prompt, workdir) => {
    calls++; const id = basename(dirname(dirname(workdir!))), nth = (perTask.get(id) ?? 0) + 1; perTask.set(id, nth);
    if (id === 'neg-error') throw new ExecutorFailure('synthetic executor error', { output: 'partial', tokens: { input: 4, output: 1 }, usageStatus: 'partial' });
    return { output: id === 'hard' || (id === 'mixed' && nth === 2) ? 'wrong' : 'skillfit-ok',
      tokens: { input: 10, cachedInput: 0, output: 1 },
      ...(id === 'pos-unknown' ? {} : { skillTriggered: id === 'pos-fired' || id === 'neg-fired' }) };
  } };
  const cli = (path: string, flags: string[] = []) => spawnSync(process.execPath, [CLI, 'report', 'eval', path, ...flags], { encoding: 'utf8', timeout: 30_000 });
  return { root, bench, skill, runsRoot, executor, calls: () => calls, cli };
}
function observedFiles(run: string, final: string) {
  return [final, '_plan.json', '_session.json', '_artifacts.json'].map(path => readFileSync(join(run, path), 'utf8'));
}

test('completed native calibration uses its own summary, state and difficulty metrics in both formats', async t => {
  const f = await fixture(t, ['easy', 'hard', 'mixed']);
  await runBenchCheck({ dir: f.bench, calibrate: { executor: f.executor, trials: 2, maxCalls: 6, runsRoot: f.runsRoot, runGroup: 'calibration' }, log: () => {} });
  const run = join(f.runsRoot, 'calibration'), before = observedFiles(run, '_calibration.json');
  const report = await readEvaluationReport(run); assert.ok('evaluationType' in report && report.evaluationType === 'calibration');
  assert.equal(report.status, 'completed'); assert.equal(report.kind, 'skillfit.calibration-report');
  assert.deepEqual(report.summary?.tasks.map(t => t.difficulty), ['saturated', 'floor', 'discriminative']);
  assert.deepEqual(report.summary?.metrics, { taskCount: 3, measuredTasks: 3, discriminativeTasks: 1, passes: 3, completed: 6, errors: 0, baselinePassRate: 0.5 });
  assert.equal(report.usage?.metrics.input.knownTotal, 60); assert.equal(report.usage?.metrics.cachedInput.knownTotal, 0);
  assert.equal(report.usage?.metrics.cachedInput.coverage.final, 6);
  assert.equal(report.acceptance.eligibleForUpgrade, false); assert.equal(report.acceptance.automaticUpgrade, false); assert.equal(report.evidence.verified, true);
  assert.equal(report.evidence.scope, 'single-arm-native');
  const human = f.cli(run), json = f.cli(run, ['--json']), file = f.cli(join(run, '_calibration.json'));
  for (const output of [human, json, file]) assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(json.stdout).status, 'completed'); assert.equal(human.stdout, file.stdout);
  assert.match(human.stdout, /Baseline pass rate: 3\/6 \(50.0%\)/); assert.match(human.stdout, /discriminative tasks: 1\/3/);
  assert.match(human.stdout, /saturated/); assert.match(human.stdout, /floor/); assert.doesNotMatch(human.stdout, /Overall verdict|State: stopped|McNemar/);
  assert.equal((await exportEvaluation(run, join(f.root, 'export'), { log: () => {} })).status, 'planned');
  assert.equal(existsSync(join(f.root, 'export')), false);
  assert.deepEqual(observedFiles(run, '_calibration.json'), before); assert.equal(f.calls(), 6);
  rmSync(join(run, 'easy/baseline/trial-1/_result.json'));
  const missing = await readEvaluationReport(run); assert.ok('evaluationType' in missing);
  assert.equal(missing.usage?.invocationsWithUnknownReceipts, 1); assert.equal(missing.usage?.metrics.input.coverage.unknown, 1);
  assert.equal(missing.acceptance.eligibleForUpgrade, false);
});

test('native trigger reports retain rates, Wilson intervals, classes, unknowns and errors without paired adoption', async t => {
  const f = await fixture(t, ['pos-fired', 'pos-missed', 'pos-unknown', 'neg-fired', 'neg-quiet', 'neg-error']);
  await runEval({ skillPath: f.skill, bench: f.bench, agent: 'codex', mode: 'trigger', executor: f.executor,
    trials: 1, maxCalls: 6, runsRoot: f.runsRoot, runGroup: 'trigger', dryRun: false, yes: true, log: () => {} });
  const run = join(f.runsRoot, 'trigger'), before = observedFiles(run, 'manifest.json');
  const saved = JSON.parse(before[0]!); const report = await readEvaluationReport(run);
  assert.ok('evaluationType' in report && report.evaluationType === 'trigger');
  assert.equal(report.status, 'stopped'); assert.equal(report.kind, 'skillfit.trigger-report');
  assert.deepEqual(report.summary?.metrics, saved.metrics); assert.equal(report.summary?.metrics.recall, 0.5);
  assert.equal(report.summary?.metrics.falseTriggerRate, 0.5); assert.equal(report.summary?.metrics.precision, 0.5); assert.equal(report.summary?.metrics.f1, 0.5);
  assert.equal(report.summary?.tasks[2]?.unknown, 1); assert.equal(report.summary?.tasks[5]?.errors, 1);
  assert.equal(report.acceptance.eligibleForUpgrade, false); assert.equal(report.acceptance.automaticUpgrade, false);
  const human = f.cli(run), json = f.cli(join(run, 'manifest.json'), ['--json']);
  assert.equal(human.status, 0, human.stderr); assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).evaluationType, 'trigger'); assert.equal(JSON.parse(json.stdout).status, 'stopped');
  for (const label of ['Recall: 50.0%', 'False-trigger rate: 50.0%', 'Precision: 50.0%', 'F1: 0.500', 'explicit recall:', 'implicit recall:', 'contextual recall: n/a', 'SKILL.md read', 'upper bound', 'Unknown | Errors']) assert.ok(human.stdout.includes(label), label);
  assert.doesNotMatch(human.stdout, /McNemar|Overall verdict|Installation decision/);
  assert.deepEqual(observedFiles(run, 'manifest.json'), before); assert.equal(f.calls(), 6);
});

test('completed trigger and standalone historical summaries preserve zero denominators and unknown provenance', async t => {
  const f = await fixture(t, ['pos-missed', 'pos-unknown']);
  await runEval({ skillPath: f.skill, bench: f.bench, mode: 'trigger', skillInstallDir: '.test-skills', executor: f.executor,
    trials: 1, maxCalls: 2, runsRoot: f.runsRoot, runGroup: 'trigger', dryRun: false, yes: true, log: () => {} });
  const run = join(f.runsRoot, 'trigger'), native = await readEvaluationReport(run);
  assert.ok('evaluationType' in native && native.evaluationType === 'trigger'); assert.equal(native.status, 'completed');
  assert.equal(native.summary?.metrics.recall, 0); assert.equal(native.summary?.metrics.falseTriggerRate, null);
  assert.equal(native.summary?.metrics.precision, null); assert.equal(native.summary?.metrics.f1, null);
  const value = JSON.parse(readFileSync(join(run, 'manifest.json'), 'utf8')); delete value.experiment;
  delete value.metrics.classRecall; delete value.metrics.precisionCi95;
  const standalone = join(f.root, 'historical.json'); writeFileSync(standalone, JSON.stringify(value));
  const human: string[] = []; await runEvalReport(standalone, line => human.push(line));
  assert.match(human[0]!, /State: reported/); assert.match(human[0]!, /False-trigger rate: n\/a/); assert.match(human[0]!, /Precision: n\/a/); assert.match(human[0]!, /F1: n\/a/);
  assert.match(human[0]!, /Eligible for upgrade: no/); assert.equal(f.calls(), 2);
});

test('standalone calibration excludes ungraded errors and leaves zero-completion difficulty unknown', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-calibration-summary-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'renamed.json');
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, runGroup: 'historical', inputMode: 'snapshot', trials: 2,
    tasks: [{ id: 'one', passes: 1, completed: 1, errors: 1 }, { id: 'none', passes: 0, completed: 0, errors: 2 }] }));
  const report = await readEvaluationReport(path); assert.ok('evaluationType' in report && report.evaluationType === 'calibration');
  assert.equal(report.status, 'reported'); assert.equal(report.summary?.metrics.baselinePassRate, 1); assert.equal(report.summary?.metrics.errors, 3);
  assert.equal(report.summary?.tasks[1]?.passRate, null); assert.equal(report.summary?.tasks[1]?.difficulty, 'unmeasured');
});

test('stopped and unfinished single-arm sessions never fabricate final metrics or completion', async t => {
  for (const mode of ['calibration', 'trigger'] as const) await t.test(mode, async t => {
    const f = await fixture(t, ['easy']); const run = join(f.runsRoot, mode);
    const session = new ExperimentSession({ bench: loadBench(f.bench), target: collectEvaluationTarget(f.skill), groupDir: run,
      workspaces: [join(run, 'easy/baseline/trial-1')], plannedCalls: 1, maxCalls: 1, injected: true, details: { mode } });
    session.finish(new Error('synthetic cancellation'));
    const stopped = await readEvaluationReport(run); assert.ok('evaluationType' in stopped);
    assert.equal(stopped.status, 'stopped'); assert.equal(stopped.summary, null); assert.equal(stopped.acceptance.eligibleForUpgrade, false);
    const human = f.cli(run); assert.equal(human.status, 0, human.stderr); assert.match(human.stdout, /Metrics are unavailable/);
    rmSync(join(run, '_session.json'));
    const unfinished = await readEvaluationReport(run); assert.equal(unfinished.status, 'incomplete'); assert.equal(f.calls(), 0);
  });
});

test('single-arm reports reject contradictory counts, metrics, schemas, session states and ignored options', async t => {
  const f = await fixture(t, ['pos-fired', 'neg-quiet']);
  await runEval({ skillPath: f.skill, bench: f.bench, mode: 'trigger', skillInstallDir: '.test-skills', executor: f.executor,
    trials: 1, maxCalls: 2, runsRoot: f.runsRoot, runGroup: 'trigger', dryRun: false, yes: true, log: () => {} });
  const run = join(f.runsRoot, 'trigger'), path = join(run, 'manifest.json'), original = readFileSync(path, 'utf8');
  const scenarios = [
    (v: any) => { v.tasks[0].fired = 2; },
    (v: any) => { v.tasks[0].runs = -1; },
    (v: any) => { v.tasks[0].unknown = 0.5; },
    (v: any) => { v.tasks[1].id = v.tasks[0].id; },
    (v: any) => { v.metrics.recall = 0; },
    (v: any) => { v.metrics.recallCi95 = { lo: 0, hi: 0 }; },
    (v: any) => { v.schemaVersion = 2; },
    (v: any) => { v.experiment.status = 'incomplete'; },
  ];
  for (const change of scenarios) {
    const value = JSON.parse(original); change(value); writeFileSync(path, JSON.stringify(value));
    await assert.rejects(() => readEvaluationReport(run));
  }
  writeFileSync(path, original);
  for (const json of [false, true]) {
    const replay = f.cli(run, ['--replay', ...(json ? ['--json'] : [])]); assert.equal(replay.status, 0, replay.stderr);
    if (json) { const result = JSON.parse(replay.stdout); assert.equal(result.evidence.verified, true); assert.equal(result.evidence.replayedDeliveries, 2); assert.equal(result.acceptance.eligibleForUpgrade, false); }
  }
  for (const flags of [['--policy', 'missing.json'], ['--records', run], ['--bench', f.bench]]) {
    for (const json of [false, true]) {
      const result = f.cli(run, [...flags, ...(json ? ['--json'] : [])]); assert.equal(result.status, json ? 2 : 1);
      if (json) { const failure = JSON.parse(result.stdout); assert.equal(failure.status, 'error'); assert.equal(failure.acceptance.eligibleForUpgrade, false); }
      else assert.match(result.stderr, /do not support paired|only used with --replay/);
    }
  }
  copyFileSync(path, join(run, '_calibration.json')); await assert.rejects(() => readEvaluationReport(run), /Ambiguous run/);
  assert.equal(f.calls(), 2);
});

test('invalid calibration summaries fail rather than being mislabeled stopped or interpreted as trigger data', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-invalid-calibration-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, '_calibration.json'), value = { schemaVersion: 1, runGroup: 'calibration', inputMode: 'workspace', trials: 2,
    tasks: [{ id: 'one', completed: 1, errors: 1, passes: 1 }] };
  for (const change of [(v: any) => { v.tasks[0].passes = 2; }, (v: any) => { v.tasks[0].errors = 2; },
    (v: any) => { v.tasks[0].completed = null; }, (v: any) => { v.inputMode = 'unknown'; }, (v: any) => { v.tasks = []; }]) {
    const changed = structuredClone(value); change(changed); writeFileSync(path, JSON.stringify(changed));
    await assert.rejects(() => readEvaluationReport(path));
  }
  assert.ok(!existsSync(join(root, 'manifest.json')));
});
