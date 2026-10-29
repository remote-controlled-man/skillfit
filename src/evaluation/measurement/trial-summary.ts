import type { ModelIdentity } from "../../agents/observation/model-identity.js";
import { CONDITIONS } from "./paired-contract.js";
import { type Condition } from "../../resources/contracts.js";
import { type TokenUsage } from "../../agents/contracts.js";
import type { ExecutionTiming } from "../../shared/timing.js";
import type { VerifierCheck } from "../../bench/gates/summary.js";
import { summarizeJudge, type JudgeResult } from "./judge-protocol.js";
import { verdictFor, type ConditionStats, type FacetSummary, type RunManifest, type TaskSummary } from "./report.js";
import { mcnemarExactP, pairedDeltaBootstrapCI, pairedScoreBootstrapCI } from "./statistics.js";
import { summarizeCosts } from "./costs.js";

export interface TrialOutcome {
  budgetStop?: 'SPENDING_BUDGET_REACHED';
  modelIdentity?: ModelIdentity;
  taskId: string;
  condition: Condition;
  trial: number;
  runDir: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  /** Wall timestamps stay available; elapsed cost uses the monotonic clock. */
  timing?: { clock: 'performance.now'; wallDurationSeconds: number; execution: ExecutionTiming | null };
  passed: boolean;
  verifierExitCode: number | null;
  verifierPassed: boolean | null;
  score: number | null;
  checks: VerifierCheck[] | null;
  error: string | null;
  output: string;
  tokens: TokenUsage | null;
  executorInvoked: boolean;
  usageStatus: 'final' | 'partial' | 'unknown';
  gitInitialized: boolean;
  skillTriggered?: boolean | null;
}

function sumTokens(records: TrialOutcome[]): { input: number; output: number } | null {
  let input = 0;
  let output = 0;
  let seen = false;
  for (const record of records) {
    if (!record.tokens || record.usageStatus !== 'final') continue;
    seen = true;
    input += record.tokens.input ?? 0;
    output += record.tokens.output ?? 0;
  }
  return seen ? { input, output } : null;
}

function countErrors(records: TrialOutcome[]): number {
  return records.filter((r) => r.error !== null).length;
}

/**
 * Trials that were graded in BOTH arms, aligned by trial number.
 *
 * A trial whose executor errored was never graded, so counting it as a failure would manufacture a
 * discordant pair out of an API timeout (docs/reference/metrics.md L0, engagement sanity). Dropping it from one
 * arm only would misalign the pairing that McNemar and the paired bootstrap depend on, so the whole
 * (task, trial) pair goes. Filtering per arm independently is the bug this replaces.
 */
function pairedSurvivors(
  outcomes: Record<Condition, TrialOutcome[]>,
): Record<Condition, TrialOutcome[]> {
  const byTrial = new Map<number, Partial<Record<Condition, TrialOutcome>>>();
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      const entry = byTrial.get(record.trial) ?? {};
      entry[condition] = record;
      byTrial.set(record.trial, entry);
    }
  }
  const survivors: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  for (const trial of [...byTrial.keys()].sort((a, b) => a - b)) {
    const pair = byTrial.get(trial);
    const baseline = pair?.baseline;
    const treatment = pair?.treatment;
    if (!baseline || !treatment) continue;
    if (baseline.error !== null || treatment.error !== null) continue;
    survivors.baseline.push(baseline);
    survivors.treatment.push(treatment);
  }
  return survivors;
}

function statsFor(records: TrialOutcome[], errors: number, readObservations = false): ConditionStats {
  const passes = records.filter((r) => r.passed).length;
  const trials = records.length;
  const scored = records.filter((r) => r.score !== null);
  const meanScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, r) => sum + (r.score as number), 0) / scored.length;
  return {
    passes,
    trials,
    errors,
    ...(readObservations ? { skillReads: {
      observed: records.filter(r => r.skillTriggered === true).length,
      unobserved: records.filter(r => r.skillTriggered === false).length,
      unknown: records.filter(r => r.skillTriggered == null).length,
    } } : {}),
    passRate: trials === 0 ? 0 : passes / trials,
    meanScore,
    tokens: sumTokens(records),
    tokenCoverage: {
      input: records.filter(r => r.usageStatus === 'final' && typeof r.tokens?.input === 'number').length,
      output: records.filter(r => r.usageStatus === 'final' && typeof r.tokens?.output === 'number').length,
    },
  };
}

