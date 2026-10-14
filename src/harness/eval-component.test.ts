import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { reportEvalComponent, runEvalComponent } from '../commands/eval-component.js';
import { runEval } from '../commands/eval.js';
import { assessEvaluation, type EvidenceAudit } from './eval-acceptance.js';
import { parseAcceptancePolicy, parseEvalRequest, policyHash } from './eval-contract.js';
import { hashFileSet, listFilesRecursive, sha256File } from './hash.js';
import { summarizeCosts, type CostObservation } from './costs.js';
import { ExecutorFailure, type Executor } from './types.js';

const CLI = fileURLToPath(new URL('../cli.js', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-component-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, answer] of [['old', '1'], ['new', '2']] as const) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, 'SKILL.md'), `---\nname: answer-skill\ndescription: Diagnose local answers.\n---\nAnswer ${answer}.\n`);
    writeFileSync(join(root, name, 'answer.txt'), answer!);
  }
  const bench = join(root, 'bench'); mkdirSync(join(bench, 'fixture'), { recursive: true });
  writeFileSync(join(bench, 'fixture/answer.txt'), 'pending'); writeFileSync(join(bench, 'prompt.md'), 'Fix answer.txt.');
  for (const [id, expected] of [['fix', '2'], ['regression', '1']]) writeFileSync(join(bench, id + '.mjs'),
    `import{readFileSync}from'node:fs';import{join}from'node:path';const pass=readFileSync(join(process.argv[2],'answer.txt'),'utf8')===${JSON.stringify(expected)};console.log(JSON.stringify({passed:pass,checks:[{name:'public answer',pass}]}));process.exit(pass?0:1);\n`);
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'component-outcomes', tasks:
    ['fix', 'regression'].map(id => ({ id, fixture: 'fixture', prompt: 'prompt.md', verifier: `node ${id}.mjs`, verifierKind: 'command' })) }));
  const body = { schemaVersion: 1, baselineSkill: 'old', candidateSkill: 'new', bench: 'bench', agent: 'codex', purpose: 'validation', trials: 1, maxCalls: 4, runsRoot: 'runs', runGroup: 'component' };
  const requestPath = join(root, 'request.json'); writeFileSync(requestPath, JSON.stringify(body));
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline-component' }), run: async (_prompt, workdir) => {
    calls++;
    const answer = readFileSync(join(workdir, 'project-skills/answer-skill/answer.txt'), 'utf8');
    writeFileSync(join(workdir, 'answer.txt'), answer);
    return { output: 'done', skillTriggered: true, tokens: answer === '1' ? { input: 10, cachedInput: 8, output: 2 } : { input: 8, cachedInput: 2, output: 3 } };
  } };
  const options = { executor, skillInstallDir: 'project-skills' };
  return { root, body, requestPath, executor, options, calls: () => calls, runDir: join(root, 'runs/component') };
}

async function run(t: TestContext) {
  const f = setup(t), preview = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true });
  assert.ok('plan' in preview);
  const result = await runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
  return { ...f, preview, result };
}

test('component request resolves relative paths, rejects unknown/weak settings and plans without writes', async t => {
  const f = setup(t);
  const normalized = parseEvalRequest(f.body, f.root); assert.equal(normalized.bench, join(f.root, 'bench'));
  assert.equal(normalized.pairOrder, 'baseline-first');
  assert.throws(() => parseEvalRequest({ ...f.body, pairOrder: 'random' }, f.root), /request.pairOrder/);
  assert.throws(() => parseEvalRequest({ ...f.body, surprise: true }, f.root), /unknown fields/);
  assert.throws(() => parseEvalRequest({ ...f.body, trials: 0 }, f.root), /request.trials/);
  assert.throws(() => parseEvalRequest({ ...f.body, runGroup: '../escape' }, f.root), /runGroup/);
  assert.throws(() => parseAcceptancePolicy({ minTasks: 1 }), /policy.minTasks/);
  assert.throws(() => parseAcceptancePolicy({ minTrialsPerTask: 1 }), /minTrials/);
  const preview = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true });
  assert.equal(preview.status, 'planned'); assert.equal(f.calls(), 0); assert.equal(existsSync(join(f.root, 'runs')), false);
  assert.ok('plan' in preview); assert.equal(preview.plan.evaluation.plannedCalls, 4);
  assert.equal(preview.acceptance.eligibleForUpgrade, false);
});

