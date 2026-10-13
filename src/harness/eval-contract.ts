import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getAgent } from '../agents.js';
import { RUN_GROUP_PATTERN } from './constants.js';
import { DEFAULT_CLI_TIMEOUT_MS } from './executors/cli.js';
import { sha256Text } from './hash.js';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS } from './report.js';
import type { PairOrder } from './types.js';

interface PolicyBase {
  minTasks: number;
  minTrialsPerTask: number;
  maxCostIncreaseFraction: { uncachedInput: number; output: number; durationSeconds: number };
}

export interface QualityPolicy extends PolicyBase {
  schemaVersion: 1;
  minDeltaPassRate: number;
}

export interface EfficiencyPolicy extends PolicyBase {
  schemaVersion: 2;
  objective: 'efficiency';
  minUncachedInputReductionFraction: number;
  minImprovedTaskFraction: number;
  maxCostIncreaseFraction: PolicyBase['maxCostIncreaseFraction'] & { input: number; cachedInput: number };
}

export type AcceptancePolicy = QualityPolicy | EfficiencyPolicy;

export interface EvalRequest {
  schemaVersion: 1;
  baselineSkill: string;
  candidateSkill: string;
  bench: string;
  agent: string;
  purpose: 'development' | 'validation';
  pairOrder: PairOrder;
  executorTimeoutSeconds: number;
  trials: number;
  maxCalls: number;
  runsRoot: string;
  runGroup: string;
  policy: AcceptancePolicy;
}

export interface ComponentMetadata {
  schemaVersion: 1;
  requestSha256: string;
  previewSha256: string;
  implementationSha256: string;
  policySha256: string;
  purpose: EvalRequest['purpose'];
  policy: AcceptancePolicy;
  synthetic: boolean;
}

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unknown = Object.keys(value).filter(k => !allowed.includes(k));
  if (unknown.length) throw new Error(`${label} has unknown fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function numeric(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}.`);
  }
  return value;
}

