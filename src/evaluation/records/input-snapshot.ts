import { inputDirectories } from "../../shared/input-directories.js";
export { inputDirectories } from "../../shared/input-directories.js";
import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashFileSet, sha256File } from "../../shared/hash.js";
import { packageFiles, packageMember } from "./replay-package.js";

export interface PinnedInput { label: string; root: string; files: string[]; sha256: string; exclude?: string }
interface RequestInput { label: string; path: string; sha256: string }
interface SnapshotEntry { label: string; path: string; files: string[]; directories: string[]; executableFiles: string[]; sha256: string }
export interface InputSnapshot {
  schemaVersion: 1;
  indexPath: '_inputs.json';
  sha256: string;
  cost: { modelCalls: 0; durationMs: number; bytes: number; files: number };
}
interface SnapshotPlan { inputs?: unknown; guardFiles?: unknown; inputSnapshot?: unknown }
export interface VerifiedInputSnapshot { entries: SnapshotEntry[]; roots: Map<string, string> }

const ALIASES = new Map([['bench', 'bench'], ['target', 'target'], ['implementation', 'implementation'], ['baseline Skill', 'baseline-skill']]);
export const INPUT_SNAPSHOT_POLICY = { schemaVersion: 1, required: true, status: 'pending' } as const;

/** Includes empty directories; excludes Git metadata and the current native run. */

function selectedInputs(inputs: unknown): PinnedInput[] {
  assert.ok(Array.isArray(inputs), 'Native input fingerprints are missing.');
  const selected = inputs.filter(input => input && ALIASES.has(input.label)) as PinnedInput[];
  for (const label of ['bench', 'target', 'implementation']) assert.equal(selected.filter(input => input.label === label).length, 1, `Missing or repeated snapshot input: ${label}`);
  assert.equal(new Set(selected.map(input => input.label)).size, selected.length, 'Repeated snapshot input.');
  for (const input of selected) {
    assert.ok(typeof input.root === 'string' && Array.isArray(input.files) && input.files.every(path => typeof path === 'string'));
    assert.deepEqual([...new Set(input.files)].sort(), input.files, 'Snapshot file list must be sorted and unique.');
    assert.match(input.sha256, /^[a-f0-9]{64}$/);
  }
  return selected;
}

function requestInput(guards: unknown): RequestInput | undefined {
  if (guards === undefined) return undefined;
  assert.ok(Array.isArray(guards), 'Invalid native request guards.');
  const requests = guards.filter(file => file?.label === 'component request');
  assert.ok(requests.length <= 1, 'Repeated component request guard.');
  if (requests[0]) {
    assert.equal(typeof requests[0].path, 'string'); assert.match(requests[0].sha256, /^[a-f0-9]{64}$/);
  }
  return requests[0] as RequestInput | undefined;
}

/** Called only in an exclusively claimed fresh run, before publishing _plan.json. */
export function freezeInputSnapshot(run: string, inputs: readonly PinnedInput[], guards: readonly RequestInput[]): InputSnapshot {
  const started = performance.now(), entries: SnapshotEntry[] = [];
  let bytes = 0, files = 0;
  const copy = (source: string, target: string): void => {
    const content = readFileSync(source);
    writeFileSync(target, content, { flag: 'wx' }); chmodSync(target, lstatSync(source).mode & 0o777); bytes += content.length; files++;
  };
  mkdirSync(join(run, '_inputs'));
  for (const input of selectedInputs(inputs)) {
    const label = ALIASES.get(input.label)!, path = `_inputs/${label}`, root = join(run, path);
    const directories = inputDirectories(input.root, input.exclude);
    mkdirSync(root);
    for (const dir of directories) mkdirSync(join(root, dir), { recursive: true });
    for (const file of input.files) {
      const source = packageMember(input.root, file);
      copy(source, join(root, file));
    }
    if (hashFileSet(root, input.files) !== input.sha256) throw new Error(`Input changed while sealing snapshot: ${label}`);
    assert.deepEqual(inputDirectories(input.root, input.exclude), directories, `Input directories changed while sealing snapshot: ${label}`);
    const executableFiles = input.files.filter(file => (lstatSync(join(root, file)).mode & 0o111) !== 0);
    entries.push({ label, path, files: [...input.files], directories, executableFiles, sha256: input.sha256 });
  }
  const request = requestInput(guards);
  if (request) {
    const path = '_inputs/request.json';
    if (!lstatSync(request.path).isFile()) throw new Error('Input request must be a regular file.');
    copy(request.path, join(run, path));
    if (sha256File(join(run, path)) !== request.sha256) throw new Error('Request changed while sealing snapshot.');
    entries.push({ label: 'request', path, files: [], directories: [], executableFiles: [], sha256: request.sha256 });
  }
  writeFileSync(join(run, '_inputs.json'), JSON.stringify({ schemaVersion: 1, kind: 'skillfit.eval-inputs', entries }, null, 2) + '\n', { flag: 'wx' });
  bytes += lstatSync(join(run, '_inputs.json')).size; files++;
  const snapshot: InputSnapshot = { schemaVersion: 1, indexPath: '_inputs.json', sha256: sha256File(join(run, '_inputs.json')),
    cost: { modelCalls: 0, durationMs: Math.round(performance.now() - started), bytes, files } };
  verifyInputSnapshot(run, { inputs, guardFiles: guards, inputSnapshot: snapshot });
  snapshot.cost.durationMs = Math.round(performance.now() - started);
  return snapshot;
}