test('balanced component execution alternates adjacent first arms and preserves pairing on replay', async t => {
  const f = setup(t), observed: string[] = [];
  writeFileSync(f.requestPath, JSON.stringify({ ...f.body, trials: 3, maxCalls: 12, pairOrder: 'balanced' }));
  const executor: Executor = { ...f.executor, run: async (prompt, workdir) => {
    observed.push(workdir.split(/[\\/]/).slice(-3).join('/'));
    return f.executor.run(prompt, workdir);
  } };
  const options = { ...f.options, executor }, preview = await runEvalComponent(f.requestPath, { ...options, dryRun: true });
  assert.ok('plan' in preview); assert.equal(preview.plan.evaluation.pairOrder, 'balanced');
  const result = await runEvalComponent(f.requestPath, { ...options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
  assert.equal(result.status, 'completed'); assert.ok('quality' in result);
  assert.deepEqual(observed, [
    'fix/baseline/trial-1','fix/treatment/trial-1',
    'fix/treatment/trial-2','fix/baseline/trial-2',
    'fix/baseline/trial-3','fix/treatment/trial-3',
    'regression/treatment/trial-1','regression/baseline/trial-1',
    'regression/baseline/trial-2','regression/treatment/trial-2',
    'regression/treatment/trial-3','regression/baseline/trial-3',
  ]);
  assert.equal(result.quality.improvedPairs, 3); assert.equal(result.quality.regressedPairs, 3);
  assert.equal(result.evidence.verified, true);
  const replay = await reportEvalComponent(f.runDir, { replay: true }); assert.ok('quality' in replay);
  assert.equal(replay.environment?.pairOrder, 'balanced'); assert.equal(replay.evidence.verified, true);
  assert.deepEqual(replay.quality, result.quality); assert.deepEqual(replay.costs, result.costs);
});

test('changing the planned pair order refuses a stale preview before writes or calls', async t => {
  const f = setup(t), before = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true }); assert.ok('plan' in before);
  writeFileSync(f.requestPath, JSON.stringify({ ...f.body, pairOrder: 'balanced' }));
  await assert.rejects(runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: before.plan.sha256 }), /changed/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(join(f.root, 'runs')), false);
});

test('resealing a ledger with wrong first-arm order still fails the native consistency audit', async t => {
  const f = await run(t), path = join(f.runDir, '_calls.jsonl');
  const rows = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  const starts = rows.filter(row => row.event === 'started' && row.role === 'agent');
  const first = starts[0]!.workdir; starts[0]!.workdir = starts[1]!.workdir; starts[1]!.workdir = first;
  writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const indexPath = join(f.runDir, '_artifacts.json'), index = JSON.parse(readFileSync(indexPath, 'utf8'));
  index.files['_calls.jsonl'] = sha256File(path); writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  const result = await reportEvalComponent(f.runDir); assert.ok('quality' in result);
  assert.equal(result.evidence.verified, false); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.match(result.evidence.reasons.join(' '), /execution order/);
});

test('component refuses absent/stale plan fingerprints and input drift before writes or calls', async t => {
  const f = setup(t), preview = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true }); assert.ok('plan' in preview);
  await assert.rejects(runEvalComponent(f.requestPath, { ...f.options, dryRun: false }), /--plan-sha/);
  writeFileSync(join(f.root, 'new/answer.txt'), '3');
  await assert.rejects(runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 }), /changed/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(join(f.root, 'runs')), false);
});

test('component records improvements, regressions and failed-task spending, with an exact offline replay', async t => {
  const f = await run(t), result = f.result;
  assert.equal(result.status, 'completed'); assert.equal(f.calls(), 4);
  assert.ok('quality' in result); assert.equal(result.quality.improvedPairs, 1); assert.equal(result.quality.regressedPairs, 1);
  assert.equal(result.acceptance.decision, 'reject'); assert.equal(result.acceptance.automaticUpgrade, false);
  assert.equal(result.costs.populations?.attempts.treatment.metrics.uncachedInput.knownTotal, 12);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.uncachedInput.knownTotal, 4);
  assert.equal(result.evidence.verified, true);
  assert.ok(result.evidence.pairs?.some(p => p.changedChecks.some(c => c.change === 'regressed')));
  const replay = await reportEvalComponent(f.runDir, { replay: true }); assert.ok('quality' in replay);
  assert.equal(replay.evidence.replayedDeliveries, 4); assert.equal(replay.evidence.verified, true);
  assert.deepEqual(replay.quality, result.quality); assert.deepEqual(replay.costs, result.costs);
  assert.deepEqual(replay.acceptance, result.acceptance);
  assert.deepEqual(replay.evidence.pairs, result.evidence.pairs);
  assert.equal(readFileSync(join(f.root, 'old/answer.txt'), 'utf8'), '1');
});

