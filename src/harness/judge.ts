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

For EACH answer, independently decide three yes/no checks against the task${rubricText ? ' and rubric' : ''}:
1. "correct" — it contains no false claims and nothing that violates the task.
2. "complete" — it addresses every explicit requirement of the task.
3. "grounded" — every claim it makes is supported by the task material (no speculation or invention).

Reply with only a JSON object: {"A": {"correct": true|false, "complete": true|false, "grounded": true|false}, "B": {"correct": true|false, "complete": true|false, "grounded": true|false}}`;
}

const CHECKS = ['correct', 'complete', 'grounded'] as const;

function parseChecklist(raw: string, label: 'A' | 'B'): number {
  const match = /\{\s*"A"\s*:\s*\{[^{}]*\}\s*,\s*"B"\s*:\s*\{[^{}]*\}\s*\}/.exec(raw);
  if (!match) throw new Error('Judge response did not contain a checklist JSON object');
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  const side = parsed[label];
  if (typeof side !== 'object' || side === null) {
    throw new Error(`Judge checklist missing the "${label}" object`);
  }
  const record = side as Record<string, unknown>;
  let score = 0;
  for (const check of CHECKS) {
    const value = record[check];
    if (typeof value !== 'boolean') {
      throw new Error(`Judge checklist "${label}.${check}" is not a boolean: ${String(value)}`);
    }
    if (value) score++;
  }
  return score;
}

function parseScores(raw: string): { a: number; b: number } {
  return { a: parseChecklist(raw, 'A'), b: parseChecklist(raw, 'B') };
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
