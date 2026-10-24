import { requestedClaimFor, claimDiagnostics } from './measurement-scope.js';
import { parseEvalReport } from './eval-manifest.js';
import { completeCost, COST_METRICS, type CostMetric, type CostObservation, type RunCosts } from './costs.js';
import { parseAcceptancePolicy, policyHash, record, type AcceptancePolicy, type ComponentMetadata } from './eval-contract.js';
import { efficiencyEvidence } from './eval-efficiency.js';

export interface AcceptanceReason { code: string; message: string }
export interface EvidenceAudit {
  verified: boolean;
  reasons: string[];
  indexedFiles: number;
  receipts: number;
  replayedDeliveries: number;
  replayRequested: boolean;
  policyBound: boolean;
  pairs?: { taskId: string; trial: number; graded: boolean;
    baseline: CostObservation & { score: number | null }; treatment: CostObservation & { score: number | null };
    scoreDelta: number | null; changedChecks: { name: string; change: 'improved' | 'regressed' }[];
    costs: ReturnType<typeof costChanges> }[];
}

export function costChanges(costs: RunCosts | null) {
  if (!costs) return null;
  return Object.fromEntries(['paired', 'attempts'].map(scope => {
    const arms = costs[scope as 'paired' | 'attempts'];
    return [scope, Object.fromEntries(COST_METRICS.map(metric => {
      const { baseline: b, treatment: t } = arms;
      const exact = completeCost(b, metric) && completeCost(t, metric);
      const baseline = b.metrics[metric].knownTotal, treatment = t.metrics[metric].knownTotal;
      const basePer = b.passes ? baseline / b.passes : null, targetPer = t.passes ? treatment / t.passes : null;
      return [metric, { baseline: b.metrics[metric], treatment: t.metrics[metric], exact,
        totalChangeFraction: exact && baseline > 0 ? treatment / baseline - 1 : null,
        perSuccess: { baseline: basePer, treatment: targetPer, knownLowerBound: !exact },
        perSuccessChangeFraction: exact && basePer !== null && basePer > 0 && targetPer !== null ? targetPer / basePer - 1 : null }];
    }))];
  }));
}