test('receipt tampering prevents eligibility and is surfaced without rewriting evidence', async t => {
  const f = await run(t);
  const path = join(f.runDir, 'fix/treatment/trial-1/_result.json');
  writeFileSync(path, readFileSync(path, 'utf8') + '\n');
  const result = await reportEvalComponent(f.runDir); assert.ok('quality' in result);
  assert.equal(result.evidence.verified, false); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.ok(result.acceptance.reasons.some(r => r.code === 'EVIDENCE_NOT_VERIFIED'));
});

test('an added unsealed file invalidates the native inventory', async t => {
  const f = await run(t);
  writeFileSync(join(f.runDir, 'fix/treatment/trial-1/unsealed.txt'), 'extra grader input');
  const result = await reportEvalComponent(f.runDir); assert.ok('quality' in result);
  assert.equal(result.evidence.verified, false); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.match(result.evidence.reasons.join(' '), /inventory changed/);
});

test('a programmatic injected executor cannot claim genuine component evidence', async t => {
  const f = setup(t), p = parseAcceptancePolicy();
  const executor: Executor = { ...f.executor, describe: () => ({ kind: 'cli', model: 'offline-spoof-fixture' }) };
  await runEval({ skillPath: join(f.root, 'new'), baselineSkillPath: join(f.root, 'old'), bench: join(f.root, 'bench'), agent: 'codex',
    mode: 'installed', skillInstallDir: 'project-skills', executor, judgeExecutor: null, trials: 1, maxCalls: 4,
    runsRoot: join(f.root, 'runs'), runGroup: 'component', dryRun: false, yes: true, log: () => {},
    component: { schemaVersion: 1, requestSha256: 'a'.repeat(64), previewSha256: 'b'.repeat(64), implementationSha256: hashFileSet(join(ROOT, 'dist'), listFilesRecursive(join(ROOT, 'dist'))),
      policySha256: policyHash(p), policy: p, purpose: 'validation', synthetic: false } });
  const result = await reportEvalComponent(f.runDir); assert.ok('quality' in result);
  assert.equal(result.evidence.verified, false); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.match(result.evidence.reasons.join(' '), /Injected executor/);
});

test('native planning rejects an implementation differing from the approved preview before writes', async t => {
  const f = setup(t), p = parseAcceptancePolicy();
  await assert.rejects(runEval({ skillPath: join(f.root, 'new'), baselineSkillPath: join(f.root, 'old'), bench: join(f.root, 'bench'), agent: 'codex',
    mode: 'installed', skillInstallDir: 'project-skills', executor: f.executor, judgeExecutor: null, trials: 1, maxCalls: 4,
    runsRoot: join(f.root, 'runs'), runGroup: 'component', dryRun: false, yes: true, log: () => {},
    component: { schemaVersion: 1, requestSha256: 'a'.repeat(64), previewSha256: 'b'.repeat(64), implementationSha256: '0'.repeat(64),
      policySha256: policyHash(p), policy: p, purpose: 'validation', synthetic: true } }), /implementation differs/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(join(f.root, 'runs')), false);
});

test('unfinished ledgers with missing receipts report unknown spending and cannot authorize adoption', async t => {
  const f = setup(t); mkdirSync(f.runDir, { recursive: true });
  writeFileSync(join(f.runDir, '_plan.json'), '{}');
  writeFileSync(join(f.runDir, '_calls.jsonl'), JSON.stringify({ event: 'started', role: 'agent', workdir: join(f.runDir, 'fix/baseline/trial-1') }) + '\n');
  const result = await reportEvalComponent(f.runDir); assert.ok('costs' in result);
  assert.equal(result.status, 'incomplete'); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.input.coverage.unknown, 1);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.durationSeconds.coverage.unknown, 1);
});

