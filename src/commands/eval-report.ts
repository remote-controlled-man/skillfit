import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS, formatP, formatPp1, verdictFor } from '../harness/report.js';
import { mcnemarExactP } from '../harness/stats.js';

const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;

type RecordValue = Record<string, unknown>;
type Verdict = 'effective' | 'ineffective' | 'inconclusive';

interface Counts {
  passes: number;
  trials: number;
  errors: number;
  meanScore: number | null;
  tokens: { input: number; output: number } | null;
  tokenCoverage: { input: number; output: number } | null;
}

interface FacetRow {
  name: string;
  baselinePassRate: number;
  treatmentPassRate: number;
  baselineTrials: number;
  treatmentTrials: number;
}

interface ReportRow {
  id: string;
  baseline: Counts;
  treatment: Counts;
  deltaPassRate: number;
  verdict: Verdict;
  scoreDelta: number | null;
  facets: FacetRow[];
}

interface ReportData {
  runGroup: string;
  createdAt: string;
  target: { kind: string; name: string; sha256: string };
  bench: { name: string; sha256: string; taskCount: number };
  executor: { kind: string; model: string };
  trials: number;
  inputMode: 'snapshot' | 'workspace' | null;
  tasks: ReportRow[];
  overall: ReportRow & {
    verdictReason: string;
    improved: number;
    regressed: number;
    mcnemarP: number;
    deltaCi: { lo: number; hi: number; resamples: number } | null;
    scoreDeltaCi: { lo: number; hi: number; resamples: number } | null;
  };
  warnings: string[];
}

function object(value: unknown, label: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as RecordValue;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}

