import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { runEval } from "../cli/eval.js";
import { auditEvaluation, stoppedAccounting } from "./records/audit.js";
import { sha256File } from "../shared/hash.js";
import { JudgePairFailure, judgePair, type JudgeCallReceipt } from "./execution/judge.js";
import { judgeCallReceipt } from "./records/judge-audit.js";
import { historicalInvocationCosts, invocationPopulation, parseInvocationCosts, summarizeInvocationCosts } from "./measurement/invocation-costs.js";
import { ExecutorFailure, type Executor, type ExecutorResult } from "../agents/contracts.js";
import type { SpendingBudget } from "./execution/budget.js";

const checklist = '{"A":{"correct":true,"complete":true,"grounded":true},"B":{"correct":true,"complete":true,"grounded":true}}';
const budget: SpendingBudget = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
const primaryTokens = { input: 10, cachedInput: 6, output: 3 };
const judgeTokens = { input: 5, cachedInput: 2, output: 1 };

function setup(t: TestContext, judgeResult: (ordinal: number) => ExecutorResult = () => ({ output: checklist, rawOutput: 'judge raw transcript', tokens: judgeTokens })) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-judge-accounting-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = join(root, 'skill'), bench = join(root, 'bench');
  mkdirSync(skill); mkdirSync(join(bench, 'fixture'), { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: audit-skill\ndescription: Offline test.\n---\nReturn the answer.\n');
  writeFileSync(join(bench, 'fixture/answer.txt'), 'pending'); writeFileSync(join(bench, 'prompt.md'), 'Return an answer.');
  writeFileSync(join(bench, 'check.mjs'), `import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';const file=join(process.argv[2],'_output.md');process.exit(existsSync(file)&&readFileSync(file,'utf8').trim()?0:1);\n`);
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'judge-costs', tasks: [{ id: 'answer', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node check.mjs' }] }));
  let primaryCalls = 0, judgeCalls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline-primary' }), run: async () => {
    primaryCalls++; return { output: 'answer', tokens: primaryTokens };
  } };
  const judge: Executor = { describe: () => ({ kind: 'mock', model: 'offline-judge' }), run: async () => judgeResult(++judgeCalls) };
  return { root, executor, judge, counts: () => ({ primary: primaryCalls, judge: judgeCalls }), directory: join(root, 'runs/judge'),
    options: { skillPath: skill, bench, executor, judgeExecutor: judge, trials: 1, maxCalls: 4, runsRoot: join(root, 'runs'), runGroup: 'judge',
      dryRun: false, yes: true, log: () => {}, sessionOptions: { homeDir: root, env: {}, versionProbe: () => null } } };
}

function reseal(directory: string, relative: string, value: unknown): void {
  writeFileSync(join(directory, relative), JSON.stringify(value, null, 2) + '\n');
  const indexPath = join(directory, '_artifacts.json'), index = JSON.parse(readFileSync(indexPath, 'utf8'));
  index.files[relative] = sha256File(join(directory, relative)); writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
}

test('each judge order retains independent complete usage and transcript; total budget/audit includes all four calls', async t => {
  const f = setup(t), manifest = await runEval({ ...f.options, spendingBudget: budget }); assert.ok(manifest && 'overall' in manifest);
  assert.deepEqual(f.counts(), { primary: 2, judge: 2 });
  const calls = [1, 2].map(i => judgeCallReceipt(JSON.parse(readFileSync(join(f.directory, `answer/judge-trial-1/call-${i}.json`), 'utf8'))));
  for (const call of calls) { assert.deepEqual(call.tokens, judgeTokens); assert.equal(call.usageStatus, 'final'); assert.equal(call.rawOutput, 'judge raw transcript'); assert.equal(call.timing.clock, 'performance.now'); }
  assert.notEqual(calls[0]!.promptSha256, calls[1]!.promptSha256);
  assert.equal(manifest.overall.costs!.attempts.baseline.metrics.input.knownTotal, 10);
  assert.equal(manifest.overall.costs!.attempts.treatment.metrics.input.knownTotal, 10);
  assert.equal(manifest.invocationCosts!.judge!.metrics.input.knownTotal, 10);
  assert.equal(manifest.invocationCosts!.total!.metrics.input.knownTotal, 30);
  assert.equal(manifest.invocationCosts!.total!.metrics.cachedInput.knownTotal, 16);
  const events = readFileSync(join(f.directory, '_budget.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.length, 8); assert.equal(events.at(-1).state.invocations, 4); assert.equal(events.at(-1).state.metrics.input.knownTotal, 30);
  const audited = await auditEvaluation(manifest, f.directory, { replay: true }); assert.equal(audited.verified, true, audited.reasons.join('\n'));
  assert.equal(audited.receipts, 4); assert.equal(audited.replayedDeliveries, 2); assert.deepEqual(f.counts(), { primary: 2, judge: 2 });
});

test('malformed judge JSON is retained with final spending and stops instead of launching its reverse order', async t => {
  const f = setup(t, () => ({ output: 'malformed but charged', tokens: judgeTokens, rawOutput: 'retained raw' }));
  await assert.rejects(runEval({ ...f.options, spendingBudget: budget }), /EXECUTION_FAILED|checklist JSON/);
  assert.deepEqual(f.counts(), { primary: 2, judge: 1 });
  const call = judgeCallReceipt(JSON.parse(readFileSync(join(f.directory, 'answer/judge-trial-1/call-1.json'), 'utf8')));
  assert.match(call.error!, /checklist JSON/); assert.equal(call.output, 'malformed but charged'); assert.equal(call.usageStatus, 'final');
  const costs = stoppedAccounting(f.directory); assert.equal(costs.invocationCosts.total!.metrics.input.knownTotal, 25);
  assert.equal(costs.startedJudgeDispatches, 1); assert.equal(costs.judgeInvocationsWithUnknownReceipts, 0);
  assert.ok(existsSync(join(f.directory, '_artifacts.json'))); assert.ok(existsSync(join(f.directory, 'answer/judge-trial-1-error.json')));
});

test('reverse judge execution failure retains its partial public output and lower-bound counters', async t => {
  const f = setup(t, index => {
    if (index === 1) return { output: checklist, tokens: judgeTokens };
    throw new ExecutorFailure('offline routing failure', { output: 'partial answer', rawOutput: 'partial raw', tokens: { input: 7, output: 2 }, usageStatus: 'partial' });
  });
  await assert.rejects(runEval(f.options), /routing failure/);
  assert.deepEqual(f.counts(), { primary: 2, judge: 2 });
  const costs = stoppedAccounting(f.directory), judge = costs.invocationCosts.judge!;
  assert.equal(judge.runs, 2); assert.equal(judge.metrics.input.knownTotal, 12); assert.equal(judge.metrics.input.coverage.partial, 1);
  assert.equal(judge.metrics.cachedInput.coverage.unknown, 1); assert.equal(costs.invocationCosts.total!.metrics.input.knownTotal, 32);
  const retained = JSON.parse(readFileSync(join(f.directory, 'answer/judge-trial-1/call-2.json'), 'utf8'));
  assert.equal(retained.output, 'partial answer'); assert.equal(retained.rawOutput, 'partial raw'); assert.equal(retained.scores, null);
});

test('interrupting an offline judge seals its partial receipt and stops before reverse order', async t => {
  const previousExit = process.exitCode, listeners = process.listenerCount('SIGINT');
  t.after(() => { process.exitCode = previousExit; });
  const f = setup(t, () => {
    process.emit('SIGINT');
    throw new ExecutorFailure('simulated interrupted judge', { output: 'retained interrupted text',
      rawOutput: 'retained interrupted transcript', tokens: { input: 8, cachedInput: 3, output: 1 }, usageStatus: 'partial' });
  });
  try {
    await assert.rejects(runEval(f.options), /interrupted by SIGINT/);
    assert.equal(process.exitCode, 130); assert.deepEqual(f.counts(), { primary: 2, judge: 1 });
    assert.equal(process.listenerCount('SIGINT'), listeners);
    const call = judgeCallReceipt(JSON.parse(readFileSync(join(f.directory, 'answer/judge-trial-1/call-1.json'), 'utf8')));
    assert.equal(call.output, 'retained interrupted text'); assert.equal(call.usageStatus, 'partial');
    const costs = stoppedAccounting(f.directory); assert.equal(costs.invocationCosts.total!.metrics.input.knownTotal, 28);
    assert.equal(costs.invocationCosts.judge!.metrics.input.coverage.partial, 1);
    assert.ok(existsSync(join(f.directory, '_interruption.json'))); assert.ok(existsSync(join(f.directory, '_artifacts.json')));
    assert.equal(existsSync(join(f.directory, 'answer/judge-trial-1/call-2.json')), false);
  } finally { process.exitCode = previousExit; }
});

test('missing judge usage or reached total spending stops before reverse order, with no retries or replacements', async t => {
  for (const [label, result, limits] of [
    ['unknown', { output: checklist }, budget],
    ['line', { output: checklist, tokens: judgeTokens }, { ...budget, input: 25 }],
  ] as const) {
    const f = setup(t, () => result); await assert.rejects(runEval({ ...f.options, spendingBudget: limits }), label === 'unknown' ? /FINAL_USAGE_MISSING/ : /SPENDING_BUDGET_REACHED/);
    assert.deepEqual(f.counts(), { primary: 2, judge: 1 });
    assert.equal(existsSync(join(f.directory, 'answer/judge-trial-1/call-2.json')), false);
    const costs = stoppedAccounting(f.directory); assert.equal(costs.invocationCosts.total!.runs, 3);
    assert.equal(costs.invocationCosts.judge!.metrics.input.coverage.unknown, label === 'unknown' ? 1 : 0);
    const session = JSON.parse(readFileSync(join(f.directory, '_session.json'), 'utf8'));
    assert.equal(session.stopCode, label === 'unknown' ? 'FINAL_USAGE_MISSING' : 'SPENDING_BUDGET_REACHED');
    assert.match(session.stopReason, label === 'unknown' ? /FINAL_USAGE_MISSING/ : /SPENDING_BUDGET_REACHED/);
  }
});

test('resealing altered aggregate usage, prompt evidence or missing historical judge usage cannot pass semantic audit', async t => {
  for (const mutation of ['total', 'ledger', 'history'] as const) {
    const f = setup(t), manifest = await runEval(f.options); assert.ok(manifest && 'overall' in manifest);
    if (mutation === 'total') { manifest.invocationCosts!.total!.metrics.input.knownTotal = 20; reseal(f.directory, 'manifest.json', manifest); }
    if (mutation === 'history') { delete manifest.invocationCosts; reseal(f.directory, 'manifest.json', manifest); }
    if (mutation === 'ledger') {
      const path = join(f.directory, '_calls.jsonl'), ledger = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      ledger.find(row => row.event === 'started' && row.role === 'judge').promptSha256 = '0'.repeat(64);
      writeFileSync(path, ledger.map(row => JSON.stringify(row)).join('\n') + '\n');
      const index = JSON.parse(readFileSync(join(f.directory, '_artifacts.json'), 'utf8')); index.files['_calls.jsonl'] = sha256File(path);
      writeFileSync(join(f.directory, '_artifacts.json'), JSON.stringify(index, null, 2) + '\n');
    }
    const audit = await auditEvaluation(manifest, f.directory); assert.equal(audit.verified, false);
    assert.match(audit.reasons.join(' '), /Full invocation accounting|Invocation.*total differs|prompt hash|Judge usage unrecorded/);
  }
});

test('invocation summary parser refuses invalid counters, coverage and role totals, preserving historical unknown', () => {
  const valid = summarizeInvocationCosts([], [], false); assert.deepEqual(parseInvocationCosts(valid), valid);
  const historical = historicalInvocationCosts(invocationPopulation([]), true); assert.deepEqual(parseInvocationCosts(historical), historical);
  for (const mutate of [
    (r: typeof valid) => { r.agent.metrics.input.knownTotal = -1; },
    (r: typeof valid) => { r.agent.metrics.output.coverage.final = 1; },
    (r: typeof valid) => { r.total!.runs = 1; },
    (r: typeof valid) => { r.judge = null; r.total = null; },
  ]) {
    const value = JSON.parse(JSON.stringify(valid)) as typeof valid; mutate(value); assert.throws(() => parseInvocationCosts(value));
  }
});

test('judge duration is monotonic even when wall clock moves backwards; non-invoked refusal spends nothing', async () => {
  let wall = 100_000, mono = 0;
  const capture: JudgeCallReceipt[] = [];
  const judge: Executor = { describe: () => ({ kind: 'mock', model: 'clock' }), run: async () => { wall -= 5000; mono += 250; return { output: checklist, tokens: judgeTokens }; } };
  const result = await judgePair(judge, { taskPromptText: 'task', baselineOutput: 'b', treatmentOutput: 't', seed: 'clock',
    clock: { wallNow: () => wall, monotonicNow: () => mono }, onCall: call => capture.push(call) });
  assert.equal(result.calls.length, 2); assert.equal(capture[0]!.durationSeconds, 0.25); assert.equal(capture[0]!.timing.wallDurationSeconds, -5);
  judgeCallReceipt(capture[0]);
  const refused: Executor = { ...judge, run: async () => { throw new ExecutorFailure('not dispatched', { output: '' }, false); } };
  let failure: unknown;
  try { await judgePair(refused, { taskPromptText: 'task', baselineOutput: 'b', treatmentOutput: 't', seed: 'refusal' }); } catch (error) { failure = error; }
  assert.ok(failure instanceof JudgePairFailure); assert.equal(failure.calls.length, 1); assert.equal(failure.calls[0]!.executorInvoked, false);
  assert.equal(summarizeInvocationCosts([], failure.calls, true).total!.runs, 0);
  const history = historicalInvocationCosts(invocationPopulation([]), true); assert.equal(history.judgeUsage, 'unknown'); assert.equal(history.judge, null); assert.equal(history.total, null);
});
