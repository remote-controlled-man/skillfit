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
}

interface ReportRow {
  id: string;
  baseline: Counts;
  treatment: Counts;
  deltaPassRate: number;
  verdict: Verdict;
}

interface ReportData {
  runGroup: string;
  createdAt: string;
  target: { kind: string; name: string; sha256: string };
  bench: { name: string; sha256: string; taskCount: number };
  executor: { kind: string; model: string };
  trials: number;
  tasks: ReportRow[];
  overall: ReportRow & {
    verdictReason: string;
    improved: number;
    regressed: number;
    mcnemarP: number;
    deltaCi: { lo: number; hi: number; resamples: number } | null;
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
  return { passes, trials, errors };
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
  };
}

function checkDelta(value: ReportRow, label: string): void {
  const rate = (counts: Counts): number => counts.trials === 0 ? 0 : counts.passes / counts.trials;
  const expected = rate(value.treatment) - rate(value.baseline);
  if (Math.abs(value.deltaPassRate - expected) > 1e-9) {
    throw new Error(`${label}.deltaPassRate disagrees with its pass counts`);
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
    tasks,
    overall: {
      ...overallRow,
      verdictReason: string(overall['verdictReason'], 'overall.verdictReason'),
      improved,
      regressed,
      mcnemarP,
      deltaCi: ciValue,
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
  if (report.bench.taskCount < CONCLUSIVE_TASKS || report.trials < CONCLUSIVE_TRIALS) {
    lines.push(`- Scale: ${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'} × ${report.trials} ${report.trials === 1 ? 'trial' : 'trials'} per condition; below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials). Treat this result as indicative.`);
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
