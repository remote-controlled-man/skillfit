import { buildJudgePrompt as buildProtocolPrompt, judgeOrder, parseJudgeScores, JudgePairFailure, type JudgeCallReceipt, type JudgeResult } from './judge-protocol.js';
export { judgeOrder, parseJudgeScores, JudgePairFailure, type JudgeCallReceipt, type JudgeResult } from './judge-protocol.js';
import { unknownModelIdentity, identityForResult, type ModelIdentity } from './model-identity.js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExecutorFailure, type Condition, type Executor, type TokenUsage, type UsageEvidence } from './types.js';
import { executionClock, type ExecutionClock, type ExecutionTiming } from './execution-timing.js';
import { throwIfEvaluationInterrupted } from './interruption.js';

// The compatibility entry retains its random default; audits supply the retained nonce explicitly.
export function buildJudgePrompt(taskPromptText: string, rubricText: string | null, answerA: string, answerB: string,
  nonce: string = randomBytes(8).toString('hex')): string {
  return buildProtocolPrompt(taskPromptText, rubricText, answerA, answerB, nonce);
}

export async function judgePair(
  judge: Executor,
  args: {
    taskPromptText: string;
    rubricText?: string | null;
    baselineOutput: string;
    treatmentOutput: string;
    seed: string;
    taskId?: string;
    trial?: number;
    clock?: ExecutionClock;
    beforeCall?: (callIndex: 1 | 2) => void;
    onCall?: (receipt: JudgeCallReceipt) => void;
  },
): Promise<JudgeResult> {
  const [first, second] = judgeOrder(args.seed);
  // A CLI judge has file tools, so its working directory is part of what it can see. Running it in
  // the task directory would expose both arms' _output.md and their _result.json — which names the
  // condition and the evaluation-target hash — and the AB/BA swap would be blindfolding a judge that can
  // just look. It gets a fresh directory holding only the two positionally-anonymized answers.
  const calls: JudgeCallReceipt[] = [];
  const clock = args.clock ?? executionClock;
  try {
    const call = async (firstCondition: Condition, callIndex: 1 | 2) => {
      throwIfEvaluationInterrupted();
      args.beforeCall?.(callIndex);
      const judgeDir = mkdtempSync(join(tmpdir(), 'skillfit-judge-'));
      try {
        const answerA = firstCondition === 'baseline' ? args.baselineOutput : args.treatmentOutput;
        const answerB = firstCondition === 'baseline' ? args.treatmentOutput : args.baselineOutput;
        writeFileSync(join(judgeDir, 'answerA.md'), answerA, 'utf8');
        writeFileSync(join(judgeDir, 'answerB.md'), answerB, 'utf8');
        const prompt = buildJudgePrompt(args.taskPromptText, args.rubricText ?? null, answerA, answerB);
        const startedWall = clock.wallNow(), startedMono = clock.monotonicNow();
        let output = '', rawOutput: string | null = null, tokens: TokenUsage | null = null;
        let usageStatus: JudgeCallReceipt['usageStatus'] = 'unknown', execution: ExecutionTiming | null = null;
        let executorInvoked = true, error: string | null = null, scores: JudgeCallReceipt['scores'] = null;
        let usageEvidence: UsageEvidence | undefined;
        let modelIdentity: ModelIdentity | undefined;
        try {
          const result = await judge.run(prompt, judgeDir);
          output = result.output; rawOutput = result.rawOutput ?? null; tokens = result.tokens ?? null;
          usageStatus = result.usageStatus ?? (tokens ? 'final' : 'unknown'); execution = result.executionTiming ?? null;
          usageEvidence = result.usageEvidence; modelIdentity = identityForResult(result, judge.describe());
          if (result.guardError) throw new Error(result.guardError);
        } catch (failure) {
          error = (failure as Error).message;
          if (failure instanceof ExecutorFailure) {
            executorInvoked = failure.executorInvoked;
            output = failure.result.output; rawOutput = failure.result.rawOutput ?? null; tokens = failure.result.tokens ?? null;
            usageStatus = failure.result.usageStatus ?? (tokens ? 'partial' : 'unknown');
            modelIdentity = identityForResult(failure.result, judge.describe()); execution = failure.result.executionTiming ?? null; usageEvidence = failure.result.usageEvidence;
          }
        }
        const finishedWall = clock.wallNow(), durationSeconds = Math.round(clock.monotonicNow() - startedMono) / 1000;
        if (!error) {
          try {
            const parsed = parseJudgeScores(output);
            scores = { baseline: firstCondition === 'baseline' ? parsed.a : parsed.b,
              treatment: firstCondition === 'baseline' ? parsed.b : parsed.a };
          } catch (failure) { error = (failure as Error).message; }
        }
        const receipt: JudgeCallReceipt = { schemaVersion: 1, kind: 'skillfit.judge-call',
          taskId: args.taskId ?? 'standalone', trial: args.trial ?? 1, callIndex, seed: args.seed, firstCondition,
          prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'), output, rawOutput,
          executor: { ...judge.describe(), sampling: judge.describe().sampling ?? null },
          startedAt: new Date(startedWall).toISOString(), finishedAt: new Date(finishedWall).toISOString(), durationSeconds,
          timing: { clock: 'performance.now', wallDurationSeconds: (finishedWall - startedWall) / 1000, execution },
          modelIdentity: modelIdentity ?? unknownModelIdentity(judge.describe().modelIntent),
          executorInvoked, error, passed: error === null, tokens, usageStatus, ...(usageEvidence ? { usageEvidence } : {}), scores };
        calls.push(receipt);
        // Persist before propagating a parse/execution error, cancellation or budget stop.
        args.onCall?.(receipt);
        throwIfEvaluationInterrupted();
        if (error) throw new Error(error);
        return { ...scores!, raw: output };
      } finally { rmSync(judgeDir, { recursive: true, force: true }); }
    };
    const forward = await call(first, 1);
    const reverse = await call(second, 2);
    const winner = (scores: { baseline: number; treatment: number }): number =>
      Math.sign(scores.baseline - scores.treatment);
    const consistent = winner(forward) === winner(reverse);
    return {
      baselineScore: (forward.baseline + reverse.baseline) / 2,
      treatmentScore: (forward.treatment + reverse.treatment) / 2,
      consistent,
      firstCondition: first,
      raw: `${forward.raw}\n--- reverse order ---\n${reverse.raw}`,
      calls,
    };
  } catch (error) { throw new JudgePairFailure((error as Error).message, calls, error); }
}
