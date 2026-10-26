import { measurementScopeText } from "../evaluation/measurement/scope.js";
import { renderModelIdentityLines } from "../agents/observation/model-identity.js";
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEvaluationReport } from "./evaluation-report.js";
import type { EvalReportOptions } from "./eval-component.js";
import { agentEnvironmentReportLines } from "../agents/preflight-contract.js";
import { renderSingleArmReport } from "./eval-single-arm-report.js";
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS, formatP, formatPp1 } from "../evaluation/measurement/report.js";
import { renderCostLines } from "../evaluation/measurement/costs.js";
import { renderInvocationCostLines } from "../evaluation/measurement/invocation-costs.js";
import { parseEvalReport, type Counts, type ReportRow, type ReportData } from "../evaluation/records/manifest.js";
export { parseEvalReport } from "../evaluation/records/manifest.js";

const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;

function escapeMarkdown(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('*', '\\*')
    .replaceAll('_', '\\_').replaceAll('[', '\\[').replaceAll(']', '\\]')
    .replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
}

function passRate(value: Counts): string {
  return `${value.passes}/${value.trials} (${value.trials === 0 ? 'n/a' : `${Math.round(100 * value.passes / value.trials)}%`})`;
}

function tableRow(value: ReportRow): string {
  return `| ${escapeMarkdown(value.id)} | ${passRate(value.baseline)} | ${passRate(value.treatment)} | ${value.baseline.errors}/${value.treatment.errors} | ${formatPp1(value.deltaPassRate)} | ${value.verdict} |`;
}

