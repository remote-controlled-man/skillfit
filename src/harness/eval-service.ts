import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RUN_GROUP_PATTERN } from './constants.js';
import { ExperimentSession } from './experiment-session.js';
import { runExperiment } from './runner.js';
import type { RunManifest } from './report.js';
import { runTriggerExperiment, type TriggerManifest } from './trigger.js';
import { collectInstalledSkillFingerprint } from './bundle.js';
import { nativeDiffDescriptor } from './native-diff.js';
import type { Bench, EvaluationTarget, SkillBundle } from './types.js';
import { withEvaluationInterrupts, throwIfEvaluationInterrupted } from './interruption.js';
import { checkEvalCases } from './eval-preflight.js';
import { assertAgentEnvironment, assertAgentEnvironmentUnchanged } from './agent-preflight.js';
import { assertBenchClaimSupported } from './measurement-scope.js';
import { resolveEvalInputs, prepareEvaluation, confirmEvalPlan, plannedEvalResult, type ResolvedEvalInputs } from './eval-planning.js';
import { readEvaluation } from './eval-read-service.js';
import { loadEvalRequest, policyHash, type ComponentMetadata } from './eval-contract.js';
import type { EvalOptions, EvalPreview, EvalPlanContext, ComponentRunOptions, ComponentPlanContext } from './eval-options.js';

export interface EvalPresentation {
  preview?: (resolved: ResolvedEvalInputs, sha256: string) => void;
  resolved?: (resolved: ResolvedEvalInputs) => void;
  dispatch?: (resolved: ResolvedEvalInputs) => void;
  completed?: (manifest: RunManifest | TriggerManifest, resolved: ResolvedEvalInputs) => void;
}

function sessionFor(options: EvalOptions, bench: Bench, target: EvaluationTarget, trials: number,
  runsRoot: string, runGroup: string, armNames: string[], plannedCalls: number,
  details: Record<string, unknown>, baselineTarget?: EvaluationTarget): ExperimentSession {
  if (!RUN_GROUP_PATTERN.test(runGroup)) throw new Error(`Invalid run group: ${runGroup}`);
  return new ExperimentSession({ bench, target, baselineTarget, groupDir: join(runsRoot, runGroup), plannedCalls,
    maxCalls: options.maxCalls, agent: options.agent, injected: options.executor !== undefined,
    ...options.sessionOptions, guardFiles: options.guardFiles,
    workspaces: bench.tasks.flatMap(task => armNames.flatMap(arm =>
      Array.from({ length: trials }, (_, i) => join(runsRoot, runGroup, task.id, arm, `trial-${i + 1}`)))),
    details: { ...details, ...(options.taskIds ? { taskIds: bench.tasks.map(task => task.id) } : {}) } });
}

