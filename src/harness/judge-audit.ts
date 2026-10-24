import { assertModelIdentity } from './model-identity.js';
import assert from 'node:assert/strict';
import { record } from './eval-contract.js';
import { parseJudgeScores, type JudgeCallReceipt } from './judge-protocol.js';
import { sha256Text } from './hash.js';

/** Validate a retained judge receipt without executing a judge or reading current config. */
export function judgeCallReceipt(value: unknown): JudgeCallReceipt {
  const r = record(value, 'judge invocation receipt');
  assert.equal(r.schemaVersion, 1); assert.equal(r.kind, 'skillfit.judge-call');
  assert.ok(typeof r.taskId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(r.taskId));
  assert.ok(Number.isSafeInteger(r.trial) && Number(r.trial) >= 1);
  assert.ok(r.callIndex === 1 || r.callIndex === 2);
  assert.equal(typeof r.seed, 'string'); assert.ok(r.firstCondition === 'baseline' || r.firstCondition === 'treatment');
  assert.equal(typeof r.prompt, 'string'); assert.equal(sha256Text(r.prompt as string), r.promptSha256);
  assert.equal(typeof r.output, 'string'); assert.ok(r.rawOutput === null || typeof r.rawOutput === 'string');
  assert.equal(typeof r.executorInvoked, 'boolean'); assert.equal(typeof r.passed, 'boolean');
  assert.ok(r.error === null || typeof r.error === 'string'); assert.equal(r.passed, r.error === null);
  assert.ok(['final', 'partial', 'unknown'].includes(String(r.usageStatus)));
  assert.ok(typeof r.durationSeconds === 'number' && Number.isFinite(r.durationSeconds) && r.durationSeconds >= 0);
  for (const key of ['startedAt', 'finishedAt']) assert.ok(typeof r[key] === 'string' && Number.isFinite(Date.parse(r[key] as string)));
  const timing = record(r.timing, 'judge invocation timing'); assert.equal(timing.clock, 'performance.now');
  assert.equal(timing.wallDurationSeconds, (Date.parse(r.finishedAt as string) - Date.parse(r.startedAt as string)) / 1000);
  if (timing.execution !== null) {
    const execution = record(timing.execution, 'judge execution timing');
    assert.equal(execution.clock, 'performance.now');
    assert.ok(typeof execution.elapsedMs === 'number' && Number.isFinite(execution.elapsedMs) && execution.elapsedMs >= 0);
    assert.ok(r.durationSeconds >= execution.elapsedMs / 1000 - 0.002, 'Judge execution interval exceeds invocation duration.');
  }
  if (r.tokens !== null) {
    const tokens = record(r.tokens, 'judge tokens');
    for (const key of ['input', 'cachedInput', 'output']) if (tokens[key] !== undefined) {
      assert.ok(Number.isSafeInteger(tokens[key]) && Number(tokens[key]) >= 0);
    }
    if (typeof tokens.cachedInput === 'number' && typeof tokens.input === 'number') assert.ok(tokens.cachedInput <= tokens.input);
  }
  assertModelIdentity(r.modelIdentity, typeof r.rawOutput === 'string' ? r.rawOutput : undefined, r.executor);
  const executor = record(r.executor, 'judge executor'); assert.equal(typeof executor.kind, 'string'); assert.equal(typeof executor.model, 'string');
  if (r.error === null) {
    assert.equal(r.executorInvoked, true);
    const scores = parseJudgeScores(r.output as string);
    assert.deepEqual(r.scores, r.firstCondition === 'baseline' ? { baseline: scores.a, treatment: scores.b } : { baseline: scores.b, treatment: scores.a });
  } else assert.equal(r.scores, null);
  return r as unknown as JudgeCallReceipt;
}
