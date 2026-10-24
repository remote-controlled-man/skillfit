import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, win32 } from 'node:path';
import { getAgent } from '../agents.js';
import { parseTaskIds } from './bench.js';
import { RUN_GROUP_PATTERN } from './constants.js';
import { record, readComponentJson } from './eval-contract.js';
import { inputDirectories } from './input-snapshot.js';
import type { Bench, Condition } from './types.js';
import type { Verdict } from './report.js';

export type ControlAction = { kind: 'output-file'; path: string } | { kind: 'fixture' | 'oracle' }
  | { kind: 'error'; code: 'SIMULATED_EXECUTOR_FAILURE' };
export interface ControlCounts { graded: number; passes: number; errors: number }
export interface ControlExpected {
  status: 'completed' | 'stopped';
  statisticalVerdict: Verdict | null;
  mcnemarPRange?: { minInclusive: number; maxExclusive: number };
  errorCode?: 'SIMULATED_EXECUTOR_FAILURE';
  tasks: { taskId: string; baseline: ControlCounts; treatment: ControlCounts }[];
}
export interface ControlSuite {
  id: string;
  purpose: 'benefit' | 'harm' | 'null' | 'error' | 'custom';
  mode: 'inject' | 'installed';
  agent: string | null;
  taskIds: string[];
  trials: number;
  arms: Record<string, Record<Condition, ControlAction>>;
  expected: ControlExpected;
}

function fields(value: Record<string, unknown>, allowed: string[], label: string): void {
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} has unknown fields: ${extra.join(', ')}.`);
}
function integer(value: unknown, label: string, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label} must be an integer between 0 and ${max}.`);
  return value;
}