async function executeTrigger(resolved: ResolvedEvalInputs, presentation: EvalPresentation): Promise<TriggerManifest> {
  const { options, bench, target, executor, trials, runsRoot, runGroup, skillInstallDir, inspect } = resolved;
  const { agentPreflight, plannedCalls, spendingBudget, executorTimeoutSeconds } = resolved.preview;
  const scope = resolved.preview.measurementScope!;
  const log = options.log ?? (() => {});
  const skill = target as SkillBundle, installDir = skillInstallDir;
  const { installedFingerprint, competition, detection, triggerDetection: observation } = resolved.preview;
  const competitors = resolved.competitors;
  assertAgentEnvironment(agentPreflight);
  if (!executor) {
    throw new Error('No executor available for trigger mode; pass --agent.');
  }
  if (!installDir) {
    throw new Error(
      'trigger mode needs a skill install directory: pass --agent (the matrix provides one) or skillInstallDir.',
    );
  }
  return withEvaluationInterrupts(async () => {
    if (existsSync(join(runsRoot, runGroup))) throw new Error(`Run group directory already exists: ${join(runsRoot, runGroup)}`);
    const eligible = { ...bench, tasks: bench.tasks.filter(t => t.shouldTrigger !== undefined) };
    const casePreflight = await checkEvalCases(eligible, [skill], false, log);
    assertAgentEnvironmentUnchanged(agentPreflight, inspect());
    if (collectInstalledSkillFingerprint(skill.sourceDir).sha256 !== installedFingerprint!.sha256 ||
        competitors.some(entry => collectInstalledSkillFingerprint(entry.sourceDir).sha256 !== entry.sha256)) {
      throw new Error('Installed Skill resources changed during case preflight; create a fresh plan. No calls started.');
    }
    throwIfEvaluationInterrupted();
    presentation.dispatch?.(resolved);
    const session = sessionFor(options, bench, skill, trials, runsRoot, runGroup, ['installed'], plannedCalls,
      { measurementScope: scope, mode: 'trigger', trials, executor: executor.describe(), casePreflight, agentPreflight,
        skillInstallDir: installDir, executorTimeoutSeconds, competition, detection,
        ...(observation ? { triggerDetection: observation } : {}),
        ...(options.reviewedPlan ? { reviewedPlan: options.reviewedPlan } : {}),
        ...(spendingBudget ? { spendingBudget } : {}) });
    let manifest: TriggerManifest;
    try {
      manifest = await runTriggerExperiment({
        bench,
        skill,
        executor: session.wrap(executor, 'agent'),
        session,
        trials,
        runsRoot,
        runGroup,
        skillInstallDir: installDir,
        competitors,
        detection: detection!,
        ...(observation ? { triggerDetection: observation } : {}),
        ...(spendingBudget ? { spendingBudget } : {}),
        log,
      });
      throwIfEvaluationInterrupted();
    } catch (error) { session.finish(error); throw error; }
    session.finish(undefined, manifest);
    presentation.completed?.(manifest, resolved);
    return manifest;
  });
}
async function executePaired(resolved: ResolvedEvalInputs, presentation: EvalPresentation): Promise<RunManifest> {
  const { options, bench, target, baselineTarget, executor, judge, trials, runsRoot, runGroup, inputMode, skillInstallDir, skillSearchDirs, inspect } = resolved;
  const { agentPreflight, pairOrder, plannedCalls, spendingBudget, executorTimeoutSeconds } = resolved.preview;
  const scope = resolved.preview.measurementScope!;
  const installed = resolved.preview.mode === 'installed';
  const log = options.log ?? (() => {});
  assertAgentEnvironment(agentPreflight);
  if (!executor) {
    throw new Error('No executor available; pass --agent or set SKILLFIT_API_KEY.');
  }

  return withEvaluationInterrupts(async () => {
    if (existsSync(join(runsRoot, runGroup))) throw new Error(`Run group directory already exists: ${join(runsRoot, runGroup)}`);
    const casePreflight = await checkEvalCases(bench, [target, ...(baselineTarget ? [baselineTarget] : [])], installed, log);
    assertAgentEnvironmentUnchanged(agentPreflight, inspect());
    throwIfEvaluationInterrupted();
    presentation.dispatch?.(resolved);
    const session = sessionFor(options, bench, target, trials, runsRoot, runGroup, ['baseline', 'treatment'], plannedCalls,
      { measurementScope: scope, mode: installed ? 'installed' : 'inject', inputMode, trials, pairOrder, casePreflight, agentPreflight,
        ...(options.stopOnExecutionError ? { stopOnExecutionError: true } : {}),
        ...(options.reviewedPlan ? { reviewedPlan: options.reviewedPlan } : {}),
        ...(spendingBudget ? { spendingBudget } : {}),
        ...(installed ? { nativeDiffTool: nativeDiffDescriptor() } : {}),
        executorTimeoutSeconds, executor: executor.describe(), judge: judge?.describe() ?? null,
        ...(options.component ? { component: options.component } : {}),
        ...(baselineTarget ? { baselineTarget: { name: baselineTarget.name, sourceDir: baselineTarget.sourceDir, bundleSha256: baselineTarget.sha256, files: baselineTarget.files } } : {}) }, baselineTarget);
    let manifest: RunManifest;
    try {
      manifest = await runExperiment({
        bench,
        target,
        baselineTarget,
        component: options.component,
        pairOrder,
        stopOnExecutionError: options.stopOnExecutionError,
        ...(spendingBudget ? { spendingBudget } : {}),
        inputMode,
        ...(skillInstallDir ? { skillInstallDir, skillSearchDirs } : {}),
        executor: session.wrap(executor, 'agent'),
        judge: judge ? session.wrap(judge, 'judge') : null,
        session,
        trials,
        runsRoot,
        runGroup,
        log,
      });
      throwIfEvaluationInterrupted();
    } catch (error) { session.finish(error); throw error; }
    session.finish(undefined, manifest);
    presentation.completed?.(manifest, resolved);
    return manifest;
  });
}
/** Re-resolve without effects, reject drift, then gate and dispatch the frozen population. */
export async function executeEvalPlan(resolved: ResolvedEvalInputs,
  assertCurrent?: (preview: EvalPreview) => void, presentation: EvalPresentation = {}): Promise<RunManifest | TriggerManifest> {
  const current = resolveEvalInputs({ ...resolved.options, dryRun: false }, resolved.dependencies);
  if (JSON.stringify(current.preview) !== JSON.stringify(resolved.preview)) throw new Error('Plan changed before execution; no calls allowed.');
  assertCurrent?.(current.preview);
  assertBenchClaimSupported(current.preview.measurementScope!);
  presentation.resolved?.(current);
  current.options.onPlan?.(current.preview);
  return current.preview.mode === 'trigger' ? executeTrigger(current, presentation) : executePaired(current, presentation);
}