export function parseAcceptancePolicy(value: unknown = {}): AcceptancePolicy {
  const p = record(value, 'policy');
  if (p.schemaVersion === 2) {
    keys(p, ['schemaVersion', 'objective', 'minTasks', 'minTrialsPerTask', 'minUncachedInputReductionFraction', 'minImprovedTaskFraction', 'maxCostIncreaseFraction'], 'policy');
    if (p.objective !== 'efficiency') throw new Error('policy.objective must be efficiency for schemaVersion 2.');
    const costs = record(p.maxCostIncreaseFraction ?? {}, 'policy.maxCostIncreaseFraction');
    keys(costs, ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds'], 'policy.maxCostIncreaseFraction');
    return {
      schemaVersion: 2, objective: 'efficiency',
      minTasks: numeric(p.minTasks ?? CONCLUSIVE_TASKS, 'policy.minTasks', CONCLUSIVE_TASKS, 10000, true),
      minTrialsPerTask: numeric(p.minTrialsPerTask ?? CONCLUSIVE_TRIALS, 'policy.minTrialsPerTask', CONCLUSIVE_TRIALS, 20, true),
      minUncachedInputReductionFraction: numeric(p.minUncachedInputReductionFraction ?? 0.1, 'policy.minUncachedInputReductionFraction', 0.01, 1),
      minImprovedTaskFraction: numeric(p.minImprovedTaskFraction ?? 0.75, 'policy.minImprovedTaskFraction', 0.75, 1),
      maxCostIncreaseFraction: {
        input: numeric(costs.input ?? 0, 'policy.maxCostIncreaseFraction.input', 0),
        cachedInput: numeric(costs.cachedInput ?? 0, 'policy.maxCostIncreaseFraction.cachedInput', 0),
        uncachedInput: numeric(costs.uncachedInput ?? 0, 'policy.maxCostIncreaseFraction.uncachedInput', 0),
        output: numeric(costs.output ?? 0, 'policy.maxCostIncreaseFraction.output', 0),
        durationSeconds: numeric(costs.durationSeconds ?? 0, 'policy.maxCostIncreaseFraction.durationSeconds', 0),
      },
    };
  }
  // Preserve the exact version-1 normalization and property order: historical
  // policy hashes bind these bytes, not just equivalent field values.
  keys(p, ['schemaVersion', 'minTasks', 'minTrialsPerTask', 'minDeltaPassRate', 'maxCostIncreaseFraction'], 'policy');
  if (p.schemaVersion !== undefined && p.schemaVersion !== 1) throw new Error('policy.schemaVersion must be 1 or 2.');
  const costs = record(p.maxCostIncreaseFraction ?? {}, 'policy.maxCostIncreaseFraction');
  keys(costs, ['uncachedInput', 'output', 'durationSeconds'], 'policy.maxCostIncreaseFraction');
  return {
    schemaVersion: 1,
    minTasks: numeric(p.minTasks ?? CONCLUSIVE_TASKS, 'policy.minTasks', CONCLUSIVE_TASKS, 10000, true),
    minTrialsPerTask: numeric(p.minTrialsPerTask ?? CONCLUSIVE_TRIALS, 'policy.minTrialsPerTask', CONCLUSIVE_TRIALS, 20, true),
    minDeltaPassRate: numeric(p.minDeltaPassRate ?? 0, 'policy.minDeltaPassRate', 0, 1),
    maxCostIncreaseFraction: {
      uncachedInput: numeric(costs.uncachedInput ?? 0, 'policy.maxCostIncreaseFraction.uncachedInput', 0),
      output: numeric(costs.output ?? 0, 'policy.maxCostIncreaseFraction.output', 0),
      durationSeconds: numeric(costs.durationSeconds ?? 0, 'policy.maxCostIncreaseFraction.durationSeconds', 0),
    },
  };
}

export function parseEvalRequest(value: unknown, baseDir: string): EvalRequest {
  const r = record(value, 'request');
  keys(r, ['schemaVersion', 'baselineSkill', 'candidateSkill', 'bench', 'agent', 'purpose', 'pairOrder', 'executorTimeoutSeconds', 'trials', 'maxCalls', 'runsRoot', 'runGroup', 'policy'], 'request');
  if (r.schemaVersion !== 1) throw new Error('request.schemaVersion must be 1.');
  const agent = text(r.agent, 'request.agent');
  getAgent(agent);
  if (r.purpose !== 'development' && r.purpose !== 'validation') throw new Error('request.purpose must be development or validation.');
  if (r.pairOrder !== undefined && r.pairOrder !== 'baseline-first' && r.pairOrder !== 'balanced') throw new Error('request.pairOrder must be baseline-first or balanced.');
  const runGroup = text(r.runGroup, 'request.runGroup');
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error('request.runGroup is invalid.');
  return { schemaVersion: 1,
    baselineSkill: resolve(baseDir, text(r.baselineSkill, 'request.baselineSkill')),
    candidateSkill: resolve(baseDir, text(r.candidateSkill, 'request.candidateSkill')),
    bench: resolve(baseDir, text(r.bench, 'request.bench')),
    agent, purpose: r.purpose, pairOrder: r.pairOrder ?? 'baseline-first',
    executorTimeoutSeconds: numeric(r.executorTimeoutSeconds ?? DEFAULT_CLI_TIMEOUT_MS / 1000, 'request.executorTimeoutSeconds', 1, 3600, true),
    trials: numeric(r.trials, 'request.trials', 1, 20, true),
    maxCalls: numeric(r.maxCalls, 'request.maxCalls', 1, Number.MAX_SAFE_INTEGER, true),
    runsRoot: resolve(baseDir, text(r.runsRoot, 'request.runsRoot')), runGroup,
    policy: parseAcceptancePolicy(r.policy),
  };
}

export function readComponentJson(path: string): { value: unknown; sha256: string } {
  if (statSync(path).size > 16 * 1024 * 1024) throw new Error('Component JSON exceeds 16 MiB.');
  const bytes = readFileSync(path, 'utf8');
  return { value: JSON.parse(bytes) as unknown, sha256: sha256Text(bytes) };
}

export function loadEvalRequest(path: string): { request: EvalRequest; sha256: string } {
  const data = readComponentJson(path);
  return { request: parseEvalRequest(data.value, dirname(resolve(path))), sha256: data.sha256 };
}

export function policyHash(policy: AcceptancePolicy): string { return sha256Text(JSON.stringify(policy)); }
