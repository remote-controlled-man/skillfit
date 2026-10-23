import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as legacy from './judge.js';
import { summarizeJudge as legacySummary } from './runner.js';
import { buildJudgePrompt, judgeOrder, JudgePairFailure, parseJudgeScores, summarizeJudge, type JudgeResult } from './judge-protocol.js';

test('judge protocol retains receipt/error identity and deterministic prompt, scores and summary', async () => {
  assert.equal(legacy.JudgePairFailure, JudgePairFailure);
  assert.equal(legacy.judgeOrder, judgeOrder); assert.equal(legacy.parseJudgeScores, parseJudgeScores);
  assert.equal(legacySummary, summarizeJudge);
  const prompt = buildJudgePrompt('Task\n', null, 'left', 'right', '0123456789abcdef');
  assert.equal(legacy.buildJudgePrompt('Task\n', null, 'left', 'right', '0123456789abcdef'), prompt);
  assert.match(prompt, /<<<BEGIN ANSWER A 0123456789abcdef>>>\nleft/);
  assert.match(legacy.buildJudgePrompt('Task', null, 'a', 'b'), /<<<BEGIN ANSWER A [a-f0-9]{16}>>>/);
  assert.deepEqual(parseJudgeScores('{"A":{"correct":true,"complete":false,"grounded":true},"B":{"correct":false,"complete":false,"grounded":true}}'), { a: 2, b: 1 });
  const rows: JudgeResult[] = [
    { baselineScore: 1, treatmentScore: 2, consistent: true, firstCondition: 'baseline', raw: '', calls: [] },
    { baselineScore: 3, treatmentScore: 0, consistent: false, firstCondition: 'treatment', raw: '', calls: [] },
  ];
  assert.deepEqual(summarizeJudge(rows), { judgedTrials: 2, consistentTrials: 1, baselineMean: 1, treatmentMean: 2 });
  assert.equal(summarizeJudge([]), null);
  await assert.rejects(legacy.judgePair({ describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => ({ output: 'invalid checklist' }) },
    { taskPromptText: 'Task', baselineOutput: 'a', treatmentOutput: 'b', seed: 'offline' }), error => {
      assert.ok(error instanceof JudgePairFailure); assert.equal(error.calls.length, 1);
      assert.match(error.message, /checklist/); return true;
    });
});