function number(value: unknown, label: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

function integer(value: unknown, label: string, min = 0): number {
  const result = number(value, label, min);
  if (!Number.isInteger(result)) throw new Error(`${label} must be an integer`);
  return result;
}

function hash(value: unknown, label: string): string {
  const result = string(value, label);
  if (!/^[0-9a-f]{64}$/i.test(result)) throw new Error(`${label} must be a SHA-256 hex digest`);
  return result;
}

function verdict(value: unknown, label: string): Verdict {
  if (value !== 'effective' && value !== 'ineffective' && value !== 'inconclusive') {
    throw new Error(`${label} must be effective, ineffective, or inconclusive`);
  }
  return value;
}

function counts(value: unknown, label: string): Counts {
  const item = object(value, label);
  const passes = integer(item['passes'], `${label}.passes`);
  const trials = integer(item['trials'], `${label}.trials`);
  const errors = integer(item['errors'], `${label}.errors`);
  if (passes > trials) throw new Error(`${label}.passes cannot exceed trials`);
  const meanScore = item['meanScore'] === undefined || item['meanScore'] === null
    ? null : number(item['meanScore'], `${label}.meanScore`, 0, 1);
  const rawTokens = item['tokens'] === undefined || item['tokens'] === null
    ? null : object(item['tokens'], `${label}.tokens`);
  const tokens = rawTokens === null ? null : {
    input: number(rawTokens['input'], `${label}.tokens.input`, 0),
    output: number(rawTokens['output'], `${label}.tokens.output`, 0),
  };
  const rawCoverage = item['tokenCoverage'] === undefined
    ? null : object(item['tokenCoverage'], `${label}.tokenCoverage`);
  const tokenCoverage = rawCoverage === null ? null : {
    input: integer(rawCoverage['input'], `${label}.tokenCoverage.input`),
    output: integer(rawCoverage['output'], `${label}.tokenCoverage.output`),
  };
  if (tokenCoverage && (tokenCoverage.input > trials || tokenCoverage.output > trials)) {
    throw new Error(`${label}.tokenCoverage cannot exceed graded trials`);
  }
  if (meanScore !== null && trials === 0) throw new Error(`${label}.meanScore requires graded trials`);
  return { passes, trials, errors, meanScore, tokens, tokenCoverage };
}

function facets(value: unknown, label: string): FacetRow[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((raw, index) => {
    const item = object(raw, `${label}[${index}]`);
    return {
      name: string(item['name'], `${label}[${index}].name`),
      baselinePassRate: number(item['baselinePassRate'], `${label}[${index}].baselinePassRate`, 0, 1),
      treatmentPassRate: number(item['treatmentPassRate'], `${label}[${index}].treatmentPassRate`, 0, 1),
      baselineTrials: integer(item['baselineTrials'], `${label}[${index}].baselineTrials`),
      treatmentTrials: integer(item['treatmentTrials'], `${label}[${index}].treatmentTrials`),
    };
  });
}

function row(value: unknown, label: string, id: string): ReportRow {
  const item = object(value, label);
  const conditions = object(item['conditions'], `${label}.conditions`);
  return {
    id,
    baseline: counts(conditions['baseline'], `${label}.conditions.baseline`),
    treatment: counts(conditions['treatment'], `${label}.conditions.treatment`),
    deltaPassRate: number(item['deltaPassRate'], `${label}.deltaPassRate`, -1, 1),
    verdict: verdict(item['verdict'], `${label}.verdict`),
    scoreDelta: item['scoreDelta'] === undefined || item['scoreDelta'] === null
      ? null : number(item['scoreDelta'], `${label}.scoreDelta`, -1, 1),
    facets: facets(item['facets'], `${label}.facets`),
  };
}

function checkDelta(value: ReportRow, label: string): void {
  if (value.baseline.trials !== value.treatment.trials) {
    throw new Error(`${label} must contain equal numbers of graded paired trials`);
  }
  const seen = new Set<string>();
  for (const facet of value.facets) {
    if (seen.has(facet.name)) throw new Error(`${label}.facets contains a duplicate check name`);
    seen.add(facet.name);
    for (const condition of ['baseline', 'treatment'] as const) {
      const trials = condition === 'baseline' ? facet.baselineTrials : facet.treatmentTrials;
      const rate = condition === 'baseline' ? facet.baselinePassRate : facet.treatmentPassRate;
      if (trials > value[condition].trials || (trials === 0 && rate !== 0) ||
          Math.abs(rate * trials - Math.round(rate * trials)) > 1e-9) {
        throw new Error(`${label}.facets has an invalid ${condition} check denominator or rate`);
      }
    }
  }
  const rate = (counts: Counts): number => counts.trials === 0 ? 0 : counts.passes / counts.trials;
  const expected = rate(value.treatment) - rate(value.baseline);
  if (Math.abs(value.deltaPassRate - expected) > 1e-9) {
    throw new Error(`${label}.deltaPassRate disagrees with its pass counts`);
  }
  if (value.baseline.meanScore !== null && value.treatment.meanScore !== null &&
      value.scoreDelta !== null && Math.abs(value.scoreDelta -
        (value.treatment.meanScore - value.baseline.meanScore)) > 1e-9 && label !== 'overall') {
    throw new Error(`${label}.scoreDelta disagrees with its mean scores`);
  }
}

/** Read only the v4 fields the Markdown report actually uses. Never reinterpret older metrics. */
export function parseEvalReport(value: unknown): ReportData {
  const manifest = object(value, 'Manifest');
  if (manifest['schemaVersion'] !== 4) {
    throw new Error(`Only evaluation manifest schemaVersion 4 can be rendered (found ${JSON.stringify(manifest['schemaVersion'])})`);
  }
  const target = object(manifest['target'], 'target');
  const kind = string(target['kind'], 'target.kind');
  if (!['skill', 'rules', 'mcp'].includes(kind)) throw new Error('target.kind must be skill, rules, or mcp');
  const bench = object(manifest['bench'], 'bench');
  const executor = object(manifest['executor'], 'executor');
  const inputMode = manifest['inputMode'];
  if (inputMode !== undefined && inputMode !== 'snapshot' && inputMode !== 'workspace') {
    throw new Error('inputMode must be snapshot or workspace');
  }
  const rawTasks = manifest['tasks'];
  if (!Array.isArray(rawTasks)) throw new Error('tasks must be an array');
  const tasks = rawTasks.map((task, index) => {
    const item = object(task, `tasks[${index}]`);
    return row(item, `tasks[${index}]`, string(item['id'], `tasks[${index}].id`));
  });
  const overall = object(manifest['overall'], 'overall');
  const stats = object(overall['stats'], 'overall.stats');
  const discordant = object(stats['discordant'], 'overall.stats.discordant');
  const rawCi = stats['deltaCi'];
  const ci = rawCi === null ? null : object(rawCi, 'overall.stats.deltaCi');
  const warnings = manifest['warnings'];
  if (!Array.isArray(warnings) || warnings.some((item) => typeof item !== 'string')) {
    throw new Error('warnings must be an array of strings');
  }
  const createdAt = string(manifest['createdAt'], 'createdAt');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('createdAt must be a date-time');
  const taskCount = integer(bench['taskCount'], 'bench.taskCount');
  if (tasks.length !== taskCount) throw new Error('bench.taskCount must match tasks.length');
  const ciValue = ci === null ? null : {
    lo: number(ci['lo'], 'overall.stats.deltaCi.lo', -1, 1),
    hi: number(ci['hi'], 'overall.stats.deltaCi.hi', -1, 1),
    resamples: integer(ci['resamples'], 'overall.stats.deltaCi.resamples', 1),
  };
  if (ciValue && ciValue.lo > ciValue.hi) throw new Error('overall.stats.deltaCi.lo cannot exceed hi');
  const rawScoreCi = stats['scoreDeltaCi'];
  const scoreCi = rawScoreCi === undefined || rawScoreCi === null ? null
    : object(rawScoreCi, 'overall.stats.scoreDeltaCi');
  const scoreDeltaCi = scoreCi === null ? null : {
    lo: number(scoreCi['lo'], 'overall.stats.scoreDeltaCi.lo', -1, 1),
    hi: number(scoreCi['hi'], 'overall.stats.scoreDeltaCi.hi', -1, 1),
    resamples: integer(scoreCi['resamples'], 'overall.stats.scoreDeltaCi.resamples', 1),
  };
  if (scoreDeltaCi && scoreDeltaCi.lo > scoreDeltaCi.hi) throw new Error('overall.stats.scoreDeltaCi.lo cannot exceed hi');
  const overallRow = row(overall, 'overall', 'Overall');
  for (const [index, task] of tasks.entries()) checkDelta(task, `tasks[${index}]`);
  checkDelta(overallRow, 'overall');
  for (const condition of ['baseline', 'treatment'] as const) {
    for (const field of ['passes', 'trials', 'errors'] as const) {
      const total = tasks.reduce((sum, task) => sum + task[condition][field], 0);
      if (total !== overallRow[condition][field]) {
        throw new Error(`overall.conditions.${condition}.${field} disagrees with task totals`);
      }
    }
  }
  const improved = integer(discordant['improved'], 'overall.stats.discordant.improved');
  const regressed = integer(discordant['regressed'], 'overall.stats.discordant.regressed');
  if (improved + regressed > overallRow.baseline.trials) {
    throw new Error('overall.stats.discordant exceeds the number of paired trials');
  }
  const mcnemarP = number(stats['mcnemarP'], 'overall.stats.mcnemarP', 0, 1);
  if (Math.abs(mcnemarP - mcnemarExactP(improved, regressed)) > 1e-9) {
    throw new Error('overall.stats.mcnemarP disagrees with discordant counts');
  }
  const expectedVerdict = verdictFor({ improved, regressed, deltaPassRate: overallRow.deltaPassRate }).verdict;
  if (overallRow.verdict !== expectedVerdict) throw new Error('overall.verdict disagrees with the metrics protocol');
  return {
    runGroup: string(manifest['runGroup'], 'runGroup'),
    createdAt,
    target: { kind, name: string(target['name'], 'target.name'), sha256: hash(target['bundleSha256'], 'target.bundleSha256') },
    bench: {
      name: string(bench['name'], 'bench.name'),
      sha256: hash(bench['contentSha256'], 'bench.contentSha256'),
      taskCount,
    },
    executor: { kind: string(executor['kind'], 'executor.kind'), model: string(executor['model'], 'executor.model') },
    trials: integer(manifest['trials'], 'trials', 1),
    inputMode: inputMode ?? null,
    tasks,
    overall: {
      ...overallRow,
      verdictReason: string(overall['verdictReason'], 'overall.verdictReason'),
      improved,
      regressed,
      mcnemarP,
      deltaCi: ciValue,
      scoreDeltaCi,
    },
    warnings: warnings as string[],
  };
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('*', '\\*')
    .replaceAll('_', '\\_').replaceAll('[', '\\[').replaceAll(']', '\\]')
    .replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
}

function passRate(value: Counts): string {
  return `${value.passes}/${value.trials} (${value.trials === 0 ? 'n/a' : `${Math.round(100 * value.passes / value.trials)}%`})`;
}

function tableRow(value: ReportRow): string {
  return `| ${escapeMarkdown(value.id)} | ${passRate(value.baseline)} | ${passRate(value.treatment)} | ${value.baseline.errors}/${value.treatment.errors} | ${formatPp1(value.deltaPassRate)} | ${value.verdict} |`;
}

function score(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function decisionNotes(report: ReportData): string[] {
  const notes: string[] = [];
  if (report.executor.kind === 'mock') {
    return ['No installation decision: this synthetic run only checks the harness.'];
  }
  if (report.overall.baseline.trials === 0) {
    notes.push('No installation decision: no graded pairs. Repair the execution or verifier environment first.');
  } else if (report.overall.verdict === 'inconclusive') {
    notes.push('No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.');
  } else {
    notes.push(report.overall.verdict === 'effective'
      ? 'The statistical quality result favors treatment on this bench; it does not by itself establish installation value.'
      : 'The statistical quality result favors baseline on this bench; review the regressions before enabling this configuration for these tasks.');
  }
  notes.push(`Scope: ${report.bench.taskCount} evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.`);
  if (report.bench.taskCount < CONCLUSIVE_TASKS || report.trials < CONCLUSIVE_TRIALS) {
    notes.push('The run is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.');
  }
  if (report.overall.baseline.errors + report.overall.treatment.errors > 0) {
    notes.push('Executor/verifier errors removed pairs. Inspect the raw error receipts before spending more calls.');
  }
  const saturated = report.tasks.filter(t => t.baseline.trials > 0 && t.baseline.passes / t.baseline.trials >= 0.9);
  if (saturated.length > 0) {
    notes.push(`Observed baseline saturation: ${saturated.map(t => t.id).join(', ')}. Retain these as regression controls; add independent real failures to measure lift.`);
  }
  if (report.tasks.some(t => t.baseline.trials > 0 && t.baseline.passes === 0 && t.treatment.passes === 0)) {
    notes.push('Some tasks failed in both arms. Inspect facet misses, dependencies and the issue-to-check contract before interpreting the pass-rate floor as task difficulty.');
  }
  if (report.target.kind === 'skill') {
    notes.push('Activation is unmeasured by this paired run: Skill content was force-injected. Run separate trigger tests with relevant requests and negative controls before an installation decision.');
  }
  if (!report.overall.baseline.tokens || !report.overall.treatment.tokens) {
    notes.push('Token overhead is unavailable. Elapsed time or prompt-size estimates do not establish token cost.');
  } else if ([report.overall.baseline, report.overall.treatment].some(c =>
    !c.tokenCoverage || c.tokenCoverage.input < c.trials || c.tokenCoverage.output < c.trials)) {
    notes.push('Token coverage is partial or unrecorded. Available usage totals cannot establish complete token overhead.');
  } else {
    notes.push('Recorded token usage is shown below; it is not a billing estimate or a statistically established cost effect.');
  }
  return notes;
}

export function renderEvalMarkdown(report: ReportData): string {
  const lines = [
    `# skillfit evaluation: ${escapeMarkdown(report.target.name)}`,
    '',
  ];
  if (report.executor.kind === 'mock') {
    lines.push('> **Synthetic harness run.** These numbers do not measure an agent or Skill effect.', '');
  }
  lines.push(
    `- Run: ${escapeMarkdown(report.runGroup)} (${escapeMarkdown(report.createdAt)})`,
    `- Target: ${escapeMarkdown(report.target.kind)}; SHA-256 \`${report.target.sha256}\``,
    `- Bench: ${escapeMarkdown(report.bench.name)} (${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'}); SHA-256 \`${report.bench.sha256}\``,
    `- Executor: ${escapeMarkdown(report.executor.kind)} / ${escapeMarkdown(report.executor.model)}`,
    `- Trials: ${report.trials} per condition`,
    `- Input: ${report.inputMode ?? 'snapshot (legacy manifest; not recorded)'}`,
    '',
    '| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |',
    '|---|---:|---:|---:|---:|---|',
    ...report.tasks.map(tableRow),
    tableRow(report.overall),
    '',
    '## Statistical readout',
    '',
    `- Overall verdict: **${report.overall.verdict}** — ${escapeMarkdown(report.overall.verdictReason)}`,
    `- Discordant pairs: ${report.overall.improved} improved, ${report.overall.regressed} regressed; McNemar exact p=${formatP(report.overall.mcnemarP)}`,
  );
  if (report.overall.deltaCi) {
    const ci = report.overall.deltaCi;
    lines.push(`- Δpass 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
  } else {
    lines.push('- Δpass 95% CI: n/a (no graded pairs)');
  }
  if (report.overall.scoreDeltaCi) {
    const ci = report.overall.scoreDeltaCi;
    lines.push(`- Δscore 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
  }
  if (report.bench.taskCount < CONCLUSIVE_TASKS || report.trials < CONCLUSIVE_TRIALS) {
    lines.push(`- Scale: ${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'} × ${report.trials} ${report.trials === 1 ? 'trial' : 'trials'} per condition; below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.`);
  }
  lines.push('', '## Checks and graded scores', '',
    '| Task | Baseline mean check score | Treatment mean check score | Δscore |',
    '|---|---:|---:|---:|',
    ...report.tasks.map(t => `| ${escapeMarkdown(t.id)} | ${score(t.baseline.meanScore)} | ${score(t.treatment.meanScore)} | ${t.scoreDelta === null ? 'n/a' : formatPp1(t.scoreDelta)} |`));
  for (const task of report.tasks) {
    if (task.facets.length === 0) continue;
    lines.push('', `### ${escapeMarkdown(task.id)}`, '',
      '| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |',
      '|---|---:|---:|',
      ...task.facets.map(f => `| ${escapeMarkdown(f.name)} | ${f.baselineTrials === 0 ? 'n/a' : `${score(f.baselinePassRate)} (n=${f.baselineTrials})`} | ${f.treatmentTrials === 0 ? 'n/a' : `${score(f.treatmentPassRate)} (n=${f.treatmentTrials})`} |`));
  }
  if (report.tasks.every(t => t.facets.length === 0)) {
    lines.push('', 'No per-check observations recorded.');
  }
  lines.push('', '## Installation decision and next steps', '',
    ...decisionNotes(report).map(note => `- ${escapeMarkdown(note)}`));
  if (report.overall.baseline.tokens && report.overall.treatment.tokens) {
    const cell = (c: Counts, field: 'input' | 'output'): string =>
      `${c.tokens![field]} (${c.tokenCoverage ? `${c.tokenCoverage[field]}/${c.trials} runs` : 'coverage unrecorded'})`;
    lines.push('', '| Recorded token totals (field coverage) | Baseline | Treatment |', '|---|---:|---:|',
      `| Input | ${cell(report.overall.baseline, 'input')} | ${cell(report.overall.treatment, 'input')} |`,
      `| Output | ${cell(report.overall.baseline, 'output')} | ${cell(report.overall.treatment, 'output')} |`);
  }
  lines.push('', '## Warnings', '');
  if (report.warnings.length === 0) lines.push('- None');
  else lines.push(...report.warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
  lines.push('', 'The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.', '');
  return lines.join('\n');
}

export function runEvalReport(manifestPath: string, log: (line: string) => void = console.log): void {
  const path = resolve(manifestPath);
  if (statSync(path).size > MAX_MANIFEST_BYTES) throw new Error(`Evaluation manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read evaluation manifest: ${(error as Error).message}`);
  }
  log(renderEvalMarkdown(parseEvalReport(value)));
}