/** A declared snapshot never falls back to mutable originals when damaged. */
export function verifyInputSnapshot(run: string, plan: SnapshotPlan): VerifiedInputSnapshot | null {
  if (plan.inputSnapshot === undefined) return null; // Historical run: retain the old recovery path.
  const descriptor = plan.inputSnapshot as InputSnapshot;
  assert.ok(descriptor && descriptor.schemaVersion === 1 && descriptor.indexPath === '_inputs.json', 'Invalid input snapshot descriptor.');
  const indexPath = packageMember(run, '_inputs.json');
  assert.equal(sha256File(indexPath), descriptor.sha256, 'Input snapshot index changed.');
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { schemaVersion: number; kind: string; entries: SnapshotEntry[] };
  assert.ok(index.schemaVersion === 1 && index.kind === 'skillfit.eval-inputs' && Array.isArray(index.entries), 'Invalid input snapshot index.');
  const inputs = selectedInputs(plan.inputs), request = requestInput(plan.guardFiles);
  const expectedLabels = [...inputs.map(input => ALIASES.get(input.label)!), ...(request ? ['request'] : [])].sort();
  assert.deepEqual(index.entries.map(entry => entry.label).sort(), expectedLabels, 'Input snapshot coverage changed.');
  assert.ok(lstatSync(join(run, '_inputs')).isDirectory(), 'Input snapshot root must be a regular directory.');
  const expectedFiles: string[] = [], expectedDirectories: string[] = [], roots = new Map<string, string>();
  for (const entry of index.entries) {
    const path = entry.label === 'request' ? '_inputs/request.json' : `_inputs/${entry.label}`;
    assert.equal(entry.path, path, 'Unsafe input snapshot root.');
    if (entry.label === 'request') {
      assert.equal(entry.sha256, request!.sha256); assert.equal(sha256File(packageMember(run, path)), request!.sha256, 'Input request snapshot changed.');
      assert.deepEqual(entry.files, []); assert.deepEqual(entry.directories, []); assert.deepEqual(entry.executableFiles, []);
      expectedFiles.push('request.json'); roots.set(entry.label, join(run, path)); continue;
    }
    const input = inputs.find(input => ALIASES.get(input.label) === entry.label)!;
    assert.deepEqual(entry.files, input.files, 'Input snapshot file coverage changed.'); assert.equal(entry.sha256, input.sha256);
    const root = join(run, path); assert.ok(lstatSync(root).isDirectory(), 'Input snapshot root must be a regular directory.');
    for (const file of entry.files) packageMember(root, file);
    assert.deepEqual(packageFiles(root), entry.files, 'Input snapshot inventory changed.');
    assert.deepEqual(inputDirectories(root), entry.directories, 'Input snapshot directories changed.');
    assert.ok(Array.isArray(entry.executableFiles) && entry.executableFiles.every(file => entry.files.includes(file)), 'Invalid snapshot executable file list.');
    if (process.platform !== 'win32') assert.deepEqual(entry.files.filter(file => (lstatSync(join(root, file)).mode & 0o111) !== 0), entry.executableFiles, 'Input snapshot executable modes changed.');
    assert.equal(hashFileSet(root, entry.files), input.sha256, `Input snapshot hash mismatch: ${entry.label}`);
    expectedFiles.push(...entry.files.map(file => `${entry.label}/${file}`)); roots.set(entry.label, root);
    expectedDirectories.push(entry.label, ...entry.directories.map(dir => `${entry.label}/${dir}`));
  }
  assert.deepEqual(packageFiles(join(run, '_inputs')), expectedFiles.sort(), 'Input snapshot inventory changed.');
  assert.deepEqual(inputDirectories(join(run, '_inputs')), expectedDirectories.sort(), 'Input snapshot directories changed.');
  return { entries: index.entries, roots };
}