test('changing the request policy during a call stops further calls and retains public spending', async t => {
  const f = setup(t); let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'policy-drift' }), run: async () => {
    calls++; writeFileSync(f.requestPath, JSON.stringify({ ...f.body, policy: { minTasks: 9 } }));
    return { output: 'done', tokens: { input: 10, cachedInput: 2, output: 3 } };
  } };
  const options = { ...f.options, executor }, preview = await runEvalComponent(f.requestPath, { ...options, dryRun: true }); assert.ok('plan' in preview);
  const result = await runEvalComponent(f.requestPath, { ...options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
  assert.equal(calls, 1); assert.equal(result.status, 'stopped'); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.ok('costs' in result);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.input.knownTotal, 10);
  const replay = await reportEvalComponent(f.runDir); assert.deepEqual(replay.costs, result.costs);
});

test('executor failures preserve partial usage and missing cache counts remain unknown', async t => {
  const f = setup(t);
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'timeout' }), run: async () => {
    throw new ExecutorFailure('simulated timeout', { output: '', tokens: { input: 12, output: 2 }, usageStatus: 'partial' });
  } };
  const options = { ...f.options, executor }, preview = await runEvalComponent(f.requestPath, { ...options, dryRun: true }); assert.ok('plan' in preview);
  const result = await runEvalComponent(f.requestPath, { ...options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
  assert.equal(result.status, 'stopped'); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.ok('costs' in result);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.input.knownTotal, 12);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.input.coverage.partial, 1);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.uncachedInput.coverage.unknown, 1);
});

test('partial numeric usage provenance is sealed in receipts without making a stopped experiment eligible', async t => {
  const f = setup(t), tokens = { input: 12, cachedInput: 8, output: 2 };
  const evidence = { source: 'local-session-token-count' as const, threadId: '11111111-1111-4111-8111-111111111111',
    counterAt: '2026-10-13T00:00:00Z', recordSha256: 'a'.repeat(64), tokens, scope: 'Partial counter only.' };
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'partial-metadata' }), run: async () => {
    throw new ExecutorFailure('simulated timeout', { output: '', tokens, usageStatus: 'partial', usageEvidence: evidence });
  } };
  const options = { ...f.options, executor }, preview = await runEvalComponent(f.requestPath, { ...options, dryRun: true }); assert.ok('plan' in preview);
  const result = await runEvalComponent(f.requestPath, { ...options, dryRun: false, expectedPlanSha256: preview.plan.sha256 }); assert.ok('quality' in result);
  const receipt = JSON.parse(readFileSync(join(f.runDir, 'fix/baseline/trial-1/_result.json'), 'utf8'));
  assert.deepEqual(receipt.usageEvidence, evidence); assert.equal(result.evidence.verified, true);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.input.coverage.partial, 1);
  assert.equal(result.costs.populations?.attempts.baseline.metrics.uncachedInput.knownTotal, 4);
  assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.ok(result.acceptance.reasons.some(r => r.code === 'INCOMPLETE_COSTS'));
});

