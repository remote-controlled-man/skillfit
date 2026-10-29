import { readComponentJson } from "../../shared/read-json.js";
export { readComponentJson } from "../../shared/read-json.js";
import { record, keys, text, numeric, parsePairOrder, parseExecutorTimeoutSeconds, parseAcceptancePolicy, type AcceptancePolicy } from "../measurement/policy.js";
export * from "../measurement/policy.js";

import { dirname, resolve } from 'node:path';
import { getAgent } from "../../agents/matrix.js";
import { RUN_GROUP_PATTERN } from './constants.js';

import type { PairOrder } from "../measurement/paired-contract.js";
import { parseSpendingBudget, type SpendingBudget } from "../execution/budget.js";
import { parseTaskIds } from "../../bench/read.js";

export interface EvalRequest {
  taskIds?: string[];
  schemaVersion: 1;
  baselineSkill: string | null;
  candidateSkill: string;
  bench: string;
  agent: string;
  purpose: 'development' | 'validation';
  pairOrder: PairOrder;
  executorTimeoutSeconds: number | null;
  trials: number;
  maxCalls: number;
  spendingBudget?: SpendingBudget;
  runsRoot: string;
  runGroup: string;
  policy: AcceptancePolicy;
}

export function parseEvalRequest(value: unknown, baseDir: string): EvalRequest {
  const r = record(value, 'request');
  keys(r, ['schemaVersion', 'baselineSkill', 'candidateSkill', 'bench', 'taskIds', 'agent', 'purpose', 'pairOrder', 'executorTimeoutSeconds', 'trials', 'maxCalls', 'spendingBudget', 'runsRoot', 'runGroup', 'policy'], 'request');
  if (r.schemaVersion !== 1) throw new Error('request.schemaVersion must be 1.');
  const agent = text(r.agent, 'request.agent');
  getAgent(agent);
  if (r.purpose !== 'development' && r.purpose !== 'validation') throw new Error('request.purpose must be development or validation.');
  const runGroup = text(r.runGroup, 'request.runGroup');
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error('request.runGroup is invalid.');
  return { schemaVersion: 1,
    baselineSkill: r.baselineSkill === null ? null : resolve(baseDir, text(r.baselineSkill, 'request.baselineSkill (use null for no installed Skill)')),
    candidateSkill: resolve(baseDir, text(r.candidateSkill, 'request.candidateSkill')),
    bench: resolve(baseDir, text(r.bench, 'request.bench')),
    ...(r.taskIds !== undefined ? { taskIds: parseTaskIds(r.taskIds) } : {}),
    agent, purpose: r.purpose, pairOrder: parsePairOrder(r.pairOrder, 'request.pairOrder'),
    executorTimeoutSeconds: parseExecutorTimeoutSeconds(r.executorTimeoutSeconds, 'request.executorTimeoutSeconds'),
    trials: numeric(r.trials, 'request.trials', 1, 20, true),
    maxCalls: numeric(r.maxCalls, 'request.maxCalls', 1, Number.MAX_SAFE_INTEGER, true),
    ...(r.spendingBudget !== undefined ? { spendingBudget: parseSpendingBudget(r.spendingBudget) } : {}),
    runsRoot: resolve(baseDir, text(r.runsRoot, 'request.runsRoot')), runGroup,
    policy: parseAcceptancePolicy(r.policy),
  };
}

export function loadEvalRequest(path: string): { request: EvalRequest; sha256: string } {
  const data = readComponentJson(path);
  return { request: parseEvalRequest(data.value, dirname(resolve(path))), sha256: data.sha256 };
}
