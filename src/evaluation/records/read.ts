import { parseMeasurementScope } from "../measurement/scope.js";
import { retainedModelIdentities } from "../records/model-identity.js";
import { parseModelIdentities } from "../../agents/observation/model-identity.js";
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assessEvaluation } from "../records/assess.js";
import { auditEvaluation, stoppedAccounting } from "../records/audit.js";
import { parseAcceptancePolicy } from '../measurement/policy.js';
import { readComponentJson } from '../../shared/read-json.js';
import { record } from '../../shared/json.js';
import { spendingBudgetReport } from "../execution/budget.js";
import { verifyReplayPackage } from "../records/replay-package.js";
import { reportSingleArmEvaluation } from "../records/single-arm-read.js";
import { historicalInvocationCosts, parseInvocationCosts } from "../measurement/invocation-costs.js";
import type { CostPopulation } from "../measurement/costs.js";
import type { EvalReportOptions } from './contracts.js';
export type { EvalReportOptions } from './contracts.js';

export async function readEvaluation(path: string, options: EvalReportOptions = {}) {
  return readSavedEvaluation(path, options);
}

async function readSavedEvaluation(path: string, options: EvalReportOptions) {
  if (statSync(resolve(path)).isDirectory() && existsSync(join(resolve(path), 'replay-package.json'))) {
    if (options.recordsPath || options.benchDir) throw new Error('Portable packages already pin their run and bench; external overrides are not allowed.');
    const metadata = verifyReplayPackage(resolve(path));
    return { ...await reportNativeEvaluation(join(resolve(path), 'run'), { ...options,
      ...(options.replay ? { benchDir: join(resolve(path), 'inputs/bench') } : {}) }),
      portablePackage: { integrityVerified: true, sourcePlanSha256: metadata.sourcePlanSha256, files: Object.keys(metadata.files).length } };
  }
  return reportNativeEvaluation(path, options);
}

async function reportNativeEvaluation(path: string, options: EvalReportOptions) {
  const single = await reportSingleArmEvaluation(path, options);
  if (single) {
    const spendingBudget = spendingBudgetReport(single.evidence.runDir);
    return { ...single, ...(spendingBudget ? { spendingBudget } : {}) };
  }
  const input = resolve(path), directory = statSync(input).isDirectory();
  const manifestPath = directory ? join(input, 'manifest.json') : input;
  const runDir = resolve(options.recordsPath ?? (directory ? input : dirname(input)));
  const spendingBudget = spendingBudgetReport(runDir);
  if (!existsSync(manifestPath)) {
    if (!directory || !existsSync(join(runDir, '_plan.json'))) throw new Error('No saved manifest or native plan found.');
    const sessionPath = join(runDir, '_session.json');
    const session = existsSync(sessionPath) ? record(readComponentJson(sessionPath).value, 'session') : null;
    const nativePlan = record(readComponentJson(join(runDir, '_plan.json')).value, 'native plan');
    const costs = stoppedAccounting(runDir);
    return { schemaVersion: 1, kind: 'skillfit.eval-result', status: session ? 'stopped' : 'incomplete',
      agentPreflight: nativePlan.details ? record(nativePlan.details, 'native plan details').agentPreflight ?? null : null,
      casePreflight: nativePlan.details ? record(nativePlan.details, 'native plan details').casePreflight ?? null : null,
      inputSnapshot: nativePlan.inputSnapshot ?? null,
      measurementScope: nativePlan.details ? parseMeasurementScope(record(nativePlan.details, 'native details').measurementScope) : undefined,
      manifest: null,
      modelIdentities: retainedModelIdentities(runDir), session, costs, invocationCosts: costs.invocationCosts,
      evidence: { verified: false, runDir, reasons: ['No final evaluation manifest; retained spending only.'] },
      ...(spendingBudget ? { spendingBudget } : {}),
      acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false,
        reasons: [{ code: 'EXPERIMENT_NOT_COMPLETED', message: 'No completed paired evaluation is available.' }] } };
  }
  const data = readComponentJson(manifestPath);
  const audit = await auditEvaluation(data.value, runDir, options);
  const policy = options.policyPath ? parseAcceptancePolicy(readComponentJson(resolve(options.policyPath)).value) : undefined;
  const result = assessEvaluation(data.value, audit, policy);
  const raw = record(data.value, 'manifest');
  const populations = result.costs.populations?.attempts;
  const invocationCosts = raw.invocationCosts === undefined
    ? populations ? historicalInvocationCosts(combinePopulations(populations.baseline, populations.treatment), raw.judge != null) : null
    : parseInvocationCosts(raw.invocationCosts);
  const nativePlan = audit.verified ? record(readComponentJson(join(runDir, '_plan.json')).value, 'native plan') : null;
  return { ...result, invocationCosts, ...(raw.modelIdentities === undefined ? {} : { modelIdentities: audit.verified ? parseModelIdentities(raw.modelIdentities) : retainedModelIdentities(runDir) }), manifest: { path: manifestPath, sha256: data.sha256, schemaVersion: 4 },
    agentPreflight: nativePlan ? record(nativePlan.details, 'native plan details').agentPreflight ?? null : null,
    casePreflight: nativePlan ? record(nativePlan.details, 'native plan details').casePreflight ?? null : null,
    inputSnapshot: nativePlan?.inputSnapshot ?? null,
    ...(spendingBudget ? { spendingBudget } : {}),
    environment: nativePlan ? { nodeVersion: nativePlan.nodeVersion, agent: nativePlan.agent,
      pairOrder: record(nativePlan.details, 'native plan details').pairOrder ?? null,
      executorTimeoutSeconds: record(nativePlan.details, 'native plan details').executorTimeoutSeconds ?? null,
      nativeDiffTool: record(nativePlan.details, 'native plan details').nativeDiffTool ?? null,
      cliVersion: nativePlan.cliVersion, configuredSettings: nativePlan.configuredSettings,
      servedModel: nativePlan.servedModel, injectedExecutor: nativePlan.injectedExecutor, warnings: nativePlan.warnings } : null,
    evidence: { ...result.evidence, runDir, planPath: join(runDir, '_plan.json'),
      ledgerPath: join(runDir, '_calls.jsonl'), artifactsPath: join(runDir, '_artifacts.json') } };
}

function combinePopulations(a: CostPopulation, b: CostPopulation): CostPopulation {
  const metrics = Object.fromEntries(Object.entries(a.metrics).map(([key, m]) => {
    const other = b.metrics[key as keyof typeof b.metrics];
    return [key, { knownTotal: m.knownTotal + other.knownTotal,
      coverage: { final: m.coverage.final + other.coverage.final, partial: m.coverage.partial + other.coverage.partial, unknown: m.coverage.unknown + other.coverage.unknown } }];
  })) as CostPopulation['metrics'];
  return { runs: a.runs + b.runs, passes: a.passes + b.passes, metrics };
}