function strongManifest() {
  const p = parseAcceptancePolicy();
  const observations = (arm: 'baseline' | 'treatment'): CostObservation[] => Array.from({ length: 5 }, (_, n) => ({
    executorInvoked: true, passed: arm === 'treatment' || n < 3, error: null, durationSeconds: 1,
    tokens: { input: arm === 'baseline' ? 10 : 9, cachedInput: 5, output: arm === 'baseline' ? 2 : 1 }, usageStatus: 'final',
  }));
  const arms = { baseline: observations('baseline'), treatment: observations('treatment') }, costs = summarizeCosts(arms, arms);
  const condition = (passes: number, trials: number) => ({ passes, trials, errors: 0 });
  const tasks = Array.from({ length: 8 }, (_, n) => ({ id: 'task-' + n, conditions: { baseline: condition(3, 5), treatment: condition(5, 5) },
    outcomes: { baseline: [true, true, true, false, false], treatment: [true, true, true, true, true] },
    deltaPassRate: 0.4, scoreDelta: null, verdict: 'inconclusive', facets: [], costs }));
  const all = { baseline: tasks.flatMap(() => arms.baseline), treatment: tasks.flatMap(() => arms.treatment) };
  return { schemaVersion: 4, createdAt: '2026-10-13T00:00:00Z', runGroup: 'policy-unit-fixture',
    target: { kind: 'skill', name: 'test', bundleSha256: 'a'.repeat(64), files: ['SKILL.md'] },
    baselineTarget: { kind: 'skill', name: 'test', bundleSha256: 'b'.repeat(64), files: ['SKILL.md'], sourceDir: '/old' },
    inputMode: 'workspace', skillDelivery: { mode: 'installed', installDir: 'project-skills' },
    executor: { kind: 'cli', model: 'synthetic-policy-unit-fixture' }, judge: null,
    bench: { name: 'policy-unit', contentSha256: 'c'.repeat(64), taskCount: 8 }, trials: 5, tasks, warnings: ['Synthetic fixture used only to test the policy function.'],
    component: { schemaVersion: 1, policy: p, policySha256: policyHash(p), requestSha256: 'd'.repeat(64), previewSha256: 'e'.repeat(64), implementationSha256: '0'.repeat(64), purpose: 'validation', synthetic: false },
    experiment: { schemaVersion: 1, status: 'completed', plannedCalls: 80, maxCalls: 80, callsStarted: 80, callsFinished: 80, stopReason: null as string | null, planSha256: 'f'.repeat(64) },
    overall: { conditions: { baseline: condition(24, 40), treatment: condition(40, 40) }, costs: summarizeCosts(all, all), deltaPassRate: 0.4, verdict: 'effective', verdictReason: 'synthetic exact-test fixture',
      stats: { discordant: { improved: 16, regressed: 0 }, mcnemarP: 2 / 65536, deltaCi: { point: 0.4, lo: 0.4, hi: 0.4, resamples: 1000 } } } };
}

const verified: EvidenceAudit = { verified: true, reasons: [], indexedFiles: 0, receipts: 80, replayedDeliveries: 0, replayRequested: false, policyBound: true };

function efficientTieManifest() {
  const value = strongManifest();
  value.component.policy = parseAcceptancePolicy({ schemaVersion: 2, objective: 'efficiency' });
  value.component.policySha256 = policyHash(value.component.policy);
  const observations = (input: number): CostObservation[] => Array.from({ length: 5 }, () => ({
    executorInvoked: true, passed: true, error: null, durationSeconds: 1,
    tokens: { input, cachedInput: 20, output: 10 }, usageStatus: 'final',
  }));
  const arms = { baseline: observations(100), treatment: observations(70) };
  for (const task of value.tasks) {
    task.conditions.baseline.passes = 5; task.outcomes.baseline.fill(true); task.deltaPassRate = 0;
    task.costs = summarizeCosts(arms, arms);
  }
  value.overall.conditions.baseline.passes = 40; value.overall.deltaPassRate = 0; value.overall.verdict = 'inconclusive';
  value.overall.stats.discordant.improved = 0; value.overall.stats.mcnemarP = 1;
  value.overall.stats.deltaCi = { point: 0, lo: 0, hi: 0, resamples: 1000 };
  const all = { baseline: value.tasks.flatMap(() => arms.baseline), treatment: value.tasks.flatMap(() => arms.treatment) };
  value.overall.costs = summarizeCosts(all, all);
  return { ...value, pairOrder: 'balanced' };
}

test('explicit efficiency validation accepts stable savings with no observed regression while quality remains inconclusive', () => {
  const value = efficientTieManifest(), result = assessEvaluation(value, verified);
  assert.equal(result.acceptance.decision, 'accept'); assert.equal(result.acceptance.automaticUpgrade, false);
  assert.equal(result.quality.statisticalVerdict, 'inconclusive'); assert.equal(result.quality.deltaPassRate, 0);
  assert.equal(result.costs.efficiency?.tasksCompared, 8); assert.ok(result.costs.efficiency!.ci!.hi < -0.1);
  const version1 = parseAcceptancePolicy();
  value.component.policy = version1; value.component.policySha256 = policyHash(version1);
  assert.ok(assessEvaluation(value, verified).acceptance.reasons.some(r => r.code === 'QUALITY_GAIN_UNPROVEN'));
});

