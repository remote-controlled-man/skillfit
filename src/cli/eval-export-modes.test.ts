import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchCheck, runBenchInit } from "./bench.js";
import { runEval } from "./eval.js";
import { exportEvaluation } from "../evaluation/application/export.js";
import { readEvaluationReport } from "./evaluation-report.js";
import { ExperimentSession } from "../evaluation/records/session.js";
import { loadBench } from "../bench/read.js";
import { collectEvaluationTarget } from "../resources/experiment.js";
import { packageFiles, verifyReplayPackage } from "../evaluation/records/replay-package.js";
import { sha256File, sha256Text } from "../shared/hash.js";
import type { Executor } from "../agents/contracts.js";
import { createSpendingBudgetRecorder } from "../evaluation/execution/budget.js";
import { summarizeCosts, type CostObservation } from "../evaluation/measurement/costs.js";

async function fixture(t: TestContext, classified = true, legacy = false) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-export-modes-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), runsRoot = join(root, 'runs');
  if (legacy) {
    for (const dir of ['fixtures/example-task', 'prompts', 'verifiers', 'ground-truth']) mkdirSync(join(bench, dir), { recursive: true });
    writeFileSync(join(bench, 'fixtures/example-task/answer.txt'), 'skillfit-ok\n');
    writeFileSync(join(bench, 'prompts/example-task.md'), 'Read answer.txt and return its contents.');
    writeFileSync(join(bench, 'verifiers/example-task.mjs'), `import{readFileSync,existsSync}from'node:fs';import{join}from'node:path';const file=join(process.argv[2],'_output.md');const pass=existsSync(file)&&readFileSync(file,'utf8').trim()==='skillfit-ok';console.log(JSON.stringify({passed:pass,checks:[{name:'exact-answer',pass},{name:'input-preserved',pass:readFileSync(join(process.argv[2],'answer.txt'),'utf8')==='skillfit-ok\\n'}]}));process.exit(pass?0:1);`);
    writeFileSync(join(bench, 'ground-truth/oracle-example-task.mjs'), `import{writeFileSync}from'node:fs';import{join}from'node:path';writeFileSync(join(process.argv[2],'_output.md'),'skillfit-ok\\n');`);
    writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'legacy-layout', tasks: [{ id: 'example-task', fixture: 'fixtures/example-task', prompt: 'prompts/example-task.md', verifier: 'node verifiers/example-task.mjs', oracle: 'node ground-truth/oracle-example-task.mjs' }] }));
  } else await runBenchInit({ dir: bench, yes: true, log: () => {} });
  const file = join(bench, 'bench.json'), definition = JSON.parse(readFileSync(file, 'utf8'));
  definition.tasks[0].shouldTrigger = true;
  if (classified) definition.tasks[0].triggerClass = 'explicit';
  writeFileSync(file, JSON.stringify(definition));
  mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# Offline export test\n');
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'stub', model: 'offline-only' }), run: async () => {
    calls++; return { output: 'skillfit-ok', skillTriggered: true, tokens: { input: 10, output: 3 }, usageStatus: 'partial' };
  } };
  return { root, bench, skill, runsRoot, executor, calls: () => calls };
}
function replay(root: string, verifyOnly = false) {
  const result = spawnSync(process.execPath, [join(root, 'reproduce.mjs'), ...(verifyOnly ? ['--verify-only'] : [])], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}
function reseal(run: string) {
  const index = JSON.parse(readFileSync(join(run, '_artifacts.json'), 'utf8'));
  index.files = Object.fromEntries(packageFiles(run).filter(path => path !== '_artifacts.json').map(path => [path, sha256File(join(run, path))]));
  writeFileSync(join(run, '_artifacts.json'), JSON.stringify(index));
}
function rewritePlan(run: string, change: (plan: Record<string, any>) => void) {
  const plan = JSON.parse(readFileSync(join(run, '_plan.json'), 'utf8')); change(plan);
  const bytes = JSON.stringify(plan, null, 2) + '\n', sha256 = sha256Text(bytes); writeFileSync(join(run, '_plan.json'), bytes);
  const session = JSON.parse(readFileSync(join(run, '_session.json'), 'utf8')); session.planSha256 = sha256;
  writeFileSync(join(run, '_session.json'), JSON.stringify(session));
  const summaryName = plan.details.mode === 'calibration' ? '_calibration.json' : 'manifest.json';
  const summary = JSON.parse(readFileSync(join(run, summaryName), 'utf8')); summary.experiment = session;
  writeFileSync(join(run, summaryName), JSON.stringify(summary));
  const index = JSON.parse(readFileSync(join(run, '_artifacts.json'), 'utf8')); index.planSha256 = sha256;
  writeFileSync(join(run, '_artifacts.json'), JSON.stringify(index)); reseal(run);
}

test('legacy relative layout still executes, seals, exports and replays after original inputs are removed', async t => {
  const f = await fixture(t, true, true), run = join(f.runsRoot, 'legacy'), output = join(f.root, 'portable');
  assert.equal(loadBench(f.bench).tasks[0]!.fixture, 'fixtures/example-task');
  await runEval({ skillPath: f.skill, bench: f.bench, executor: f.executor, judgeExecutor: null,
    trials: 1, maxCalls: 2, runsRoot: f.runsRoot, runGroup: 'legacy', dryRun: false, yes: true, log: () => {} });
  const before = await readEvaluationReport(run);
  assert.equal(before.evidence.verified, true, JSON.stringify(before.evidence));
  const bytes = packageFiles(run).map(file => [file, sha256File(join(run, file))]);
  await exportEvaluation(run, output, { yes: true, log: () => {} });
  assert.deepEqual(packageFiles(run).map(file => [file, sha256File(join(run, file))]), bytes);
  const moved = join(f.root, 'legacy received'); renameSync(output, moved);
  rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true }); rmSync(run, { recursive: true });
  assert.equal(verifyReplayPackage(moved).evaluationType, 'paired');
  const result = replay(moved);
  assert.equal(result.evidence.verified, true);
  assert.equal(result.portableReplay.modelCalls, 0); assert.equal(f.calls(), 2);
});

