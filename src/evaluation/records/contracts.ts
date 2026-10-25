export type { ExperimentSummary } from '../measurement/run-state.js';

import type { Bench } from "../../bench/contracts.js";
import type { EvaluationTarget } from "../../resources/contracts.js";

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
  details: Record<string, unknown>;
  guardFiles?: { label: string; path: string; sha256: string }[];
}

export interface EvalReportOptions { policyPath?: string; recordsPath?: string; replay?: boolean; benchDir?: string }
