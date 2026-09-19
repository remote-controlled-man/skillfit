import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { hashFileSet, listFilesRecursive } from './hash.js';
import type { Bench, BenchTask } from './types.js';

export const BENCH_SCHEMA_VERSION = 1;

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface RawBenchFile {
  schemaVersion?: unknown;
  name?: unknown;
  tasks?: unknown;
}

function assertRelativeInside(benchDir: string, rel: string, label: string): string {
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} must be a relative path inside the bench directory: ${rel}`);
  }
  const abs = resolve(benchDir, rel);
  if (abs !== benchDir && !abs.startsWith(benchDir + sep)) {
    throw new Error(`${label} escapes the bench directory: ${rel}`);
  }
  return abs;
}

function validateTask(benchDir: string, raw: unknown, index: number): BenchTask {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`bench.json task #${index + 1} must be an object`);
  }
  const task = raw as Record<string, unknown>;
  const id = task['id'];
  if (typeof id !== 'string' || !TASK_ID_PATTERN.test(id)) {
    throw new Error(`bench.json task #${index + 1} has an invalid id (expected ${TASK_ID_PATTERN})`);
  }
  for (const field of ['fixture', 'prompt', 'verifier'] as const) {
    if (typeof task[field] !== 'string' || (task[field] as string).trim() === '') {
      throw new Error(`bench.json task "${id}" is missing a non-empty "${field}" field`);
    }
  }
  const fixture = task['fixture'] as string;
  const prompt = task['prompt'] as string;
  const verifier = task['verifier'] as string;
  const rubric = task['rubric'];
  const shouldTrigger = task['shouldTrigger'];
  if (shouldTrigger !== undefined && typeof shouldTrigger !== 'boolean') {
    throw new Error(`bench.json task "${id}" has an invalid "shouldTrigger" field`);
  }
  const triggerField = shouldTrigger === undefined ? {} : { shouldTrigger };

  const fixtureAbs = assertRelativeInside(benchDir, fixture, `task "${id}" fixture`);
  if (!existsSync(fixtureAbs) || !statSync(fixtureAbs).isDirectory()) {
    throw new Error(`task "${id}" fixture directory not found: ${fixture}`);
  }
  const promptAbs = assertRelativeInside(benchDir, prompt, `task "${id}" prompt`);
  if (!existsSync(promptAbs) || !statSync(promptAbs).isFile()) {
    throw new Error(`task "${id}" prompt file not found: ${prompt}`);
  }
  for (const token of verifier.split(/\s+/).filter(Boolean)) {
    if (!token.includes('/') && !token.includes('\\')) continue;
    const tokenAbs = assertRelativeInside(benchDir, token, `task "${id}" verifier`);
    if (!existsSync(tokenAbs)) {
      throw new Error(`task "${id}" verifier references a missing file: ${token}`);
    }
  }
  if (rubric !== undefined) {
    if (typeof rubric !== 'string' || rubric.trim() === '') {
      throw new Error(`bench.json task "${id}" has an invalid "rubric" field`);
    }
    const rubricAbs = assertRelativeInside(benchDir, rubric, `task "${id}" rubric`);
    if (!existsSync(rubricAbs) || !statSync(rubricAbs).isFile()) {
      throw new Error(`task "${id}" rubric file not found: ${rubric}`);
    }
    return { id, fixture, prompt, verifier, rubric, ...triggerField };
  }
  return { id, fixture, prompt, verifier, ...triggerField };
}

export function loadBench(benchDir: string): Bench {
  const dir = resolve(benchDir);
  const benchJsonPath = join(dir, 'bench.json');
  if (!existsSync(benchJsonPath)) {
    throw new Error(`Not a bench directory (missing bench.json): ${dir}`);
  }
  let raw: RawBenchFile;
  try {
    raw = JSON.parse(readFileSync(benchJsonPath, 'utf8')) as RawBenchFile;
  } catch (error) {
    throw new Error(`Invalid bench.json in ${dir}: ${(error as Error).message}`);
  }
  if (raw.schemaVersion !== BENCH_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported bench schemaVersion ${String(raw.schemaVersion)} in ${dir} (expected ${BENCH_SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
    throw new Error(`bench.json in ${dir} must list at least one task`);
  }
  const tasks = raw.tasks.map((task, index) => validateTask(dir, task, index));
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new Error(`Duplicate task id in bench.json: ${task.id}`);
    }
    seen.add(task.id);
  }
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : basename(dir);
  const contentSha256 = hashFileSet(dir, listFilesRecursive(dir));
  return { dir, name, schemaVersion: BENCH_SCHEMA_VERSION, tasks, contentSha256 };
}
