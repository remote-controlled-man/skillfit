export type BenchClaim = 'quality' | 'efficiency' | 'activation';


export interface BenchTask {
  /** Schema 2 design support; absent in legacy schema 1. */
  claims?: BenchClaim[];
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
