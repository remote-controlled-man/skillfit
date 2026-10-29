import { measurementScope, assertBenchClaimSupported, type MeasurementScope } from "../measurement/scope.js";
import { summarizeTriggerTask, triggerMetrics, type TriggerMetrics, type TriggerTaskSummary, type TriggerTrialRecord } from "../measurement/trigger-summary.js";
export { triggerMetrics, type TriggerMetrics, type TriggerTaskSummary, type TriggerTrialRecord } from "../measurement/trigger-summary.js";
import { unknownModelIdentity, identityForResult, modelIdentities, type ModelIdentity } from "../../agents/observation/model-identity.js";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseFrontmatter } from "../../resources/frontmatter.js";
import { parseTriggerDetection, parseTriggerEvidence, type TriggerDetection, type TriggerEvidence } from "../../agents/observation/trigger-contract.js";
import type { ExperimentSession, ExperimentSummary } from "../records/session.js";
import { RUN_GROUP_PATTERN } from '../application/constants.js';
import { collectInstalledSkillFingerprint, collectSkillBundle, type InstalledSkillFingerprint } from "../../resources/skill.js";
import { OUTPUT_CONTRACT } from "./prompt.js";
import { createTrialWorkspace, engagementError, gitInit } from "../targets/workspace.js";
import { runVerifier, verifierFailure, verifierLogFor } from "../../bench/gates/verifier.js";
import { throwIfCancelled as throwIfEvaluationInterrupted } from "../../shared/cancellation.js";
import { ExecutorFailure } from "../../agents/contracts.js";
import { createSpendingBudgetRecorder, assertTokenBudgetSupport, type SpendingBudget } from "./budget.js";
import type { ExecutionTiming } from "../../shared/timing.js";
import { verdictFromOutput, type VerifierCheck } from "../../bench/gates/summary.js";
import type { Bench } from "../../bench/contracts.js";
import type { Executor, ExecutorDescriptor, TokenUsage, ExecutorRunOptions } from "../../agents/contracts.js";
import type { SkillBundle } from "../../resources/contracts.js";

export interface TriggerCompetitor {
  name: string;
  sourceDir: string;
  sha256: string;
}

export interface TriggerPlan {
  bench: Bench;
  skill: SkillBundle;
  executor: Executor;
  trials: number;
  runsRoot: string;
  runGroup: string;
  skillInstallDir: string;
  /** Other user Skills copied beside the Skill under test. Absent means it is installed alone. */
  competitors?: TriggerCompetitor[];
  /** How a fire was recognized. Codex has no Skill-invocation event. */
  detection?: 'skill-tool' | 'skill-read' | 'unrecorded';
  triggerDetection?: TriggerDetection;
  session?: ExperimentSession;
  spendingBudget?: SpendingBudget;
  log?: (msg: string) => void;
}

export interface TriggerManifest {
  measurementScope?: MeasurementScope;
  modelIdentities?: import("../../agents/observation/model-identity.js").ModelIdentities;
  schemaVersion: 1;
  mode: 'trigger';
  experiment?: ExperimentSummary;
  runGroup: string;
  createdAt: string;
  skill: {
    name: string;
    sourceDir: string;
    /** Injectable text identity, retained for compatibility with paired experiments. */
    bundleSha256: string;
    files: string[];
    /** All installed file paths and bytes before execution; absent in older v1 manifests. */
    installedSha256?: string;
    installedFiles?: string[];
  };
  bench: { name: string; dir: string; contentSha256: string; taskCount: number };
  executor: ExecutorDescriptor;
  trials: number;
  skillInstallDir: string;
  competition?: { mode: 'alone' | 'installed'; skills: { name: string; sha256: string }[] };
  detection?: 'skill-tool' | 'skill-read' | 'unrecorded';
  triggerDetection?: TriggerDetection;
  tasks: TriggerTaskSummary[];
  metrics: TriggerMetrics;
  warnings: string[];
}

