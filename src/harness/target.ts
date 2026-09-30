import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { collectSkillBundle } from './bundle.js';
import { hashFileSet, listFilesRecursive } from './hash.js';
import type { Condition, EvaluationTarget, EvaluationTargetKind } from './types.js';

export const EXPERIMENT_FILE = 'skillfit-experiment.json';

interface ExperimentFile {
  schemaVersion: number;
  name?: string;
  kind: EvaluationTargetKind;
  baseline?: string;
  treatment: string;
}

function parseExperimentFile(path: string): ExperimentFile {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid ${EXPERIMENT_FILE}: ${(error as Error).message}`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${EXPERIMENT_FILE} must contain a JSON object`);
  }
  const record = value as Record<string, unknown>;
  if (record['schemaVersion'] !== 1) {
    throw new Error(`${EXPERIMENT_FILE} schemaVersion must be 1`);
  }
  if (record['kind'] !== 'rules' && record['kind'] !== 'mcp') {
    throw new Error(`${EXPERIMENT_FILE} kind must be "rules" or "mcp"`);
  }
  if (typeof record['treatment'] !== 'string' || record['treatment'].trim() === '') {
    throw new Error(`${EXPERIMENT_FILE} treatment must name a non-empty overlay directory`);
  }
  if (record['baseline'] !== undefined && (typeof record['baseline'] !== 'string' || record['baseline'].trim() === '')) {
    throw new Error(`${EXPERIMENT_FILE} baseline must be a non-empty overlay directory when present`);
  }
  if (record['name'] !== undefined && (typeof record['name'] !== 'string' || record['name'].trim() === '')) {
    throw new Error(`${EXPERIMENT_FILE} name must be a non-empty string when present`);
  }
  return record as unknown as ExperimentFile;
}

function resolveOverlay(root: string, value: string, label: Condition): string {
  if (isAbsolute(value)) {
    throw new Error(`${EXPERIMENT_FILE} ${label} must be relative to the experiment directory`);
  }
  const path = resolve(root, value);
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${EXPERIMENT_FILE} ${label} escapes the experiment directory`);
  }
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`${EXPERIMENT_FILE} ${label} overlay is not a directory: ${path}`);
  }
  const realRoot = realpathSync(root);
  const realPath = realpathSync(path);
  const realRel = relative(realRoot, realPath);
  if (realRel === '' || realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) {
    throw new Error(`${EXPERIMENT_FILE} ${label} escapes or aliases the experiment directory`);
  }
  return path;
}

export function collectEvaluationTarget(targetPath: string): EvaluationTarget {
  const sourceDir = resolve(targetPath);
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Evaluation target is not a directory: ${sourceDir}`);
  }
  const manifestPath = join(sourceDir, EXPERIMENT_FILE);
  if (!existsSync(manifestPath)) {
    return collectSkillBundle(sourceDir);
  }

  const spec = parseExperimentFile(manifestPath);
  const treatmentOverlay = resolveOverlay(sourceDir, spec.treatment, 'treatment');
  const overlays: Partial<Record<Condition, string>> = { treatment: treatmentOverlay };
  if (spec.baseline) overlays.baseline = resolveOverlay(sourceDir, spec.baseline, 'baseline');

  const prefixedFiles = [EXPERIMENT_FILE];
  for (const condition of ['baseline', 'treatment'] as const) {
    const overlay = overlays[condition];
    if (!overlay) continue;
    const prefix = relative(sourceDir, overlay).split(sep).join('/');
    for (const file of listFilesRecursive(overlay)) prefixedFiles.push(`${prefix}/${file}`);
  }
  if (listFilesRecursive(treatmentOverlay).length === 0) {
    throw new Error(`${EXPERIMENT_FILE} treatment overlay must contain at least one file`);
  }

  return {
    kind: spec.kind,
    name: spec.name?.trim() || basename(sourceDir),
    sourceDir,
    files: prefixedFiles.sort(),
    sha256: hashFileSet(sourceDir, prefixedFiles),
    payload: null,
    overlays,
  };
}
