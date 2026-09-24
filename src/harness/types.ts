export interface TokenUsage {
  input?: number;
  output?: number;
}

export interface ExecutorResult {
  output: string;
  tokens?: TokenUsage;
  skillTriggered?: boolean;
  rawOutput?: string;
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

export const CONDITIONS: readonly Condition[] = ['baseline', 'treatment'];

export interface BenchTask {
  id: string;
  fixture: string;
  prompt: string;
  promptTrigger?: string;
  verifier: string;
  verifierKind?: 'output' | 'command';
  oracle?: string;
  rubric?: string;
  shouldTrigger?: boolean;
}

export interface Bench {
  dir: string;
  name: string;
  schemaVersion: number;
  tasks: BenchTask[];
  contentSha256: string;
}

export interface SkillBundle {
  name: string;
  sourceDir: string;
  files: string[];
  sha256: string;
  payload: string;
}
