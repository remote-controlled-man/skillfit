import type { ModelIdentity, ModelIntent } from "./observation/model-identity.js";
import type { ExecutionTiming } from "../shared/timing.js";
import type { TriggerDetection, TriggerEvidence } from "./observation/trigger-contract.js";
export interface TokenUsage {
  input?: number;
  output?: number;
  /** Cache-read input, already included in input; absent means unrecorded. */
  cachedInput?: number;
}


export interface TokenBudgetLimits { input: number; cachedInput: number; uncachedInput: number; output: number }
export interface ExecutorRunOptions { tokenBudget?: TokenBudgetLimits }

export interface ExecutorResult {
  /** An interrupted invocation, never a graded failure or final usage receipt. */
  budgetStop?: 'SPENDING_BUDGET_REACHED';
  modelIdentity?: ModelIdentity;
  output: string;
  tokens?: TokenUsage;
  skillTriggered?: boolean;
  triggerDetection?: TriggerDetection;
  triggerEvidence?: TriggerEvidence;
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
  modelIntent?: ModelIntent;
  modelIdentitySurface?: 'claude-assistant';
  kind: string;
  model: string;
  detail?: string;
  triggerDetection?: TriggerDetection;
  /**
   * Sampling controls actually sent to the model, or null when the surface exposes none. Recorded
   * explicitly so a reader can tell "seeded and reproducible" from "this surface has no knob" —
   * an absent field would be ambiguous between the two.
   */
  sampling?: { seed: number | null; temperature: number | null } | null;
}


export interface Executor {
  readonly supportsLiveTokenBudget?: boolean;
  run(prompt: string, workdir: string, options?: ExecutorRunOptions): Promise<ExecutorResult>;
  describe(): ExecutorDescriptor;
}


/**
 * Record sampling controls explicitly. An executor whose surface exposes no seed or temperature
 * knob reports `sampling: null`, which is a statement about the surface — not an omission that a
 * reader would have to guess at.
 */
export function withSampling(descriptor: ExecutorDescriptor): ExecutorDescriptor {
  return { ...descriptor, sampling: descriptor.sampling ?? null };
}
