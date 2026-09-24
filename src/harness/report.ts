import { mcnemarExactP, MIN_DISCORDANT_FOR_SIGNIFICANCE } from './stats.js';
import { CONDITIONS } from './types.js';
import type { Condition, ExecutorDescriptor } from './types.js';

export type Verdict = 'effective' | 'ineffective' | 'inconclusive';

export const DISCRIMINATION_BASELINE_THRESHOLD = 0.9;
export const FLOOR_BASELINE_THRESHOLD = 0.1;

export const CONCLUSIVE_TASKS = 8;
export const CONCLUSIVE_TRIALS = 5;

export interface VerdictOutcome {
  verdict: Verdict;
  reason: string;
}

export interface ConditionStats {
  passes: number;
  /** Trials that completed and were graded. Errored trials are excluded — see `errors`. */
  trials: number;
  /** Trials where the executor failed, so nothing was graded. Never counted as failures. */
  errors: number;
  passRate: number;
  meanScore: number | null;
  tokens: { input: number; output: number } | null;
}

export interface JudgeSummary {
  judgedTrials: number;
  consistentTrials: number;
  baselineMean: number | null;
  treatmentMean: number | null;
}

export interface FacetSummary {
  name: string;
  baselinePassRate: number;
  treatmentPassRate: number;
  baselineTrials: number;
  treatmentTrials: number;
}

export interface TaskSummary {
  id: string;
  conditions: Record<Condition, ConditionStats>;
  outcomes: { baseline: boolean[]; treatment: boolean[] };
  scores: { baseline: (number | null)[]; treatment: (number | null)[] };
  deltaPassRate: number;
  scoreDelta: number | null;
  facets: FacetSummary[];
  verifierNotes: string[];
  tokenDelta: { input: number; output: number } | null;
  verdict: Verdict;
  verdictReason: string;
  judge: JudgeSummary | null;
}

export interface SignificanceStats {
  discordant: { improved: number; regressed: number };
  mcnemarP: number;
  deltaCi: { point: number; lo: number; hi: number; resamples: number } | null;
  scoreDeltaCi: { point: number; lo: number; hi: number; resamples: number } | null;
}

export interface OverallSummary {
  conditions: Record<Condition, ConditionStats>;
  deltaPassRate: number;
  scoreDelta: number | null;
  tokenDelta: { input: number; output: number } | null;
  verdict: Verdict;
  verdictReason: string;
  stats: SignificanceStats;
}

export interface RunManifest {
  schemaVersion: 3;
  runGroup: string;
  createdAt: string;
  skill: { name: string; sourceDir: string; bundleSha256: string; files: string[] };
  bench: { name: string; dir: string; contentSha256: string; taskCount: number };
  executor: ExecutorDescriptor;
  judge: ExecutorDescriptor | null;
  trials: number;
  tasks: TaskSummary[];
  overall: OverallSummary;
  warnings: string[];
}

export function formatPassRate(passes: number, trials: number): string {
  return `${passes}/${trials} (${Math.round((passes / trials) * 100)}%)`;
}