test('efficiency cannot waive predeclaration, independent validation, balanced order or visible regressions', () => {
  const value = efficientTieManifest();
  assert.ok(assessEvaluation(value, verified, parseAcceptancePolicy()).acceptance.reasons.some(r => r.code === 'POLICY_NOT_PREDECLARED'));
  for (const mutate of [
    (v: typeof value) => { v.component.purpose = 'development'; },
    (v: typeof value) => { v.component.synthetic = true; },
    (v: typeof value) => { v.pairOrder = 'baseline-first'; },
  ]) { const copy = structuredClone(value); mutate(copy); assert.equal(assessEvaluation(copy, verified).acceptance.decision, 'inconclusive'); }
  const observation: CostObservation & { score: null } = { executorInvoked: true, passed: true, error: null, durationSeconds: 1, tokens: null, usageStatus: 'unknown', score: null };
  const result = assessEvaluation(value, { ...verified, pairs: [{ taskId: 'task-0', trial: 1, graded: true,
    baseline: observation, treatment: observation, scoreDelta: 0, costs: null, changedChecks: [{ name: 'edge case', change: 'regressed' }] }] });
  assert.equal(result.acceptance.decision, 'reject');
});

test('efficiency keeps input partition tradeoffs visible and refuses unstable savings', () => {
  const value = efficientTieManifest();
  for (const scope of ['paired', 'attempts'] as const) {
    for (const task of value.tasks) {
      task.costs[scope].treatment.metrics.cachedInput.knownTotal = 125;
      task.costs[scope].treatment.metrics.uncachedInput.knownTotal = 225;
    }
    value.overall.costs[scope].treatment.metrics.cachedInput.knownTotal = 1000;
    value.overall.costs[scope].treatment.metrics.uncachedInput.knownTotal = 1800;
  }
  assert.ok(assessEvaluation(value, verified).acceptance.reasons.some(r => r.code === 'COST_LIMIT_EXCEEDED'));
  const equal = efficientTieManifest();
  for (const task of equal.tasks) for (const scope of ['paired', 'attempts'] as const) {
    task.costs[scope].treatment.metrics.input.knownTotal = 500;
    task.costs[scope].treatment.metrics.uncachedInput.knownTotal = 400;
  }
  for (const scope of ['paired', 'attempts'] as const) {
    equal.overall.costs[scope].treatment.metrics.input.knownTotal = 4000;
    equal.overall.costs[scope].treatment.metrics.uncachedInput.knownTotal = 3200;
  }
  const result = assessEvaluation(equal, verified);
  assert.equal(result.acceptance.decision, 'inconclusive');
  assert.ok(result.acceptance.reasons.some(r => r.code === 'EFFICIENCY_REDUCTION_UNPROVEN'));
  assert.ok(result.acceptance.reasons.some(r => r.code === 'EFFICIENCY_NOT_BROAD'));
});

test('versioned policy parsing retains canonical quality bytes and rejects ambiguous objectives', () => {
  const v1 = parseAcceptancePolicy();
  assert.equal(JSON.stringify(v1), '{"schemaVersion":1,"minTasks":8,"minTrialsPerTask":5,"minDeltaPassRate":0,"maxCostIncreaseFraction":{"uncachedInput":0,"output":0,"durationSeconds":0}}');
  assert.equal(policyHash(v1), policyHash(parseAcceptancePolicy({ schemaVersion: 1 })));
  assert.throws(() => parseAcceptancePolicy({ objective: 'efficiency' }), /unknown fields/);
  assert.throws(() => parseAcceptancePolicy({ schemaVersion: 2 }), /objective/);
  assert.throws(() => parseAcceptancePolicy({ schemaVersion: 2, objective: 'quality' }), /objective/);
  assert.throws(() => parseAcceptancePolicy({ schemaVersion: 2, objective: 'efficiency', minUncachedInputReductionFraction: 0 }), /minUncachedInputReductionFraction/);
  assert.throws(() => parseAcceptancePolicy({ schemaVersion: 2, objective: 'efficiency', minImprovedTaskFraction: 0.5 }), /minImprovedTaskFraction/);
  assert.throws(() => parseAcceptancePolicy({ schemaVersion: 2, objective: 'efficiency', minDeltaPassRate: 0 }), /unknown fields/);
});

