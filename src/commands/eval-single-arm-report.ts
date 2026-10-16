import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { record, readComponentJson } from '../harness/eval-contract.js';
import type { ExperimentSummary } from '../harness/experiment-session.js';
import { stoppedAccounting } from '../harness/eval-audit.js';
import { COST_METRICS } from '../harness/costs.js';
import { triggerMetrics, type TriggerTaskSummary } from '../harness/trigger.js';
import type { EvalReportOptions } from './eval-component.js';

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string.`);
  return value;
}
function count(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label} must be a nonnegative safe integer no greater than ${max}.`);
  return value;
}
function tasks(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Summary tasks must be a nonempty array.');
  const result = value.map((task, i) => record(task, `tasks[${i}]`));
  const ids = result.map(task => text(task.id, 'task.id'));
  if (new Set(ids).size !== ids.length) throw new Error('Summary task IDs must be unique.');
  return result;
}
function experiment(value: unknown): ExperimentSummary {
  const s = record(value, 'experiment');
  if (s.schemaVersion !== 1 || !['completed', 'stopped', 'incomplete'].includes(String(s.status))) throw new Error('Invalid experiment schema or status.');
  const max = count(s.maxCalls, 'experiment.maxCalls'), planned = count(s.plannedCalls, 'experiment.plannedCalls', max);
  const started = count(s.callsStarted, 'experiment.callsStarted', planned), finished = count(s.callsFinished, 'experiment.callsFinished', started);
  if (!planned || (s.stopReason !== null && typeof s.stopReason !== 'string') || typeof s.planSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(s.planSha256)) throw new Error('Invalid experiment metadata.');
  if (s.status === 'completed' && (finished !== planned || s.stopReason !== null)) throw new Error('Completed experiment has unfinished calls or a stop reason.');
  return { schemaVersion: 1, status: s.status as ExperimentSummary['status'], plannedCalls: planned, maxCalls: max,
    callsStarted: started, callsFinished: finished, stopReason: s.stopReason as string | null, planSha256: s.planSha256 };
}
function trials(value: unknown): number {
  const n = count(value, 'trials', 20);
  if (!n) throw new Error('trials must be at least 1.');
  return n;
}
function calibration(value: Record<string, unknown>, complete: boolean) {
  if (value.inputMode !== 'snapshot' && value.inputMode !== 'workspace') throw new Error('Calibration inputMode must be snapshot or workspace.');
  const repetitions = trials(value.trials);
  const rows = tasks(value.tasks).map(task => {
    const completed = count(task.completed, 'task.completed', repetitions), errors = count(task.errors, 'task.errors', repetitions);
    if (completed + errors > repetitions || (complete && completed + errors !== repetitions)) throw new Error('Calibration trial counts disagree with trials.');
    const passes = count(task.passes, 'task.passes', completed), passRate = completed ? passes / completed : null;
    const difficulty = passRate === null ? 'unmeasured' : passRate >= 0.9 ? 'saturated' : passRate <= 0.1 ? 'floor' : 'discriminative';
    return { id: text(task.id, 'task.id'), passes, completed, errors, passRate, difficulty };
  });
  const completed = rows.reduce((n, row) => n + row.completed, 0), passes = rows.reduce((n, row) => n + row.passes, 0);
  return { trials: repetitions, inputMode: value.inputMode, tasks: rows,
    metrics: { taskCount: rows.length, measuredTasks: rows.filter(row => row.completed > 0).length,
      discriminativeTasks: rows.filter(row => row.difficulty === 'discriminative').length,
      passes, completed, errors: rows.reduce((n, row) => n + row.errors, 0), baselinePassRate: completed ? passes / completed : null } };
}
function tokens(value: unknown): { input: number; output: number } | null {
  if (value === null) return null;
  const pair = record(value, 'task.tokens');
  return { input: count(pair.input, 'tokens.input'), output: count(pair.output, 'tokens.output') };
}
function trigger(value: Record<string, unknown>, complete: boolean) {
  const repetitions = trials(value.trials);
  const rows: TriggerTaskSummary[] = tasks(value.tasks).map(task => {
    if (typeof task.shouldTrigger !== 'boolean') throw new Error('task.shouldTrigger must be boolean.');
    const runs = count(task.runs, 'task.runs', repetitions), unknown = count(task.unknown, 'task.unknown', repetitions), errors = count(task.errors, 'task.errors', repetitions);
    if (runs + unknown + errors > repetitions || (complete && runs + unknown + errors !== repetitions)) throw new Error('Trigger trial counts disagree with trials.');
    if (task.triggerClass !== undefined && !['explicit', 'implicit', 'contextual'].includes(String(task.triggerClass))) throw new Error('Invalid triggerClass.');
    return { id: text(task.id, 'task.id'), shouldTrigger: task.shouldTrigger,
      ...(task.triggerClass ? { triggerClass: task.triggerClass as TriggerTaskSummary['triggerClass'] } : {}),
      runs, fired: count(task.fired, 'task.fired', runs), unknown, errors, passes: count(task.passes, 'task.passes', runs + unknown), tokens: tokens(task.tokens) };
  });
  const metrics = triggerMetrics(rows), saved = record(value.metrics, 'trigger metrics');
  // Reuse the frozen formulas and validate recorded fields. Older v1 additions
  // may be absent; intervals can be derived from the retained counts, not new runs.
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
    if (saved[key] !== undefined && !isDeepStrictEqual(saved[key], metrics[key])) throw new Error(`Trigger metrics.${key} disagrees with saved task counts.`);
  }
  for (const key of ['recall', 'falseTriggerRate', 'precision', 'f1', 'positives', 'negatives']) if (saved[key] === undefined) throw new Error(`Missing trigger metrics.${key}.`);
  const skill = record(value.skill, 'trigger skill'), bench = record(value.bench, 'trigger bench');
  if (count(bench.taskCount, 'bench.taskCount') !== rows.length) throw new Error('Trigger bench.taskCount disagrees with tasks.');
  if (value.detection !== undefined && !['skill-tool', 'skill-read', 'unrecorded'].includes(String(value.detection))) throw new Error('Invalid trigger detection.');
  const competition = value.competition === undefined ? null : record(value.competition, 'competition');
  if (competition && competition.mode !== 'alone' && competition.mode !== 'installed') throw new Error('Invalid competition mode.');
  return { trials: repetitions, skillName: text(skill.name, 'skill.name'), benchName: text(bench.name, 'bench.name'),
    detection: value.detection ?? 'unrecorded', competition: competition?.mode ?? 'unrecorded', tasks: rows, metrics };
}

