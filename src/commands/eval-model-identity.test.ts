import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { ApiExecutor } from '../harness/executors/api.js';
import { ExecutorFailure } from '../harness/types.js';
import { parseModelIdentities } from '../harness/model-identity.js';
import { sha256File } from '../harness/hash.js';
import { packageFiles } from '../harness/replay-package.js';
import { runBenchInit } from './bench.js';
import { runEval, type EvalOptions } from './eval.js';
import { prepareEvalPlan } from './eval-plan.js';
import { readEvaluationReport } from './evaluation-report.js';
import { renderEvalMarkdown } from './eval-report.js';
import { parseEvalReport } from '../harness/eval-manifest.js';
import { exportEvaluation } from './eval-export.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-model-identity-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill');
  await runBenchInit({ dir: bench, yes: true, log: () => {} }); mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: offline-model\ndescription: Synthetic fixture.\n---\nReturn skillfit-ok.\n');
  let calls = 0, judgeCalls = 0;
  const executor = new ApiExecutor({ apiKey: 'PRIVATE_TEST_KEY', model: 'requested-primary', fetchImpl: async () => {
    calls++; return new Response(JSON.stringify({ model: calls === 1 ? 'served-a' : 'served-b', choices: [{ message: { content: 'skillfit-ok' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } }));
  } });
  const judge = new ApiExecutor({ apiKey: 'PRIVATE_TEST_KEY', model: 'requested-judge', fetchImpl: async () => {
    judgeCalls++; return new Response(JSON.stringify({ model: 'served-judge', choices: [{ message: { content: JSON.stringify({ A: { correct: true, complete: true, grounded: true }, B: { correct: true, complete: true, grounded: true } }) } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }));
  } });
  const options: EvalOptions = { skillPath: skill, bench, executor, judgeExecutor: judge, trials: 1, maxCalls: 4,
    runsRoot: join(root, 'runs'), runGroup: 'identity', dryRun: false, yes: true, log: () => {} };
  return { root, options, run: join(root, 'runs/identity'), executor, judge, counts: () => [calls, judgeCalls] };
}
function reseal(run: string) {
  const file = join(run, '_artifacts.json'), index = JSON.parse(readFileSync(file, 'utf8'));
  index.files = Object.fromEntries(packageFiles(run).filter(path => path !== '_artifacts.json').map(path => [path, sha256File(join(run, path))]));
  writeFileSync(file, JSON.stringify(index));
}
test('native API model identities survive report parsing, relocation and the exported pinned reproducer', async t => {
  const f = await fixture(t), descriptor = JSON.stringify(f.executor.describe());
  const prepared = await prepareEvalPlan(f.options, {}); assert.deepEqual(f.counts(), [0, 0]); assert.equal(existsSync(f.run), false);
  const approved = JSON.stringify(prepared.plan);
  await runEval({ ...prepared.options, reviewedPlan: prepared.plan, onPlan: prepared.assertCurrent });
  assert.deepEqual(f.counts(), [2, 2]); assert.equal(JSON.stringify(f.executor.describe()), descriptor); assert.equal(JSON.stringify(prepared.plan), approved);
  const manifest = JSON.parse(readFileSync(join(f.run, 'manifest.json'), 'utf8'));
  const coverage = parseModelIdentities(manifest.modelIdentities);
  assert.deepEqual(coverage.primary?.models, ['served-a', 'served-b']); assert.equal(coverage.primary?.reported, 2);
  assert.equal(coverage.judge?.reported, 2); assert.deepEqual(coverage.judge?.models, ['served-judge']);
  assert.equal(manifest.overall.verdict, 'inconclusive');
  assert.equal(manifest.invocationCosts.total.metrics.input.knownTotal, 26);
  const legacyMetrics = structuredClone(manifest); delete legacyMetrics.modelIdentities;
  assert.deepEqual(parseEvalReport(legacyMetrics).overall, parseEvalReport(manifest).overall);
  const native = JSON.parse(readFileSync(join(f.run, '_plan.json'), 'utf8')); assert.equal(native.servedModel, 'unrecorded');
  const report = await readEvaluationReport(f.run); assert.equal(report.evidence.verified, true, JSON.stringify(report.evidence));
  assert.deepEqual(report.modelIdentities, coverage);
  assert.match(renderEvalMarkdown(parseEvalReport(manifest)), /requested-primary.*served-a/);
  const original = packageFiles(f.run).map(path => [path, sha256File(join(f.run, path))]);
  const portable = join(f.root, 'portable'); await exportEvaluation(f.run, portable, { yes: true, log: () => {} });
  renameSync(f.run, join(f.root, 'original-hidden')); const relocated = join(f.root, 'relocated'); renameSync(portable, relocated);
  const replay = await readEvaluationReport(relocated, { replay: true }); assert.equal(replay.evidence.verified, true, JSON.stringify(replay.evidence));
  assert.deepEqual(replay.modelIdentities, coverage); assert.deepEqual(f.counts(), [2, 2]);
  const result = spawnSync(process.execPath, [join(relocated, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout).modelIdentities, coverage);
  assert.deepEqual(packageFiles(join(f.root, 'original-hidden')).map(path => [path, sha256File(join(f.root, 'original-hidden', path))]), original);
});
test('resealing cannot hide changed model claims, removed identity receipts, or contradictory coverage', async t => {
  const f = await fixture(t); await runEval(f.options);
  const path = join(f.run, 'example-task/baseline/trial-1/_result.json'), bytes = readFileSync(path, 'utf8');
  for (const mutate of [(r: any) => { r.modelIdentity.reportedModels[0].id = 'forged'; },
    (r: any) => { r.modelIdentity.reportedModels[0].location = '/choices/0/message/content'; },
    (r: any) => { r.modelIdentity.requested = 'changed-intent'; }, (r: any) => { delete r.modelIdentity; }]) {
    const receipt = JSON.parse(bytes); mutate(receipt); writeFileSync(path, JSON.stringify(receipt)); reseal(f.run);
    const report = await readEvaluationReport(f.run); assert.equal(report.evidence.verified, false); assert.equal(report.acceptance.eligibleForUpgrade, false);
    await assert.rejects(exportEvaluation(f.run, join(f.root, 'rejected'), { yes: true, log: () => {} }));
  }
  writeFileSync(path, bytes); reseal(f.run);
  const summary = join(f.run, 'manifest.json'), manifest = JSON.parse(readFileSync(summary, 'utf8')); manifest.modelIdentities.primary.reported++;
  writeFileSync(summary, JSON.stringify(manifest)); reseal(f.run); await assert.rejects(readEvaluationReport(f.run), /coverage/);
});
test('stopped primary and judge calls retain observed models and legacy absence stays unrecorded', async t => {
  const f = await fixture(t);
  f.options.judgeExecutor = { describe: () => f.judge.describe(), run: async () => {
    const result = await f.judge.run('offline'); throw new ExecutorFailure('synthetic interrupted judge', result);
  } };
  await assert.rejects(runEval(f.options));
  const report = await readEvaluationReport(f.run); assert.ok('manifest' in report); assert.equal(report.manifest, null);
  assert.equal(report.modelIdentities?.primary?.reported, 2); assert.equal(report.modelIdentities?.judge?.reported, 1);
  assert.equal(report.acceptance.eligibleForUpgrade, false);
  const simple = await fixture(t); await runEval(simple.options);
  const legacy = JSON.parse(readFileSync(join(simple.run, 'manifest.json'), 'utf8')); delete legacy.modelIdentities;
  const parsed = parseEvalReport(legacy); assert.equal(parsed.modelIdentities, undefined);
  assert.match(renderEvalMarkdown(parsed), /Model identity: unrecorded in legacy\/incomplete evidence/);
});
