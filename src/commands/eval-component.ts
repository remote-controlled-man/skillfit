import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assessEvaluation } from '../harness/eval-acceptance.js';
import { auditEvaluation, stoppedAccounting } from '../harness/eval-audit.js';
import { loadEvalRequest, parseAcceptancePolicy, policyHash, readComponentJson, record, type ComponentMetadata } from '../harness/eval-contract.js';
import { runEval, type EvalOptions } from './eval.js';
import { prepareEvalPlan, confirmEvalPlan, plannedEvalResult } from './eval-plan.js';
import { spendingBudgetReport } from '../harness/eval-budget.js';
import { verifyReplayPackage } from '../harness/replay-package.js';
import { CasePreflightFailed } from './eval-preflight.js';
import { AgentPreflightFailed } from '../harness/agent-preflight.js';

export function componentError(error: unknown, code = 'INVALID_OR_FAILED_EVALUATION') {
  return { schemaVersion: 1, kind: 'skillfit.eval-error', status: 'error',
    error: { code: error instanceof CasePreflightFailed ? 'CASE_PREFLIGHT_FAILED' : error instanceof AgentPreflightFailed ? 'AGENT_PREFLIGHT_FAILED' : code, message: error instanceof Error ? error.message : String(error) },
    ...(error instanceof AgentPreflightFailed ? { agentPreflight: error.agentPreflight } : {}),
    ...(error instanceof CasePreflightFailed ? { casePreflight: error.preflight } : {}),
    acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false } };
}

export interface EvalReportOptions { policyPath?: string; recordsPath?: string; replay?: boolean; benchDir?: string }

export async function reportEvalComponent(path: string, options: EvalReportOptions = {}) {
  if (statSync(resolve(path)).isDirectory() && existsSync(join(resolve(path), 'replay-package.json'))) {
    if (options.recordsPath || options.benchDir) throw new Error('Portable packages already pin their run and bench; external overrides are not allowed.');
    const metadata = verifyReplayPackage(resolve(path));
    return { ...await reportNativeEvaluation(join(resolve(path), 'run'), { ...options, benchDir: join(resolve(path), 'inputs/bench') }),
      portablePackage: { integrityVerified: true, sourcePlanSha256: metadata.sourcePlanSha256, files: Object.keys(metadata.files).length } };
  }
  return reportNativeEvaluation(path, options);
}

async function reportNativeEvaluation(path: string, options: EvalReportOptions) {
  const input = resolve(path), directory = statSync(input).isDirectory();
  const manifestPath = directory ? join(input, 'manifest.json') : input;
  const runDir = resolve(options.recordsPath ?? (directory ? input : dirname(input)));
  const spendingBudget = spendingBudgetReport(runDir);
  if (!existsSync(manifestPath)) {
    if (!directory || !existsSync(join(runDir, '_plan.json'))) throw new Error('No saved manifest or native plan found.');
    const sessionPath = join(runDir, '_session.json');
    const session = existsSync(sessionPath) ? record(readComponentJson(sessionPath).value, 'session') : null;
    const nativePlan = record(readComponentJson(join(runDir, '_plan.json')).value, 'native plan');
    return { schemaVersion: 1, kind: 'skillfit.eval-result', status: session ? 'stopped' : 'incomplete',
      agentPreflight: nativePlan.details ? record(nativePlan.details, 'native plan details').agentPreflight ?? null : null,
      casePreflight: nativePlan.details ? record(nativePlan.details, 'native plan details').casePreflight ?? null : null,
      inputSnapshot: nativePlan.inputSnapshot ?? null,
      manifest: null, session, costs: stoppedAccounting(runDir), evidence: { verified: false, runDir, reasons: ['No final evaluation manifest; retained spending only.'] },
      ...(spendingBudget ? { spendingBudget } : {}),
      acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false,
        reasons: [{ code: 'EXPERIMENT_NOT_COMPLETED', message: 'No completed paired evaluation is available.' }] } };
  }
  const data = readComponentJson(manifestPath);
  const audit = await auditEvaluation(data.value, runDir, options);
  const policy = options.policyPath ? parseAcceptancePolicy(readComponentJson(resolve(options.policyPath)).value) : undefined;
  const result = assessEvaluation(data.value, audit, policy);
  const nativePlan = audit.verified ? record(readComponentJson(join(runDir, '_plan.json')).value, 'native plan') : null;
  return { ...result, manifest: { path: manifestPath, sha256: data.sha256, schemaVersion: 4 },
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

export interface ComponentRunOptions {
  dryRun: boolean;
  expectedPlanSha256?: string;
  /** Test-only injection; always records synthetic=true and cannot authorize adoption. */
  executor?: EvalOptions['executor'];
  sessionOptions?: EvalOptions['sessionOptions'];
  skillInstallDir?: string;
  log?: (line: string) => void;
}

/** Machine interface to the existing installed A/B engine; never installs an accepted candidate. */
export async function runEvalComponent(requestPath: string, options: ComponentRunOptions) {
  const path = resolve(requestPath), { request, sha256: requestSha256 } = loadEvalRequest(path);
  const runDir = join(request.runsRoot, request.runGroup);
  if (existsSync(runDir)) throw new Error('Run group already exists; declare a fresh group without overwriting evidence.');
  const base: EvalOptions = { skillPath: request.candidateSkill, baselineSkillPath: request.baselineSkill ?? undefined,
    bench: request.bench, agent: request.agent, mode: 'installed', inputMode: 'workspace', trials: request.trials,
    maxCalls: request.maxCalls, pairOrder: request.pairOrder, runsRoot: request.runsRoot, runGroup: request.runGroup, yes: true, dryRun: true,
    executorTimeoutSeconds: request.executorTimeoutSeconds,
    ...(request.taskIds ? { taskIds: request.taskIds } : {}),
    ...(request.spendingBudget ? { spendingBudget: request.spendingBudget } : {}),
    judgeExecutor: null, executor: options.executor, sessionOptions: options.sessionOptions,
    skillInstallDir: options.skillInstallDir, log: options.log ?? (() => {}) };
  const prepared = await prepareEvalPlan(base, { request, requestSha256, policySha256: policyHash(request.policy) });
  const { plan } = prepared, { sha256: previewSha256, implementationSha256 } = plan;
  if (plan.evaluation.judge) throw new Error('Component requires a paired installed Skill evaluation without a judge.');
  if (options.dryRun) return plannedEvalResult(plan);
  confirmEvalPlan(options.expectedPlanSha256, previewSha256);
  const component: ComponentMetadata = { schemaVersion: 1, requestSha256, previewSha256, implementationSha256, policySha256: policyHash(request.policy),
    purpose: request.purpose, policy: request.policy, synthetic: options.executor !== undefined };
  try {
    await runEval({ ...base, dryRun: false, component, guardFiles: [{ label: 'component request', path, sha256: requestSha256 }],
      onPlan: prepared.assertCurrent });
  } catch (error) {
    if (!existsSync(join(runDir, '_plan.json'))) throw error;
    const result = await reportEvalComponent(runDir);
    return { ...result, status: 'stopped', plan, executionError: error instanceof Error ? error.message : String(error),
      acceptance: { ...result.acceptance, decision: result.acceptance.decision === 'reject' ? 'reject' : 'inconclusive', eligibleForUpgrade: false,
        reasons: [...result.acceptance.reasons, { code: 'EXECUTION_STOPPED', message: 'Request execution failed; inspect retained receipts before a fresh declaration.' }] } };
  }
  return { ...await reportEvalComponent(runDir), plan };
}