async function runTriggerTrial(
  plan: TriggerPlan,
  taskId: string,
  trial: number,
  installedSkill: InstalledSkillFingerprint,
  runOptions?: ExecutorRunOptions,
): Promise<TriggerTrialRecord> {
  throwIfEvaluationInterrupted();
  const task = plan.bench.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  const runDir = join(plan.runsRoot, plan.runGroup, task.id, 'installed', `trial-${trial}`);
  createTrialWorkspace(join(plan.bench.dir, task.fixture), runDir, { removeMockMarker: true });
  const gitInitialized = await gitInit(runDir);
  throwIfEvaluationInterrupted();

  const taskPromptText = readFileSync(
    join(plan.bench.dir, task.promptTrigger ?? task.prompt),
    'utf8',
  );
  const prompt = `${[taskPromptText.trimEnd(), OUTPUT_CONTRACT].join('\n\n')}\n`;
  writeFileSync(join(runDir, '_prompt.txt'), prompt, 'utf8');

  const skillDest = join(runDir, plan.skillInstallDir, plan.skill.name);
  mkdirSync(dirname(skillDest), { recursive: true });
  cpSync(realpathSync(plan.skill.sourceDir), skillDest, { recursive: true });
  const observedSkill = collectInstalledSkillFingerprint(skillDest);
  if (observedSkill.sha256 !== installedSkill.sha256) {
    throw new Error(`Installed Skill content does not match the planned fingerprint for ${taskId} / trial ${trial}; keep the Skill input unchanged and remove any conflicting fixture Skill files.`);
  }
  for (const competitor of plan.competitors ?? []) {
    const dest = join(runDir, plan.skillInstallDir, competitor.name);
    if (existsSync(dest)) throw new Error(`Competing Skill collides with an existing directory: ${dest}`);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(realpathSync(competitor.sourceDir), dest, { recursive: true });
    if (collectInstalledSkillFingerprint(dest).sha256 !== competitor.sha256) {
      throw new Error(`Competing Skill "${competitor.name}" changed after planning; remove it from the run and start again.`);
    }
  }

  const started = new Date();
  const monotonicStarted = performance.now();
  let output = '';
  let rawOutput: string | null = null;
  let modelIdentity: ModelIdentity | undefined;
  let error: string | null = null;
  let tokens: TokenUsage | null = null;
  let failedUsage: TriggerTrialRecord['usageStatus'];
  let triggered: boolean | null = null;
  let budgetStop: TriggerTrialRecord['budgetStop'];
  let executorInvoked = false;
  let executionTiming: ExecutionTiming | undefined;
  const detection = plan.triggerDetection;
  let triggerEvidence: TriggerEvidence | undefined = detection
    ? { status: 'unknown', complete: false, matchedIdentity: null, eventLines: [] } : undefined;
  const observation = (result: import("../../agents/contracts.js").ExecutorResult) => {
    if (!detection) return;
    if (!isDeepStrictEqual(parseTriggerDetection(result.triggerDetection), detection)) throw new Error('Trigger detection declaration differs from the frozen plan.');
    const evidence = parseTriggerEvidence(result.triggerEvidence, detection);
    const expected = evidence.status === 'unknown' ? null : evidence.status === 'observed';
    if ((result.skillTriggered ?? null) !== expected) throw new Error('Trigger boolean contradicts its observation evidence.');
    triggerEvidence = evidence;
  };
  try {
    if (!gitInitialized && task.verifierKind === 'command') {
      throw new Error('Benchmark Git initialization or reflog verification failed; trigger task was not executed.');
    }
    executorInvoked = true;
    const result = await plan.executor.run(prompt, runDir, runOptions);
    output = result.output;
    rawOutput = result.rawOutput ?? null;
    modelIdentity = identityForResult(result, plan.executor.describe());
    tokens = result.tokens ?? null;
    triggered = result.skillTriggered ?? null;
    error = result.guardError ?? null;
    failedUsage = result.usageStatus ?? 'final';
    executionTiming = result.executionTiming;
    observation(result);
  } catch (executorError) {
    error = (executorError as Error).message;
    triggered = null;
    if (executorError instanceof ExecutorFailure) {
      budgetStop = executorError.result.budgetStop;
      executorInvoked = executorError.executorInvoked;
      output = executorError.result.output;
      rawOutput = executorError.result.rawOutput ?? null;
      modelIdentity = identityForResult(executorError.result, plan.executor.describe());
      tokens = executorError.result.tokens ?? null;
      triggered = executorError.result.skillTriggered ?? null;
      failedUsage = executorError.result.usageStatus ?? 'unknown';
      executionTiming = executorError.result.executionTiming;
      if (detection && executorError.result.triggerDetection !== undefined) {
        try { observation(executorError.result); } catch (invalid) { error += `; ${(invalid as Error).message}`; triggered = null; }
      } else if (detection) triggered = null;
    }
  }
  if (error === null) {
    error = await engagementError(output, task.verifierKind, runDir, gitInitialized);
  }
  const finished = new Date();
  const durationSeconds = Math.round((performance.now() - monotonicStarted)) / 1000;
  writeFileSync(join(runDir, '_output.md'), output, 'utf8');
  if (rawOutput !== null) {
    writeFileSync(join(runDir, '_transcript.jsonl'), rawOutput, 'utf8');
  }

  let passed = false;
  let score: number | null = null;
  let checks: VerifierCheck[] | null = null;
  if (error === null) {
    const verifier = await runVerifier(plan.bench.dir, task.verifier, runDir, task.verifierTimeoutSeconds);
    writeFileSync(join(runDir, '_verifier.txt'), verifierLogFor(verifier), 'utf8');
    if (verifier.error !== null || verifier.exitCode === null) {
      error = verifierFailure('verifier', task.verifier, verifier.error);
    } else {
      passed = verifier.exitCode === 0;
      const verdict = verdictFromOutput(verifier.output);
      if (verdict) {
        checks = verdict.checks;
        score = verdict.score;
      }
    }
  } else {
    writeFileSync(join(runDir, '_executor-error.txt'), error, 'utf8');
  }

  const record: TriggerTrialRecord = {
    taskId,
    trial,
    runDir,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationSeconds,
    wallDurationSeconds: Math.round(((finished.getTime() - started.getTime()) / 1000) * 1000) / 1000,
    executorInvoked,
    modelIdentity: modelIdentity ?? unknownModelIdentity(plan.executor.describe().modelIntent),
    ...(executionTiming ? { executionTiming } : {}),
    triggered,
    ...(detection ? { triggerDetection: detection, triggerEvidence } : {}),
    passed,
    score,
    checks,
    error,
    ...(budgetStop ? { budgetStop } : {}),
    tokens,
    ...(failedUsage ? { usageStatus: failedUsage } : {}),
  };
  writeFileSync(
    join(runDir, '_result.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        ...record,
        runGroup: plan.runGroup,
        skillBundleSha256: plan.skill.sha256,
        skillInstalledSha256: observedSkill.sha256,
        skillInstalledFiles: observedSkill.files,
        skillInstalledAt: join(plan.skillInstallDir, plan.skill.name),
        gitInitialized,
        executor: plan.executor.describe(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return record;
}

function buildTriggerWarnings(manifest: Omit<TriggerManifest, 'warnings'>): string[] {
  const warnings: string[] = [];
  if (manifest.metrics.negatives.runs === 0) {
    warnings.push(
      'No shouldTrigger:false tasks in this bench — the false-trigger rate is unmeasurable. Add negative-control tasks.',
    );
  }
  const unknown = manifest.tasks.reduce((sum, t) => sum + t.unknown, 0);
  if (unknown > 0) {
    warnings.push(
      `${unknown} run(s) had transcripts where trigger detection was impossible — excluded from recall/precision rates.`,
    );
  }
  const errors = manifest.tasks.reduce((sum, t) => sum + t.errors, 0);
  if (errors > 0) {
    warnings.push(`${errors} run(s) hit an executor, verifier, or engagement error — excluded from rates.`);
  }
  const competing = manifest.competition?.mode === 'installed' ? manifest.competition.skills : [];
  if (competing.length === 0) {
    warnings.push('Recall is an upper bound: the Skill under test was installed alone, with no other user Skills competing.');
  } else {
    warnings.push(`Recall faced ${competing.length} other user Skill(s): ${competing.map((skill) => skill.name).join(', ')}. System Skills and plugins outside the matrix user directories were not copied.`);
  }
  if (manifest.detection === 'skill-read') {
    warnings.push('Trigger detection counted a SKILL.md read, not a Skill-invocation event.');
  }
  if (manifest.tasks.some((task) => task.shouldTrigger) && !manifest.tasks.some((task) => task.triggerClass)) {
    warnings.push('Positive tasks have no triggerClass, so explicit, implicit, and contextual requests stay pooled.');
  }
  if (manifest.tasks.some((task) => task.shouldTrigger && !task.triggerClass) && manifest.tasks.some((task) => task.triggerClass)) {
    warnings.push('Some positive tasks have no triggerClass and stay in the pooled recall only.');
  }
  return warnings;
}

export async function runTriggerExperiment(plan: TriggerPlan): Promise<TriggerManifest> {
  const scope = measurementScope(plan.bench, 'activation');
  assertBenchClaimSupported(scope);
  const declared = parseTriggerDetection(plan.triggerDetection ?? plan.executor.describe().triggerDetection);
  if (plan.triggerDetection && !isDeepStrictEqual(declared, parseTriggerDetection(plan.executor.describe().triggerDetection))) {
    throw new Error('Trigger executor declaration differs from the frozen plan.');
  }
  if (declared && (!declared.identities.includes(plan.skill.name) || (plan.detection !== undefined &&
      plan.detection !== (declared.method === 'skill-file-read-command' ? 'skill-read' : 'skill-tool')))) {
    throw new Error('Trigger identity or detection label contradicts the declared target/protocol.');
  }
  plan = { ...plan, ...(declared ? { triggerDetection: declared,
    detection: plan.detection ?? (declared.method === 'skill-file-read-command' ? 'skill-read' : 'skill-tool') } : {}) };
  if (declared?.method === 'skill-file-read-command' && !declared.skillPaths.includes(`${plan.skillInstallDir.replaceAll('\\', '/')}/${plan.skill.name}/SKILL.md`)) {
    throw new Error('Registered Skill read paths do not include the installed target from the trigger plan.');
  }
  if (declared) for (const competitor of plan.competitors ?? []) {
    const alias = parseFrontmatter(readFileSync(join(competitor.sourceDir, 'SKILL.md'), 'utf8'))?.name;
    if (declared.identities.includes(competitor.name) || (alias && declared.identities.includes(alias))) {
      throw new Error('Competing Skill has a conflicting registered trigger identity: ' + competitor.name);
    }
  }
  if (!RUN_GROUP_PATTERN.test(plan.runGroup)) {
    throw new Error(
      `Invalid run group "${plan.runGroup}": must match ${RUN_GROUP_PATTERN} (got characters outside [A-Za-z0-9._-] or a leading dot/hyphen)`,
    );
  }
  if (!Number.isInteger(plan.trials) || plan.trials < 1 || plan.trials > 20) {
    throw new Error(`trials must be an integer between 1 and 20, got ${plan.trials}`);
  }
  if (plan.executor.describe().kind === 'mock') {
    throw new Error('Trigger mode requires a real CLI executor with trigger detection; the mock executor cannot invoke skills.');
  }
  assertTokenBudgetSupport([plan.executor], undefined, plan.spendingBudget);
  const groupDir = join(plan.runsRoot, plan.runGroup);
  if (existsSync(groupDir)) {
    if (plan.session?.groupDir !== resolve(groupDir)) throw new Error(`Run group directory already exists: ${groupDir}`);
    plan.session.assertPrepared();
  }
  const installedSkill = collectInstalledSkillFingerprint(plan.skill.sourceDir);
  if (collectSkillBundle(plan.skill.sourceDir, plan.skill.name).sha256 !== plan.skill.sha256) {
    throw new Error('Skill input changed after planning; collect a new Skill bundle before starting the trigger experiment.');
  }
  mkdirSync(groupDir, { recursive: true });

  const eligible = plan.bench.tasks.filter((task) => task.shouldTrigger !== undefined);
  const skipped = plan.bench.tasks.length - eligible.length;
  if (skipped > 0) {
    plan.log?.(`Skipping ${skipped} task(s) without a shouldTrigger label.`);
  }

  const allRecords: TriggerTrialRecord[] = [];
  const taskSummaries: TriggerTaskSummary[] = [];
  const budget = createSpendingBudgetRecorder({ budget: plan.spendingBudget, groupDir });
  for (const task of eligible) {
    const records: TriggerTrialRecord[] = [];
    for (let trial = 1; trial <= plan.trials; trial++) {
      throwIfEvaluationInterrupted();
      plan.log?.(`Running ${task.id} / installed / trial ${trial}…`);
      const identity = { taskId: task.id, trial, condition: 'installed' as const };
      const runOptions = budget.before(identity);
      const outcome = await runTriggerTrial(plan, task.id, trial, installedSkill, runOptions);
      records.push(outcome); allRecords.push(outcome);
      budget.after(identity, { ...outcome, executorInvoked: outcome.executorInvoked ?? false, usageStatus: outcome.usageStatus ?? 'unknown' });
      throwIfEvaluationInterrupted();
    }
    taskSummaries.push(summarizeTriggerTask(task.id, task.shouldTrigger ?? false, task.triggerClass, records));
  }

  plan.session?.settle();
  const manifestWithoutWarnings: Omit<TriggerManifest, 'warnings'> = {
    schemaVersion: 1,
    mode: 'trigger',
    measurementScope: scope,
    modelIdentities: modelIdentities(allRecords.filter(r => r.executorInvoked).map(r => ({ receipt: `${r.taskId}/installed/trial-${r.trial}/_result.json`, identity: r.modelIdentity ?? null }))),
    ...(plan.session ? { experiment: plan.session.summary() } : {}),
    runGroup: plan.runGroup,
    createdAt: new Date().toISOString(),
    skill: {
      name: plan.skill.name,
      sourceDir: plan.skill.sourceDir,
      bundleSha256: plan.skill.sha256,
      files: plan.skill.files,
      installedSha256: installedSkill.sha256,
      installedFiles: installedSkill.files,
    },
    bench: {
      name: plan.bench.name,
      dir: plan.bench.dir,
      contentSha256: plan.bench.contentSha256,
      taskCount: eligible.length,
    },
    executor: plan.executor.describe(),
    trials: plan.trials,
    skillInstallDir: plan.skillInstallDir,
    competition: {
      mode: (plan.competitors?.length ?? 0) > 0 ? 'installed' : 'alone',
      skills: (plan.competitors ?? []).map((skill) => ({ name: skill.name, sha256: skill.sha256 })),
    },
    detection: plan.detection ?? 'unrecorded',
    ...(declared ? { triggerDetection: declared } : {}),
    tasks: taskSummaries,
    metrics: triggerMetrics(taskSummaries),
  };
  const manifest: TriggerManifest = {
    ...manifestWithoutWarnings,
    warnings: buildTriggerWarnings(manifestWithoutWarnings),
  };
  writeFileSync(join(groupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
