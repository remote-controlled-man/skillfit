import type { TriggerManifest } from '../evaluation/execution/activation.js';
import { triggerProtocolLine } from '../agents/observation/trigger-contract.js';

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function rateWithCi(
  fired: number,
  runs: number,
  ci: { lo: number; hi: number } | null,
): string {
  if (runs === 0) return 'n/a (no runs)';
  const base = `${fired}/${runs} (${pct(fired / runs)})`;
  return ci ? `${base} [95% CI ${pct(ci.lo)}–${pct(ci.hi)}]` : base;
}

export function renderTriggerSummary(manifest: TriggerManifest, manifestPath: string): string {
  const lines: string[] = [];
  lines.push(`Skill    : ${manifest.skill.name} (injectable bundle sha256 ${manifest.skill.bundleSha256.slice(0, 12)}…, ${manifest.skill.files.length} injectable files)`);
  lines.push(manifest.skill.installedSha256 && manifest.skill.installedFiles
    ? `Installed: sha256 ${manifest.skill.installedSha256.slice(0, 12)}…, ${manifest.skill.installedFiles.length} files (before execution)`
    : 'Installed: not recorded (legacy manifest; injectable hash does not identify all installed resources)');
  lines.push(`Bench    : ${manifest.bench.name} (${manifest.bench.taskCount} task(s), content sha256 ${manifest.bench.contentSha256.slice(0, 12)}…)`);
  lines.push(`Executor : ${manifest.executor.kind} (${manifest.executor.model})${manifest.executor.detail ? ` — ${manifest.executor.detail}` : ''}`);
  lines.push(`Mode     : trigger — skill installed into ${manifest.skillInstallDir}, not injected into the prompt`);
  const competing = manifest.competition?.skills ?? [];
  lines.push(competing.length === 0
    ? 'Compete  : alone (recall is an upper bound)'
    : `Compete  : ${competing.length} other user Skill(s): ${competing.map((skill) => skill.name).join(', ')}`);
  if (manifest.detection === 'skill-read') lines.push('Detect   : SKILL.md read, not a Skill-invocation event');
  lines.push(triggerProtocolLine(manifest.triggerDetection));
  lines.push(`Trials   : ${manifest.trials} per task`);
  lines.push('');
  const idWidth = Math.max(7, ...manifest.tasks.map((t) => t.id.length));
  lines.push(`${pad('TASK', idWidth)}  FIRE?  FIRED    UNKNOWN  ERRORS  PASS`);
  for (const task of manifest.tasks) {
    const total = task.runs + task.unknown + task.errors;
    lines.push(
      `${pad(task.id, idWidth)}  ${pad(task.shouldTrigger ? 'yes' : 'no', 5)}  ${pad(`${task.fired}/${total}`, 8)} ${pad(String(task.unknown), 7)}  ${pad(String(task.errors), 6)}  ${task.passes}/${total}`,
    );
  }
  lines.push('');
  const m = manifest.metrics;
  lines.push(`Trigger recall      : ${rateWithCi(m.positives.fired, m.positives.runs, m.recallCi95)}`);
  for (const name of ['explicit', 'implicit', 'contextual'] as const) {
    const row = m.classRecall?.[name];
    if (row) lines.push(`  ${name.padEnd(18)}: ${rateWithCi(row.fired, row.runs, row.recallCi95)}`);
  }
  lines.push(
    `False-trigger rate  : ${rateWithCi(m.negatives.fired, m.negatives.runs, m.falseTriggerRateCi95)}`,
  );
  const firedTotal = m.positives.fired + m.negatives.fired;
  lines.push(
    `Precision           : ${firedTotal === 0 ? 'n/a (nothing fired)' : rateWithCi(m.positives.fired, firedTotal, m.precisionCi95)}`,
  );
  lines.push(
    `F1                  : ${m.f1 === null ? 'n/a' : `${m.f1.toFixed(2)} (no CI: a harmonic mean of two proportions has no closed-form binomial interval)`}`,
  );
  const tokenLines = manifest.tasks
    .filter((task) => task.tokens !== null)
    .map((task) => {
      const tokens = task.tokens;
      return tokens ? `- ${task.id}: input ${tokens.input}, output ${tokens.output}` : null;
    })
    .filter((line): line is string => line !== null);
  if (tokenLines.length > 0) {
    lines.push('');
    lines.push('Tokens used (per task):');
    lines.push(...tokenLines);
    if (m.tokens) {
      lines.push(`- total: input ${m.tokens.input}, output ${m.tokens.output}`);
    }
  }
  lines.push('');
  lines.push('Warnings:');
  if (manifest.warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of manifest.warnings) lines.push(`- ${warning}`);
  }
  lines.push('');
  lines.push(`Manifest: ${manifestPath}`);
  return lines.join('\n');
}
