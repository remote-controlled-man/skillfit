import { auditSingleArmEvaluation } from './single-arm-audit.js';
import { parseMeasurementScope, requestedClaimFor, claimDiagnostics } from './measurement-scope.js';
import { parseModelIdentities } from './model-identity.js';
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { record, readComponentJson } from './eval-contract.js';
import type { ExperimentSummary } from './experiment-session.js';
import { stoppedAccounting } from './eval-audit.js';
import { triggerMetrics, type TriggerTaskSummary } from './trigger-summary.js';
import type { EvalReportOptions } from './eval-options.js';
import { parseTriggerDetection } from './trigger-detection.js';

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
  if (s.stopCode !== undefined && !['EXECUTION_FAILED', 'FINAL_USAGE_MISSING', 'SPENDING_BUDGET_REACHED'].includes(String(s.stopCode))) throw new Error('Invalid experiment stopCode.');
  return { schemaVersion: 1, status: s.status as ExperimentSummary['status'], plannedCalls: planned, maxCalls: max,
    callsStarted: started, callsFinished: finished, stopReason: s.stopReason as string | null, planSha256: s.planSha256,
    ...(s.stopCode === undefined ? {} : { stopCode: s.stopCode as NonNullable<ExperimentSummary['stopCode']> }) };
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
    return { id: text(task.id, 'task.id'), passes, completed, errors, passRate, difficulty,
      diagnostics: claimDiagnostics(passRate, parseMeasurementScope(value.measurementScope), String(task.id)) };
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
  const metrics = JSON.parse(JSON.stringify(triggerMetrics(rows))) as ReturnType<typeof triggerMetrics>, saved = record(value.metrics, 'trigger metrics');
  // Reuse the frozen formulas and validate recorded fields. Older v1 additions
  // may be absent; intervals can be derived from the retained counts, not new runs.
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
    if (saved[key] !== undefined && !isDeepStrictEqual(saved[key], metrics[key])) throw new Error(`Trigger metrics.${key} disagrees with saved task counts.`);
  }
  for (const key of ['recall', 'falseTriggerRate', 'precision', 'f1', 'positives', 'negatives']) if (saved[key] === undefined) throw new Error(`Missing trigger metrics.${key}.`);
  const skill = record(value.skill, 'trigger skill'), bench = record(value.bench, 'trigger bench');
  if (count(bench.taskCount, 'bench.taskCount') !== rows.length) throw new Error('Trigger bench.taskCount disagrees with tasks.');
  if (value.detection !== undefined && !['skill-tool', 'skill-read', 'unrecorded'].includes(String(value.detection))) throw new Error('Invalid trigger detection.');
  const triggerDetection = parseTriggerDetection(value.triggerDetection);
  if (triggerDetection && value.detection !== (triggerDetection.method === 'skill-file-read-command' ? 'skill-read' : 'skill-tool')) {
    throw new Error('Trigger detection label contradicts its observation protocol.');
  }
  const competition = value.competition === undefined ? null : record(value.competition, 'competition');
  if (competition && competition.mode !== 'alone' && competition.mode !== 'installed') throw new Error('Invalid competition mode.');
  return { trials: repetitions, skillName: text(skill.name, 'skill.name'), benchName: text(bench.name, 'bench.name'),
    detection: value.detection ?? 'unrecorded', triggerDetection, competition: competition?.mode ?? 'unrecorded', tasks: rows, metrics };
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
  const planScope = plan?.details ? record(plan.details, 'native details').measurementScope : undefined;
  const scope = parseMeasurementScope(value?.measurementScope ?? planScope);
  if (planScope !== undefined && value && !isDeepStrictEqual(value.measurementScope, planScope)) throw new Error('measurementScope differs between summary and native plan.');
  if (scope) {
    if (scope.requestedClaim !== requestedClaimFor(mode)) throw new Error('measurementScope contradicts the single-arm mode.');
    if (value) {
      const ids = tasks(value.tasks).map(t => String(t.id)), recorded = scope.taskClaims.map(t => t.taskId);
      if (!isDeepStrictEqual(scope.benchSchemaVersion === 1 && mode === 'trigger' ? recorded.filter(id => ids.includes(id)) : recorded, ids)) throw new Error('measurementScope task IDs/order differ from summary.');
    }
  }
  const base = { schemaVersion: 1 as const, status,
    measurementScope: scope, runGroup: value ? text(value.runGroup, 'runGroup') : basename(root), session,
    agentPreflight: plan?.details ? record(plan.details, 'native plan details').agentPreflight ?? null : null,
    usage,
    ...(value?.modelIdentities === undefined ? {} : { modelIdentities: parseModelIdentities(value.modelIdentities) }),
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

/** Shared async single-arm report reader; only native evidence can be replayed. */
export async function reportSingleArmEvaluation(path: string, options: EvalReportOptions = {}) {
  const report = readSingleArmReport(path);
  if (!report) return null;
  if (options.policyPath || options.recordsPath) throw new Error('Single-arm reports do not support paired --policy or external --records overrides.');
  if (options.benchDir && !options.replay) throw new Error('--bench is only used with --replay for a single-arm report.');
  const input = resolve(path), root = statSync(input).isDirectory() ? input : dirname(input);
  if (!existsSync(join(root, '_plan.json')) || !existsSync(join(root, '_session.json')) || !existsSync(join(root, '_artifacts.json'))) {
    if (options.replay) throw new Error('Offline single-arm replay requires a sealed native run, not a standalone historical summary.');
    return report;
  }
  return { ...report, ...await auditSingleArmEvaluation(root, options) };
}
