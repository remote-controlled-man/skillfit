import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessEvaluation } from '../harness/eval-acceptance.js';
import { auditEvaluation, stoppedAccounting } from '../harness/eval-audit.js';
import { loadEvalRequest, parseAcceptancePolicy, policyHash, readComponentJson, record, type ComponentMetadata } from '../harness/eval-contract.js';
import { hashFileSet, listFilesRecursive, sha256Text } from '../harness/hash.js';
import { runEval, type EvalOptions, type EvalPreview } from './eval.js';

export function componentError(error: unknown, code = 'INVALID_OR_FAILED_EVALUATION') {
  return { schemaVersion: 1, kind: 'skillfit.eval-error', status: 'error',
    error: { code, message: error instanceof Error ? error.message : String(error) },
    acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false } };
}

export async function reportEvalComponent(path: string, options: { policyPath?: string; recordsPath?: string; replay?: boolean; benchDir?: string } = {}) {
  const input = resolve(path), directory = statSync(input).isDirectory();
  const manifestPath = directory ? join(input, 'manifest.json') : input;
  const runDir = resolve(options.recordsPath ?? (directory ? input : dirname(input)));
  if (!existsSync(manifestPath)) {
    if (!directory || !existsSync(join(runDir, '_plan.json'))) throw new Error('No saved manifest or native plan found.');
    const sessionPath = join(runDir, '_session.json');
    const session = existsSync(sessionPath) ? record(readComponentJson(sessionPath).value, 'session') : null;
    return { schemaVersion: 1, kind: 'skillfit.eval-result', status: session ? 'stopped' : 'incomplete',
      manifest: null, session, costs: stoppedAccounting(runDir), evidence: { verified: false, runDir, reasons: ['No final evaluation manifest; retained spending only.'] },
      acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false,
        reasons: [{ code: 'EXPERIMENT_NOT_COMPLETED', message: 'No completed paired evaluation is available.' }] } };
  }
  const data = readComponentJson(manifestPath);
  const audit = await auditEvaluation(data.value, runDir, options);
  const policy = options.policyPath ? parseAcceptancePolicy(readComponentJson(resolve(options.policyPath)).value) : undefined;
  const result = assessEvaluation(data.value, audit, policy);
  const nativePlan = audit.verified ? record(readComponentJson(join(runDir, '_plan.json')).value, 'native plan') : null;
  return { ...result, manifest: { path: manifestPath, sha256: data.sha256, schemaVersion: 4 },
    environment: nativePlan ? { nodeVersion: nativePlan.nodeVersion, agent: nativePlan.agent,
      pairOrder: record(nativePlan.details, 'native plan details').pairOrder ?? null,
      executorTimeoutSeconds: record(nativePlan.details, 'native plan details').executorTimeoutSeconds ?? null,
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
  const implementationDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const implementationFiles = listFilesRecursive(implementationDir);
  const implementationSha256 = hashFileSet(implementationDir, implementationFiles);
  const base: EvalOptions = { skillPath: request.candidateSkill, baselineSkillPath: request.baselineSkill,
    bench: request.bench, agent: request.agent, mode: 'installed', inputMode: 'workspace', trials: request.trials,
    maxCalls: request.maxCalls, pairOrder: request.pairOrder, runsRoot: request.runsRoot, runGroup: request.runGroup, yes: true, dryRun: true,
    executorTimeoutSeconds: request.executorTimeoutSeconds,
    judgeExecutor: null, executor: options.executor, sessionOptions: options.sessionOptions,
    skillInstallDir: options.skillInstallDir, log: options.log ?? (() => {}) };
  let prepared: EvalPreview | undefined;
  await runEval({ ...base, onPlan: preview => { prepared = preview; } });
  if (!prepared || !prepared.baseline || prepared.judge) throw new Error('Component requires a paired installed Skill revision without a judge.');
  const describe = (evaluation: EvalPreview) => ({ schemaVersion: 1 as const, kind: 'skillfit.eval-plan' as const,
    request, requestSha256, policySha256: policyHash(request.policy), implementationSha256, evaluation });
  const planData = describe(prepared), previewSha256 = sha256Text(JSON.stringify(planData));
  const plan = { ...planData, sha256: previewSha256 };
  if (options.dryRun) return { schemaVersion: 1, kind: 'skillfit.eval-result', status: 'planned', plan,
    acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false,
      reasons: [{ code: 'PLAN_ONLY', message: 'No agent call or outcome is available.' }] } };
  if (!options.expectedPlanSha256 || !/^[0-9a-f]{64}$/i.test(options.expectedPlanSha256) || options.expectedPlanSha256.toLowerCase() !== previewSha256) {
    throw new Error('Execution requires --plan-sha matching the current dry-run plan; inputs, policy, executor or implementation changed.');
  }
  const component: ComponentMetadata = { schemaVersion: 1, requestSha256, previewSha256, implementationSha256, policySha256: policyHash(request.policy),
    purpose: request.purpose, policy: request.policy, synthetic: options.executor !== undefined };
  try {
    await runEval({ ...base, dryRun: false, component, guardFiles: [{ label: 'component request', path, sha256: requestSha256 }],
      onPlan: preview => { if (sha256Text(JSON.stringify(describe(preview))) !== previewSha256) throw new Error('Plan changed before execution; no calls allowed.'); } });
  } catch (error) {
    if (!existsSync(join(runDir, '_plan.json'))) throw error;
    const result = await reportEvalComponent(runDir);
    return { ...result, status: 'stopped', plan, executionError: error instanceof Error ? error.message : String(error),
      acceptance: { ...result.acceptance, decision: result.acceptance.decision === 'reject' ? 'reject' : 'inconclusive', eligibleForUpgrade: false,
        reasons: [...result.acceptance.reasons, { code: 'EXECUTION_STOPPED', message: 'Request execution failed; inspect retained receipts before a fresh declaration.' }] } };
  }
  return { ...await reportEvalComponent(runDir), plan };
}
