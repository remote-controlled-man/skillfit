import type { MeasurementScope } from "./scope.js";
import type { ModelIdentities } from "../../agents/observation/model-identity.js";
import type { ExperimentSummary } from './run-state.js';
import type { RunCosts } from "./costs.js";
import type { InvocationCosts } from "./invocation-costs.js";
export type Verdict = 'effective' | 'ineffective' | 'inconclusive';
export interface Counts {
  passes: number;
  trials: number;
  errors: number;
  meanScore: number | null;
  tokens: { input: number; output: number } | null;
  tokenCoverage: { input: number; output: number } | null;
  skillReads: { observed: number; unobserved: number; unknown: number } | null;
}
export interface FacetRow {
  name: string;
  baselinePassRate: number;
  treatmentPassRate: number;
  baselineTrials: number;
  treatmentTrials: number;
}
export interface ReportRow {
  costs: RunCosts | null;
  id: string;
  baseline: Counts;
  treatment: Counts;
  deltaPassRate: number;
  verdict: Verdict;
  scoreDelta: number | null;
  facets: FacetRow[];
}
export interface ReportData {
  measurementScope?: MeasurementScope;
  modelIdentities?: ModelIdentities;
  invocationCosts?: InvocationCosts;
  runGroup: string;
  createdAt: string;
  target: { kind: string; name: string; sha256: string };
  baselineTarget: { name: string; sha256: string } | null;
  bench: { name: string; sha256: string; taskCount: number };
  executor: { kind: string; model: string };
  trials: number;
  inputMode: 'snapshot' | 'workspace' | null;
  skillDelivery: { mode: 'installed'; installDir: string } | null;
  experiment: ExperimentSummary | null;
  tasks: ReportRow[];
  overall: ReportRow & {
    verdictReason: string;
    improved: number;
    regressed: number;
    mcnemarP: number;
    deltaCi: { lo: number; hi: number; resamples: number } | null;
    scoreDeltaCi: { lo: number; hi: number; resamples: number } | null;
  };
  warnings: string[];
}