test('a version-2 request binds its objective to native receipts and reproduces cost evidence offline', async t => {
  const f = setup(t);
  writeFileSync(f.requestPath, JSON.stringify({ ...f.body, pairOrder: 'balanced', policy: { schemaVersion: 2, objective: 'efficiency' } }));
  const preview = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true }); assert.ok('plan' in preview);
  const result = await runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 });
  assert.ok('quality' in result); assert.equal(result.evidence.verified, true);
  assert.ok('policy' in result.acceptance);
  assert.equal(result.acceptance.policy.schemaVersion, 2); assert.equal(result.acceptance.decision, 'reject');
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.costs.efficiency!.ci, null);
  const replay = await reportEvalComponent(f.runDir, { replay: true }); assert.ok('quality' in replay);
  assert.equal(replay.evidence.verified, true); assert.deepEqual(replay.costs, result.costs);
  assert.deepEqual(replay.acceptance, result.acceptance);
});

test('declared deadlines are bounded, frozen before execution and reported from the native plan', async t => {
  const f = setup(t);
  assert.equal(parseEvalRequest(f.body, f.root).executorTimeoutSeconds, 600);
  for (const executorTimeoutSeconds of [0, 3601, 1.5, Infinity]) {
    assert.throws(() => parseEvalRequest({ ...f.body, executorTimeoutSeconds }, f.root), /executorTimeoutSeconds/);
  }
  writeFileSync(f.requestPath, JSON.stringify({ ...f.body, executorTimeoutSeconds: 1200 }));
  const preview = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true }); assert.ok('plan' in preview);
  assert.equal(preview.plan.request.executorTimeoutSeconds, 1200); assert.equal(preview.plan.evaluation.executorTimeoutSeconds, 1200);
  writeFileSync(f.requestPath, JSON.stringify({ ...f.body, executorTimeoutSeconds: 600 }));
  await assert.rejects(runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: preview.plan.sha256 }), /matching the current dry-run plan/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.runDir), false);
  const current = await runEvalComponent(f.requestPath, { ...f.options, dryRun: true }); assert.ok('plan' in current);
  const result = await runEvalComponent(f.requestPath, { ...f.options, dryRun: false, expectedPlanSha256: current.plan.sha256 });
  assert.ok('quality' in result); assert.equal(result.evidence.verified, true); assert.equal(result.environment?.executorTimeoutSeconds, 600);
});

test('adoption policy accepts only positive complete predeclared validation, never performs an upgrade', () => {
  const value = strongManifest(), result = assessEvaluation(value, verified);
  assert.equal(result.acceptance.decision, 'accept'); assert.equal(result.acceptance.eligibleForUpgrade, true);
  assert.equal(result.acceptance.automaticUpgrade, false);
  for (const change of [(v: typeof value) => { v.component.purpose = 'development'; },
    (v: typeof value) => { v.component.synthetic = true; },
    (v: typeof value) => { v.experiment.status = 'stopped'; v.experiment.stopReason = 'test'; }]) {
    const copy = structuredClone(value); change(copy); assert.equal(assessEvaluation(copy, verified).acceptance.eligibleForUpgrade, false);
  }
  const changedPolicy = parseAcceptancePolicy({ minTasks: 9 });
  assert.equal(assessEvaluation(value, verified, changedPolicy).acceptance.eligibleForUpgrade, false);
  const looser = assessEvaluation(value, verified, parseAcceptancePolicy({ maxCostIncreaseFraction: { output: 1 } }));
  assert.equal(looser.acceptance.decision, 'inconclusive');
  assert.ok(looser.acceptance.reasons.some(r => r.code === 'POLICY_NOT_PREDECLARED'));
  const largerScale = strongManifest(); largerScale.component.policy = parseAcceptancePolicy({ minTasks: 9 });
  largerScale.component.policySha256 = policyHash(largerScale.component.policy);
  const small = assessEvaluation(largerScale, verified);
  assert.equal(small.quality.statisticalVerdict, 'effective'); assert.equal(small.acceptance.decision, 'inconclusive');
  assert.deepEqual(small.acceptance.reasons.map(r => r.code), ['INSUFFICIENT_SCALE']);
});

test('a declared cost limit can reject an otherwise positive complete validation fixture', () => {
  const value = strongManifest();
  for (const scope of ['paired', 'attempts'] as const) {
    for (const task of value.tasks) task.costs[scope].treatment.metrics.output.knownTotal = 100;
    value.overall.costs[scope].treatment.metrics.output.knownTotal = 800;
  }
  const result = assessEvaluation(value, verified);
  assert.equal(result.quality.statisticalVerdict, 'effective'); assert.equal(result.acceptance.decision, 'reject');
  assert.ok(result.acceptance.reasons.some(r => r.code === 'COST_LIMIT_EXCEEDED'));
});