function score(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function replicatedTaskCount(report: ReportData): number {
  return report.tasks.filter(t => Math.min(t.baseline.trials, t.treatment.trials) >= CONCLUSIVE_TRIALS).length;
}

function decisionNotes(report: ReportData): string[] {
  const notes: string[] = [];
  if (report.experiment && report.experiment.status !== 'completed') {
    return ['No installation decision: the frozen experiment stopped or did not complete its declared calls. Inspect _session.json, _calls.jsonl and the error receipts; repair the inputs/environment, then declare a fresh run. Retain this run without adding replacement samples.'];
  }
  if (report.executor.kind === 'mock') {
    return ['No installation decision: this synthetic run only checks the harness.'];
  }
  if (report.overall.baseline.trials === 0) {
    notes.push('No installation decision: no graded pairs. Repair the execution or verifier environment first.');
  } else if (report.overall.verdict === 'inconclusive') {
    notes.push('No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.');
  } else {
    notes.push(report.overall.verdict === 'effective'
      ? 'The statistical quality result favors treatment on this bench; it does not by itself establish installation value.'
      : 'The statistical quality result favors baseline on this bench; review the regressions before enabling this configuration for these tasks.');
  }
  notes.push(`Scope: ${report.bench.taskCount} evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.`);
  if (replicatedTaskCount(report) < CONCLUSIVE_TASKS) {
    notes.push('No installation recommendation: this run is below 8 tasks × 5 graded pairs and is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.');
  }
  if (report.overall.baseline.errors + report.overall.treatment.errors > 0) {
    notes.push('Executor/verifier errors removed pairs. Inspect the raw error receipts before spending more calls.');
  }
  const saturated = report.tasks.filter(t => t.baseline.trials > 0 && t.baseline.passes / t.baseline.trials >= 0.9);
  if (saturated.length > 0) {
    notes.push(`Observed baseline saturation: ${saturated.map(t => t.id).join(', ')}. Retain these as regression controls; add independent real failures to measure lift.`);
  }
  if (report.tasks.some(t => t.baseline.trials > 0 && t.baseline.passes === 0 && t.treatment.passes === 0)) {
    notes.push('Some tasks failed in both arms. Inspect facet misses, dependencies and the issue-to-check contract before interpreting the pass-rate floor as task difficulty.');
  }
  if (report.target.kind === 'skill') {
    notes.push(report.baselineTarget
      ? 'Skill revision comparison: baseline contains the previous complete Skill and treatment contains the target version. Results describe revision effects, not installation benefit over no Skill. A positive delta does not guarantee non-regression on unseen tasks. Inspect per-run read observations and separate positive/negative trigger tests.'
      : report.skillDelivery
      ? 'Complete Skill resources were installed only in treatment. Task outcomes include native discovery; inspect per-run activation/transcript receipts and run separate positive/negative trigger tests. Installation does not guarantee activation, and inherited agent configuration still applies.'
      : 'Activation is unmeasured by this paired run: Skill content was force-injected. Run separate trigger tests with relevant requests and negative controls before an installation decision.');
  }
  if (report.baselineTarget) {
    const regressions = report.tasks.filter(task => task.deltaPassRate < 0 || (task.scoreDelta !== null && task.scoreDelta < 0));
    if (regressions.length > 0) {
      notes.push(`Observed task regressions: ${regressions.map(task => task.id).join(', ')}. Inspect their outcomes and checks before accepting the revision, even if the pooled verdict favors treatment.`);
    }
  }
  if (!report.overall.baseline.tokens || !report.overall.treatment.tokens) {
    notes.push('Token overhead is unavailable. Elapsed time or prompt-size estimates do not establish token cost.');
  } else if ([report.overall.baseline, report.overall.treatment].some(c =>
    !c.tokenCoverage || c.tokenCoverage.input < c.trials || c.tokenCoverage.output < c.trials)) {
    notes.push('Token coverage is partial or unrecorded. Available usage totals cannot establish complete token overhead.');
  } else {
    notes.push('Recorded token usage is shown below; it is not a billing estimate or a statistically established cost effect.');
  }
  return notes;
}

export function renderEvalMarkdown(report: ReportData): string {
  const lines = [
    `# skillfit evaluation: ${escapeMarkdown(report.target.name)}`,
    '',
  ];
  lines.push(measurementScopeText(report.measurementScope), '');
  if (report.executor.kind === 'mock') {
    lines.push('> **Synthetic harness run.** These numbers do not measure an agent or Skill effect.', '');
  }
  lines.push(
    `- Run: ${escapeMarkdown(report.runGroup)} (${escapeMarkdown(report.createdAt)})`,
    `- Target: ${escapeMarkdown(report.target.kind)}; SHA-256 \`${report.target.sha256}\``,
    ...(report.baselineTarget ? [`- Baseline Skill: ${escapeMarkdown(report.baselineTarget.name)} (previous version); SHA-256 \`${report.baselineTarget.sha256}\``] : []),
    `- Bench: ${escapeMarkdown(report.bench.name)} (${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'}); SHA-256 \`${report.bench.sha256}\``,
    `- Executor: ${escapeMarkdown(report.executor.kind)} / ${escapeMarkdown(report.executor.model)}`,
    `- Trials: ${report.trials} per condition`,
    `- Input: ${report.inputMode ?? 'snapshot (legacy manifest; not recorded)'}`,
    ...(report.skillDelivery ? ['- Delivery: complete Skill installed ' + (report.baselineTarget ? 'in both conditions' : 'in treatment') + ' at ' + escapeMarkdown(report.skillDelivery.installDir)] : []),
    ...(report.experiment ? [`- Session: ${report.experiment.status}; ${report.experiment.callsStarted}/${report.experiment.plannedCalls} calls started, ${report.experiment.callsFinished} finished; ceiling ${report.experiment.maxCalls}`, `- Frozen plan SHA-256: \`${report.experiment.planSha256}\``] : []),
    '',
    '| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |',
    '|---|---:|---:|---:|---:|---|',
    ...report.tasks.map(tableRow),
    tableRow(report.overall),
    '',
    '## Statistical readout',
    '',
    `- Overall verdict: **${report.overall.verdict}** — ${escapeMarkdown(report.overall.verdictReason)}`,
    `- Discordant pairs: ${report.overall.improved} improved, ${report.overall.regressed} regressed; McNemar exact p=${formatP(report.overall.mcnemarP)}`,
  );
  if (report.overall.deltaCi) {
    const ci = report.overall.deltaCi;
    lines.push(`- Δpass 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
    lines.push(`- Observed Δpass CI half-width: ±${((ci.hi - ci.lo) * 50).toFixed(1)}pp; not a validated minimum detectable effect.`);
  } else {
    lines.push('- Δpass 95% CI: n/a (no graded pairs)');
  }
  if (report.overall.scoreDeltaCi) {
    const ci = report.overall.scoreDeltaCi;
    lines.push(`- Δscore 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
  }
  if ((report.overall.deltaCi && report.overall.deltaCi.lo === report.overall.deltaCi.hi)
    || (report.overall.scoreDeltaCi && report.overall.scoreDeltaCi.lo === report.overall.scoreDeltaCi.hi)) {
    lines.push('- The bootstrap interval collapsed on the observed tasks; this does not establish zero uncertainty or validated effect resolution.');
  }
  if (replicatedTaskCount(report) < CONCLUSIVE_TASKS) {
    lines.push(`- Scale: ${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'} × ${report.trials} ${report.trials === 1 ? 'trial' : 'trials'} per condition; below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.`);
    lines.push(`- Completed scale: ${replicatedTaskCount(report)} task(s) have at least ${CONCLUSIVE_TRIALS} graded pairs after exclusions.`);
  }
  if (report.overall.treatment.skillReads) {
    lines.push('', '## Native Skill-read observations', '',
      '| Task / arm | Read observed | Read unobserved | Unknown |', '|---|---:|---:|---:|');
    for (const item of [...report.tasks, report.overall]) for (const arm of ['baseline', 'treatment'] as const) {
      const reads = item[arm].skillReads;
      if (reads) lines.push(`| ${escapeMarkdown(item.id)} / ${arm} | ${reads.observed} | ${reads.unobserved} | ${reads.unknown} |`);
    }
    lines.push('', 'Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.', '');
  }
  lines.push('', '## Checks and graded scores', '',
    '| Task | Baseline mean check score | Treatment mean check score | Δscore |',
    '|---|---:|---:|---:|',
    ...report.tasks.map(t => `| ${escapeMarkdown(t.id)} | ${score(t.baseline.meanScore)} | ${score(t.treatment.meanScore)} | ${t.scoreDelta === null ? 'n/a' : formatPp1(t.scoreDelta)} |`));
  for (const task of report.tasks) {
    if (task.facets.length === 0) continue;
    lines.push('', `### ${escapeMarkdown(task.id)}`, '',
      '| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |',
      '|---|---:|---:|',
      ...task.facets.map(f => `| ${escapeMarkdown(f.name)} | ${f.baselineTrials === 0 ? 'n/a' : `${score(f.baselinePassRate)} (n=${f.baselineTrials})`} | ${f.treatmentTrials === 0 ? 'n/a' : `${score(f.treatmentPassRate)} (n=${f.treatmentTrials})`} |`));
  }
  if (report.tasks.every(t => t.facets.length === 0)) {
    lines.push('', 'No per-check observations recorded.');
  }
  lines.push('', '## Installation decision and next steps', '',
    ...decisionNotes(report).map(note => `- ${escapeMarkdown(note)}`));
  if (report.overall.baseline.tokens && report.overall.treatment.tokens) {
    const cell = (c: Counts, field: 'input' | 'output'): string =>
      `${c.tokens![field]} (${c.tokenCoverage ? `${c.tokenCoverage[field]}/${c.trials} runs` : 'coverage unrecorded'})`;
    lines.push('', '| Recorded token totals (field coverage) | Baseline | Treatment |', '|---|---:|---:|',
      `| Input | ${cell(report.overall.baseline, 'input')} | ${cell(report.overall.treatment, 'input')} |`,
      `| Output | ${cell(report.overall.baseline, 'output')} | ${cell(report.overall.treatment, 'output')} |`);
  }
  lines.push('', ...renderModelIdentityLines(report.modelIdentities));
  lines.push('', '## Cost accounting', '');
  if (report.overall.costs) lines.push(...renderCostLines(report.overall.costs));
  else lines.push('Cache partitions and all-invocation costs were not recorded in this legacy manifest. Missing usage is unknown; the report does not infer it from prompt size or treat it as zero.');
  if (report.invocationCosts) lines.push('', ...renderInvocationCostLines(report.invocationCosts));
  lines.push('', '## Warnings', '');
  if (report.warnings.length === 0) lines.push('- None');
  else lines.push(...report.warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
  lines.push('', 'The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.', '');
  return lines.join('\n');
}

export async function runEvalReport(inputPath: string, log: (line: string) => void = console.log, options: EvalReportOptions = {}): Promise<void> {
  const result = await readEvaluationReport(inputPath, options);
  if ('evaluationType' in result) { log(renderSingleArmReport(result)); return; }
  const root = result.evidence.runDir;
  const safe = (message: string) => escapeMarkdown(message.replaceAll(root, '[run]'));
  const lines: string[] = [];
  if (result.manifest) {
    const path = result.manifest.path;
    if (statSync(path).size > MAX_MANIFEST_BYTES) throw new Error(`Evaluation manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
    lines.push(renderEvalMarkdown({ ...parseEvalReport(JSON.parse(readFileSync(path, 'utf8'))), modelIdentities: result.modelIdentities }));
  } else {
    lines.push(`# skillfit evaluation: ${result.status} run`, '',
      `- State: ${result.status}`,
      '- No completed paired comparison is available. Retained spending is not a quality verdict.');
    if (result.session?.stopReason) lines.push(`- Stop reason: ${safe(String(result.session.stopReason))}`);
    if ('startedAgentDispatches' in result.costs) lines.push(`- Started agent dispatches: ${result.costs.startedAgentDispatches}`,
      `- Missing or invalid invocation receipts: ${result.costs.invocationsWithUnknownReceipts}`);
    lines.push('', '## Retained costs', '', ...renderCostLines(result.costs.populations));
    lines.push('', ...renderInvocationCostLines(result.invocationCosts));
  }
  if (!result.manifest) lines.push('', ...renderModelIdentityLines(result.modelIdentities));
  lines.push('', '## Evidence and acceptance', '',
    `- State: ${result.status}`,
    `- Native evidence: ${result.evidence.verified ? 'verified' : 'unverified'}`,
    `- Acceptance: ${result.acceptance.decision}`,
    `- Eligible for upgrade: ${result.acceptance.eligibleForUpgrade ? 'yes' : 'no'}`,
    '- Automatic upgrade: no');
  for (const reason of result.acceptance.reasons) lines.push(`- ${reason.code}: ${safe(reason.message)}`);
  for (const reason of result.evidence.reasons) lines.push(`- Audit: ${safe(reason)}`);
  lines.push(...agentEnvironmentReportLines(result.agentPreflight).map(line => `- ${safe(line)}`));
  if (result.casePreflight) {
    const gate = result.casePreflight as { status?: unknown; summary?: { failures?: unknown; warnings?: unknown; unknown?: unknown } };
    if (typeof gate.status === 'string' && gate.summary && [gate.summary.failures, gate.summary.warnings, gate.summary.unknown].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)) {
      lines.push(`- Case preflight: ${safe(gate.status)}; ${gate.summary.failures} failure(s), ${gate.summary.warnings} warning(s), ${gate.summary.unknown} unknown(s)`);
    } else lines.push('- Case preflight: invalid or unavailable metadata; inspect the unverified JSON record.');
  }
  if (result.inputSnapshot) {
    const archive = result.inputSnapshot as { cost?: { durationMs?: unknown; files?: unknown; bytes?: unknown } };
    if (archive.cost && [archive.cost.files, archive.cost.bytes, archive.cost.durationMs].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)) {
      lines.push(`- Sealed input cost: ${archive.cost.files} files; ${archive.cost.bytes} bytes; ${archive.cost.durationMs}ms local sealing; 0 model calls`);
    } else lines.push('- Sealed input cost: invalid or unavailable metadata; no copy-cost total inferred.');
  }
  log(lines.join('\n') + '\n');
}
