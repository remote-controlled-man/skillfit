import type { SpendingStopCode } from '../../agents/call-budget.js';
export interface ExperimentSummary {
  schemaVersion: 1;
  status: 'completed' | 'stopped' | 'incomplete';
  plannedCalls: number;
  maxCalls: number;
  callsStarted: number;
  callsFinished: number;
  stopReason: string | null;
  stopCode?: SpendingStopCode;
  planSha256: string;
}
