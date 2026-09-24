import { collectReceipts, type AgentReceipt } from '../harness/receipts.js';

export interface ReportOptions {
  agent?: string;
  json?: boolean;
  homeDir?: string;
  log?: (msg: string) => void;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function day(epochMs: number | null): string {
  return epochMs === null ? '—' : new Date(epochMs).toISOString().slice(0, 10);
}

function renderAgent(receipt: AgentReceipt, lines: string[]): void {
  if (!receipt.sessionsDir) {
    lines.push(
      `${receipt.agentId}: skipped — no verified skill-invocation signal in its session format yet`,
    );
    return;
  }
  if (!receipt.present) {
    lines.push(`${receipt.agentId}: no session history found at ${receipt.sessionsDir}`);
    if (receipt.installedCount > 0) {
      lines.push(`  (${receipt.installedCount} skill(s) installed; nothing measured)`);
    }
    return;
  }
  lines.push(
    `${receipt.agentId} — ${receipt.sessionsFound} session(s), ${receipt.transcriptsRead} transcript(s)`,
  );
  if (receipt.skills.length > 0) {
    const nameWidth = Math.max(5, ...receipt.skills.map((s) => s.name.length));
    lines.push(`${pad('  skill', nameWidth + 2)}  FIRES  SESSIONS  LAST SEEN`);
    for (const skill of receipt.skills) {
      lines.push(
        `  ${pad(skill.name, nameWidth)}  ${pad(String(skill.fires), 5)}  ${pad(String(skill.sessionCount), 8)}  ${day(skill.lastSeen)}`,
      );
    }
  } else {
    lines.push('  (no skill invocations found)');
  }
  lines.push(
    `  installed: ${receipt.installedCount}, fired at least once: ${receipt.skills.length}, never fired: ${receipt.neverFired.length}`,
  );
  if (receipt.neverFired.length > 0) {
    lines.push(`  never fired: ${receipt.neverFired.join(', ')}`);
  }
  if (receipt.tax.descTokensTotal > 0) {
    const heaviest = receipt.tax.heaviest
      .map((entry) => `${entry.name} (${entry.descTokens} tok)`)
      .join(', ');
    lines.push(
      `  context tax (estimate): ~${receipt.tax.descTokensTotal.toLocaleString('en-US')} tokens of skill descriptions load into every session; median skill body ~${receipt.tax.bodyTokensMedian.toLocaleString('en-US')} tokens when fired${heaviest ? `; heaviest: ${heaviest}` : ''}`,
    );
  }
}

export function renderReceipts(receipts: AgentReceipt[]): string {
  const lines: string[] = [];
  lines.push('skillfit report — skill usage receipts (read-only; local session history, no model calls)');
  lines.push('');
  for (const receipt of receipts) {
    renderAgent(receipt, lines);
    lines.push('');
  }
  // One population: distinct installed skill names. `installed` was already deduped across agents
  // while `fired` and `never` were per-agent sums, so a skill installed for three agents counted once
  // in the first figure and up to three times in the other two, `fired` could exceed `installed`, and
  // the three numbers never added up. Both are now restricted to the installed set, so
  // installed = fired + never holds exactly, and a skill that fired but has since been uninstalled
  // does not inflate the count.
  const installed = new Set(receipts.flatMap((r) => r.installed));
  const firedNames = new Set(receipts.flatMap((r) => r.skills.map((s) => s.name)));
  const fired = [...installed].filter((name) => firedNames.has(name)).sort();
  const never = [...installed].filter((name) => !firedNames.has(name)).sort();
  lines.push(`Overall: ${installed.size} installed skill(s), ${fired.length} fired at least once, ${never.length} never fired.`);
  if (never.length > 0) {
    lines.push(
      'Skills that never fire are pure routing/context tax. Verify any of them with: skillfit eval <skill> --mode trigger',
    );
  }
  return lines.join('\n');
}

export async function runReport(options: ReportOptions): Promise<AgentReceipt[]> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const receipts = await collectReceipts({ agent: options.agent, homeDir: options.homeDir });
  if (options.json) {
    log(JSON.stringify(receipts, null, 2));
  } else {
    log(renderReceipts(receipts));
  }
  return receipts;
}