/** Resolve only ordinary bench members, checking every component before reading bytes. */
export function controlFile(benchDir: string, value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('\0') || isAbsolute(value) || win32.parse(value).root ||
      value.split(/[\\/]/).some(part => !part || part === '..' || part === '.git')) {
    throw new Error('Control paths must be relative files inside the bench, without links, traversal or Git metadata.');
  }
  let path = realpathSync(benchDir);
  for (const part of value.split(/[\\/]/)) {
    if (part === '.') continue;
    path = join(path, part);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Control paths cannot contain symbolic links: ${value}`);
  }
  if (!lstatSync(path).isFile()) throw new Error(`Control resource must be an ordinary file: ${value}`);
  return path;
}

function action(value: unknown, bench: Bench, taskId: string): ControlAction {
  const a = record(value, `${taskId} action`), task = bench.tasks.find(t => t.id === taskId)!;
  if (a.kind === 'output-file') {
    fields(a, ['kind', 'path'], 'output-file action');
    if ((task.verifierKind ?? 'output') !== 'output') throw new Error('output-file requires an output task.');
    const file = controlFile(bench.dir, a.path);
    // TextDecoder rejects invalid UTF-8 instead of silently replacing source bytes.
    new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
    return { kind: 'output-file', path: a.path as string };
  }
  if (a.kind === 'fixture' || a.kind === 'oracle') {
    fields(a, ['kind'], `${a.kind} action`);
    if (task.verifierKind !== 'command') throw new Error(`${a.kind} requires a command task.`);
    if (a.kind === 'oracle' && !task.oracle) throw new Error(`oracle action needs a registered oracle: ${taskId}`);
    return { kind: a.kind };
  }
  if (a.kind === 'error') {
    fields(a, ['kind', 'code'], 'error action');
    if (a.code !== 'SIMULATED_EXECUTOR_FAILURE') throw new Error('Unsupported synthetic error code.');
    return { kind: 'error', code: a.code };
  }
  throw new Error(`Unsupported control action: ${String(a.kind)}`);
}

function expected(value: unknown, taskIds: string[], trials: number): ControlExpected {
  const e = record(value, 'expected');
  fields(e, ['status', 'statisticalVerdict', 'mcnemarPRange', 'errorCode', 'tasks'], 'expected');
  if (e.status !== 'completed' && e.status !== 'stopped') throw new Error('expected.status must be completed or stopped.');
  if (e.status === 'stopped' ? e.statisticalVerdict !== null : typeof e.statisticalVerdict !== 'string' || !['effective', 'ineffective', 'inconclusive'].includes(e.statisticalVerdict)) {
    throw new Error('expected.statisticalVerdict must be null for stopped suites and a verdict for completed suites.');
  }
  if (!Array.isArray(e.tasks) || e.tasks.length !== taskIds.length) throw new Error('expected.tasks must list every selected task exactly once.');
  const rows = e.tasks.map(row => {
    const t = record(row, 'expected task'); fields(t, ['taskId', 'baseline', 'treatment'], 'expected task');
    if (typeof t.taskId !== 'string' || !taskIds.includes(t.taskId)) throw new Error('Unknown expected task.');
    const counts = (arm: Condition): ControlCounts => {
      const c = record(t[arm], `expected ${arm}`); fields(c, ['graded', 'passes', 'errors'], 'expected counts');
      const graded = integer(c.graded, 'graded', trials), passes = integer(c.passes, 'passes', graded), errors = integer(c.errors, 'errors', trials - graded);
      if (e.status === 'completed' && (graded !== trials || errors !== 0)) throw new Error('Completed controls require all trials graded without execution errors.');
      return { graded, passes, errors };
    };
    return { taskId: t.taskId, baseline: counts('baseline'), treatment: counts('treatment') };
  });
  if (new Set(rows.map(t => t.taskId)).size !== taskIds.length) throw new Error('Duplicate expected task.');
  let range: ControlExpected['mcnemarPRange'];
  if (e.mcnemarPRange !== undefined) {
    if (e.status === 'stopped') throw new Error('Stopped controls cannot declare a p range.');
    const r = record(e.mcnemarPRange, 'p range'); fields(r, ['minInclusive', 'maxExclusive'], 'p range');
    const min = r.minInclusive, max = r.maxExclusive;
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) ||
        min < 0 || min > 1 || max <= min || max > 1 + Number.EPSILON) throw new Error('Invalid inclusive/exclusive p range.');
    range = { minInclusive: min, maxExclusive: max };
  }
  if (e.errorCode !== undefined && (e.status !== 'stopped' || e.errorCode !== 'SIMULATED_EXECUTOR_FAILURE')) throw new Error('expected.errorCode requires a supported stopped error.');
  return { status: e.status, statisticalVerdict: e.statisticalVerdict as Verdict | null,
    ...(range ? { mcnemarPRange: range } : {}), ...(e.errorCode ? { errorCode: e.errorCode as 'SIMULATED_EXECUTOR_FAILURE' } : {}),
    tasks: taskIds.map(id => rows.find(t => t.taskId === id)!) };
}

export function loadBenchControls(bench: Bench, file = 'controls.json') {
  // Preview validates sealability without running a verifier, oracle or executor.
  inputDirectories(bench.dir);
  const path = controlFile(bench.dir, file), data = readComponentJson(path), raw = record(data.value, 'controls');
  fields(raw, ['schemaVersion', 'suites'], 'controls');
  if (raw.schemaVersion !== 1) throw new Error('Unsupported controls schemaVersion; expected 1.');
  if (!Array.isArray(raw.suites) || !raw.suites.length) throw new Error('controls.suites must be nonempty.');
  const suites: ControlSuite[] = raw.suites.map(value => {
    const s = record(value, 'suite'); fields(s, ['id', 'purpose', 'mode', 'agent', 'taskIds', 'trials', 'arms', 'expected'], 'suite');
    if (typeof s.id !== 'string' || !RUN_GROUP_PATTERN.test(s.id)) throw new Error('Invalid suite id.');
    if (typeof s.purpose !== 'string' || !['benefit', 'harm', 'null', 'error', 'custom'].includes(s.purpose)) throw new Error('Unsupported suite purpose.');
    if (s.mode !== 'inject' && s.mode !== 'installed') throw new Error('Unsupported self-test mode; only inject and installed are supported; trigger/rules/MCP/judge/drafting are unsupported.');
    if (s.mode === 'inject' ? s.agent !== null : typeof s.agent !== 'string' || !s.agent) throw new Error('suite.agent must be null for inject or a matrix agent for installed.');
    if (s.mode === 'installed' && !getAgent(s.agent as string).skills.projectDirs.length) throw new Error('Installed control needs a matrix Skill layout.');
    const selected = parseTaskIds(s.taskIds);
    if (selected.some(id => !bench.tasks.some(t => t.id === id))) throw new Error('Unknown control task.');
    const taskIds = bench.tasks.filter(t => selected.includes(t.id)).map(t => t.id);
    const trials = integer(s.trials, 'suite.trials', 20); if (!trials) throw new Error('suite.trials must be at least 1.');
    const arms = record(s.arms, 'suite arms'); fields(arms, taskIds, 'suite arms');
    const parsed = Object.fromEntries(taskIds.map(id => {
      const a = record(Object.hasOwn(arms, id) ? arms[id] : undefined, `${id} arms`); fields(a, ['baseline', 'treatment'], `${id} arms`);
      return [id, { baseline: action(a.baseline, bench, id), treatment: action(a.treatment, bench, id) }];
    }));
    return { id: s.id, purpose: s.purpose as ControlSuite['purpose'], mode: s.mode, agent: s.agent as string | null, taskIds, trials,
      arms: parsed, expected: expected(s.expected, taskIds, trials) };
  });
  if (new Set(suites.map(s => s.id)).size !== suites.length) throw new Error('Duplicate suite id.');
  return { schemaVersion: 1 as const, suites, path, sha256: data.sha256 };
}

export function selectControlSuites(suites: ControlSuite[], ids?: string[]): ControlSuite[] {
  if (ids === undefined) return suites;
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !suites.some(s => s.id === id))) throw new Error('Unknown, empty or duplicate suite selection.');
  return suites.filter(s => ids.includes(s.id));
}
