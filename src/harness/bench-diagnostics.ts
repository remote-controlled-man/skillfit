import type { BenchTask } from './types.js';
import { verdictFromOutput, type VerifierCheck } from './verifier-summary.js';
import { MOCK_MARKER_FILE } from './constants.js';
export interface BenchCheck { status: 'PASS' | 'WARN' | 'FAIL' | 'INFO'; message: string }
type Check = BenchCheck;

const GATES = {
  BENCH_LOAD: [null, 'Fix bench.json and its referenced files, then run bench check again.'],
  UNTOUCHED_FIXTURE: ['verifier', 'Make the verifier executable and ensure the untouched fixture fails for the intended defect.'],
  MISSING_OUTPUT: ['verifier', 'Make the verifier executable and reject a missing _output.md.'],
  EMPTY_OUTPUT: ['verifier', 'Make the verifier executable and reject an empty _output.md.'],
  FACET_COUNT: ['verifier', 'Decompose acceptance into 2–8 deterministic named checks.'],
  ORACLE: ['oracle', 'Inspect the oracle and verifier output; register a reference repair that passes every check.'],
  MOCK_COVERAGE: ['fixture', 'Add a valid .skillfit-mock.json marker for output tasks if mock coverage is needed.'],
  MOCK_MARKER: ['fixture', 'Fix the .skillfit-mock.json file so it contains valid JSON.'],
  MOCK_BASELINE: ['fixture', 'Inspect the baseline mock output and verifier.'],
  MOCK_TREATMENT: ['fixture', 'Inspect the treatment mock output and verifier.'],
  FIXTURE_SIZE: ['fixture', 'Shrink the fixture while preserving the real defect and acceptance checks.'],
  TRIGGER_LABEL: ['shouldTrigger', 'Label trigger tasks and include appropriate negative controls.'],
  NEGATIVE_CONTROLS: ['shouldTrigger', 'Add representative shouldTrigger:false tasks to reach the documented 30% target.'],
  CALIBRATION: [null, 'Inspect the calibration records before considering a separately budgeted run.'],
} as const;

export type BenchCheckCode = keyof typeof GATES;

export interface BenchCheckEvidence {
  command: string;
  exitCode: number | null;
  error: string | null;
  output: string;
  outputTruncated: boolean;
  checks: readonly VerifierCheck[] | null;
}

export interface BenchDiagnostic extends Check {
  code: BenchCheckCode;
  taskId: string | null;
  location: { path: string; field: string | null };
  remediation: string | null;
  evidence: BenchCheckEvidence | null;
}

export interface BenchCheckReport {
  dir: string;
  bench: { name: string; sha256: string; taskCount: number } | null;
  checks: BenchDiagnostic[];
  failures: number;
  warnings: number;
}

export function benchDiagnostic(code: BenchCheckCode, status: Check['status'], message: string,
  task?: BenchTask, evidence: BenchCheckEvidence | null = null): BenchDiagnostic {
  const [field, remediation] = GATES[code];
  const marker = code.startsWith('MOCK_');
  const path = task && field === 'fixture'
    ? `${task.fixture}${marker ? `/${MOCK_MARKER_FILE}` : ''}` : 'bench.json';
  return { code, status, message, taskId: task?.id ?? null,
    location: { path, field: path === 'bench.json' && field ? `tasks[].${field}` : null },
    remediation: status === 'FAIL' || status === 'WARN' ? remediation : null, evidence };
}

/** Bound process text without dropping exit status or individual verifier checks. */
export function benchCheckEvidence(result: { exitCode: number | null; error: string | null; output: string }, command: string): BenchCheckEvidence {
  // Verifier JSON is interpreted consistently with the existing runner.
  return { command, exitCode: result.exitCode, error: result.error,
    output: result.output.slice(-8192), outputTruncated: result.output.length > 8192,
    checks: verdictFromOutput(result.output)?.checks ?? null };
}
