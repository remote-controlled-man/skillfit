import type { ExecutionTiming } from './execution-timing.js';

export type PairOrder = 'baseline-first' | 'balanced';

/** Keep each pair adjacent; alternate the first arm across both tasks and trials. */
export function pairConditions(order: PairOrder, taskIndex: number, trial: number): readonly Condition[] {
  return order === 'balanced' && (taskIndex + trial - 1) % 2 === 1
    ? ['treatment', 'baseline'] : ['baseline', 'treatment'];
}

export interface TokenUsage {
  input?: number;
  output?: number;
  /** Cache-read input, already included in input; absent means unrecorded. */
  cachedInput?: number;
}

export interface ExecutorResult {
  output: string;
  tokens?: TokenUsage;
  skillTriggered?: boolean;
  rawOutput?: string;
  /** Returned output retained, but input/configuration drift makes this trial ungradable. */
  guardError?: string;
  /** Partial usage is a known lower bound, never a complete final receipt. */
  usageStatus?: 'final' | 'partial';
  /** Public timing diagnostics; neither clock measures billed/active model computation. */
  executionTiming?: ExecutionTiming;
  usageEvidence?: UsageEvidence;
}

export interface UsageEvidence {
  source: 'local-session-token-count';
  threadId: string;
  counterAt: string;
  recordSha256: string;
  tokens: TokenUsage;
  scope: string;
}

/** Retain public output/usage from a failed invocation; guards can refuse before invoking. */
export class ExecutorFailure extends Error {
  constructor(message: string, readonly result: ExecutorResult = { output: '' }, readonly executorInvoked = true) {
    super(message);
    this.name = 'ExecutorFailure';
  }
}

export interface ExecutorDescriptor {
  kind: string;
  model: string;
  detail?: string;
  /**
   * Sampling controls actually sent to the model, or null when the surface exposes none. Recorded
   * explicitly so a reader can tell "seeded and reproducible" from "this surface has no knob" —
   * an absent field would be ambiguous between the two.
   */
  sampling?: { seed: number | null; temperature: number | null } | null;
}

export interface Executor {
  run(prompt: string, workdir: string): Promise<ExecutorResult>;
  describe(): ExecutorDescriptor;
}

export type Condition = 'baseline' | 'treatment';
export type InputMode = 'snapshot' | 'workspace';

export const CONDITIONS: readonly Condition[] = ['baseline', 'treatment'];

export interface BenchTask {
  id: string;
  fixture: string;
  prompt: string;
  promptTrigger?: string;
  verifier: string;
  verifierKind?: 'output' | 'command';
  /** Deadline for each verifier/oracle subprocess; absent means the historical 120 seconds. */
  verifierTimeoutSeconds?: number;
  oracle?: string;
  rubric?: string;
  shouldTrigger?: boolean;
  /** How a positive trigger task is phrased. Absent tasks stay in the pooled recall. */
  triggerClass?: 'explicit' | 'implicit' | 'contextual';
}

export interface Bench {
  dir: string;
  name: string;
  schemaVersion: number;
  tasks: BenchTask[];
  contentSha256: string;
}

export interface SkillBundle {
  kind: 'skill';
  name: string;
  sourceDir: string;
  files: string[];
  sha256: string;
  payload: string;
  overlays: Partial<Record<Condition, string>>;
}

export type EvaluationTargetKind = 'skill' | 'rules' | 'mcp';

/**
 * The one variable changed between paired experiment arms.
 *
 * Skills are injected into the treatment prompt. Rules and MCP targets are installed as project
 * files in the run workspace so the agent encounters them through its real configuration loader.
 */
export interface EvaluationTarget {
  kind: EvaluationTargetKind;
  name: string;
  sourceDir: string;
  files: string[];
  sha256: string;
  payload: string | null;
  overlays: Partial<Record<Condition, string>>;
}