test('calibration and trigger export/replay survive deleted inputs and retain single-arm observations, unknown cache and partial costs', async t => {
  for (const variant of ['calibration', 'trigger', 'trigger-unclassified'] as const) await t.test(variant, async t => {
    const mode = variant === 'calibration' ? 'calibration' : 'trigger';
    const f = await fixture(t, variant !== 'trigger-unclassified'), run = join(f.runsRoot, mode), output = join(f.root, 'portable');
    if (mode === 'calibration') await runBenchCheck({ dir: f.bench, calibrate: { executor: f.executor, trials: 1, maxCalls: 1, runsRoot: f.runsRoot, runGroup: mode }, log: () => {} });
    else await runEval({ skillPath: f.skill, bench: f.bench, mode, skillInstallDir: '.test-skills', executor: f.executor, trials: 1, maxCalls: 1, runsRoot: f.runsRoot, runGroup: mode, dryRun: false, yes: true, log: () => {} });
    const before = await readEvaluationReport(run); assert.ok('evaluationType' in before && before.evaluationType === mode);
    assert.equal(before.evidence.verified, true, JSON.stringify(before.evidence));
    assert.equal(before.usage?.metrics.input.knownTotal, 10); assert.equal(before.usage?.metrics.input.coverage.partial, 1);
    assert.equal(before.usage?.metrics.cachedInput.coverage.unknown, 1);
    const nativeFiles = packageFiles(run).map(file => [file, sha256File(join(run, file))]);
    rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true });
    assert.equal((await exportEvaluation(run, output, { log: () => {} })).status, 'planned'); assert.equal(existsSync(output), false);
    await exportEvaluation(run, output, { yes: true, log: () => {} });
    assert.deepEqual(packageFiles(run).map(file => [file, sha256File(join(run, file))]), nativeFiles, 'Native receipts and ledgers remain untouched.');
    const moved = join(f.root, 'received offline package'); renameSync(output, moved); rmSync(run, { recursive: true });
    assert.equal(verifyReplayPackage(moved).evaluationType, mode); assert.equal(replay(moved, true).modelCalls, 0);
    const result = replay(moved); assert.equal(result.evaluationType, mode); assert.equal(result.evidence.verified, true);
    assert.equal(result.evidence.replayedDeliveries, 1); assert.deepEqual(result.summary, JSON.parse(JSON.stringify(before.summary))); assert.deepEqual(result.usage, before.usage);
    assert.equal(result.acceptance.decision, 'inconclusive'); assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.acceptance.automaticUpgrade, false);
    assert.equal(result.portableReplay.modelCalls, 0); assert.equal(f.calls(), 1);
    const inspected = await readEvaluationReport(moved); assert.ok('portablePackage' in inspected && inspected.portablePackage.integrityVerified);
  });
});