function tokenDelta(
  baseline: { input: number; output: number } | null,
  treatment: { input: number; output: number } | null,
): { input: number; output: number } | null {
  if (!baseline || !treatment) return null;
  return { input: treatment.input - baseline.input, output: treatment.output - baseline.output };
}

function trialFlags(records: TrialOutcome[]): boolean[] {
  return [...records].sort((a, b) => a.trial - b.trial).map((r) => r.passed);
}

function trialScores(records: TrialOutcome[]): (number | null)[] {
  return [...records].sort((a, b) => a.trial - b.trial).map((r) => r.score);
}

/** Drop a trial from both arms unless both produced a score, so Δscore keeps the paired denominators. */
function pairedScores(
  baseline: readonly (number | null)[],
  treatment: readonly (number | null)[],
): { baseline: number[]; treatment: number[] } | null {
  const left: number[] = [];
  const right: number[] = [];
  const count = Math.min(baseline.length, treatment.length);
  for (let index = 0; index < count; index++) {
    const baselineScore = baseline[index];
    const treatmentScore = treatment[index];
    if (typeof baselineScore !== 'number' || typeof treatmentScore !== 'number') continue;
    left.push(baselineScore);
    right.push(treatmentScore);
  }
  return left.length === 0 ? null : { baseline: left, treatment: right };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function facetStats(outcomes: Record<Condition, TrialOutcome[]>): FacetSummary[] {
  const names: string[] = [];
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      for (const check of record.checks ?? []) {
        if (!names.includes(check.name)) names.push(check.name);
      }
    }
  }
  return names.map((name) => {
    const rateFor = (records: TrialOutcome[]): { trials: number; passRate: number } => {
      const relevant = records.filter((r) => r.checks?.some((c) => c.name === name));
      const passes = relevant.filter(
        (r) => r.checks?.find((c) => c.name === name)?.pass === true,
      ).length;
      return { trials: relevant.length, passRate: relevant.length === 0 ? 0 : passes / relevant.length };
    };
    const baseline = rateFor(outcomes.baseline);
    const treatment = rateFor(outcomes.treatment);
    return {
      name,
      baselinePassRate: baseline.passRate,
      treatmentPassRate: treatment.passRate,
      baselineTrials: baseline.trials,
      treatmentTrials: treatment.trials,
    };
  });
}

function verifierConsistencyNotes(
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
): string[] {
  const notes = new Set<string>();
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      if (record.verifierPassed !== null && record.verifierPassed !== record.passed) {
        notes.add(
          `Task "${taskId}": the verifier's JSON "passed" flag disagrees with its exit code — the exit code is authoritative, fix the summary line.`,
        );
      }
      if (record.checks !== null && record.verifierExitCode !== null) {
        const allPass = record.checks.every((c) => c.pass);
        if (record.passed && !allPass) {
          notes.add(
            `Task "${taskId}": the verifier exits 0 while some checks fail — exit code and checks disagree.`,
          );
        }
        if (!record.passed && allPass) {
          notes.add(
            `Task "${taskId}": all checks pass but the verifier exits non-zero — exit code and checks disagree.`,
          );
        }
      }
    }
  }
  return [...notes];
}

function discordantCounts(
  outcomeSets: Array<{ baseline: boolean[]; treatment: boolean[] }>,
): { improved: number; regressed: number } {
  let improved = 0;
  let regressed = 0;
  for (const outcomes of outcomeSets) {
    for (let i = 0; i < outcomes.baseline.length && i < outcomes.treatment.length; i++) {
      const baselinePassed = outcomes.baseline[i] === true;
      const treatmentPassed = outcomes.treatment[i] === true;
      if (treatmentPassed && !baselinePassed) improved++;
      else if (baselinePassed && !treatmentPassed) regressed++;
    }
  }
  return { improved, regressed };
}