export function formatDeltaPp(delta: number): string {
  const pp = Math.round(delta * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
}

export function formatP(p: number): string {
  return p < 0.0001 ? '<0.0001' : p.toFixed(4);
}

export function verdictFor(input: {
  improved: number;
  regressed: number;
  deltaPassRate: number;
}): VerdictOutcome {
  const { improved, regressed, deltaPassRate } = input;
  const discordant = improved + regressed;
  if (discordant < MIN_DISCORDANT_FOR_SIGNIFICANCE) {
    return {
      verdict: 'inconclusive',
      reason: `only ${discordant} discordant pair(s) (Δpass ${formatDeltaPp(deltaPassRate)}); significance needs at least ${MIN_DISCORDANT_FOR_SIGNIFICANCE}`,
    };
  }
  const p = mcnemarExactP(improved, regressed);
  const detail = `${improved} improved vs ${regressed} regressed of ${discordant} discordant pair(s), McNemar exact p=${formatP(p)}`;
  if (p < 0.05 && deltaPassRate > 0) {
    return { verdict: 'effective', reason: detail };
  }
  if (p < 0.05 && deltaPassRate < 0) {
    return { verdict: 'ineffective', reason: detail };
  }
  return { verdict: 'inconclusive', reason: `not significant: ${detail}` };
}

export function buildWarnings(manifest: Omit<RunManifest, 'warnings'>): string[] {
  const warnings: string[] = [];
  if (manifest.executor.kind === 'mock') {
    warnings.push('Executor is a mock: results are synthetic and only exercise the harness.');
  }
  for (const task of manifest.tasks) {
    for (const condition of CONDITIONS) {
      const stats = task.conditions[condition];
      if (stats.errors > 0) {
        const other = condition === 'baseline' ? 'treatment' : 'baseline';
        warnings.push(
          `Task "${task.id}" (${condition}): ${stats.errors} trial(s) hit an executor error and were excluded from the rates, together with their paired ${other} trial(s) — an ungraded run is not a failure.`,
        );
      }
    }
    const rate = task.conditions.baseline.passRate;
    if (rate >= DISCRIMINATION_BASELINE_THRESHOLD) {
      warnings.push(
        `Task "${task.id}": baseline pass rate is ${Math.round(rate * 100)}% (>= 90%) — this bench task may be too easy and the experiment may lack discriminative power.`,
      );
    }
    if (task.conditions.baseline.trials > 0 && rate <= FLOOR_BASELINE_THRESHOLD) {
      warnings.push(
        `Task "${task.id}": baseline pass rate is ${Math.round(rate * 100)}% (<= 10%) — this bench task may be too hard or broken, and all-zero arms are uninformative.`,
      );
    }
    for (const facet of task.facets) {
      if (facet.baselineTrials > 0 && facet.baselinePassRate >= DISCRIMINATION_BASELINE_THRESHOLD) {
        warnings.push(
          `Task "${task.id}" facet "${facet.name}": baseline check pass rate is ${Math.round(facet.baselinePassRate * 100)}% (>= 90%) — this facet is saturated and measures no lift.`,
        );
      }
    }
    warnings.push(...task.verifierNotes);
  }
  const overallRate = manifest.overall.conditions.baseline.passRate;
  if (manifest.tasks.length > 1 && overallRate >= DISCRIMINATION_BASELINE_THRESHOLD) {
    warnings.push(
      `Overall baseline pass rate is ${Math.round(overallRate * 100)}% (>= 90%) — this bench may be too easy and the experiment may lack discriminative power.`,
    );
  }
  const discordant =
    manifest.overall.stats.discordant.improved + manifest.overall.stats.discordant.regressed;
  if (discordant < MIN_DISCORDANT_FOR_SIGNIFICANCE) {
    warnings.push(
      `Only ${discordant} discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.`,
    );
  }
  return warnings;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

export function renderSummary(manifest: RunManifest, manifestPath: string): string {
  const lines: string[] = [];
  lines.push(`Skill    : ${manifest.skill.name} (bundle sha256 ${manifest.skill.bundleSha256.slice(0, 12)}…, ${manifest.skill.files.length} files)`);
  lines.push(`Bench    : ${manifest.bench.name} (${manifest.bench.taskCount} task(s), content sha256 ${manifest.bench.contentSha256.slice(0, 12)}…)`);
  lines.push(`Executor : ${describeExecutor(manifest.executor)}`);
  lines.push(`Judge    : ${manifest.judge ? describeExecutor(manifest.judge) : 'disabled'}`);
  lines.push(`Trials   : ${manifest.trials} per condition`);
  lines.push('');
  const idWidth = Math.max(7, ...manifest.tasks.map((t) => t.id.length));
  const header = `${pad('TASK', idWidth)}  BASELINE     TREATMENT    DELTA    VERDICT`;
  lines.push(header);
  for (const task of manifest.tasks) {
    lines.push(renderRow(task.id, idWidth, task.conditions, task.deltaPassRate, task.verdict));
  }
  lines.push(
    renderRow('OVERALL', idWidth, manifest.overall.conditions, manifest.overall.deltaPassRate, manifest.overall.verdict),
  );
  lines.push('');
  const stats = manifest.overall.stats;
  lines.push(
    `Significance (overall): ${stats.discordant.improved} improved vs ${stats.discordant.regressed} regressed discordant pair(s), McNemar exact p=${formatP(stats.mcnemarP)}`,
  );
  lines.push(
    stats.deltaCi
      ? `Δpass 95% CI (paired bootstrap, ${stats.deltaCi.resamples} resamples): [${formatDeltaPp(stats.deltaCi.lo)}, ${formatDeltaPp(stats.deltaCi.hi)}]`
      : 'Δpass 95% CI: n/a (no trials)',
  );
  const anyScores = manifest.tasks.some((task) => task.scoreDelta !== null);
  if (anyScores) {
    lines.push(
      stats.scoreDeltaCi
        ? `Δscore 95% CI (paired bootstrap, ${stats.scoreDeltaCi.resamples} resamples): [${signedScore(stats.scoreDeltaCi.lo)}, ${signedScore(stats.scoreDeltaCi.hi)}]`
        : 'Δscore 95% CI: n/a (no task scored in both arms)',
    );
  }
  if (manifest.bench.taskCount < CONCLUSIVE_TASKS || manifest.trials < CONCLUSIVE_TRIALS) {
    lines.push(
      `Scale: ${manifest.bench.taskCount} task(s) × ${manifest.trials} trials per condition — below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials); results are indicative.`,
    );
  }
  const tokenLines = renderTokenDeltas(manifest);
  if (tokenLines.length > 0) {
    lines.push('');
    lines.push(...tokenLines);
  }
  const facetLines = renderFacetScores(manifest);
  if (facetLines.length > 0) {
    lines.push('');
    lines.push(...facetLines);
  }
  lines.push('');
  lines.push('Warnings:');
  if (manifest.warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of manifest.warnings) lines.push(`- ${warning}`);
  }
  lines.push('');
  lines.push(`Manifest: ${manifestPath}`);
  return lines.join('\n');
}

function renderRow(
  id: string,
  idWidth: number,
  conditions: Record<Condition, ConditionStats>,
  deltaPassRate: number,
  verdict: Verdict,
): string {
  const baseline = formatPassRate(conditions.baseline.passes, conditions.baseline.trials);
  const treatment = formatPassRate(conditions.treatment.passes, conditions.treatment.trials);
  return `${pad(id, idWidth)}  ${pad(baseline, 12)} ${pad(treatment, 12)} ${pad(formatDeltaPp(deltaPassRate), 8)} ${verdict}`;
}

function renderTokenDeltas(manifest: RunManifest): string[] {
  const rows = manifest.tasks.filter((task) => task.tokenDelta !== null);
  if (rows.length === 0 || manifest.overall.tokenDelta === null) return [];
  const lines = ['Token delta (treatment - baseline):'];
  for (const task of rows) {
    const delta = task.tokenDelta;
    if (delta) lines.push(`- ${task.id}: input ${signed(delta.input)}, output ${signed(delta.output)}`);
  }
  const overall = manifest.overall.tokenDelta;
  if (overall) lines.push(`- overall: input ${signed(overall.input)}, output ${signed(overall.output)}`);
  const baseline = manifest.overall.conditions.baseline;
  const treatment = manifest.overall.conditions.treatment;
  const totalTokens = (condition: ConditionStats): number | null =>
    condition.tokens ? condition.tokens.input + condition.tokens.output : null;
  const costBaseline = totalTokens(baseline);
  const costTreatment = totalTokens(treatment);
  if (
    costBaseline !== null &&
    costTreatment !== null &&
    baseline.passRate > 0 &&
    treatment.passRate > 0
  ) {
    const ratio =
      costTreatment / treatment.trials / treatment.passRate / (costBaseline / baseline.trials / baseline.passRate);
    lines.push(`- cost-of-pass ratio (treatment / baseline): ${ratio.toFixed(2)} (lower is better)`);
  }
  return lines;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function signedScore(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function renderFacetScores(manifest: RunManifest): string[] {
  const rows = manifest.tasks.filter((task) => task.facets.length > 0);
  if (rows.length === 0) return [];
  const percent = (rate: number): string => `${Math.round(rate * 100)}%`;
  const mean = (value: number | null): string => (value === null ? 'n/a' : value.toFixed(2));
  const delta = (value: number | null): string => (value === null ? 'n/a' : signedScore(value));
  const lines = ['Facet scores (mean checks passed, baseline → treatment):'];
  for (const task of rows) {
    lines.push(
      `- ${task.id}: score ${mean(task.conditions.baseline.meanScore)} → ${mean(task.conditions.treatment.meanScore)} (Δ ${delta(task.scoreDelta)})`,
    );
    for (const facet of task.facets) {
      lines.push(
        `  - ${facet.name}: ${percent(facet.baselinePassRate)} → ${percent(facet.treatmentPassRate)}`,
      );
    }
  }
  return lines;
}

function describeExecutor(descriptor: ExecutorDescriptor): string {
  const base = `${descriptor.kind} (${descriptor.model})`;
  return descriptor.detail ? `${base} — ${descriptor.detail}` : base;
}
