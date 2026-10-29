export type { ExperimentSummary } from '../measurement/run-state.js';

import type { Bench } from "../../bench/contracts.js";
import type { EvaluationTarget } from "../../resources/contracts.js";

import type { ExecutorDescriptor } from '../../agents/contracts.js';
import type { AgentEnvironmentPreflight } from '../../agents/preflight-contract.js';
import type { TriggerDetection } from '../../agents/observation/trigger-contract.js';
import type { SpendingBudget } from '../../agents/call-budget.js';
import type { PairOrder, InputMode } from '../measurement/paired-contract.js';
import type { MeasurementScope } from '../measurement/scope.js';
import type { ComponentMetadata } from '../measurement/policy.js';
import type { NativeDiffDescriptor } from '../targets/native-diff.js';
import type { CasePreflight } from '../application/preflight-error.js';
import { parseAcceptancePolicy } from '../measurement/policy.js';
import { record, keys } from '../../shared/json.js';

/** Current writer contract; legacy readers continue to accept their recorded formats. */
export interface SessionDetails {
  mode: 'inject' | 'installed' | 'trigger' | 'calibration';
  measurementScope?: MeasurementScope;
  inputMode?: InputMode;
  trials?: number;
  executor?: ExecutorDescriptor;
  judge?: ExecutorDescriptor | null;
  executorTimeoutSeconds?: number | null;
  spendingBudget?: SpendingBudget;
  taskIds?: string[];
  agentPreflight?: AgentEnvironmentPreflight;
  casePreflight?: CasePreflight;
  pairOrder?: PairOrder;
  skillInstallDir?: string;
  competition?: { mode: 'alone' | 'installed'; skills: { name: string; sourceDir: string; sha256: string }[] };
  detection?: 'skill-tool' | 'skill-read' | 'unrecorded';
  triggerDetection?: TriggerDetection;
  stopOnExecutionError?: boolean;
  reviewedPlan?: { implementationSha256: string };
  component?: ComponentMetadata;
  nativeDiffTool?: NativeDiffDescriptor;
  baselineTarget?: { name: string; sourceDir: string; bundleSha256: string; files: string[] };
}

/** Validate behavior-driving fields before any filesystem mutation or process probe. */
export function assertSessionDetails(details: SessionDetails): void {
  const value = record(details, 'Session details');
  keys(value, ['mode', 'measurementScope', 'inputMode', 'trials', 'executor', 'judge',
    'executorTimeoutSeconds', 'spendingBudget', 'taskIds', 'agentPreflight', 'casePreflight',
    'pairOrder', 'skillInstallDir', 'competition', 'detection', 'triggerDetection',
    'stopOnExecutionError', 'reviewedPlan', 'component', 'nativeDiffTool', 'baselineTarget'], 'Session details');
  if (!['inject', 'installed', 'trigger', 'calibration'].includes(value.mode as string)) throw new Error('Session details.mode is unsupported.');
  if (value.stopOnExecutionError !== undefined && typeof value.stopOnExecutionError !== 'boolean') throw new Error('Session details.stopOnExecutionError must be boolean.');
  for (const key of ['component', 'reviewedPlan'] as const) if (value[key] !== undefined) {
    const metadata = record(value[key], `Session details.${key}`);
    if (typeof metadata.implementationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.implementationSha256)) throw new Error(`Session details.${key} requires an implementationSha256.`);
    if (key === 'component') {
      if (metadata.schemaVersion !== 1) throw new Error('Session details.component.schemaVersion must be 1.');
      try { parseAcceptancePolicy(record(metadata.policy, 'Session details.component.policy')); }
      catch { throw new Error('Session details.component.policy is invalid.'); }
    }
  }
  if (value.nativeDiffTool !== undefined) {
    const descriptor = record(value.nativeDiffTool, 'Session details.nativeDiffTool');
    if (descriptor.id !== 'native-untracked-diff' || descriptor.version !== 1 ||
        typeof descriptor.path !== 'string' || typeof descriptor.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
      throw new Error('Session details.nativeDiffTool is invalid.');
    }
  }
}

export interface SessionOptions {
  bench: Bench;
  target: EvaluationTarget;
  baselineTarget?: EvaluationTarget;
  groupDir: string;
  workspaces: string[];
  plannedCalls: number;
  maxCalls?: number;
  agent?: string;
  injected?: boolean;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  versionProbe?: (argv: string[]) => string | null;
  details: SessionDetails;
  guardFiles?: { label: string; path: string; sha256: string }[];
}

export interface EvalReportOptions { policyPath?: string; recordsPath?: string; replay?: boolean; benchDir?: string }
