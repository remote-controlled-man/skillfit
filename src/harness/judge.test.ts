import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { judgeOrder, judgePair } from './judge.js';
import type { Executor, ExecutorResult } from './types.js';

const WIN = '{"correct":true,"complete":true,"grounded":true}';
const LOSE = '{"correct":false,"complete":false,"grounded":false}';

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
    const result = await judgePair(fakeJudge(`{"A": ${WIN}, "B": ${LOSE}}`, captured), {
      taskPromptText: 'task',
      baselineOutput: 'baseline-answer',
      treatmentOutput: 'treatment-answer',
      seed,
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
    assert.equal(result.baselineScore, 1.5);
    assert.equal(result.treatmentScore, 1.5);
    assert.equal(result.firstCondition, first);
  }
});

test('judgePair reports a consistent verdict when both orders agree', async () => {
  const orderAware = (prompt: string): string => {
    const aIndex = prompt.indexOf('Answer A:');
    const bIndex = prompt.indexOf('Answer B:');
    const aIsBaseline = prompt.slice(aIndex, bIndex).includes('baseline-answer');
    const partial = '{"correct":true,"complete":false,"grounded":true}';
    return aIsBaseline
      ? `{"A": ${partial}, "B": ${WIN}}`
      : `{"A": ${WIN}, "B": ${partial}}`;
  };
  for (const seed of ['seed-0', 'seed-1']) {
    const result = await judgePair(fakeJudge(orderAware), {
      taskPromptText: 'task',
      baselineOutput: 'baseline-answer',
      treatmentOutput: 'treatment-answer',
      seed,
    });
    assert.equal(result.consistent, true);
    assert.equal(result.baselineScore, 2);
    assert.equal(result.treatmentScore, 3);
  }
});

test('judgePair includes the rubric when provided', async () => {
  const captured: string[] = [];
  await judgePair(fakeJudge(`{"A": ${WIN}, "B": ${WIN}}`, captured), {
    taskPromptText: 'task',
    rubricText: 'the rubric',
    baselineOutput: 'b',
    treatmentOutput: 't',
    seed: 's',
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
      }),
    /JSON object/,
  );
  await assert.rejects(
    () =>
      judgePair(fakeJudge('{"A": {"correct": "yes"}, "B": {}}'), {
        taskPromptText: 'task',
        baselineOutput: 'b',
        treatmentOutput: 't',
        seed: 's',
      }),
    /not a boolean/,
  );
});

test('judgePair finds the checklist JSON amid prose and stray braces', async () => {
  const noisy = `Let me think about {braces} and {other: "things"} first.\n\nVerdict:\n\n\`\`\`json\n{"A": ${WIN}, "B": ${LOSE}}\n\`\`\`\n\nHope that helps!`;
  const result = await judgePair(fakeJudge(noisy), {
    taskPromptText: 'task',
    baselineOutput: 'baseline-answer',
    treatmentOutput: 'treatment-answer',
    seed: 's',
  });
  assert.equal(result.consistent, false);
});

test('judgePair sandboxes the judge cwd to the two anonymized answers', async () => {
  const listings: string[][] = [];
  const cwds: string[] = [];
  const judge: Executor = {
    describe: () => ({ kind: 'mock', model: 'judge' }),
    run: (_prompt: string, workdir: string): Promise<ExecutorResult> => {
      // Inspect during the call: judgePair removes the directory afterwards.
      cwds.push(workdir);
      listings.push(readdirSync(workdir).sort());
      return Promise.resolve({ output: `{"A": ${WIN}, "B": ${LOSE}}` });
    },
  };
  await judgePair(judge, {
    taskPromptText: 'task',
    baselineOutput: 'baseline-answer',
    treatmentOutput: 'treatment-answer',
    seed: 'seed-blind',
  });
  assert.equal(cwds.length, 2, 'one call per presentation order');
  for (const entries of listings) {
    assert.deepEqual(entries, ['answerA.md', 'answerB.md']);
    assert.ok(!entries.includes('_result.json'));
    assert.ok(
      !entries.some((name) => /baseline|treatment/i.test(name)),
      'nothing in the judge cwd may name a condition',
    );
  }
  for (const cwd of cwds) {
    assert.ok(!existsSync(cwd), 'the sandbox is removed after the pair is judged');
  }
});