test('paired named-check regressions cannot be hidden by unchanged task averages', () => {
  const value = strongManifest();
  const observation: CostObservation & { score: null } = { executorInvoked: true, passed: true, error: null, durationSeconds: 1,
    tokens: { input: 10, cachedInput: 5, output: 2 }, usageStatus: 'final', score: null };
  const result = assessEvaluation(value, { ...verified, pairs: [{ taskId: 'task-0', trial: 1, graded: true,
    baseline: observation, treatment: observation, scoreDelta: 0,
    changedChecks: [{ name: 'public callback', change: 'regressed' }], costs: null }] });
  assert.equal(result.quality.statisticalVerdict, 'effective');
  assert.equal(result.acceptance.decision, 'reject');
  assert.ok(result.acceptance.reasons.some(r => r.code === 'OBSERVED_PAIR_REGRESSION'));
});

test('aggregate improvement cannot hide a named-check regression or incomplete costs', () => {
  const value = strongManifest();
  (value.tasks[0]!.facets as unknown[]).push({ name: 'public callback', baselinePassRate: 1, treatmentPassRate: 0, baselineTrials: 5, treatmentTrials: 5 });
  assert.equal(assessEvaluation(value, verified).acceptance.decision, 'reject');
  const missing = strongManifest();
  for (const scope of ['paired', 'attempts'] as const) for (const metric of ['cachedInput', 'uncachedInput'] as const) {
    for (const task of missing.tasks) {
      task.costs[scope].treatment.metrics[metric].coverage = { final: 0, partial: 0, unknown: 5 };
      task.costs[scope].treatment.metrics[metric].knownTotal = 0;
    }
    missing.overall.costs[scope].treatment.metrics[metric].coverage = { final: 0, partial: 0, unknown: 40 };
    missing.overall.costs[scope].treatment.metrics[metric].knownTotal = 0;
  }
  const assessed = assessEvaluation(missing, verified);
  assert.equal(assessed.acceptance.eligibleForUpgrade, false);
  assert.ok(assessed.acceptance.reasons.some(r => r.code === 'INCOMPLETE_COSTS'));
  assert.equal(assessEvaluation(strongManifest(), { ...verified, verified: false, reasons: ['missing receipts'] }).acceptance.eligibleForUpgrade, false);
});

test('published real revision evidence preserves recorded cost coverage and never authorizes an upgrade', async () => {
  for (const name of ['2026-10-12-diagnosing-revision', '2026-10-12-normalize-url-v2-validated']) {
    const path = join(ROOT, 'evidence/artifacts', name, 'manifest.json');
    const result = await reportEvalComponent(path); assert.ok('quality' in result);
    assert.equal(result.acceptance.eligibleForUpgrade, false);
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(result.costs.populations, saved.overall.costs ?? null);
    if (saved.overall.costs === undefined) assert.ok(result.acceptance.reasons.some(r => r.code === 'INCOMPLETE_COSTS'));
    if (name.includes('diagnosing')) assert.equal(result.quality.regressedPairs, 2);
    else assert.equal(result.quality.improvedPairs, 0);
  }
});

test('CLI request plans and errors emit one parseable JSON document without agent execution', t => {
  const f = setup(t);
  const plan = spawnSync(process.execPath, [CLI, 'eval', '--request', f.requestPath, '--dry-run'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr); assert.equal(JSON.parse(plan.stdout).status, 'planned');
  const refusal = spawnSync(process.execPath, [CLI, 'eval', '--request=' + f.requestPath, '--plan-sha', 'bad'], { encoding: 'utf8' });
  assert.equal(refusal.status, 2); assert.equal(JSON.parse(refusal.stdout).acceptance.eligibleForUpgrade, false);
  const mixed = spawnSync(process.execPath, [CLI, 'eval', '--request', f.requestPath, '--trials', '2', '--dry-run'], { encoding: 'utf8' });
  assert.equal(mixed.status, 2); assert.match(JSON.parse(mixed.stdout).error.message, /cannot be combined/);
  assert.equal(existsSync(join(f.root, 'runs')), false);
});
