import { applyBenchChange, prepareBenchChange, type BenchManageOptions } from "../bench/authoring.js";
import { join } from 'node:path';
export { inspectBench } from "../bench/authoring.js";
export type { BenchManageOptions } from "../bench/authoring.js";

export function manageBench(options: BenchManageOptions) {
  const change = prepareBenchChange({ operation: options.action, options });
  const result = change.result, changed = result.status !== 'unchanged';
  const log = options.log ?? console.log;
  log(`${options.action === 'edit' ? 'Edit' : 'Unregister'} task ${options.taskId} in ${join(change.dir, 'bench.json')}`);
  log(`Before: ${JSON.stringify(result.before)}`);
  log(`After: ${JSON.stringify(result.after)}`);
  log('Only bench.json changes; task files remain in place.');
  if (options.yes && !options.dryRun && changed) {
    applyBenchChange(change); log(`Applied and verified. Backup: ${result.backup}`);
  } else log(changed ? 'Plan only — re-run with --yes to apply.' : 'No changes needed.');
  return result;
}
