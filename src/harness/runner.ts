import { withSampling } from './types.js';
export { withSampling } from './types.js';
import { measurementScope, requestedClaimFor, assertBenchClaimSupported } from './measurement-scope.js';
import { summarizeExperiment, type TrialOutcome, type TaskOutcomes } from './trial-summary.js';
export type { TrialOutcome } from './trial-summary.js';
export { summarizeJudge } from './judge-protocol.js';
import { applyOverlay, createTrialWorkspace, engagementError, gitInit } from './trial-workspace.js';
export { engagementError, gitInit } from './trial-workspace.js';
import { runVerifier, verifierFailure, verifierLogFor } from './verifier.js';
export { runVerifier, verifierFailure, verifierLogFor } from './verifier.js';
export type { ProcessResult } from './process.js';
import { unknownModelIdentity, identityForResult, modelIdentities, type ModelIdentity } from './model-identity.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExperimentSession } from './experiment-session.js';
import { RUN_GROUP_PATTERN } from './constants.js';
import { assertInstalledSkillFixtures, assertSkillRevisionTargets, installSkillResources, installedSkillDestination } from './installed-skill.js';
import { collectInstalledSkillFingerprint } from './bundle.js';
import { JudgePairFailure, judgePair, type JudgeCallReceipt, type JudgeResult } from './judge.js';
import { throwIfEvaluationInterrupted } from './interruption.js';
import { assertInputModeSupported, buildTaskPrompt, snapshotRepoFiles } from './prompt.js';
import {
  buildWarnings,
  type RunManifest,
} from './report.js';
import { assertNativeDiffFixtures, assertNativeDiffWorkspace, installNativeDiffTool, nativeDiffDescriptor, NATIVE_DIFF_GUIDANCE, snapshotNativeDiffTool } from './native-diff.js';
import type { Bench, Condition, EvaluationTarget, Executor, ExecutorDescriptor, InputMode, PairOrder, TokenUsage, UsageEvidence } from './types.js';
import { pairConditions } from './types.js';
import { ExecutorFailure } from './types.js';
import { executionClock, type ExecutionClock, type ExecutionTiming } from './execution-timing.js';
import type { ComponentMetadata } from './eval-contract.js';
import { verdictFromOutput, type VerifierCheck } from './verifier-summary.js';
import { createSpendingBudgetRecorder, parseSpendingBudget, type SpendingBudget } from './eval-budget.js';
import { summarizeInvocationCosts } from './invocation-costs.js';

export interface ExperimentPlan {
  component?: ComponentMetadata;
  bench: Bench;
  target: EvaluationTarget;
  baselineTarget?: EvaluationTarget;
  inputMode?: InputMode;
  skillInstallDir?: string;
  skillSearchDirs?: readonly string[];
  session?: ExperimentSession;
  executor: Executor;
  judge?: Executor | null;
  trials: number;
  pairOrder?: PairOrder;
  runsRoot: string;
  runGroup: string;
  log?: (msg: string) => void;
  spendingBudget?: SpendingBudget;
  /** Only an offline control asks to stop immediately after retaining an error. */
  stopOnExecutionError?: true;
  /** Injectable clocks for offline duration checks. */
  clock?: ExecutionClock;
}