test('stopped single-arm exports preserve missing invocation receipt as unknown and never invent a summary', async t => {
  for (const mode of ['calibration', 'trigger'] as const) await t.test(mode, async t => {
    const f = await fixture(t), run = join(f.runsRoot, mode), arm = mode === 'calibration' ? 'baseline' : 'installed', workspace = join(run, 'example-task', arm, 'trial-1');
    const session = new ExperimentSession({ bench: loadBench(f.bench), target: collectEvaluationTarget(f.skill), groupDir: run, workspaces: [workspace], plannedCalls: 1, maxCalls: 1, injected: true, details: { mode, trials: 1 } });
    mkdirSync(workspace, { recursive: true }); const prompt = 'Saved invocation with a lost receipt'; writeFileSync(join(workspace, '_prompt.txt'), prompt);
    await session.wrap(f.executor, 'agent').run(prompt, workspace); session.finish(new Error('Synthetic interruption before receipt persistence'));
    const before = await readEvaluationReport(run); assert.ok('evaluationType' in before); assert.equal(before.status, 'stopped'); assert.equal(before.summary, null);
    assert.equal(before.evidence.verified, true, JSON.stringify(before.evidence)); assert.equal(before.usage?.invocationsWithUnknownReceipts, 1);
    assert.equal(before.usage?.metrics.input.coverage.unknown, 1); assert.equal(before.usage?.metrics.durationSeconds.coverage.unknown, 1);
    const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
    rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true }); rmSync(run, { recursive: true });
    const result = replay(output); assert.equal(result.status, 'stopped'); assert.equal(result.summary, null); assert.deepEqual(result.usage, before.usage);
    assert.equal(result.evidence.replayedDeliveries, 0); assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(f.calls(), 1);
  });
});

