import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeOrder, judgePair } from './judge.js';
import type { Executor, ExecutorResult } from './types.js';

function fakeJudge(answer: string | ((prompt: string) => string), capture?: string[]): Executor {
  return {
    describe: () => ({ kind: 'mock', model: 'judge' }),
    run: (prompt: string): Promise<ExecutorResult> => {
      capture?.push(prompt);
      return Promise.resolve({ output: typeof answer === 'function' ? answer(prompt) : answer });
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

test('judgePair runs AB/BA and flags an order-biased judge as inconsistent', async () => {
  for (const seed of ['seed-0', 'seed-1']) {
    const captured: string[] = [];
    const result = await judgePair(fakeJudge('{"A": 9, "B": 4}', captured), {
      taskPromptText: 'task',
      baselineOutput: 'baseline-answer',
      treatmentOutput: 'treatment-answer',
      seed,
      workdir: '/tmp',
    });
    assert.equal(captured.length, 2, 'one call per presentation order');
    const [first] = judgeOrder(seed);
    const firstPrompt = captured[0] ?? '';
    const aIndex = firstPrompt.indexOf('Answer A:');
    const bIndex = firstPrompt.indexOf('Answer B:');
    assert.ok(
      firstPrompt.slice(aIndex, bIndex).includes(first === 'baseline' ? 'baseline-answer' : 'treatment-answer'),
    );
    const reversePrompt = captured[1] ?? '';
    const raIndex = reversePrompt.indexOf('Answer A:');
    const rbIndex = reversePrompt.indexOf('Answer B:');
    assert.ok(
      reversePrompt.slice(raIndex, rbIndex).includes(first === 'baseline' ? 'treatment-answer' : 'baseline-answer'),
    );
    assert.equal(result.consistent, false, 'a judge that always favors A disagrees with itself');
    assert.equal(result.baselineScore, 6.5);
    assert.equal(result.treatmentScore, 6.5);
    assert.equal(result.firstCondition, first);
  }
});

test('judgePair reports a consistent verdict when both orders agree', async () => {
  const orderAware = (prompt: string): string => {
    const aIndex = prompt.indexOf('Answer A:');
    const bIndex = prompt.indexOf('Answer B:');
    const aIsBaseline = prompt.slice(aIndex, bIndex).includes('baseline-answer');
    return aIsBaseline ? '{"A": 3, "B": 9}' : '{"A": 9, "B": 3}';
  };
  for (const seed of ['seed-0', 'seed-1']) {
    const result = await judgePair(fakeJudge(orderAware), {
      taskPromptText: 'task',
      baselineOutput: 'baseline-answer',
      treatmentOutput: 'treatment-answer',
      seed,
      workdir: '/tmp',
    });
    assert.equal(result.consistent, true);
    assert.equal(result.baselineScore, 3);
    assert.equal(result.treatmentScore, 9);
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
