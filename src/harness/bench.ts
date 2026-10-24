import { parseBenchClaims } from './measurement-scope.js';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { hashFileSet, listFilesRecursive } from './hash.js';
import type { Bench, BenchTask } from './types.js';
import { parseCommand } from './command.js';
import { parseVerifierTimeoutSeconds } from './verifier-timeout.js';

export const BENCH_SCHEMA_VERSION = 1;
export const BENCH_SCHEMA_VERSIONS = [1, 2] as const;

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface RawBenchFile {
  schemaVersion?: unknown;
  name?: unknown;
  tasks?: unknown;
}

function assertRelativeInside(benchDir: string, rel: string, label: string): string {
  if (rel.split(/[\\/]/).includes('.git')) throw new Error(`${label} cannot reference Git metadata: ${rel}`);
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} must be a relative path inside the bench directory: ${rel}`);
  }
  const abs = resolve(benchDir, rel);
  if (abs !== benchDir && !abs.startsWith(benchDir + sep)) {
    throw new Error(`${label} escapes the bench directory: ${rel}`);
  }
  return abs;
}

function assertCommandTokensExist(benchDir: string, command: string, label: string): void {
  for (const token of parseCommand(command)) {
    if (!token.includes('/') && !token.includes('\\')) continue;
    const tokenAbs = assertRelativeInside(benchDir, token, label);
    if (!existsSync(tokenAbs)) {
      throw new Error(`${label} references a missing file: ${token}`);
    }
  }
}

export function validateBenchTask(benchDir: string, raw: unknown, index: number, schemaVersion = 1): BenchTask {
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
  const claims = schemaVersion === 2 ? parseBenchClaims(task['claims'], `task "${id}" claims`) : undefined;
  if (claims?.includes('activation') && typeof task.shouldTrigger !== 'boolean') throw new Error(`task "${id}" activation claims require a shouldTrigger boolean.`);
  const claimField = claims ? { claims } : {};
  const fixture = task['fixture'] as string;
  const prompt = task['prompt'] as string;
  const verifier = task['verifier'] as string;
  const rubric = task['rubric'];
  const shouldTrigger = task['shouldTrigger'];
  const promptTrigger = task['promptTrigger'];
  const verifierKind = task['verifierKind'];
  if (verifierKind !== undefined && verifierKind !== 'output' && verifierKind !== 'command') {
    throw new Error(
      `bench.json task "${id}" has an invalid "verifierKind" field (expected "output" or "command")`,
    );
  }
  const verifierKindField: { verifierKind?: 'output' | 'command' } =
    verifierKind === undefined ? {} : { verifierKind: verifierKind as 'output' | 'command' };
  const timeoutField = task['verifierTimeoutSeconds'] === undefined ? {} :
    { verifierTimeoutSeconds: parseVerifierTimeoutSeconds(task['verifierTimeoutSeconds']) };
  if (shouldTrigger !== undefined && typeof shouldTrigger !== 'boolean') {
    throw new Error(`bench.json task "${id}" has an invalid "shouldTrigger" field`);
  }
  const triggerClass = task['triggerClass'];
  if (triggerClass !== undefined && triggerClass !== 'explicit' && triggerClass !== 'implicit' && triggerClass !== 'contextual') {
    throw new Error(`bench.json task "${id}" has an invalid "triggerClass" field (expected "explicit", "implicit", or "contextual")`);
  }
  if (triggerClass !== undefined && shouldTrigger !== true) {
    throw new Error(`bench.json task "${id}" sets triggerClass without shouldTrigger: true`);
  }
  const triggerField = {
    ...(shouldTrigger === undefined ? {} : { shouldTrigger }),
    ...(triggerClass === undefined ? {} : { triggerClass: triggerClass as 'explicit' | 'implicit' | 'contextual' }),
  };
  if (promptTrigger !== undefined && (typeof promptTrigger !== 'string' || promptTrigger.trim() === '')) {
    throw new Error(`bench.json task "${id}" has an invalid "promptTrigger" field`);
  }
  const promptTriggerField = promptTrigger === undefined ? {} : { promptTrigger };

  const fixtureAbs = assertRelativeInside(benchDir, fixture, `task "${id}" fixture`);
  if (!existsSync(fixtureAbs) || !statSync(fixtureAbs).isDirectory()) {
    throw new Error(`task "${id}" fixture directory not found: ${fixture}`);
  }
  const promptAbs = assertRelativeInside(benchDir, prompt, `task "${id}" prompt`);
  if (!existsSync(promptAbs) || !statSync(promptAbs).isFile()) {
    throw new Error(`task "${id}" prompt file not found: ${prompt}`);
  }
  if (promptTrigger !== undefined) {
    const promptTriggerAbs = assertRelativeInside(benchDir, promptTrigger, `task "${id}" promptTrigger`);
    if (!existsSync(promptTriggerAbs) || !statSync(promptTriggerAbs).isFile()) {
      throw new Error(`task "${id}" promptTrigger file not found: ${promptTrigger}`);
    }
  }
  assertCommandTokensExist(benchDir, verifier, `task "${id}" verifier`);
  const oracle = task['oracle'];
  if (oracle !== undefined) {
    if (typeof oracle !== 'string' || oracle.trim() === '') {
      throw new Error(`bench.json task "${id}" has an invalid "oracle" field`);
    }
    assertCommandTokensExist(benchDir, oracle, `task "${id}" oracle`);
  }
  const oracleField = oracle === undefined ? {} : { oracle: oracle as string };
  if (rubric !== undefined) {
    if (typeof rubric !== 'string' || rubric.trim() === '') {
      throw new Error(`bench.json task "${id}" has an invalid "rubric" field`);
    }
    const rubricAbs = assertRelativeInside(benchDir, rubric, `task "${id}" rubric`);
    if (!existsSync(rubricAbs) || !statSync(rubricAbs).isFile()) {
      throw new Error(`task "${id}" rubric file not found: ${rubric}`);
    }
    return { ...claimField, id, fixture, prompt, verifier, rubric, ...triggerField, ...promptTriggerField, ...verifierKindField, ...timeoutField, ...oracleField };
  }
  return { ...claimField, id, fixture, prompt, verifier, ...triggerField, ...promptTriggerField, ...verifierKindField, ...timeoutField, ...oracleField };
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
  if (!BENCH_SCHEMA_VERSIONS.includes(raw.schemaVersion as 1 | 2)) {
    throw new Error(
      `Unsupported bench schemaVersion ${String(raw.schemaVersion)} in ${dir} (expected 1 or 2)`,
    );
  }
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
    throw new Error(`bench.json in ${dir} must list at least one task`);
  }
  const tasks = raw.tasks.map((task, index) => validateBenchTask(dir, task, index, raw.schemaVersion as number));
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new Error(`Duplicate task id in bench.json: ${task.id}`);
    }
    seen.add(task.id);
  }
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : basename(dir);
  const contentSha256 = hashFileSet(dir, listFilesRecursive(dir, { excludeGitMetadata: true }));
  return { dir, name, schemaVersion: raw.schemaVersion as number, tasks, contentSha256 };
}

/** Keep manifest order so selecting IDs cannot silently change balanced pair order. */
export function parseTaskIds(value: unknown): string[] {
  const taskIds = value as string[];
  if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.some(id => typeof id !== 'string' || !TASK_ID_PATTERN.test(id))) {
    throw new Error('taskIds must be a nonempty array of valid task IDs.');
  }
  if (new Set(taskIds).size !== taskIds.length) throw new Error('Duplicate task selection.');
  return [...taskIds];
}

export function selectBenchTasks(bench: Bench, selection?: readonly string[]): Bench {
  if (selection === undefined) return bench;
  const taskIds = parseTaskIds(selection);
  const missing = taskIds.filter(id => !bench.tasks.some(task => task.id === id));
  if (missing.length) throw new Error(`Unknown task selection: ${missing.join(', ')}`);
  return { ...bench, tasks: bench.tasks.filter(task => taskIds.includes(task.id)) };
}
