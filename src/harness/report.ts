import type { Condition, ExecutorDescriptor } from './types.js';

export type Verdict = 'effective' | 'ineffective' | 'inconclusive';

export const MIN_TRIALS_FOR_VERDICT = 3;

export const DISCRIMINATION_BASELINE_THRESHOLD = 0.9;

export interface VerdictOutcome {
  verdict: Verdict;
  reason: string;
}

export interface ConditionStats {
  passes: number;
  trials: number;
  passRate: number;
  tokens: { input: number; output: number } | null;
}

export interface JudgeSummary {
  judgedTrials: number;
  baselineMean: number;
  treatmentMean: number;
}

export interface TaskSummary {
  id: string;
  conditions: Record<Condition, ConditionStats>;
  deltaPassRate: number;
  tokenDelta: { input: number; output: number } | null;
  verdict: Verdict;
  verdictReason: string;
  judge: JudgeSummary | null;
}

export interface OverallSummary {
  conditions: Record<Condition, ConditionStats>;
  deltaPassRate: number;
  tokenDelta: { input: number; output: number } | null;
  verdict: Verdict;
  verdictReason: string;
}

export interface RunManifest {
  schemaVersion: 1;
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

export function verdictFor(
  baselineRate: number,
  treatmentRate: number,
  trials: number,
): VerdictOutcome {
  if (trials < MIN_TRIALS_FOR_VERDICT) {
    return {
      verdict: 'inconclusive',
      reason: `insufficient samples: ${trials} trial(s) per condition, need at least ${MIN_TRIALS_FOR_VERDICT}`,
    };
  }
  const delta = treatmentRate - baselineRate;
  if (delta > 0) {
    return { verdict: 'effective', reason: `treatment pass rate is ${formatDeltaPp(delta)} higher` };
  }
  if (delta < 0) {
    return { verdict: 'ineffective', reason: `treatment pass rate is ${formatDeltaPp(delta)} lower` };
  }
  return { verdict: 'inconclusive', reason: 'no measurable difference in pass rate' };
}

export function buildWarnings(manifest: Omit<RunManifest, 'warnings'>): string[] {
  const warnings: string[] = [];
  if (manifest.executor.kind === 'mock') {
    warnings.push('Executor is a mock: results are synthetic and only exercise the harness.');
  }
  for (const task of manifest.tasks) {
    const rate = task.conditions.baseline.passRate;
    if (rate >= DISCRIMINATION_BASELINE_THRESHOLD) {
      warnings.push(
        `Task "${task.id}": baseline pass rate is ${Math.round(rate * 100)}% (>= 90%) — this bench task may be too easy and the experiment may lack discriminative power.`,
      );
    }
  }
  const overallRate = manifest.overall.conditions.baseline.passRate;
  if (manifest.tasks.length > 1 && overallRate >= DISCRIMINATION_BASELINE_THRESHOLD) {
    warnings.push(
      `Overall baseline pass rate is ${Math.round(overallRate * 100)}% (>= 90%) — this bench may be too easy and the experiment may lack discriminative power.`,
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
  const tokenLines = renderTokenDeltas(manifest);
  if (tokenLines.length > 0) {
    lines.push('');
    lines.push(...tokenLines);
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
  return lines;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function describeExecutor(descriptor: ExecutorDescriptor): string {
  const base = `${descriptor.kind} (${descriptor.model})`;
  return descriptor.detail ? `${base} — ${descriptor.detail}` : base;
}
