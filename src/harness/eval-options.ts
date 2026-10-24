import type { AcceptancePolicy, ComponentMetadata } from './eval-contract.js';
import type { MeasurementScope } from './measurement-scope.js';
import type { TriggerDetection } from './trigger-detection.js';
import type { NativeDiffDescriptor } from './native-diff.js';
import type { SessionOptions } from './experiment-session.js';
import type { EvaluationTarget, Executor, InputMode, PairOrder } from './types.js';
import type { SpendingBudget } from './eval-budget.js';
import type { AgentEnvironmentPreflight } from './agent-preflight.js';
import type { CASE_PREFLIGHT_POLICY } from './eval-preflight.js';
import type { INPUT_SNAPSHOT_POLICY } from './input-snapshot.js';
import type { EvalRequest } from './eval-contract.js';
import type { ControlSuite } from './bench-controls.js';

export interface EvalPreview {
  measurementScope?: MeasurementScope;
  mode: 'inject' | 'installed' | 'trigger';
  target: { kind: EvaluationTarget['kind']; name: string; sourceDir: string; sha256: string; files: string[] };
  baseline: { name: string; sourceDir: string; sha256: string; files: string[] } | null;
  bench: { name: string; dir: string; sha256: string; taskIds: string[] };
  executor: ReturnType<Executor['describe']> | null;
  judge: ReturnType<Executor['describe']> | null;
  inputMode: InputMode;
  installDir: string | null;
  trials: number;
  plannedCalls: number;
  maxCalls: number;
  outputDir: string;
  casePreflight: typeof CASE_PREFLIGHT_POLICY & { status: 'pending' };
  agentPreflight: AgentEnvironmentPreflight;
  inputSnapshot: typeof INPUT_SNAPSHOT_POLICY;
  pairOrder?: PairOrder;
  executorTimeoutSeconds?: number;
  nativeDiffTool?: NativeDiffDescriptor;
  spendingBudget?: SpendingBudget;
  installedFingerprint?: { sha256: string; files: string[] };
  competition?: { mode: 'alone' | 'installed'; skills: { name: string; sourceDir: string; sha256: string }[] };
  detection?: 'skill-tool' | 'skill-read' | 'unrecorded';
  triggerDetection?: TriggerDetection;
}

export interface EvalOptions {
  /** Internal request policy used before ComponentMetadata exists. */
  policy?: AcceptancePolicy;
  /** A Skill directory or a directory containing skillfit-experiment.json. */
  skillPath: string;
  /** Previous complete Skill version; available only in installed mode. */
  baselineSkillPath?: string;
  bench?: string;
  taskIds?: string[];
  trials?: number;
  pairOrder?: PairOrder;
  executorTimeoutSeconds?: number;
  maxCalls?: number;
  spendingBudget?: SpendingBudget;
  sessionOptions?: Pick<SessionOptions, 'homeDir' | 'env' | 'versionProbe'>;
  agent?: string;
  judgeAgent?: string;
  mode?: 'inject' | 'installed' | 'trigger';
  inputMode?: InputMode;
  dryRun: boolean;
  yes: boolean;
  executor?: Executor;
  judgeExecutor?: Executor | null;
  runsRoot?: string;
  runGroup?: string;
  skillInstallDir?: string;
  /** With trigger mode, copy the user's other matrix user-level Skills into each trial. */
  competeInstalled?: boolean;
  log?: (msg: string) => void;
  onPlan?: (plan: EvalPreview) => void;
  component?: ComponentMetadata;
  reviewedPlan?: ReviewedEvalPlan;
  guardFiles?: SessionOptions['guardFiles'];
  /** Internal offline self-test: retain the first error receipt, then seal a stopped prefix. */
  stopOnExecutionError?: true;
}

export const DEFAULT_EVAL_TRIALS = 5;

export interface ReviewedEvalPlan {
  schemaVersion: 1;
  kind: 'skillfit.eval-plan';
  implementationSha256: string;
  evaluation: EvalPreview;
  sha256: string;
}

/** The discriminator is internal; only fields retain their legacy wire representation. */
export type EvalPlanContext<T extends object = object> = {
  kind: 'legacy' | 'ordinary' | 'component' | 'self-test';
  fields: T;
};
export type ComponentPlanContext = { kind: 'component'; fields: { request: EvalRequest; requestSha256: string; policySha256: string } };
export type SelfTestPlanContext = { kind: 'self-test'; fields: { selfTest: { schemaVersion: number; controlsSha256: string; suite: ControlSuite; stopOnExecutionError: boolean } } };
export interface EvalReportOptions { policyPath?: string; recordsPath?: string; replay?: boolean; benchDir?: string }

export interface ComponentRunOptions {
  dryRun: boolean;
  expectedPlanSha256?: string;
  /** Test-only injection; always synthetic and cannot authorize adoption. */
  executor?: EvalOptions['executor'];
  sessionOptions?: EvalOptions['sessionOptions'];
  skillInstallDir?: string;
  log?: (line: string) => void;
}