/** Ordinary and synthetic-suite adapters share preparation, confirmation, dispatch and assessment. */
export async function runEvaluation<T extends object>(options: EvalOptions, expectedPlanSha256: string | undefined,
  context: EvalPlanContext<T>, presentation: EvalPresentation = {}) {
  const prepared = prepareEvaluation(options, context), { plan } = prepared;
  if (options.dryRun) { presentation.preview?.(prepared.resolved, plan.sha256); return plannedEvalResult(plan); }
  if (expectedPlanSha256 !== undefined) confirmEvalPlan(expectedPlanSha256, plan.sha256);
  const runDir = plan.evaluation.outputDir;
  try {
    const execution = { ...prepared.resolved, options: { ...prepared.options, dryRun: false, reviewedPlan: plan } };
    await executeEvalPlan(execution, prepared.assertCurrent, presentation);
  } catch (error) {
    if (!existsSync(join(runDir, '_plan.json'))) throw error;
    const result = await readEvaluation(runDir);
    return { ...result, status: 'stopped', plan, executionError: error instanceof Error ? error.message : String(error),
      acceptance: { ...result.acceptance, decision: result.acceptance.decision === 'reject' ? 'reject' : 'inconclusive', eligibleForUpgrade: false,
        reasons: [...result.acceptance.reasons, { code: 'EXECUTION_STOPPED', message: 'Execution stopped; retained receipts do not authorize an upgrade.' }] } };
  }
  return { ...await readEvaluation(runDir), plan };
}
async function pairedComponentReport(path: string) {
  const result = await readEvaluation(path);
  if ('evaluationType' in result) throw new Error('A revision request must produce paired evaluation evidence.');
  return result;
}

/** Machine interface to the existing installed A/B engine; never installs an accepted candidate. */
export async function runComponentEvaluation(requestPath: string, options: ComponentRunOptions, presentation: EvalPresentation = {}) {
  const path = resolve(requestPath), { request, sha256: requestSha256 } = loadEvalRequest(path);
  const runDir = join(request.runsRoot, request.runGroup);
  if (existsSync(runDir)) throw new Error('Run group already exists; declare a fresh group without overwriting evidence.');
  const base: EvalOptions = { skillPath: request.candidateSkill, baselineSkillPath: request.baselineSkill ?? undefined,
    policy: request.policy, bench: request.bench, agent: request.agent, mode: 'installed', inputMode: 'workspace', trials: request.trials,
    maxCalls: request.maxCalls, pairOrder: request.pairOrder, runsRoot: request.runsRoot, runGroup: request.runGroup, yes: true, dryRun: true,
    executorTimeoutSeconds: request.executorTimeoutSeconds,
    ...(request.taskIds ? { taskIds: request.taskIds } : {}),
    ...(request.spendingBudget ? { spendingBudget: request.spendingBudget } : {}),
    judgeExecutor: null, executor: options.executor, sessionOptions: options.sessionOptions,
    skillInstallDir: options.skillInstallDir, log: options.log ?? (() => {}) };
  const context: ComponentPlanContext = { kind: 'component', fields: { request, requestSha256, policySha256: policyHash(request.policy) } };
  const prepared = prepareEvaluation(base, context);
  const { plan } = prepared, { sha256: previewSha256, implementationSha256 } = plan;
  if (plan.evaluation.judge) throw new Error('Component requires a paired installed Skill evaluation without a judge.');
  if (options.dryRun) return plannedEvalResult(plan);
  confirmEvalPlan(options.expectedPlanSha256, previewSha256);
  const component: ComponentMetadata = { schemaVersion: 1, requestSha256, previewSha256, implementationSha256, policySha256: policyHash(request.policy),
    purpose: request.purpose, policy: request.policy, synthetic: options.executor !== undefined };
  try {
    const execution = { ...prepared.resolved, options: { ...prepared.options, dryRun: false, component,
      guardFiles: [{ label: 'component request', path, sha256: requestSha256 }] } };
    await executeEvalPlan(execution, prepared.assertCurrent, presentation);
  } catch (error) {
    if (!existsSync(join(runDir, '_plan.json'))) throw error;
    const result = await pairedComponentReport(runDir);
    return { ...result, status: 'stopped', plan, executionError: error instanceof Error ? error.message : String(error),
      acceptance: { ...result.acceptance, decision: result.acceptance.decision === 'reject' ? 'reject' : 'inconclusive', eligibleForUpgrade: false,
        reasons: [...result.acceptance.reasons, { code: 'EXECUTION_STOPPED', message: 'Request execution failed; inspect retained receipts before a fresh declaration.' }] } };
  }
  return { ...await pairedComponentReport(runDir), plan };
}