test('single-arm semantic audit rejects resealed wrong summary and changed local verdicts', async t => {
  const f = await fixture(t), run = join(f.runsRoot, 'calibration');
  await runBenchCheck({ dir: f.bench, calibrate: { executor: f.executor, trials: 1, runsRoot: f.runsRoot, runGroup: 'calibration' }, log: () => {} });
  const file = join(run, '_calibration.json'), original = readFileSync(file, 'utf8'), summary = JSON.parse(original);
  summary.tasks[0].passes = 0; writeFileSync(file, JSON.stringify(summary)); reseal(run);
  const bad = await readEvaluationReport(run); assert.equal(bad.evidence.verified, false); assert.match(JSON.stringify(bad.evidence), /summary differs from receipts/);
  await assert.rejects(exportEvaluation(run, join(f.root, 'bad'), { yes: true, log: () => {} }), /audit failed/);
  writeFileSync(file, original); reseal(run);
  const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
  const delivery = join(output, 'run/example-task/baseline/trial-1/_output.md'); writeFileSync(delivery, 'wrong delivery');
  const index = JSON.parse(readFileSync(join(output, 'run/_artifacts.json'), 'utf8')); index.files['example-task/baseline/trial-1/_output.md'] = sha256File(delivery);
  writeFileSync(join(output, 'run/_artifacts.json'), JSON.stringify(index));
  const metadata = JSON.parse(readFileSync(join(output, 'replay-package.json'), 'utf8')); for (const file of Object.keys(metadata.files)) metadata.files[file] = sha256File(join(output, file));
  writeFileSync(join(output, 'replay-package.json'), JSON.stringify(metadata));
  const replayed = spawnSync(process.execPath, [join(output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(replayed.status, 2); assert.match(replayed.stderr, /verdict differs/); assert.equal(f.calls(), 1);
});

test('paired judge portable replay retains both review calls and full costs without invoking judge again', async t => {
  const f = await fixture(t); let judgeCalls = 0;
  const judge: Executor = { describe: () => ({ kind: 'stub', model: 'offline-judge' }), run: async () => {
    judgeCalls++; return { output: JSON.stringify({ A: { correct: true, complete: true, grounded: true }, B: { correct: true, complete: true, grounded: true } }), tokens: { input: 20, cachedInput: 4, output: 5 }, usageStatus: 'final' };
  } };
  const run = join(f.runsRoot, 'judge'); await runEval({ skillPath: f.skill, bench: f.bench, executor: f.executor, judgeExecutor: judge,
    trials: 1, maxCalls: 4, runsRoot: f.runsRoot, runGroup: 'judge', dryRun: false, yes: true, log: () => {} });
  const before = await readEvaluationReport(run); assert.equal(before.evidence.verified, true, JSON.stringify(before.evidence));
  const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
  rmSync(f.bench, { recursive: true }); rmSync(f.skill, { recursive: true }); rmSync(run, { recursive: true });
  const result = replay(output); assert.equal(result.evidence.verified, true); assert.equal(result.evidence.replayedDeliveries, 2);
  assert.deepEqual(result.invocationCosts, 'invocationCosts' in before ? before.invocationCosts : null);
  assert.equal(result.invocationCosts.judge.runs, 2); assert.equal(result.invocationCosts.judge.metrics.input.knownTotal, 40);
  assert.equal(result.invocationCosts.agent.metrics.input.coverage.partial, 2); assert.equal(result.invocationCosts.total.runs, 4);
  assert.equal(result.acceptance.automaticUpgrade, false); assert.equal(f.calls(), 2); assert.equal(judgeCalls, 2);
});

test('resealing an outer inventory cannot hide missing plan inputs, a changed approval or a mismatched prompt', async t => {
  for (const damage of ['inputs', 'approval', 'prompt', 'invoked'] as const) await t.test(damage, async t => {
    const f = await fixture(t), run = join(f.runsRoot, 'calibration');
    await runBenchCheck({ dir: f.bench, calibrate: { executor: f.executor, trials: 1, runsRoot: f.runsRoot, runGroup: 'calibration' }, log: () => {} });
    if (damage === 'inputs') rewritePlan(run, plan => { delete plan.inputs; });
    if (damage === 'approval') rewritePlan(run, plan => { plan.details.executorTimeoutSeconds += 1; });
    if (damage === 'prompt') { writeFileSync(join(run, 'example-task/baseline/trial-1/_prompt.txt'), 'different invocation'); reseal(run); }
    if (damage === 'invoked') {
      const path = join(run, 'example-task/baseline/trial-1/_result.json'), receipt = JSON.parse(readFileSync(path, 'utf8'));
      receipt.executorInvoked = false; writeFileSync(path, JSON.stringify(receipt)); reseal(run);
    }
    const report = await readEvaluationReport(run); assert.equal(report.evidence.verified, false, damage); assert.ok(report.evidence.reasons.length);
    await assert.rejects(exportEvaluation(run, join(f.root, 'refused'), { yes: true, log: () => {} }), /audit failed/);
    assert.equal(existsSync(join(f.root, 'refused')), false); assert.equal(f.calls(), 1);
  });
});

test('single-arm budget replay includes setup attempts that never invoked an Agent', async t => {
  const f = await fixture(t), run = join(f.runsRoot, 'calibration'), workspace = join(run, 'example-task/baseline/trial-1');
  const limits = { input: 100, cachedInput: 100, uncachedInput: 100, output: 100, durationSeconds: 100 };
  const session = new ExperimentSession({ bench: loadBench(f.bench), target: collectEvaluationTarget(f.skill), groupDir: run,
    workspaces: [workspace], plannedCalls: 1, maxCalls: 1, injected: true,
    details: { mode: 'calibration', inputMode: 'snapshot', trials: 1, spendingBudget: limits } });
  mkdirSync(workspace, { recursive: true });
  const observation: CostObservation = { executorInvoked: false, passed: false, error: 'Synthetic Git setup refusal', durationSeconds: 0, tokens: null, usageStatus: 'unknown' };
  writeFileSync(join(workspace, '_result.json'), JSON.stringify({ schemaVersion: 2, taskId: 'example-task', trial: 1, condition: 'baseline', ...observation }));
  const budget = createSpendingBudgetRecorder({ budget: limits, groupDir: run }), identity = { taskId: 'example-task', condition: 'baseline' as const, trial: 1 };
  budget.before(identity); let failure: unknown; try { budget.after(identity, observation); } catch (error) { failure = error; }
  assert.ok(failure);
  const summary = { schemaVersion: 1, measurementScope: JSON.parse(readFileSync(join(run, '_plan.json'), 'utf8')).details.measurementScope, runGroup: 'calibration', inputMode: 'snapshot', trials: 1,
    tasks: [{ id: 'example-task', passes: 0, completed: 0, errors: 1 }], costs: summarizeCosts({ baseline: [observation], treatment: [] }, { baseline: [], treatment: [] }), experiment: session.summary() };
  writeFileSync(join(run, '_calibration.json'), JSON.stringify(summary)); session.finish(failure, summary, '_calibration.json');
  const before = await readEvaluationReport(run); assert.ok('evaluationType' in before); assert.equal(before.evidence.verified, true, JSON.stringify(before.evidence));
  assert.equal(before.usage?.runs, 0); assert.equal(before.status, 'stopped');
  const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
  const result = replay(output); assert.equal(result.evidence.verified, true); assert.equal(result.usage.runs, 0); assert.equal(result.summary.metrics.errors, 1);
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(f.calls(), 0);
});

test('portable replay forwards interruption and waits for verifier cleanup before exiting', async t => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) await t.test(signal, async t => {
    const f = await fixture(t), enabled = join(f.root, 'enable-hanging-verifier'), pidFile = join(f.root, 'verifier.pid');
    writeFileSync(join(f.bench, 'tasks/example-task/verify.mjs'), `import{existsSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';if(existsSync(${JSON.stringify(enabled)})){writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000);}else{const file=join(process.argv[2],'_output.md');const passed=existsSync(file)&&readFileSync(file,'utf8').includes('skillfit-ok');console.log(JSON.stringify({passed}));process.exit(passed?0:1);}`);
    const run = join(f.runsRoot, 'cancel'); await runEval({ skillPath: f.skill, bench: f.bench, executor: f.executor, judgeExecutor: null,
      trials: 1, runsRoot: f.runsRoot, runGroup: 'cancel', dryRun: false, yes: true, log: () => {} });
    const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} });
    const before = packageFiles(output).map(path => [path, sha256File(join(output, path))]); writeFileSync(enabled, 'hang only replay');
    const entry = join(output, 'reproduce.mjs');
    const argv = process.platform === 'win32' ? ['--input-type=module', '--eval', `process.on('message',message=>{if(message?.signal)process.emit(message.signal);});process.channel?.unref();await import(${JSON.stringify(pathToFileURL(entry).href)});`] : [entry];
    const child = spawn(process.execPath, argv, { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    let stdout = '', stderr = '', verifierPid: number | undefined;
    child.stdout!.on('data', chunk => { stdout += String(chunk); }); child.stderr!.on('data', chunk => { stderr += String(chunk); });
    const closed = new Promise<number | null>((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
    t.after(() => { child.kill('SIGKILL'); if (verifierPid) try { process.kill(verifierPid, 'SIGKILL'); } catch { /* Already cleaned. */ } });
    const until = Date.now() + 15_000;
    while (!existsSync(pidFile) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(existsSync(pidFile), `Pinned replay verifier did not start: ${stderr}`); verifierPid = Number(readFileSync(pidFile, 'utf8'));
    assert.doesNotThrow(() => process.kill(verifierPid!, 0));
    if (process.platform === 'win32') child.send({ signal }); else child.kill(signal);
    let timer: NodeJS.Timeout | undefined;
    try {
      const code = await Promise.race([closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Portable replay did not finish verifier cleanup after interruption.')), 15_000); })]);
      assert.equal(code, signal === 'SIGINT' ? 130 : 143, stderr);
    } finally { if (timer) clearTimeout(timer); }
    assert.equal(stdout, '', 'Interrupted replay must not emit a successful JSON assessment.'); assert.match(stderr, /waited for the pinned CLI/);
    let alive = true; try { process.kill(verifierPid, 0); } catch { alive = false; }
    assert.equal(alive, false, 'Local verifier must have exited before reproduce.mjs exits.');
    verifierPid = undefined;
    assert.deepEqual(packageFiles(output).map(path => [path, sha256File(join(output, path))]), before, 'Replay cancellation never alters sealed input evidence.');
    assert.equal(f.calls(), 2);
  });
});

test('broken single-arm inventory preserves readable costs and counts lost or invalid receipts as unknown', async t => {
  for (const mode of ['calibration', 'trigger'] as const) await t.test(mode, async t => {
    const f = await fixture(t), run = join(f.runsRoot, mode), arm = mode === 'calibration' ? 'baseline' : 'installed';
    if (mode === 'calibration') await runBenchCheck({ dir: f.bench, calibrate: { executor: f.executor, trials: 2, runsRoot: f.runsRoot, runGroup: mode }, log: () => {} });
    else await runEval({ skillPath: f.skill, bench: f.bench, mode, skillInstallDir: '.test-skills', executor: f.executor,
      trials: 2, runsRoot: f.runsRoot, runGroup: mode, dryRun: false, yes: true, log: () => {} });
    const first = join(run, 'example-task', arm, 'trial-1/_result.json'), second = join(run, 'example-task', arm, 'trial-2/_result.json');
    rmSync(first);
    const missing = await readEvaluationReport(run); assert.ok('evaluationType' in missing); assert.equal(missing.evidence.verified, false);
    assert.equal(missing.usage?.runs, 2); assert.equal(missing.usage?.invocationsWithUnknownReceipts, 1);
    assert.equal(missing.usage?.metrics.input.knownTotal, 10); assert.equal(missing.usage?.metrics.input.coverage.partial, 1); assert.equal(missing.usage?.metrics.input.coverage.unknown, 1);
    writeFileSync(second, '{invalid raw receipt');
    const invalid = await readEvaluationReport(run); assert.ok('evaluationType' in invalid); assert.equal(invalid.evidence.verified, false);
    assert.equal(invalid.usage?.runs, 2); assert.equal(invalid.usage?.invocationsWithUnknownReceipts, 2); assert.equal(invalid.usage?.metrics.input.coverage.unknown, 2);
    assert.match(invalid.usage?.scope ?? '', /Unaudited/); assert.equal(invalid.acceptance.eligibleForUpgrade, false);
    await assert.rejects(exportEvaluation(run, join(f.root, 'invalid'), { yes: true, log: () => {} }), /Native evidence inventory changed/); assert.equal(f.calls(), 2);
  });
});