/** Descriptive single-arm reports never enter the paired acceptance protocol. */
export function readSingleArmReport(inputPath: string, options: EvalReportOptions = {}) {
  const input = resolve(inputPath), directory = statSync(input).isDirectory(), root = directory ? input : dirname(input);
  const regular = join(root, 'manifest.json'), calibrated = join(root, '_calibration.json');
  if (directory && existsSync(regular) && existsSync(calibrated)) throw new Error('Ambiguous run: both paired/trigger and calibration summaries exist.');
  const source = directory ? existsSync(regular) ? regular : existsSync(calibrated) ? calibrated : null : input;
  const data = source ? readComponentJson(source) : null, value = data ? record(data.value, 'summary') : null;
  let mode: 'trigger' | 'calibration' | null = value?.mode === 'trigger' ? 'trigger'
    : value?.schemaVersion === 1 && (basename(source!) === '_calibration.json' || value.inputMode !== undefined) ? 'calibration' : null;
  let plan: Record<string, unknown> | null = null;
  if (!source || mode) {
    if (existsSync(join(root, '_plan.json'))) plan = record(readComponentJson(join(root, '_plan.json')).value, 'native plan');
    const planned = plan?.details ? record(plan.details, 'native plan details').mode : undefined;
    if (!mode && (planned === 'trigger' || planned === 'calibration')) mode = planned;
    else if (mode && planned !== undefined && planned !== mode) throw new Error('Summary type differs from the native plan.');
  }
  if (!mode) return null;
  if (options.replay || options.policyPath || options.recordsPath || options.benchDir) throw new Error(`${mode} reports support saved summaries only; --replay, --policy, --records and --bench require a paired report.`);
  if (value && value.schemaVersion !== 1) throw new Error(`Unsupported ${mode} summary schemaVersion: ${String(value.schemaVersion)}.`);
  let session = value?.experiment === undefined ? null : experiment(value.experiment);
  if (existsSync(join(root, '_session.json'))) {
    const native = experiment(readComponentJson(join(root, '_session.json')).value);
    if (session && !isDeepStrictEqual(session, native)) throw new Error('Summary experiment differs from the saved session.');
    session = native;
  }
  const status = value ? session?.status ?? 'reported' : session?.status === 'stopped' ? 'stopped' : 'incomplete';
  const warnings = value?.warnings === undefined ? [] : value.warnings;
  if (!Array.isArray(warnings) || warnings.some(w => typeof w !== 'string')) throw new Error('Summary warnings must be strings.');
  if (value && session && session.plannedCalls !== tasks(value.tasks).length * trials(value.trials)) throw new Error('Summary task/trial count differs from the declared call plan.');
  const accounting = mode === 'calibration' && existsSync(join(root, '_calls.jsonl')) ? stoppedAccounting(root) : null;
  if (accounting && accounting.populations.attempts.treatment.runs) throw new Error('Calibration receipts contain an unexpected treatment invocation.');
  const usage = accounting ? { ...accounting.populations.attempts.baseline,
    startedAgentDispatches: accounting.startedAgentDispatches, invocationsWithUnknownReceipts: accounting.invocationsWithUnknownReceipts,
    scope: 'Available baseline invocation receipts only; missing or invalid usage remains unknown. No paired comparison or billing estimate.' } : null;
  const base = { schemaVersion: 1 as const, status, runGroup: value ? text(value.runGroup, 'runGroup') : basename(root), session,
    usage,
    source: data && source ? { path: source, sha256: data.sha256, schemaVersion: 1 } : null,
    warnings: [...warnings as string[], ...(!value ? ['Final summary is missing; no aggregate metrics inferred from an unfinished run.'] : [])],
    evidence: { verified: false, runDir: root, scope: 'saved-summary-only', reasons: ['Saved single-arm summary only; paired native audit and delivery replay do not apply.'] },
    acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false,
      reasons: [{ code: 'NOT_A_PAIRED_COMPARISON', message: 'Calibration measures baseline difficulty; trigger mode measures discovery. Neither establishes a paired Skill improvement or authorizes an upgrade.' }] } };
  if (mode === 'calibration') return { ...base, kind: 'skillfit.calibration-report' as const, evaluationType: 'calibration' as const,
    summary: value ? calibration(value, status === 'completed') : null };
  return { ...base, kind: 'skillfit.trigger-report' as const, evaluationType: 'trigger' as const,
    summary: value ? trigger(value, status === 'completed') : null };
}

