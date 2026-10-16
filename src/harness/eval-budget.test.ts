import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { runEvalComponent, reportEvalComponent } from '../commands/eval-component.js';
import { parseEvalRequest } from './eval-contract.js';
import { assertSpendingCanContinue, parseSpendingBudget, spendingBudgetState, type SpendingBudget } from './eval-budget.js';
import { COST_METRICS, type CostObservation } from './costs.js';
import { sha256File } from './hash.js';
import { ExecutorFailure, type Executor, type ExecutorResult } from './types.js';

const limits: SpendingBudget = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
const observation = (extra: Partial<CostObservation> = {}): CostObservation => ({ executorInvoked: true, passed: true, error: null,
  tokens: { input: 10, cachedInput: 6, output: 3 }, usageStatus: 'final', durationSeconds: 2, ...extra });

test('spending stop lines require all five positive values and reject malformed counters/limits', () => {
  assert.deepEqual(parseSpendingBudget(limits), limits);
  for (const bad of [null, [], {}, { ...limits, surprise: 1 }, { ...limits, output: 0 }, { ...limits, input: 1.5 }, { ...limits, durationSeconds: Infinity }]) {
    assert.throws(() => parseSpendingBudget(bad), /spendingBudget/);
  }
  for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const state = spendingBudgetState(limits, [observation({ tokens: { input: value, cachedInput: 2, output: 3 } })]);
    assert.equal(state.reason, 'FINAL_USAGE_MISSING'); assert.ok(state.incomplete.includes('input'));
    assert.equal(state.metrics.input.coverage.unknown, 1); assert.throws(() => assertSpendingCanContinue(state), /no further/);
  }
});

test('all-invocation budgets count functional failures, partial costs and unknown partitions without double counting cache', () => {
  const state = spendingBudgetState(limits, [observation({ passed: false }), observation({ usageStatus: 'partial', tokens: { input: 7, output: 2 } })]);
  assert.equal(state.invocations, 2); assert.equal(state.metrics.input.knownTotal, 17);
  assert.equal(state.metrics.cachedInput.knownTotal, 6); assert.equal(state.metrics.cachedInput.coverage.unknown, 1);
  assert.equal(state.metrics.uncachedInput.knownTotal, 4); assert.equal(state.metrics.uncachedInput.coverage.unknown, 1);
  assert.equal(state.metrics.input.coverage.partial, 1); assert.equal(state.reason, 'FINAL_USAGE_MISSING');
});

function setup(t: TestContext, change: Partial<SpendingBudget> = {}, result?: () => ExecutorResult, functionalFailure = false) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-budget-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['old', 'new']) { mkdirSync(join(root, name)); writeFileSync(join(root, name, 'SKILL.md'), `---\nname: budget-skill\ndescription: Diagnose answers.\n---\nCheck the public answer using the ${name} revision.\n`); }
  const bench = join(root, 'bench'); mkdirSync(join(bench, 'fixture'), { recursive: true });
  writeFileSync(join(bench, 'fixture/answer.txt'), 'pending'); writeFileSync(join(bench, 'prompt.md'), 'Repair the answer.');
  writeFileSync(join(bench, 'check.mjs'), `import{readFileSync}from'node:fs';import{join}from'node:path';const passed=readFileSync(join(process.argv[2],'answer.txt'),'utf8')==='fixed';console.log(JSON.stringify({passed,checks:[{name:'answer',pass:passed}]}));process.exit(passed?0:1);\n`);
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'budget', tasks: [
    { id: 'first', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node check.mjs', verifierKind: 'command' },
    { id: 'second', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node check.mjs', verifierKind: 'command' },
  ] }));
  const body = { schemaVersion: 1, baselineSkill: 'old', candidateSkill: 'new', bench: 'bench', agent: 'codex', purpose: 'validation',
    pairOrder: 'balanced', trials: 1, maxCalls: 4, spendingBudget: { ...limits, ...change }, runsRoot: 'runs', runGroup: 'budget' };
  const request = join(root, 'request.json'); writeFileSync(request, JSON.stringify(body));
  let count = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline-budget' }), run: async (_prompt, workdir) => {
    if (!functionalFailure) writeFileSync(join(workdir, 'answer.txt'), 'fixed');
    count++; return result ? result() : { output: 'done', tokens: { input: 10, cachedInput: 6, output: 3 } };
  } };
  const options = { executor, skillInstallDir: 'project-skills', sessionOptions: { homeDir: root, env: {}, versionProbe: () => null } };
  return { root, body, request, options, calls: () => count, directory: join(root, 'runs/budget') };
}