export async function runTrial(
  plan: ExperimentPlan,
  taskId: string,
  condition: Condition,
  trial: number,
): Promise<TrialOutcome> {
  throwIfEvaluationInterrupted();
  const { bench, executor } = plan;
  const target = condition === 'baseline' && plan.baselineTarget ? plan.baselineTarget : plan.target;
  if (plan.baselineTarget) {
    if (!plan.skillInstallDir) throw new Error('Skill revision comparison requires installed delivery.');
    assertSkillRevisionTargets(plan.target, plan.baselineTarget);
  }
  const inputMode = plan.inputMode ?? 'snapshot';
  assertInputModeSupported(inputMode, executor);
  if (plan.skillInstallDir) {
    if (target.kind !== 'skill' || inputMode !== 'workspace') {
      throw new Error('Installed Skill delivery requires a Skill target and workspace input.');
    }
    for (const skill of [plan.target, ...(plan.baselineTarget ? [plan.baselineTarget] : [])]) {
      if (collectInstalledSkillFingerprint(skill.sourceDir).sha256 !== skill.sha256) {
        throw new Error('Skill resources changed after planning; freeze the input again before running.');
      }
    }
  }
  const task = bench.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  const runDir = join(plan.runsRoot, plan.runGroup, task.id, condition, `trial-${trial}`);
  createTrialWorkspace(join(bench.dir, task.fixture), runDir, { removeMockMarker: executor.describe().kind !== 'mock' });
  // Keep the prompt byte-identical across conditions. Workspace configuration is copied only after
  // taking the fixture snapshot, so a rules or MCP treatment is discovered through the agent's real
  // project configuration loader instead of being disclosed in treatment-only prompt text.
  const snapshot = inputMode === 'snapshot' ? snapshotRepoFiles(runDir) : '';
  const overlay = target.overlays[condition];
  if (overlay) applyOverlay(overlay, runDir);
  if (plan.skillInstallDir) {
    const destination = installedSkillDestination(runDir, plan.skillInstallDir, target.name);
    if (existsSync(destination)) throw new Error('Fixture already contains the evaluated Skill: ' + destination);
    if (condition === 'treatment' || plan.baselineTarget) installSkillResources(target, runDir, plan.skillInstallDir);
    installNativeDiffTool(runDir);
  }
  const gitInitialized = await gitInit(runDir);
  throwIfEvaluationInterrupted();

  const taskPromptText = readFileSync(join(bench.dir, task.prompt), 'utf8');
  const prompt = buildTaskPrompt(
    taskPromptText,
    snapshot,
    condition === 'treatment' && !plan.skillInstallDir ? target.payload : null,
    // Workspace configuration experiments must let the agent use its configured tools and inspect
    // the project even when the final answer is graded as text. Skill-only output benches retain the
    // stricter prompt isolation used by the original harness.
    { workspace: task.verifierKind === 'command' || target.kind !== 'skill', inputMode },
  ) + (plan.skillInstallDir ? '\n' + NATIVE_DIFF_GUIDANCE + '\n' : '');
  writeFileSync(join(runDir, '_prompt.txt'), prompt, 'utf8');

  const clock = plan.clock ?? executionClock;
  const started = new Date(clock.wallNow());
  const startedMonotonic = clock.monotonicNow();
  let executionTiming: ExecutionTiming | null = null;
  let usageEvidence: UsageEvidence | undefined;
  let output = '';
  let error: string | null = null;
  let tokens: TokenUsage | null = null;
  let rawOutput: string | null = null;
  let modelIdentity: ModelIdentity | undefined;
  let skillTriggered: boolean | null = null;
  let executorInvoked = false;
  let usageStatus: TrialOutcome['usageStatus'] = 'unknown';
  try {
    if (!gitInitialized && task.verifierKind === 'command') {
      throw new Error('Benchmark Git initialization or reflog verification failed; command task was not executed.');
    }
    executorInvoked = true;
    const result = await executor.run(prompt, runDir);
    output = result.output;
    tokens = result.tokens ?? null;
    rawOutput = result.rawOutput ?? null;
    modelIdentity = identityForResult(result, executor.describe());
    skillTriggered = result.skillTriggered ?? null;
    usageStatus = result.usageStatus ?? 'final';
    executionTiming = result.executionTiming ?? null;
    usageEvidence = result.usageEvidence;
    error = result.guardError ?? null;
    if (plan.skillInstallDir && !error) assertNativeDiffWorkspace(runDir);
  } catch (executorError) {
    error = (executorError as Error).message;
    if (executorError instanceof ExecutorFailure) {
      executorInvoked = executorError.executorInvoked;
      output = executorError.result.output;
      tokens = executorError.result.tokens ?? null;
      rawOutput = executorError.result.rawOutput ?? null;
      modelIdentity = identityForResult(executorError.result, executor.describe());
      skillTriggered = executorError.result.skillTriggered ?? null;
      usageStatus = executorError.result.usageStatus ?? (tokens ? 'partial' : 'unknown');
      executionTiming = executorError.result.executionTiming ?? null;
      usageEvidence = executorError.result.usageEvidence;
    }
  }
  if (error === null) {
    error = await engagementError(output, task.verifierKind, runDir, gitInitialized);
  }
  const finished = new Date(clock.wallNow());
  const durationSeconds = Math.round(clock.monotonicNow() - startedMonotonic) / 1000;
  writeFileSync(join(runDir, '_output.md'), output, 'utf8');
  if (rawOutput !== null) writeFileSync(join(runDir, '_transcript.jsonl'), rawOutput, 'utf8');

  let verifierExitCode: number | null = null;
  let passed = false;
  let verifierPassed: boolean | null = null;
  let score: number | null = null;
  let checks: VerifierCheck[] | null = null;
  if (error === null) {
    const verifier = await runVerifier(bench.dir, task.verifier, runDir, task.verifierTimeoutSeconds);
    verifierExitCode = verifier.exitCode;
    writeFileSync(join(runDir, '_verifier.txt'), verifierLogFor(verifier), 'utf8');
    if (verifier.error !== null || verifier.exitCode === null) {
      error = verifierFailure('verifier', task.verifier, verifier.error);
    } else {
      passed = verifier.exitCode === 0;
      const verdict = verdictFromOutput(verifier.output);
      if (verdict) {
        verifierPassed = verdict.passed;
        checks = verdict.checks;
        score = verdict.score;
      }
    }
  } else {
    writeFileSync(join(runDir, '_executor-error.txt'), error, 'utf8');
  }

  const record: TrialOutcome = {
    taskId,
    condition,
    trial,
    runDir,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationSeconds,
    timing: { clock: 'performance.now', wallDurationSeconds: (finished.getTime() - started.getTime()) / 1000, execution: executionTiming },
    passed,
    verifierExitCode,
    verifierPassed,
    score,
    checks,
    error,
    output,
    tokens,
    executorInvoked,
    modelIdentity: modelIdentity ?? unknownModelIdentity(executor.describe().modelIntent),
    usageStatus,
    ...(usageEvidence ? { usageEvidence } : {}),
    gitInitialized,
    ...(plan.skillInstallDir ? { skillTriggered } : {}),
  };
  const { output: _output, ...serializable } = record;
  writeFileSync(
    join(runDir, '_result.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        inputMode,
        ...(plan.skillInstallDir ? { skillDelivery: { mode: 'installed', installDir: plan.skillInstallDir } } : {}),
        ...serializable,
        runGroup: plan.runGroup,
        target: {
          kind: target.kind,
          name: target.name,
          bundleSha256: target.sha256,
          applied: condition === 'treatment' || plan.baselineTarget !== undefined || target.overlays.baseline !== undefined,
        },
        executor: withSampling(executor.describe()),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return record;
}


async function judgeTaskTrials(
  plan: ExperimentPlan,
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
  allJudgeCalls: JudgeCallReceipt[],
  budget: ReturnType<typeof createSpendingBudgetRecorder>,
): Promise<JudgeResult[]> {
  const judge = plan.judge;
  if (!judge) return [];
  const task = plan.bench.tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const taskPromptText = readFileSync(join(plan.bench.dir, task.prompt), 'utf8');
  const rubricText = task.rubric ? readFileSync(join(plan.bench.dir, task.rubric), 'utf8') : null;
  const results: JudgeResult[] = [];
  for (let trial = 1; trial <= plan.trials; trial++) {
    const baseline = outcomes.baseline.find((r) => r.trial === trial);
    const treatment = outcomes.treatment.find((r) => r.trial === trial);
    if (!baseline || !treatment || baseline.error !== null || treatment.error !== null) continue;
    // Output location only — the judge never runs here (see judgePair, which sandboxes its own cwd
    // so it cannot read either arm's _result.json and infer which answer is which).
    const taskDir = join(plan.runsRoot, plan.runGroup, task.id);
    const seed = `${plan.runGroup}:${task.id}:${trial}`;
    try {
      const result = await judgePair(judge, {
        taskPromptText,
        rubricText,
        baselineOutput: baseline.output,
        treatmentOutput: treatment.output,
        seed,
        taskId: task.id,
        trial,
        clock: plan.clock,
        beforeCall: callIndex => budget.before({ role: 'judge', taskId: task.id, trial, callIndex }),
        onCall: receipt => {
          const path = join(taskDir, `judge-trial-${trial}`);
          mkdirSync(path, { recursive: true });
          writeFileSync(join(path, `call-${receipt.callIndex}.json`), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
          allJudgeCalls.push(receipt);
          budget.after({ role: 'judge', taskId: task.id, trial, callIndex: receipt.callIndex }, receipt);
        },
      });
      results.push(result);
      writeFileSync(
        join(taskDir, `judge-trial-${trial}.json`),
        `${JSON.stringify({ trial, seed, ...result }, null, 2)}\n`,
        'utf8',
      );
    } catch (error) {
      writeFileSync(join(taskDir, `judge-trial-${trial}-error.json`), JSON.stringify({ schemaVersion: 1, trial, seed,
        error: (error as Error).message, calls: error instanceof JudgePairFailure ? error.calls : [], automaticRetry: false }, null, 2) + '\n', { flag: 'wx' });
      throwIfEvaluationInterrupted();
      plan.log?.(`Judge failed for ${task.id} trial ${trial}: ${(error as Error).message}`);
      throw error;
    }
  }
  return results;
}

export async function runExperiment(plan: ExperimentPlan): Promise<RunManifest> {
  const scope = measurementScope(plan.bench, requestedClaimFor('paired', plan.component?.policy, !!plan.stopOnExecutionError));
  assertBenchClaimSupported(scope);
  if (plan.stopOnExecutionError && plan.executor.describe().kind !== 'mock') throw new Error('stopOnExecutionError requires an offline mock executor.');
  const budget = plan.spendingBudget === undefined ? undefined : parseSpendingBudget(plan.spendingBudget);
  assertInputModeSupported(plan.inputMode ?? 'snapshot', plan.executor);
  const pairOrder = plan.pairOrder ?? 'baseline-first';
  if (pairOrder !== 'baseline-first' && pairOrder !== 'balanced') throw new Error('pairOrder must be baseline-first or balanced.');
  if (plan.baselineTarget) {
    if (!plan.skillInstallDir) throw new Error('Skill revision comparison requires installed delivery.');
    assertSkillRevisionTargets(plan.target, plan.baselineTarget);
  }
  if (plan.skillInstallDir) {
    if (plan.target.kind !== 'skill' || plan.inputMode !== 'workspace') {
      throw new Error('Installed Skill delivery requires a Skill target and workspace input.');
    }
    assertInstalledSkillFixtures(plan.bench, plan.target, plan.skillInstallDir, plan.skillSearchDirs);
    assertNativeDiffFixtures(plan.bench);
  }
  if (!RUN_GROUP_PATTERN.test(plan.runGroup)) {
    throw new Error(
      `Invalid run group "${plan.runGroup}": must match ${RUN_GROUP_PATTERN} (got characters outside [A-Za-z0-9._-] or a leading dot/hyphen)`,
    );
  }
  if (!Number.isInteger(plan.trials) || plan.trials < 1 || plan.trials > 20) {
    throw new Error(`trials must be an integer between 1 and 20, got ${plan.trials}`);
  }
  const groupDir = join(plan.runsRoot, plan.runGroup);
  if (existsSync(groupDir)) {
    if (plan.session?.groupDir !== resolve(groupDir)) throw new Error(`Run group directory already exists: ${groupDir}`);
    plan.session.assertPrepared();
  }
  mkdirSync(groupDir, { recursive: true });
  if (plan.skillInstallDir) snapshotNativeDiffTool(groupDir);

  const taskOutcomes: TaskOutcomes[] = [];
  const allOutcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  const budgetRecorder = createSpendingBudgetRecorder({ budget, groupDir });
  const allJudgeCalls: JudgeCallReceipt[] = [];
  for (const [taskIndex, task] of plan.bench.tasks.entries()) {
    const outcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
    // Interleaved: the trial loop is outermost so the two arms of a pair run adjacently. Running
    // every baseline trial before every treatment trial confounds condition with elapsed time —
    // provider drift or rate-limit degradation would land entirely on one arm.
    for (let trial = 1; trial <= plan.trials; trial++) {
      for (const condition of pairConditions(pairOrder, taskIndex, trial)) {
        throwIfEvaluationInterrupted();
        budgetRecorder.before({ taskId: task.id, condition, trial });
        plan.log?.(`Running ${task.id} / ${condition} / trial ${trial}…`);
        const outcome = await runTrial(plan, task.id, condition, trial);
        outcomes[condition].push(outcome);
        allOutcomes[condition].push(outcome);
        budgetRecorder.after({ taskId: task.id, condition, trial }, outcome);
        throwIfEvaluationInterrupted();
        if (plan.stopOnExecutionError && outcome.error !== null) throw new Error(outcome.error);
        // A reached line prevents the next call; incomplete or failed evidence stops even
        // after the final scheduled call. One in-flight invocation may cross a stop line.
      }
    }
    const judgeResults = await judgeTaskTrials(plan, task.id, outcomes, allJudgeCalls, budgetRecorder);
    taskOutcomes.push({ id: task.id, outcomes, judgeResults });
  }

  const summary = summarizeExperiment(taskOutcomes, !!plan.skillInstallDir);
  plan.session?.settle();
  const manifestWithoutWarnings: Omit<RunManifest, 'warnings'> = {
    schemaVersion: 4,
    measurementScope: scope,
    modelIdentities: modelIdentities(
      [...allOutcomes.baseline, ...allOutcomes.treatment].filter(r => r.executorInvoked).map(r => ({ receipt: `${r.taskId}/${r.condition}/trial-${r.trial}/_result.json`, identity: r.modelIdentity ?? null })),
      allJudgeCalls.filter(r => r.executorInvoked).map(r => ({ receipt: `${r.taskId}/judge-trial-${r.trial}/call-${r.callIndex}.json`, identity: r.modelIdentity ?? null }))),
    invocationCosts: summarizeInvocationCosts([...allOutcomes.baseline, ...allOutcomes.treatment], allJudgeCalls, !!plan.judge),
    ...(plan.component ? { component: plan.component } : {}),
    ...(plan.session ? { experiment: plan.session.summary() } : {}),
    inputMode: plan.inputMode ?? 'snapshot',
    pairOrder,
    ...(plan.skillInstallDir ? { skillDelivery: { mode: 'installed' as const, installDir: plan.skillInstallDir } } : {}),
    ...(plan.skillInstallDir ? { nativeDiffTool: nativeDiffDescriptor() } : {}),
    runGroup: plan.runGroup,
    createdAt: new Date().toISOString(),
    target: {
      kind: plan.target.kind,
      name: plan.target.name,
      sourceDir: plan.target.sourceDir,
      bundleSha256: plan.target.sha256,
      files: plan.target.files,
    },
    ...(plan.baselineTarget ? { baselineTarget: {
      kind: 'skill' as const,
      name: plan.baselineTarget.name,
      sourceDir: plan.baselineTarget.sourceDir,
      bundleSha256: plan.baselineTarget.sha256,
      files: plan.baselineTarget.files,
    } } : {}),
    bench: {
      name: plan.bench.name,
      dir: plan.bench.dir,
      contentSha256: plan.bench.contentSha256,
      taskCount: plan.bench.tasks.length,
    },
    executor: withSampling(plan.executor.describe()),
    judge: plan.judge ? withSampling(plan.judge.describe()) : null,
    trials: plan.trials,
    tasks: summary.tasks,
    overall: summary.overall,
  };
  const manifest: RunManifest = {
    ...manifestWithoutWarnings,
    warnings: buildWarnings(manifestWithoutWarnings),
  };
  writeFileSync(join(groupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
