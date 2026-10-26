import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256File, sha256Text } from "../../shared/hash.js";
import type { Bench } from "../../bench/contracts.js";

export const NATIVE_DIFF_DIRECTORY = '_skillfit';
export const NATIVE_DIFF_PATH = '_skillfit/native-diff.cjs';
export const NATIVE_DIFF_SNAPSHOT = '_native-diff.cjs';
export const NATIVE_DIFF_SOURCE = `'use strict';
const { spawnSync } = require('node:child_process');
const { resolve, relative, isAbsolute, sep } = require('node:path');
const { existsSync, realpathSync } = require('node:fs');
if (process.argv.length !== 3 || !process.argv[2]) {
  console.error('Usage: node _skillfit/native-diff.cjs <untracked-file>');
  process.exit(2);
}
const file = resolve(process.argv[2]);
const inside = value => { const p = relative(realpathSync(process.cwd()), value); return !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };
if (!inside(existsSync(file) ? realpathSync(file) : file)) {
  console.error('Untracked diff file must stay inside the task workspace.');
  process.exit(2);
}
const child = spawnSync('git', ['diff', '--no-ext-diff', '--no-index', '--', '/dev/null', process.argv[2]], { stdio: 'inherit', shell: false });
if (child.error) { console.error(child.error.message); process.exit(127); }
if (child.signal) process.kill(process.pid, child.signal);
else process.exit(child.status === null ? 1 : child.status);
`;

export function nativeDiffDescriptor() {
  return { id: 'native-untracked-diff' as const, version: 1 as const, path: NATIVE_DIFF_PATH, sha256: sha256Text(NATIVE_DIFF_SOURCE) };
}
export type NativeDiffDescriptor = ReturnType<typeof nativeDiffDescriptor>;
export const NATIVE_DIFF_GUIDANCE = `Common evaluation tool (identical in both conditions):
- To inspect an untracked-file patch, use node ${NATIVE_DIFF_PATH} <file>. It runs native Git without output filtering. A displayed patch may return exit 1; inspect stderr for command errors.
- Keep the supplied helper unchanged. Other checks still use the repository's commands.`;

export function assertNativeDiffFixtures(bench: Bench): void {
  for (const task of bench.tasks) if (existsSync(join(bench.dir, task.fixture, NATIVE_DIFF_DIRECTORY))) {
    throw new Error(`Fixture collides with reserved evaluation tool directory: ${NATIVE_DIFF_DIRECTORY}`);
  }
}

function writeTool(path: string): void {
  if (existsSync(path)) throw new Error('Native diff tool destination already exists: ' + path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, NATIVE_DIFF_SOURCE, { flag: 'wx' });
  assertNativeDiffFile(path);
}
export function snapshotNativeDiffTool(groupDir: string): void { writeTool(join(groupDir, NATIVE_DIFF_SNAPSHOT)); }
export function installNativeDiffTool(workdir: string): void {
  if (existsSync(join(workdir, NATIVE_DIFF_DIRECTORY))) throw new Error('Reserved native diff tool directory already exists.');
  writeTool(join(workdir, NATIVE_DIFF_PATH));
}
export function assertNativeDiffFile(path: string): void {
  if (!existsSync(path) || !lstatSync(path).isFile() || sha256File(path) !== nativeDiffDescriptor().sha256) {
    throw new Error('Frozen native diff tool changed; no further calls.');
  }
}
export function assertNativeDiffWorkspace(workdir: string): void {
  const folder = join(workdir, NATIVE_DIFF_DIRECTORY);
  if (!existsSync(folder) || !lstatSync(folder).isDirectory()) throw new Error('Frozen native diff tool directory changed; no further calls.');
  assertNativeDiffFile(join(workdir, NATIVE_DIFF_PATH));
}
