import { agentIds } from "../agents/matrix.js";
import { collectDoctorReport, type DoctorReport, type CheckStatus } from "../agents/health.js";
export { collectDoctorReport } from "../agents/health.js";
export type {
  CheckStatus,
  Check,
  Section,
  DetectionEntry,
  AgentHealthReport,
  DoctorReport,
  DoctorOptions,
} from "../agents/health.js";

export interface RunDoctorArgs {
  agent?: string;
  dryRun?: boolean;
  yes?: boolean;
  json?: boolean;
  strict?: boolean;
}

interface DoctorSummary {
  agents: { detected: number; total: number };
  checks: { total: number; PASS: number; WARN: number; FAIL: number; INFO: number };
}

function summarizeDoctorReport(report: DoctorReport): DoctorSummary {
  const checks = { total: 0, PASS: 0, WARN: 0, FAIL: 0, INFO: 0 };
  for (const agent of report.health) {
    for (const section of agent.sections) {
      for (const item of section.checks) {
        checks[item.status]++;
        checks.total++;
      }
    }
  }
  return {
    agents: {
      detected: report.detection.filter((entry) => entry.detected).length,
      total: report.detection.length,
    },
    checks,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    "skillfit doctor — read-only configuration health report",
    `home: ${report.homeDir}`,
    `project: ${report.cwd}`,
    "",
    "Agent detection",
    "===============",
  ];
  for (const entry of report.detection) {
    if (entry.detected) {
      lines.push(`[PASS] ${entry.displayName} — detected (${entry.evidence.join("; ")})`);
    } else {
      lines.push(`[INFO] ${entry.displayName} — not detected`);
    }
  }
  for (const agent of report.health) {
    lines.push(
      "",
      `${agent.displayName} (${agent.id})`,
      "=".repeat(agent.displayName.length + agent.id.length + 3),
    );
    if (!agent.detected) {
      lines.push(
        "[INFO] agent not detected on this machine — inspected because --agent selected it",
      );
    }
    for (const section of agent.sections) {
      lines.push("", section.title, "-".repeat(section.title.length));
      for (const item of section.checks) {
        lines.push(`[${item.status}] ${item.message}`);
      }
    }
  }
  const summary = summarizeDoctorReport(report);
  lines.push(
    "",
    "Summary",
    "=======",
    `${summary.agents.detected}/${summary.agents.total} agents detected — ${summary.checks.total} checks: ${summary.checks.PASS} PASS, ${summary.checks.WARN} WARN, ${summary.checks.FAIL} FAIL, ${summary.checks.INFO} INFO`,
    "Findings are advisory by default; skillfit doctor is read-only. Use --strict to exit 1 on FAIL.",
  );
  return lines.join("\n");
}

export function formatDoctorReportJson(report: DoctorReport): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      kind: "skillfit.doctor-report",
      ...report,
      summary: summarizeDoctorReport(report),
    },
    null,
    2,
  );
}

export async function runDoctor(args: RunDoctorArgs = {}): Promise<void> {
  if (args.agent !== undefined && !agentIds().includes(args.agent)) {
    console.error(`Unknown agent "${args.agent}". Known agents: ${agentIds().join(", ")}`);
    // A usage error, not a finding. Findings are advisory by default, but an unrecognised
    // --agent means the health check never ran, and exiting 0 there lets CI read a typo as a clean
    // bill of health. 2 is this CLI's usage-error code.
    process.exitCode = 2;
    return;
  }
  const report = collectDoctorReport({ agent: args.agent });
  if (args.strict && summarizeDoctorReport(report).checks.FAIL > 0) process.exitCode = 1;
  console.log(args.json ? formatDoctorReportJson(report) : formatDoctorReport(report));
}