async function execute(f: ReturnType<typeof setup>) {
  const preview = await runEvalComponent(f.request, { ...f.options, dryRun: true }); assert.ok('plan' in preview);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.directory), false);
  return runEvalComponent(f.request, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
}

for (const metric of COST_METRICS) test(`${metric} stop line blocks the second executor and retains the first complete receipt`, async t => {
  const values = { input: 10, cachedInput: 6, uncachedInput: 4, output: 3, durationSeconds: 0.000001 };
  const f = setup(t, { [metric]: values[metric] }), result = await execute(f);
  assert.equal(f.calls(), 1); assert.equal(result.status, 'stopped'); assert.equal(result.acceptance.eligibleForUpgrade, false);
  const receipt = JSON.parse(readFileSync(join(f.directory, 'first/baseline/trial-1/_result.json'), 'utf8'));
  assert.deepEqual(receipt.tokens, { input: 10, cachedInput: 6, output: 3 });
  assert.equal(existsSync(join(f.directory, 'first/treatment/trial-1')), false);
  assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.ok(result.spendingBudget.latestState!.reached.includes(metric));
  assert.equal(result.spendingBudget.latestState!.metrics.input.knownTotal, 10);
  const replay = await reportEvalComponent(f.directory); assert.equal(replay.status, 'stopped');
  assert.ok('spendingBudget' in replay); assert.deepEqual(replay.spendingBudget, result.spendingBudget);
});

test('an in-flight overshoot is retained instead of clamped to its stop line', async t => {
  const f = setup(t, { input: 5 }), result = await execute(f);
  assert.equal(f.calls(), 1); assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.equal(result.spendingBudget.limits.input, 5); assert.equal(result.spendingBudget.latestState!.metrics.input.knownTotal, 10);
});

for (const [label, tokens] of [['no counters', undefined], ['missing cache', { input: 10, output: 3 }], ['incompatible cache', { input: 10, cachedInput: 11, output: 3 }]] as const) {
  test(`${label}: missing or incompatible final usage refuses another call without filling cache with zero`, async t => {
    const f = setup(t, {}, () => ({ output: 'returned', tokens })), result = await execute(f);
    assert.equal(f.calls(), 1); assert.equal(result.status, 'stopped'); assert.equal(result.acceptance.eligibleForUpgrade, false);
    assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
    assert.equal(result.spendingBudget.latestState!.reason, 'FINAL_USAGE_MISSING');
    assert.equal(result.spendingBudget.latestState!.metrics.cachedInput.coverage.unknown, 1);
  });
}

test('invalid retained receipts remain untouched and appear as unknown rather than disappearing or becoming zero-cost success', async t => {
  const f = setup(t, {}, () => ({ output: 'invalid counters', tokens: { input: 10, cachedInput: 11, output: 3 } }));
  const result = await execute(f), path = join(f.directory, 'first/baseline/trial-1/_result.json'), hash = sha256File(path);
  const value = JSON.parse(JSON.stringify(result));
  assert.equal(value.costs.invocationsWithUnknownReceipts, 1); assert.equal(value.costs.recordedExecutorInvocations, 0);
  assert.equal(value.costs.invalidReceipts.length, 1); assert.equal(value.costs.populations.attempts.baseline.metrics.input.coverage.unknown, 1);
  await reportEvalComponent(f.directory); assert.equal(sha256File(path), hash); assert.equal(f.calls(), 1);
});

test('an executor guard failure stops immediately while retaining its complete returned usage', async t => {
  const f = setup(t, {}, () => ({ output: 'retained', guardError: 'simulated configuration drift', tokens: { input: 12, cachedInput: 8, output: 2 } }));
  const result = await execute(f); assert.equal(result.status, 'stopped'); assert.equal(f.calls(), 1);
  assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.equal(result.spendingBudget.latestState!.reason, 'EXECUTION_FAILED');
  assert.equal(result.spendingBudget.latestState!.metrics.input.knownTotal, 12);
  assert.equal(result.spendingBudget.latestState!.metrics.input.coverage.final, 1);
});