function summarizeTask(
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
  survivors: Record<Condition, TrialOutcome[]>,
  judgeResults: JudgeResult[],
  readObservations = false,
): TaskSummary {
  const baseline = statsFor(survivors.baseline, countErrors(outcomes.baseline), readObservations);
  const treatment = statsFor(survivors.treatment, countErrors(outcomes.treatment), readObservations);
  const flags = {
    baseline: trialFlags(survivors.baseline),
    treatment: trialFlags(survivors.treatment),
  };
  const deltaPassRate = treatment.passRate - baseline.passRate;
  const scoreRows = {
    baseline: trialScores(survivors.baseline),
    treatment: trialScores(survivors.treatment),
  };
  const paired = pairedScores(scoreRows.baseline, scoreRows.treatment);
  const scoreDelta = paired ? mean(paired.treatment) - mean(paired.baseline) : null;
  const { verdict, reason } = verdictFor({ ...discordantCounts([flags]), deltaPassRate });
  return {
    id: taskId,
    conditions: { baseline, treatment },
    outcomes: flags,
    scores: scoreRows,
    deltaPassRate,
    scoreDelta,
    facets: facetStats(survivors),
    verifierNotes: verifierConsistencyNotes(taskId, outcomes),
    tokenDelta: tokenDelta(baseline.tokens, treatment.tokens),
    costs: summarizeCosts(outcomes, survivors),
    verdict,
    verdictReason: reason,
    judge: summarizeJudge(judgeResults),
  };
}

export interface TaskOutcomes {
  id: string;
  outcomes: Record<Condition, TrialOutcome[]>;
  judgeResults: JudgeResult[];
}

/** Pure paired calculation; callers retain execution, receipts and lifecycle ownership. */
export function summarizeExperiment(tasks: TaskOutcomes[], readObservations = false): Pick<RunManifest, 'tasks' | 'overall'> {
  const allOutcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  const allSurvivors: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  const taskSummaries = tasks.map(task => {
    const survivors = pairedSurvivors(task.outcomes);
    for (const condition of CONDITIONS) {
      allOutcomes[condition].push(...task.outcomes[condition]);
      allSurvivors[condition].push(...survivors[condition]);
    }
    return summarizeTask(task.id, task.outcomes, survivors, task.judgeResults, readObservations);
  });
  const overallBaseline = statsFor(allSurvivors.baseline, countErrors(allOutcomes.baseline), readObservations);
  const overallTreatment = statsFor(allSurvivors.treatment, countErrors(allOutcomes.treatment), readObservations);
  const overallDelta = overallTreatment.passRate - overallBaseline.passRate;
  const taskOutcomes = taskSummaries.map((task) => task.outcomes);
  const discordant = discordantCounts(taskOutcomes);
  const overallVerdict = verdictFor({ ...discordant, deltaPassRate: overallDelta });
  const scoreTasks = taskSummaries.flatMap((task) => {
    const paired = pairedScores(task.scores.baseline, task.scores.treatment);
    return paired ? [paired] : [];
  });
  const scoreDeltaCi = pairedScoreBootstrapCI(scoreTasks);
  const scoreDelta = scoreDeltaCi ? scoreDeltaCi.point : null;
  return {
    tasks: taskSummaries,
    overall: {
      conditions: {
        baseline: overallBaseline,
        treatment: overallTreatment,
      },
      deltaPassRate: overallDelta,
      scoreDelta,
      tokenDelta: tokenDelta(overallBaseline.tokens, overallTreatment.tokens),
      costs: summarizeCosts(allOutcomes, allSurvivors),
      verdict: overallVerdict.verdict,
      verdictReason: overallVerdict.reason,
      stats: {
        discordant,
        mcnemarP: mcnemarExactP(discordant.improved, discordant.regressed),
        deltaCi: pairedDeltaBootstrapCI(taskOutcomes),
        scoreDeltaCi,
      },
    },
  };
}