/** Separate conservative adoption policy; this does not change the statistical verdict. */
export function assessEvaluation(value: unknown, audit: EvidenceAudit, override?: AcceptancePolicy) {
  const raw = record(value, 'manifest');
  const report = parseEvalReport(value);
  const metadata = raw.component === undefined ? null : record(raw.component, 'component') as unknown as ComponentMetadata;
  const policy = override ?? parseAcceptancePolicy(metadata?.policy);
  const rejected: AcceptanceReason[] = [], insufficient: AcceptanceReason[] = [];
  const need = (code: string, message: string) => insufficient.push({ code, message });
  const reject = (code: string, message: string) => rejected.push({ code, message });
  if (report.measurementScope?.requestedClaim === null) need('MEASUREMENT_NOT_APPLICABLE', 'Diagnostic-only synthetic evidence declares no requested adoption claim.');
  if (report.measurementScope?.benchSchemaVersion === 2 && !report.measurementScope.taskClaims.every(t => t.claims?.includes(requestedClaimFor('paired', policy)!))) need('BENCH_CLAIM_UNSUPPORTED', 'Selected frozen task claims do not support the requested report policy; observed quality numbers do not expand that scope.');
  const tasks = report.tasks.map((task, i) => {
    const item = record((raw.tasks as unknown[])[i], 'task');
    let improvedPairs: number | null = null, regressedPairs: number | null = null;
    if (item.outcomes !== undefined) {
      const outcomes = record(item.outcomes, 'task.outcomes');
      const b = outcomes.baseline, t = outcomes.treatment;
      if (!Array.isArray(b) || !Array.isArray(t) || b.length !== task.baseline.trials || t.length !== b.length ||
          [...b, ...t].some(x => typeof x !== 'boolean') || b.filter(Boolean).length !== task.baseline.passes || t.filter(Boolean).length !== task.treatment.passes) {
        throw new Error(`Task ${task.id} paired outcomes contradict graded counts.`);
      }
      improvedPairs = b.filter((x, n) => !x && t[n]).length;
      regressedPairs = b.filter((x, n) => x && !t[n]).length;
    }
    const improvedFacets = task.facets.filter(f => f.treatmentPassRate > f.baselinePassRate);
    const regressedFacets = task.facets.filter(f => f.treatmentPassRate < f.baselinePassRate);
    if ((regressedPairs ?? 0) > 0 || task.deltaPassRate < 0 || regressedFacets.length > 0 || (task.scoreDelta ?? 0) < 0) {
      reject('OBSERVED_REGRESSION', `Task ${task.id} has an observed pass, score or named-check regression.`);
    }
    return { id: task.id, baseline: task.baseline, treatment: task.treatment, deltaPassRate: task.deltaPassRate,
      scoreDelta: task.scoreDelta, improvedPairs, regressedPairs, improvedFacets, regressedFacets, costs: task.costs };
  });
  if (tasks.every(t => t.improvedPairs !== null && t.regressedPairs !== null)) {
    if (tasks.reduce((s, t) => s + t.improvedPairs!, 0) !== report.overall.improved ||
        tasks.reduce((s, t) => s + t.regressedPairs!, 0) !== report.overall.regressed) throw new Error('Per-task paired changes contradict overall discordance.');
  } else need('PAIR_EVIDENCE_MISSING', 'Per-task paired outcomes were not recorded.');
  if (report.overall.regressed > 0) reject('REGRESSED_PAIRS', `${report.overall.regressed} paired task outcomes regressed.`);
  for (const pair of audit.pairs ?? []) if (pair.graded && (pair.changedChecks.some(c => c.change === 'regressed') || (pair.scoreDelta ?? 0) < 0)) {
    reject('OBSERVED_PAIR_REGRESSION', `Task ${pair.taskId} trial ${pair.trial} has a named-check or score regression despite any aggregate gain.`);
  }
  if (report.overall.verdict === 'ineffective') reject('NEGATIVE_EFFECT', 'The unchanged statistical verdict is ineffective.');
  else if (policy.schemaVersion === 1 && (report.overall.verdict !== 'effective' || report.overall.deltaPassRate <= 0 || report.overall.deltaPassRate < policy.minDeltaPassRate)) {
    need('QUALITY_GAIN_UNPROVEN', 'A positive effective verdict meeting the declared minimum gain is required.');
  }
  if (!report.baselineTarget || !report.skillDelivery) need('REVISION_COMPARISON_REQUIRED', 'Adoption requires two complete installed versions of the same Skill.');
  if (!report.experiment || report.experiment.status !== 'completed') need('EXPERIMENT_NOT_COMPLETED', 'The declared native experiment did not complete.');
  if (report.overall.baseline.errors || report.overall.treatment.errors) need('EXECUTION_ERRORS', 'Errors and excluded pairs cannot authorize adoption.');
  const replicatedTasks = tasks.filter(t => Math.min(t.baseline.trials, t.treatment.trials) >= policy.minTrialsPerTask).length;
  if (replicatedTasks < policy.minTasks || replicatedTasks !== tasks.length) need('INSUFFICIENT_SCALE', `Need at least ${policy.minTasks} tasks, each with ${policy.minTrialsPerTask} graded pairs.`);
  if (!metadata || metadata.purpose !== 'validation') need('VALIDATION_NOT_DECLARED', 'An independent validation task set must be declared before execution.');
  if (report.executor.kind === 'mock' || metadata?.synthetic !== false) need('SYNTHETIC_OR_UNATTESTED_RUN', 'Injected/synthetic or unrecorded component runs cannot authorize adoption.');
  if (!audit.verified) need('EVIDENCE_NOT_VERIFIED', audit.reasons.join('; ') || 'Native receipts and their integrity were not verified.');
  if (!metadata || !audit.policyBound || metadata.policySha256 !== policyHash(policy)) need('POLICY_NOT_PREDECLARED', 'The selected policy is not bound to the native plan before execution.');
  const costs = report.overall.costs;
  if (costs && (!costs.attempts.baseline.passes || !costs.attempts.treatment.passes)) {
    need('COST_PER_SUCCESS_UNDEFINED', 'Both arms need successful tasks to compare all spending per success.');
  }
  if (!costs || COST_METRICS.some(m => !completeCost(costs.attempts.baseline, m) || !completeCost(costs.attempts.treatment, m))) {
    need('INCOMPLETE_COSTS', 'Final input, cache partition, output and elapsed coverage is required for every invocation.');
  }
  const efficiency = policy.schemaVersion === 2 ? efficiencyEvidence(tasks) : null;
  if (policy.schemaVersion === 2 && efficiency) {
    if (raw.pairOrder !== 'balanced') need('BALANCED_ORDER_REQUIRED', 'Efficiency validation requires predeclared balanced adjacent pairs.');
    if (efficiency.ci === null) need('TASK_COSTS_UNDEFINED', efficiency.unavailableReason!);
    else {
      if (efficiency.ci.hi > -policy.minUncachedInputReductionFraction + 1e-12) {
        need('EFFICIENCY_REDUCTION_UNPROVEN', 'The upper task-bootstrap bound does not meet the declared uncached-input reduction per success.');
      }
      if (efficiency.improvedTaskFraction! < policy.minImprovedTaskFraction) {
        need('EFFICIENCY_NOT_BROAD', 'Too few tasks reduced all-invocation uncached input per success.');
      }
    }
  }
  if (costs) for (const [name, limit] of Object.entries(policy.maxCostIncreaseFraction)) {
    const metric = name as CostMetric;
    const b = costs.attempts.baseline, t = costs.attempts.treatment;
    if (completeCost(b, metric as CostMetric) && completeCost(t, metric as CostMetric) && b.passes > 0 && t.passes > 0 &&
        t.metrics[metric].knownTotal / t.passes > b.metrics[metric].knownTotal / b.passes * (1 + limit) + 1e-9) {
      reject('COST_LIMIT_EXCEEDED', `${metric} spending per successful task exceeds the declared increase limit.`);
    }
  }
  const decision = rejected.length ? 'reject' as const : insufficient.length ? 'inconclusive' as const : 'accept' as const;
  return {
    schemaVersion: 1 as const, kind: 'skillfit.eval-result' as const,
    ...(report.measurementScope ? { measurementScope: report.measurementScope } : {}),
    ...(report.modelIdentities ? { modelIdentities: report.modelIdentities } : {}),
    status: report.experiment?.status ?? 'reported',
    identity: { candidate: report.target, baseline: report.baselineTarget, bench: report.bench, executor: report.executor },
    quality: { statisticalVerdict: report.overall.verdict, verdictReason: report.overall.verdictReason,
      deltaPassRate: report.overall.deltaPassRate, scoreDelta: report.overall.scoreDelta,
      improvedPairs: report.overall.improved, regressedPairs: report.overall.regressed, mcnemarP: report.overall.mcnemarP,
      deltaCi: report.overall.deltaCi, scoreDeltaCi: report.overall.scoreDeltaCi, replicatedTasks, tasks },
    costs: { populations: costs, changes: costChanges(costs), ...(efficiency ? { efficiency } : {}), scope: 'Agent executor invocations, including errors and excluded partners; no dollar bill, candidate-generation, judge or orchestration cost.' },
    evidence: audit,
    acceptance: { decision, eligibleForUpgrade: decision === 'accept', automaticUpgrade: false as const,
      policy, policySha256: policyHash(policy), reasons: [...rejected, ...insufficient],
      scope: 'Advisory eligibility on the declared validation tasks and recorded environment; no general non-regression or future-model guarantee.' },
    diagnostics: report.tasks.map(t => ({ taskId: t.id, ...claimDiagnostics(t.baseline.trials ? t.baseline.passes / t.baseline.trials : null, report.measurementScope, t.id) })),
    warnings: report.warnings,
  };
}
