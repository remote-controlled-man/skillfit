import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFileSet, listFilesRecursive, sha256File } from '../../dist/harness/hash.js';
import { nativeDiffDescriptor } from '../../dist/harness/native-diff.js';

// Offline input preparation only. This example never runs an agent or eval.
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && ['--out', '--write'].includes(args[0])),
  'Use --out <fresh-directory-under-runs> for a read-only plan, or --write to prepare');
const destination = resolve(root, args[1] ?? 'runs/native-diff-probe-inputs');
const runs = join(root, 'runs');
assert.equal(dirname(destination), runs, 'Prepare only in a fresh direct child of this checkout\'s runs directory');
if (existsSync(runs)) assert.ok(lstatSync(runs).isDirectory(), 'Runs directory must not be a symlink');
assert.equal(existsSync(destination), false, 'Destination already exists; preserve it and choose a fresh directory');

const sources = {
  baseline: join(root, 'evidence/inputs/diagnosing-bugs'),
  candidate: join(root, 'evidence/inputs/diagnosing-bugs-compact-v4'),
  bench: join(root, 'benches/contrib/oss-skill-followup'),
};
const inventory = directory => {
  const files = listFilesRecursive(directory);
  return { sha256: hashFileSet(directory, files), files: files.map(path => ({ path, sha256: sha256File(join(directory, path)) })) };
};
const sourceInventory = Object.fromEntries(Object.entries(sources).map(([name, directory]) => [name, inventory(directory)]));
const bench = JSON.parse(readFileSync(join(sources.bench, 'bench.json'), 'utf8'));
const tasks = bench.tasks.filter(task => task.id === 'duration-large-digits');
assert.equal(tasks.length, 1);
const request = {
  schemaVersion: 1, baselineSkill: './baseline', candidateSkill: './candidate', bench: './bench',
  agent: 'codex', purpose: 'development', pairOrder: 'balanced', executorTimeoutSeconds: 1200,
  trials: 2, maxCalls: 4, runsRoot: './results', runGroup: 'native-diff-probe-001',
  policy: {
    schemaVersion: 2, objective: 'efficiency', minTasks: 8, minTrialsPerTask: 5,
    minUncachedInputReductionFraction: 0.1, minImprovedTaskFraction: 0.75,
    maxCostIncreaseFraction: { input: 0, cachedInput: 0, uncachedInput: 0, output: 0, durationSeconds: 0.25 },
  },
};
const plan = {
  schemaVersion: 1, kind: 'skillfit.offline-probe-preparation', destination,
  dryRun: args[0] !== '--write', modelCalls: 0, authorizedLiveCalls: 0,
  proposedCallsRequiringFreshAuthorization: 4, task: tasks[0].id,
  nativeDiffTool: nativeDiffDescriptor(), sourceInventory, request,
  limits: ['development only', 'no automatic expansion or upgrade', 'does not isolate the causal effect of the common helper'],
};
console.log(JSON.stringify(plan, null, 2));
if (plan.dryRun) process.exit(0);

mkdirSync(join(root, 'runs'), { recursive: true });
mkdirSync(destination);
const writeJson = (file, value) => {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), value);
};
writeJson(join(destination, 'preparation-plan.json'), plan);
for (const [name, source] of Object.entries(sources)) {
  cpSync(source, join(destination, name), { recursive: true, errorOnExist: true, force: false });
  assert.deepEqual(inventory(join(destination, name)), sourceInventory[name], 'Copied inputs differ');
}
// Keep the full bench assets and oracle checks, but schedule exactly one task.
// The original bench definition is backed up before the local projection.
writeJson(join(destination, 'bench/bench.original.json'), bench);
writeFileSync(join(destination, 'bench/bench.json'), JSON.stringify({ ...bench,
  name: 'native-diff-development-probe',
  description: 'One reused development defect; no independent validation or live-call authorization.', tasks,
}, null, 2) + '\n');
assert.equal(JSON.parse(readFileSync(join(destination, 'bench/bench.json'), 'utf8')).tasks.length, 1);
writeJson(join(destination, 'prepared-inputs.json'), {
  ...Object.fromEntries(Object.keys(sources).map(name => [name, inventory(join(destination, name))])),
  nativeDiffTool: nativeDiffDescriptor(), modelCalls: 0,
});
writeJson(join(destination, 'request.json'), request);
