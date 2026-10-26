import { agentIds } from '../agents/matrix.js';
import { collectDoctorReport, type DoctorReport, type CheckStatus } from '../agents/health.js';
export { collectDoctorReport } from '../agents/health.js';
export type { CheckStatus, Check, Section, DetectionEntry, AgentHealthReport, DoctorReport, DoctorOptions } from '../agents/health.js';

export interface RunDoctorArgs {
  agent?: string;
  dryRun?: boolean;
  yes?: boolean;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    'skillfit doctor — read-only configuration health report',
    `home: ${report.homeDir}`,
    `project: ${report.cwd}`,
    '',
    'Agent detection',
    '===============',
  ];
  for (const entry of report.detection) {
    if (entry.detected) {
      lines.push(`[PASS] ${entry.displayName} — detected (${entry.evidence.join('; ')})`);
    } else {
      lines.push(`[INFO] ${entry.displayName} — not detected`);
    }
  }
  for (const agent of report.health) {
    lines.push('', `${agent.displayName} (${agent.id})`, '='.repeat(agent.displayName.length + agent.id.length + 3));
    if (!agent.detected) {
      lines.push('[INFO] agent not detected on this machine — inspected because --agent selected it');
    }
    for (const section of agent.sections) {
      lines.push('', section.title, '-'.repeat(section.title.length));
      for (const item of section.checks) {
        lines.push(`[${item.status}] ${item.message}`);
      }
    }
  }
  const counts: Record<CheckStatus, number> = { PASS: 0, WARN: 0, FAIL: 0, INFO: 0 };
  let total = 0;
  for (const agent of report.health) {
    for (const section of agent.sections) {
      for (const item of section.checks) {
        counts[item.status]++;
        total++;
      }
    }
  }
  const detected = report.detection.filter((entry) => entry.detected).length;
  lines.push(
    '',
    'Summary',
    '=======',
    `${detected}/${report.detection.length} agents detected — ${total} checks: ${counts.PASS} PASS, ${counts.WARN} WARN, ${counts.FAIL} FAIL, ${counts.INFO} INFO`,
    'Findings are advisory: skillfit doctor is read-only and always exits 0.',
  );
  return lines.join('\n');
}

export async function runDoctor(args: RunDoctorArgs = {}): Promise<void> {
  if (args.agent !== undefined && !agentIds().includes(args.agent)) {
    console.error(`Unknown agent "${args.agent}". Known agents: ${agentIds().join(', ')}`);
    // A usage error, not a finding. Findings are advisory and always exit 0, but an unrecognised
    // --agent means the health check never ran, and exiting 0 there lets CI read a typo as a clean
    // bill of health. 2 is this CLI's usage-error code.
    process.exitCode = 2;
    return;
  }
  console.log(formatDoctorReport(collectDoctorReport({ agent: args.agent })));
}
