export interface VerifierCheck {
  name: string;
  pass: boolean;
}

export interface VerifierSummary {
  passed: boolean | null;
  checks: VerifierCheck[];
  workflow?: WorkflowSummary;
}

export type CheckStatus = "passed" | "failed" | "unknown";
export interface WorkflowSummary {
  functional: CheckStatus;
  checks: { name: string; status: CheckStatus; detail: string }[];
}

export function workflowStatus({ checks }: WorkflowSummary): CheckStatus {
  if (checks.some((check) => check.status === "failed")) return "failed";
  if (checks.some((check) => check.status === "unknown")) return "unknown";
  return "passed";
}

function checkStatus(value: unknown): value is CheckStatus {
  return value === "passed" || value === "failed" || value === "unknown";
}

function parseWorkflow(value: unknown): WorkflowSummary | undefined {
  if (typeof value !== "object" || value === null) return;
  const { functional, checks } = value as Record<string, unknown>;
  if (!checkStatus(functional) || !Array.isArray(checks) || checks.length === 0) return;
  const normalized: WorkflowSummary["checks"] = [];
  for (const item of checks) {
    if (typeof item !== "object" || item === null) return;
    const { name, status, detail } = item as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !checkStatus(status) ||
      typeof detail !== "string" ||
      !detail.trim()
    )
      return;
    normalized.push({ name, status, detail });
  }
  return { functional, checks: normalized };
}

function parseChecks(raw: unknown): VerifierCheck[] | null {
  if (!Array.isArray(raw)) return null;
  const checks: VerifierCheck[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, pass } = entry as Record<string, unknown>;
    if (typeof name === "string" && name.length > 0 && typeof pass === "boolean") {
      checks.push({ name, pass });
    }
  }
  return checks;
}

function summarize(value: unknown): VerifierSummary | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const passed = typeof obj["passed"] === "boolean" ? obj["passed"] : null;
  const checks = parseChecks(obj["checks"]);
  if (passed === null && checks === null) return null;
  const workflow = parseWorkflow(obj.workflow);
  return { passed, checks: checks ?? [], ...(workflow ? { workflow } : {}) };
}

// The verifier's one-line JSON summary rides on merged stdout+stderr, so scan
// from the end for the last line that parses as a summary object.
export function parseVerifierSummary(output: string): VerifierSummary | null {
  const lines = output.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      const summary = summarize(JSON.parse(line));
      if (summary) return summary;
    } catch {
      continue;
    }
  }
  return null;
}

export function scoreFromChecks(checks: readonly VerifierCheck[]): number | null {
  if (checks.length === 0) return null;
  const passes = checks.filter((check) => check.pass).length;
  return passes / checks.length;
}

export interface VerifierVerdict {
  passed: boolean | null;
  checks: VerifierCheck[] | null;
  score: number | null;
}

export function verdictFromOutput(output: string): VerifierVerdict | null {
  const summary = parseVerifierSummary(output);
  if (!summary) return null;
  return {
    passed: summary.passed,
    checks: summary.checks.length > 0 ? summary.checks : null,
    score: scoreFromChecks(summary.checks),
  };
}
