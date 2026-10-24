import { wilson95 } from './stats.js';
import type { ModelIdentity } from './model-identity.js';
import type { TriggerDetection, TriggerEvidence } from './trigger-contract.js';
import type { ExecutionTiming } from './execution-timing.js';
import type { VerifierCheck } from './verifier-summary.js';
import type { TokenUsage } from './types.js';

export interface TriggerTrialRecord {
  modelIdentity?: ModelIdentity;
  taskId: string;
  trial: number;
  runDir: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  wallDurationSeconds?: number;
  executorInvoked?: boolean;
  executionTiming?: ExecutionTiming;
  triggered: boolean | null;
  triggerDetection?: TriggerDetection;
  triggerEvidence?: TriggerEvidence;
  passed: boolean;
  score: number | null;
  checks: VerifierCheck[] | null;
  error: string | null;
  tokens: TokenUsage | null;
  usageStatus?: 'final' | 'partial' | 'unknown';
}

export interface TriggerTaskSummary {
  id: string;
  shouldTrigger: boolean;
  triggerClass?: 'explicit' | 'implicit' | 'contextual';
  runs: number;
  fired: number;
  unknown: number;
  errors: number;
  passes: number;
  tokens: { input: number; output: number } | null;
}

export interface TriggerMetrics {
  recall: number | null;
  recallCi95: { lo: number; hi: number } | null;
  falseTriggerRate: number | null;
  falseTriggerRateCi95: { lo: number; hi: number } | null;
  precision: number | null;
  /**
   * Wilson interval over the fired runs (precision is a proportion: positives fired / all fired).
   * `f1` deliberately has none — it is a harmonic mean of two proportions and has no closed-form
   * binomial interval, so printing one would be invented precision. See docs/metrics.md L1.
   */
  precisionCi95: { lo: number; hi: number } | null;
  f1: number | null;
  positives: { fired: number; runs: number };
  negatives: { fired: number; runs: number };
  classRecall?: Partial<Record<'explicit' | 'implicit' | 'contextual', { fired: number; runs: number; recall: number | null; recallCi95: { lo: number; hi: number } | null }>>;
  tokens: { input: number; output: number } | null;
}

export function summarizeTriggerTask(
  taskId: string,
  shouldTrigger: boolean,
  triggerClass: TriggerTaskSummary['triggerClass'],
  records: TriggerTrialRecord[],
): TriggerTaskSummary {
  let input = 0;
  let output = 0;
  let seenTokens = false;
  for (const record of records) {
    if (!record.tokens) continue;
    seenTokens = true;
    input += record.tokens.input ?? 0;
    output += record.tokens.output ?? 0;
  }
  return {
    id: taskId,
    shouldTrigger,
    ...(triggerClass ? { triggerClass } : {}),
    runs: records.filter((r) => r.error === null && r.triggered !== null).length,
    fired: records.filter((r) => r.error === null && r.triggered === true).length,
    unknown: records.filter((r) => r.error === null && r.triggered === null).length,
    errors: records.filter((r) => r.error !== null).length,
    passes: records.filter((r) => r.passed).length,
    tokens: seenTokens ? { input, output } : null,
  };
}

export function triggerMetrics(tasks: TriggerTaskSummary[]): TriggerMetrics {
  const positives = tasks.filter((t) => t.shouldTrigger);
  const negatives = tasks.filter((t) => !t.shouldTrigger);
  const posFired = positives.reduce((sum, t) => sum + t.fired, 0);
  const posRuns = positives.reduce((sum, t) => sum + t.runs, 0);
  const negFired = negatives.reduce((sum, t) => sum + t.fired, 0);
  const negRuns = negatives.reduce((sum, t) => sum + t.runs, 0);
  const recall = posRuns > 0 ? posFired / posRuns : null;
  const falseTriggerRate = negRuns > 0 ? negFired / negRuns : null;
  const firedTotal = posFired + negFired;
  const precision = firedTotal > 0 ? posFired / firedTotal : null;
  const f1 =
    recall !== null && precision !== null && recall + precision > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  let input = 0;
  let output = 0;
  let seenTokens = false;
  for (const task of tasks) {
    if (!task.tokens) continue;
    seenTokens = true;
    input += task.tokens.input;
    output += task.tokens.output;
  }
  return {
    recall,
    recallCi95: posRuns > 0 ? wilson95(posFired, posRuns) : null,
    falseTriggerRate,
    falseTriggerRateCi95: negRuns > 0 ? wilson95(negFired, negRuns) : null,
    precision,
    precisionCi95: firedTotal > 0 ? wilson95(posFired, firedTotal) : null,
    f1,
    positives: { fired: posFired, runs: posRuns },
    negatives: { fired: negFired, runs: negRuns },
    classRecall: classRecall(positives),
    tokens: seenTokens ? { input, output } : null,
  };
}

function classRecall(positives: TriggerTaskSummary[]): TriggerMetrics['classRecall'] {
  const out: NonNullable<TriggerMetrics['classRecall']> = {};
  for (const name of ['explicit', 'implicit', 'contextual'] as const) {
    const rows = positives.filter((task) => task.triggerClass === name);
    const runs = rows.reduce((sum, task) => sum + task.runs, 0);
    if (runs === 0) continue;
    const fired = rows.reduce((sum, task) => sum + task.fired, 0);
    out[name] = { fired, runs, recall: fired / runs, recallCi95: wilson95(fired, runs) };
  }
  return Object.keys(out).length === 0 ? undefined : out;
}
