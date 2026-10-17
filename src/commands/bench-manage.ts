import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadBench, validateBenchTask } from '../harness/bench.js';
import { resolveBenchDir } from '../harness/bench-location.js';
import { applyBenchWrites } from './bench.js';
import { BACKUP_SUFFIX } from './install.js';

const EDITABLE = ['fixture', 'prompt', 'promptTrigger', 'verifier', 'verifierKind', 'verifierTimeoutSeconds', 'oracle', 'rubric', 'shouldTrigger'] as const;
const OPTIONAL = ['promptTrigger', 'verifierTimeoutSeconds', 'oracle', 'rubric', 'shouldTrigger'] as const;

export function inspectBench(dir: string, taskId?: string) {
  const bench = loadBench(resolveBenchDir(dir));
  const tasks = taskId === undefined ? bench.tasks : bench.tasks.filter(task => task.id === taskId);
  if (!tasks.length) throw new Error(`Unknown task: ${taskId}`);
  return { schemaVersion: 1, kind: taskId === undefined ? 'skillfit.bench-list' : 'skillfit.bench-task',
    dir: bench.dir, name: bench.name, sha256: bench.contentSha256,
    tasks: tasks.map(task => ({ ...task, verifierKind: task.verifierKind ?? 'output', shouldTrigger: task.shouldTrigger ?? null })) };
}

export interface BenchManageOptions {
  dir: string;
  taskId: string;
  action: 'edit' | 'remove';
  set?: string[];
  unset?: string[];
  dryRun?: boolean;
  yes?: boolean;
  log?: (message: string) => void;
}

/** Modify only the registration; shared fixtures, graders and evidence stay in place. */
export function manageBench(options: BenchManageOptions) {
  const dir = resolve(options.dir), path = join(dir, 'bench.json');
  if (lstatSync(path).isSymbolicLink()) throw new Error('Refusing to edit a symlinked bench.json.');
  const before = readFileSync(path, 'utf8');
  const bench = loadBench(dir);
  const manifest = JSON.parse(before) as { tasks: Record<string, unknown>[] };
  const index = manifest.tasks.findIndex(task => task.id === options.taskId);
  if (index < 0) throw new Error(`Unknown task: ${options.taskId}`);
  const original = { ...manifest.tasks[index]! };
  if (options.action === 'remove') {
    if (options.set?.length || options.unset?.length) throw new Error('Removal cannot be combined with --set or --unset.');
    if (manifest.tasks.length === 1) throw new Error('Cannot remove the last task. Add a real task before removing the teaching case.');
    manifest.tasks.splice(index, 1);
  } else {
    if (!options.set?.length && !options.unset?.length) throw new Error('Editing requires --set field=value or --unset field.');
    const next = { ...original }, touched = new Set<string>();
    for (const assignment of options.set ?? []) {
      const at = assignment.indexOf('=');
      if (at < 1) throw new Error(`Invalid --set: ${assignment}; expected field=value.`);
      const field = assignment.slice(0, at), value = assignment.slice(at + 1);
      if (!(EDITABLE as readonly string[]).includes(field)) throw new Error(`Field is not editable: ${field}`);
      if (touched.has(field)) throw new Error(`Repeated edit field: ${field}`);
      touched.add(field);
      if (field === 'shouldTrigger') {
        if (value !== 'true' && value !== 'false') throw new Error('shouldTrigger must be true or false.');
        next[field] = value === 'true';
      } else next[field] = field === 'verifierTimeoutSeconds' ? Number(value) : value;
    }
    for (const field of options.unset ?? []) {
      if (!(OPTIONAL as readonly string[]).includes(field)) throw new Error(`Field cannot be unset: ${field}`);
      if (touched.has(field)) throw new Error(`Repeated edit field: ${field}`);
      touched.add(field); delete next[field];
    }
    validateBenchTask(dir, next, index);
    manifest.tasks[index] = next;
  }
  const after = options.action === 'remove' ? null : manifest.tasks[index]!;
  const changed = JSON.stringify(original) !== JSON.stringify(after);
  const apply = !!options.yes && !options.dryRun && changed;
  const result = { schemaVersion: 1, kind: 'skillfit.bench-change', action: options.action,
    dir, taskId: options.taskId, status: apply ? 'applied' : changed ? 'planned' : 'unchanged',
    before: original, after, filesPreserved: true, backup: path + BACKUP_SUFFIX,
    previousSha256: bench.contentSha256, sha256: bench.contentSha256 };
  const log = options.log ?? console.log;
  log(`${options.action === 'edit' ? 'Edit' : 'Unregister'} task ${options.taskId} in ${path}`);
  log(`Before: ${JSON.stringify(original)}`);
  log(`After: ${JSON.stringify(after)}`);
  log('Only bench.json changes; task files remain in place.');
  if (apply) {
    if (readFileSync(path, 'utf8') !== before) throw new Error('bench.json changed after the plan; nothing written.');
    applyBenchWrites(dir, [{ target: path, content: JSON.stringify(manifest, null, 2) + '\n' }]);
    result.sha256 = loadBench(dir).contentSha256;
    log(`Applied and verified. Backup: ${result.backup}`);
  } else log(changed ? 'Plan only — re-run with --yes to apply.' : 'No changes needed.');
  return result;
}