test('executor failure retains partial usage, stops once and never replaces the call', async t => {
  const f = setup(t, {}, () => { throw new ExecutorFailure('offline simulated routing failure', { output: 'partial', usageStatus: 'partial', tokens: { input: 17, cachedInput: 4, output: 2 } }); });
  const result = await execute(f); assert.equal(f.calls(), 1); assert.equal(result.status, 'stopped');
  assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.equal(result.spendingBudget.latestState!.reason, 'EXECUTION_FAILED');
  assert.equal(result.spendingBudget.latestState!.metrics.input.knownTotal, 17);
  assert.equal(result.spendingBudget.latestState!.metrics.input.coverage.partial, 1);
});

test('ordinary functional failures spend budget and are not executor failures or replacement samples', async t => {
  const f = setup(t, {}, undefined, true), result = await execute(f);
  assert.equal(f.calls(), 4); assert.equal(result.status, 'completed');
  assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.equal(result.spendingBudget.latestState!.metrics.input.knownTotal, 40);
  assert.equal(result.spendingBudget.latestState!.reason, null); assert.equal(result.acceptance.eligibleForUpgrade, false);
});

test('complete budget events bind the plan and reproduce from native receipts', async t => {
  const f = setup(t), result = await execute(f); assert.equal(f.calls(), 4); assert.equal(result.status, 'completed');
  assert.ok('evidence' in result); assert.equal(result.evidence.verified, true); assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.equal(result.spendingBudget.events, 8); assert.equal(result.spendingBudget.latestState!.metrics.uncachedInput.knownTotal, 16);
  const replay = await reportEvalComponent(f.directory, { replay: true });
  assert.equal(replay.evidence.verified, true); assert.ok('spendingBudget' in replay); assert.deepEqual(replay.spendingBudget, result.spendingBudget);
});

test('a resealed under-reported budget trace fails the semantic native audit', async t => {
  const f = setup(t); await execute(f);
  const path = join(f.directory, '_budget.jsonl'), rows = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  rows[1].state.metrics.input.knownTotal = 0; writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const indexPath = join(f.directory, '_artifacts.json'), index = JSON.parse(readFileSync(indexPath, 'utf8'));
  index.files['_budget.jsonl'] = sha256File(path); writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  const result = await reportEvalComponent(f.directory); assert.equal(result.evidence.verified, false);
  assert.match(result.evidence.reasons.join(' '), /Budget after-call/); assert.equal(result.acceptance.eligibleForUpgrade, false);
});

test('changed stop lines invalidate a preview and cannot silently increase the approved budget', async t => {
  const f = setup(t), preview = await runEvalComponent(f.request, { ...f.options, dryRun: true }); assert.ok('plan' in preview);
  writeFileSync(f.request, JSON.stringify({ ...f.body, spendingBudget: { ...limits, input: 2000 } }));
  await assert.rejects(runEvalComponent(f.request, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 }), /changed/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.directory), false);
});

test('call ceiling remains independent and old request normalization omits the new optional field', async t => {
  const f = setup(t); const { spendingBudget: _unused, ...old } = f.body;
  assert.equal(Object.hasOwn(parseEvalRequest(old, f.root), 'spendingBudget'), false);
  writeFileSync(f.request, JSON.stringify({ ...f.body, maxCalls: 3 }));
  await assert.rejects(runEvalComponent(f.request, { ...f.options, dryRun: true }), /exceeding --max-calls/);
  assert.equal(f.calls(), 0);
});

test('a stop line reached only by the final declared call permits no extra call and preserves a complete cohort', async t => {
  const f = setup(t, { input: 40 }), result = await execute(f);
  assert.equal(f.calls(), 4); assert.equal(result.status, 'completed');
  assert.ok('spendingBudget' in result); assert.ok(result.spendingBudget);
  assert.deepEqual(result.spendingBudget.latestState!.reached, ['input']); assert.equal(result.evidence.verified, true);
});
