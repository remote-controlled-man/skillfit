import { measurementScopeText } from '../harness/measurement-scope.js';
import { renderModelIdentityLines } from '../harness/model-identity.js';
import { agentEnvironmentReportLines } from '../harness/agent-preflight.js';
import { COST_METRICS } from '../harness/costs.js';
import type { SingleArmReport } from '../harness/single-arm-read.js';
export { readSingleArmReport, type SingleArmReport } from '../harness/single-arm-read.js';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('*', '\\*').replaceAll('_', '\\_')
  .replaceAll('[', '\\[').replaceAll(']', '\\]').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
const percent = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
export function renderSingleArmReport(report: SingleArmReport): string {
  const lines = [`# skillfit ${report.evaluationType} report: ${escape(report.runGroup)}`, '', `- State: ${report.status}`,
    `- Evidence: ${report.evidence.verified ? 'verified native single-arm receipts' : 'unverified saved single-arm evidence'}; no paired efficacy or adoption decision.`, '- Eligible for upgrade: no', '- Automatic upgrade: no'];
  for (const reason of report.evidence.reasons) lines.push(`- Audit: ${escape(reason.replaceAll(report.evidence.runDir, '[run]'))}`);
  if (report.session?.stopReason) lines.push(`- Stop reason: ${escape(report.session.stopReason.replaceAll(report.evidence.runDir, '[run]'))}`);
  lines.push(...agentEnvironmentReportLines(report.agentPreflight).map(line => `- ${escape(line)}`));
  lines.push('', measurementScopeText(report.measurementScope));
  lines.push('', ...renderModelIdentityLines(report.modelIdentities));
  if (report.evaluationType === 'calibration' && report.summary) {
    const { tasks, metrics } = report.summary;
    lines.push('', '## Baseline difficulty', '', `- Baseline pass rate: ${metrics.passes}/${metrics.completed} (${percent(metrics.baselinePassRate)})`,
      `- Measured tasks: ${metrics.measuredTasks}/${metrics.taskCount}; discriminative tasks: ${metrics.discriminativeTasks}/${metrics.measuredTasks}`,
      `- Ungraded errors: ${metrics.errors}`, '', '| Task | Passes / completed | Pass rate | Errors | Difficulty |', '|---|---:|---:|---:|---|',
      ...tasks.map(t => `| ${escape(t.id)} | ${t.passes}/${t.completed} | ${percent(t.passRate)} | ${t.errors} | ${t.difficulty} |`), '',
      'Completed runs exclude execution errors. Saturated >=90%; floor <=10%; otherwise discriminative; zero completed runs are unmeasured.',
      'Baseline difficulty does not measure Skill benefit. Efficiency eligibility requires paired costs, variance, final coverage and no regressions; activation coverage requires positive/negative labeled observations.');
  } else if (report.evaluationType === 'trigger' && report.summary) {
    const { metrics: m, tasks, detection, competition } = report.summary;
    const ci = (value: number | null, interval: { lo: number; hi: number } | null) => `${percent(value)}${interval ? ` [${percent(interval.lo)}, ${percent(interval.hi)}]` : ''}`;
    lines.push('', '## Trigger metrics', '', `- Skill: ${escape(report.summary.skillName)}; bench: ${escape(report.summary.benchName)}`,
      `- Detection: ${detection}; competition: ${competition}`, `- Recall: ${ci(m.recall, m.recallCi95)} (${m.positives.fired}/${m.positives.runs})`,
      `- False-trigger rate: ${ci(m.falseTriggerRate, m.falseTriggerRateCi95)} (${m.negatives.fired}/${m.negatives.runs})`,
      `- Precision: ${ci(m.precision, m.precisionCi95)}`, `- F1: ${m.f1 === null ? 'n/a' : m.f1.toFixed(3)} (no confidence interval)`,
      '', '| Task | Expected trigger | Fired / observed | Unknown | Errors | Task passes |', '|---|---|---:|---:|---:|---:|',
      ...tasks.map(t => `| ${escape(t.id)} | ${t.shouldTrigger ? 'yes' : 'no'} | ${t.fired}/${t.runs} | ${t.unknown} | ${t.errors} | ${t.passes} |`));
    lines.push(report.summary.triggerDetection
      ? `- Observation protocol: triggerDetection v2; ${report.summary.triggerDetection.wireShape}; exact registered identities.`
      : '- Observation protocol: legacy/unversioned detection; saved fired counts are not reinterpreted.');
    for (const label of ['explicit', 'implicit', 'contextual'] as const) {
      const group = m.classRecall?.[label];
      if (group) lines.push(`- ${label} recall: ${ci(group.recall, group.recallCi95)} (${group.fired}/${group.runs})`);
      else if (tasks.some(t => t.shouldTrigger && t.triggerClass === label)) lines.push(`- ${label} recall: n/a (no observed detections)`);
    }
    if (detection === 'skill-read') lines.push('- A SKILL.md read is an observation, not a Skill-invocation event.');
    if (competition === 'alone') lines.push('- Recall is an upper bound with the tested Skill installed alone.');
    lines.push('- Rates exclude unknown detections and execution errors; zero denominators are n/a. Intervals use Wilson 95%.',
      '- Recorded token totals are historical aggregates, not complete final/partial/unknown costs or a bill; missing cache partitions remain unknown.');
    if (m.tokens) lines.push(`- Recorded input/output tokens: ${m.tokens.input}/${m.tokens.output}`);
  } else lines.push('', 'Final summary is missing. Metrics are unavailable; the run is not a completed comparison.');
  if (report.evaluationType === 'calibration' || report.usage) {
    lines.push('', `## Retained ${report.evaluationType === 'calibration' ? 'baseline' : 'Agent'} usage`, '');
    if (report.usage) {
      const u = report.usage;
      lines.push(`- Started agent dispatches: ${u.startedAgentDispatches}; missing or invalid receipts: ${u.invocationsWithUnknownReceipts}`,
        '| Measure | Known total | Final/partial/unknown |', '|---|---:|---:|');
      for (const metric of COST_METRICS) {
        const m = u.metrics[metric], c = m.coverage;
        const total = c.unknown === u.runs ? 'unrecorded' : c.final === u.runs ? String(m.knownTotal) : `>= ${m.knownTotal}`;
        lines.push(`| ${metric} | ${total} | ${c.final}/${c.partial}/${c.unknown} |`);
      }
      lines.push('Available receipt totals only; >= is a lower bound. Unknown usage is not zero; no bill or paired cost change is inferred.');
    } else lines.push('Invocation usage is unrecorded; no spending totals inferred from task success counts.');
  }
  for (const warning of report.warnings) lines.push(`- Warning: ${escape(warning)}`);
  return lines.join('\n') + '\n';
}