export type SingleArmReport = NonNullable<ReturnType<typeof readSingleArmReport>>;
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('*', '\\*').replaceAll('_', '\\_')
  .replaceAll('[', '\\[').replaceAll(']', '\\]').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
const percent = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
export function renderSingleArmReport(report: SingleArmReport): string {
  const lines = [`# skillfit ${report.evaluationType} report: ${escape(report.runGroup)}`, '', `- State: ${report.status}`,
    '- Evidence: saved summary only; no paired native audit or adoption decision.', '- Eligible for upgrade: no', '- Automatic upgrade: no'];
  if (report.session?.stopReason) lines.push(`- Stop reason: ${escape(report.session.stopReason.replaceAll(report.evidence.runDir, '[run]'))}`);
  if (report.evaluationType === 'calibration' && report.summary) {
    const { tasks, metrics } = report.summary;
    lines.push('', '## Baseline difficulty', '', `- Baseline pass rate: ${metrics.passes}/${metrics.completed} (${percent(metrics.baselinePassRate)})`,
      `- Measured tasks: ${metrics.measuredTasks}/${metrics.taskCount}; discriminative tasks: ${metrics.discriminativeTasks}/${metrics.measuredTasks}`,
      `- Ungraded errors: ${metrics.errors}`, '', '| Task | Passes / completed | Pass rate | Errors | Difficulty |', '|---|---:|---:|---:|---|',
      ...tasks.map(t => `| ${escape(t.id)} | ${t.passes}/${t.completed} | ${percent(t.passRate)} | ${t.errors} | ${t.difficulty} |`), '',
      'Completed runs exclude execution errors. Saturated >=90%; floor <=10%; otherwise discriminative; zero completed runs are unmeasured.',
      'Baseline difficulty does not measure Skill benefit.');
  } else if (report.evaluationType === 'trigger' && report.summary) {
    const { metrics: m, tasks, detection, competition } = report.summary;
    const ci = (value: number | null, interval: { lo: number; hi: number } | null) => `${percent(value)}${interval ? ` [${percent(interval.lo)}, ${percent(interval.hi)}]` : ''}`;
    lines.push('', '## Trigger metrics', '', `- Skill: ${escape(report.summary.skillName)}; bench: ${escape(report.summary.benchName)}`,
      `- Detection: ${detection}; competition: ${competition}`, `- Recall: ${ci(m.recall, m.recallCi95)} (${m.positives.fired}/${m.positives.runs})`,
      `- False-trigger rate: ${ci(m.falseTriggerRate, m.falseTriggerRateCi95)} (${m.negatives.fired}/${m.negatives.runs})`,
      `- Precision: ${ci(m.precision, m.precisionCi95)}`, `- F1: ${m.f1 === null ? 'n/a' : m.f1.toFixed(3)} (no confidence interval)`,
      '', '| Task | Expected trigger | Fired / observed | Unknown | Errors | Task passes |', '|---|---|---:|---:|---:|---:|',
      ...tasks.map(t => `| ${escape(t.id)} | ${t.shouldTrigger ? 'yes' : 'no'} | ${t.fired}/${t.runs} | ${t.unknown} | ${t.errors} | ${t.passes} |`));
    for (const label of ['explicit', 'implicit', 'contextual'] as const) {
      const group = m.classRecall?.[label];
      if (group) lines.push(`- ${label} recall: ${ci(group.recall, group.recallCi95)} (${group.fired}/${group.runs})`);
      else if (tasks.some(t => t.shouldTrigger && t.triggerClass === label)) lines.push(`- ${label} recall: n/a (no observed detections)`);
    }
    if (detection === 'skill-read') lines.push('- A SKILL.md read is an observation, not a Skill-invocation event.');
    if (competition === 'alone') lines.push('- Recall is an upper bound with the tested Skill installed alone.');
    lines.push('- Rates exclude unknown detections and execution errors; zero denominators are n/a. Intervals use Wilson 95%.',
      '- Recorded token totals are historical aggregates, not complete final/partial/unknown costs or a bill; missing cache partitions remain unknown.');
    if (m.tokens) lines.push(`- Recorded input/output tokens: ${m.tokens.input}/${m.tokens.output}`);
  } else lines.push('', 'Final summary is missing. Metrics are unavailable; the run is not a completed comparison.');
  if (report.evaluationType === 'calibration') {
    lines.push('', '## Retained baseline usage', '');
    if (report.usage) {
      const u = report.usage;
      lines.push(`- Started agent dispatches: ${u.startedAgentDispatches}; missing or invalid receipts: ${u.invocationsWithUnknownReceipts}`,
        '| Measure | Known total | Final/partial/unknown |', '|---|---:|---:|');
      for (const metric of COST_METRICS) {
        const m = u.metrics[metric], c = m.coverage;
        const total = c.unknown === u.runs ? 'unrecorded' : c.final === u.runs ? String(m.knownTotal) : `>= ${m.knownTotal}`;
        lines.push(`| ${metric} | ${total} | ${c.final}/${c.partial}/${c.unknown} |`);
      }
      lines.push('Available receipt totals only; >= is a lower bound. Unknown usage is not zero; no bill or paired cost change is inferred.');
    } else lines.push('Invocation usage is unrecorded; no spending totals inferred from task success counts.');
  }
  for (const warning of report.warnings) lines.push(`- Warning: ${escape(warning)}`);
  return lines.join('\n') + '\n';
}
