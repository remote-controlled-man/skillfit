import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeOrder, judgePair } from './judge.js';
import type { Executor, ExecutorResult } from './types.js';

function fakeJudge(answer: string, capture?: string[]): Executor {
  return {
    describe: () => ({ kind: 'mock', model: 'judge' }),
    run: (prompt: string): Promise<ExecutorResult> => {
      capture?.push(prompt);
      return Promise.resolve({ output: answer });
    },
  };
}

test('judgeOrder is deterministic and covers both orders', () => {
  const orders = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const order = judgeOrder(`seed-${i}`);
    orders.add(order.join(','));
    assert.deepEqual(judgeOrder(`seed-${i}`), order);
  }
  assert.equal(orders.size, 2);
  assert.ok(orders.has('baseline,treatment'));
  assert.ok(orders.has('treatment,baseline'));
});

test('judgePair maps A/B scores back to baseline/treatment regardless of order', async () => {
  for (const seed of ['seed-0', 'seed-1']) {
    const captured: string[] = [];
    const result = await judgePair(fakeJudge('{"A": 9, "B": 4}', captured), {
      taskPromptText: 'task',
      baselineOutput: 'baseline-answer',
      treatmentOutput: 'treatment-answer',
      seed,
      workdir: '/tmp',
    });
    const [first] = judgeOrder(seed);
    assert.equal(result.firstCondition, first);
    assert.equal(result.baselineScore, first === 'baseline' ? 9 : 4);
    assert.equal(result.treatmentScore, first === 'baseline' ? 4 : 9);
    const prompt = captured[0] ?? '';
    const aIndex = prompt.indexOf('Answer A:');
    const bIndex = prompt.indexOf('Answer B:');
    const firstAnswer = prompt.slice(aIndex, bIndex);
    assert.ok(firstAnswer.includes(first === 'baseline' ? 'baseline-answer' : 'treatment-answer'));
  }
});

test('judgePair includes the rubric when provided', async () => {
  const captured: string[] = [];
  await judgePair(fakeJudge('{"A": 5, "B": 5}', captured), {
    taskPromptText: 'task',
    rubricText: 'the rubric',
    baselineOutput: 'b',
    treatmentOutput: 't',
    seed: 's',
    workdir: '/tmp',
  });
  assert.match(captured[0] ?? '', /Grading rubric:\nthe rubric/);
});

test('judgePair rejects malformed judge responses', async () => {
  await assert.rejects(
    () =>
      judgePair(fakeJudge('no json here'), {
        taskPromptText: 'task',
        baselineOutput: 'b',
        treatmentOutput: 't',
        seed: 's',
        workdir: '/tmp',
      }),
    /JSON object/,
  );
  await assert.rejects(
    () =>
      judgePair(fakeJudge('{"A": 99, "B": 1}'), {
        taskPromptText: 'task',
        baselineOutput: 'b',
        treatmentOutput: 't',
        seed: 's',
        workdir: '/tmp',
      }),
    /integer in \[1, 10\]/,
  );
});
