import { createHash } from 'node:crypto';
import type { Condition, Executor } from './types.js';

export interface JudgeResult {
  baselineScore: number;
  treatmentScore: number;
  consistent: boolean;
  firstCondition: Condition;
  raw: string;
}

export function judgeOrder(seed: string): [Condition, Condition] {
  const digest = createHash('sha256').update(seed, 'utf8').digest();
  const first: Condition = (digest[0] ?? 0) % 2 === 0 ? 'baseline' : 'treatment';
  return first === 'baseline' ? ['baseline', 'treatment'] : ['treatment', 'baseline'];
}

export function buildJudgePrompt(
  taskPromptText: string,
  rubricText: string | null,
  answerA: string,
  answerB: string,
): string {
  const rubricSection = rubricText ? `Grading rubric:\n${rubricText.trimEnd()}\n\n` : '';
  return `You are an impartial judge comparing two answers to the same task. The answers are shown in random order; do not assume either ordering means anything.

Task:
${taskPromptText.trimEnd()}

${rubricSection}Answer A:
${answerA}

Answer B:
${answerB}

Score each answer from 1 (worthless) to 10 (perfect) for correctness and completeness against the task${rubricText ? ' and rubric' : ''}.
Reply with only a JSON object: {"A": <scoreA>, "B": <scoreB>}`;
}

function parseScores(raw: string): { a: number; b: number } {
  const match = /\{[\s\S]*?\}/.exec(raw);
  if (!match) throw new Error('Judge response did not contain a JSON object');
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  const a = parsed['A'];
  const b = parsed['B'];
  for (const [label, value] of [['A', a], ['B', b]] as const) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error(`Judge score ${label} is not an integer in [1, 10]: ${String(value)}`);
    }
  }
  return { a: a as number, b: b as number };
}

export async function judgePair(
  judge: Executor,
  args: {
    taskPromptText: string;
    rubricText?: string | null;
    baselineOutput: string;
    treatmentOutput: string;
    seed: string;
    workdir: string;
  },
): Promise<JudgeResult> {
  const [first, second] = judgeOrder(args.seed);
  const call = async (firstCondition: Condition) => {
    const answerA = firstCondition === 'baseline' ? args.baselineOutput : args.treatmentOutput;
    const answerB = firstCondition === 'baseline' ? args.treatmentOutput : args.baselineOutput;
    const prompt = buildJudgePrompt(args.taskPromptText, args.rubricText ?? null, answerA, answerB);
    const result = await judge.run(prompt, args.workdir);
    const scores = parseScores(result.output);
    return {
      baseline: firstCondition === 'baseline' ? scores.a : scores.b,
      treatment: firstCondition === 'baseline' ? scores.b : scores.a,
      raw: result.output,
    };
  };
  const forward = await call(first);
  const reverse = await call(second);
  const winner = (scores: { baseline: number; treatment: number }): number =>
    Math.sign(scores.baseline - scores.treatment);
  const consistent = winner(forward) === winner(reverse);
  return {
    baselineScore: (forward.baseline + reverse.baseline) / 2,
    treatmentScore: (forward.treatment + reverse.treatment) / 2,
    consistent,
    firstCondition: first,
    raw: `${forward.raw}\n--- reverse order ---\n${reverse.raw}`,
  };
}
