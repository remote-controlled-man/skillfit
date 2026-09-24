import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOCK_MARKER_FILE, RUN_GROUP_PATTERN } from './constants.js';
import { judgePair, type JudgeResult } from './judge.js';
import { killTree, treeSpawnOptions } from './kill-tree.js';
import { buildTaskPrompt, snapshotRepoFiles } from './prompt.js';
import {
  buildWarnings,
  verdictFor,
  type ConditionStats,
  type FacetSummary,
  type JudgeSummary,
  type RunManifest,
  type TaskSummary,
} from './report.js';
import { mcnemarExactP, pairedDeltaBootstrapCI, pairedScoreBootstrapCI } from './stats.js';
import type { Bench, Condition, Executor, ExecutorDescriptor, SkillBundle, TokenUsage } from './types.js';
import { CONDITIONS } from './types.js';
import { verdictFromOutput, type VerifierCheck } from './verifier-summary.js';

export interface ExperimentPlan {
  bench: Bench;
  skill: SkillBundle;
  executor: Executor;
  judge?: Executor | null;
  trials: number;
  runsRoot: string;
  runGroup: string;
  log?: (msg: string) => void;
}

export interface TrialOutcome {
  taskId: string;
  condition: Condition;
  trial: number;
  runDir: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  passed: boolean;
  verifierExitCode: number | null;
  verifierPassed: boolean | null;
  score: number | null;
  checks: VerifierCheck[] | null;
  error: string | null;
  output: string;
  tokens: TokenUsage | null;
  gitInitialized: boolean;
}

export interface ProcessResult {
  exitCode: number | null;
  output: string;
  error: string | null;
}

const VERIFIER_TIMEOUT_MS = 2 * 60 * 1000;

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolvePromise) => {
    let child;
    try {
      const env = { ...process.env };
      delete env['NODE_TEST_CONTEXT'];
      child = spawn(command, args, { cwd, shell: false, env, ...treeSpawnOptions() });
    } catch (error) {
      resolvePromise({ exitCode: null, output: '', error: (error as Error).message });
      return;
    }
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: null, output, error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: code,
        output: timedOut ? `${output}\n[timed out after ${timeoutMs}ms]` : output,
        error: timedOut ? `timed out after ${timeoutMs}ms` : null,
      });
    });
  });
}

export async function gitInit(dir: string): Promise<boolean> {
  const steps: string[][] = [
    ['init', '--quiet'],
    ['config', 'user.email', 'skillfit@example.invalid'],
    ['config', 'user.name', 'skillfit harness'],
    ['add', '-A'],
    ['commit', '--quiet', '-m', 'Initial benchmark fixture'],
  ];
  for (const args of steps) {
    const result = await runProcess('git', args, dir, 30_000);
    if (result.exitCode !== 0) return false;
  }
  return true;
}

export async function runTrial(
  plan: ExperimentPlan,
  taskId: string,
  condition: Condition,
  trial: number,
): Promise<TrialOutcome> {
  const { bench, skill, executor } = plan;
  const task = bench.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  const runDir = join(plan.runsRoot, plan.runGroup, task.id, condition, `trial-${trial}`);
  if (existsSync(runDir)) {
    throw new Error(`Run directory already exists: ${runDir}`);
  }
  mkdirSync(runDir, { recursive: true });
  cpSync(join(bench.dir, task.fixture), runDir, { recursive: true });
  if (executor.describe().kind !== 'mock') {
    rmSync(join(runDir, MOCK_MARKER_FILE), { force: true });
  }
  const gitInitialized = await gitInit(runDir);

  const taskPromptText = readFileSync(join(bench.dir, task.prompt), 'utf8');
  const snapshot = snapshotRepoFiles(runDir);
  const prompt = buildTaskPrompt(
    taskPromptText,
    snapshot,
    condition === 'treatment' ? skill.payload : null,
    { workspace: task.verifierKind === 'command' },
  );
  writeFileSync(join(runDir, '_prompt.txt'), prompt, 'utf8');

  const started = new Date();
  let output = '';
  let error: string | null = null;
  let tokens: TokenUsage | null = null;
  try {
    const result = await executor.run(prompt, runDir);
    output = result.output;
    tokens = result.tokens ?? null;
  } catch (executorError) {
    error = (executorError as Error).message;
  }
  const finished = new Date();
  writeFileSync(join(runDir, '_output.md'), output, 'utf8');

  let verifierExitCode: number | null = null;
  let passed = false;
  let verifierPassed: boolean | null = null;
  let score: number | null = null;
  let checks: VerifierCheck[] | null = null;
  if (error === null) {
    const verifier = await runVerifier(bench.dir, task.verifier, runDir);
    verifierExitCode = verifier.exitCode;
    writeFileSync(join(runDir, '_verifier.txt'), verifierLogFor(verifier), 'utf8');
    if (verifier.exitCode === null) {
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
    durationSeconds: Math.round(((finished.getTime() - started.getTime()) / 1000) * 1000) / 1000,
    passed,
    verifierExitCode,
    verifierPassed,
    score,
    checks,
    error,
    output,
    tokens,
    gitInitialized,
  };
  const { output: _output, ...serializable } = record;
  writeFileSync(
    join(runDir, '_result.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        ...serializable,
        runGroup: plan.runGroup,
        skillBundleSha256: condition === 'treatment' ? skill.sha256 : null,
        executor: withSampling(executor.describe()),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return record;
}

export async function runVerifier(benchDir: string, command: string, runDir: string): Promise<ProcessResult> {
  const tokens = command.split(/\s+/).filter(Boolean);
  const executable = tokens[0];
  if (!executable) {
    return { exitCode: null, output: '', error: 'empty verifier command' };
  }
  return runProcess(executable, [...tokens.slice(1), runDir], benchDir, VERIFIER_TIMEOUT_MS);
}

export function verifierLogFor(result: ProcessResult): string {
  return result.error ? `${result.output}\n[${result.error}]` : result.output;
}

const SPAWN_FAILURE = /ENOENT|EINVAL|EACCES|EPERM/i;

/**
 * A verifier that produced no exit code gave no verdict, so the trial says nothing about the agent.
 * Reporting it as a failure would blame the model for a broken bench — and against a command-kind
 * NOP gate it would look like the failure the gate exists to require.
 */
export function verifierFailure(label: string, command: string, reason: string | null): string {
  const why = reason ?? 'no exit code';
  if (SPAWN_FAILURE.test(why)) {
    return `${label} could not be started (${why}): ${command} — it is spawned without a shell, so the first token must be an executable the OS can start directly ("node verifiers/x.mjs"), not "npm", a shell builtin, or a .cmd/.bat wrapper`;
  }
  return `${label} produced no exit code (${why}): ${command}`;
}

function sumTokens(records: TrialOutcome[]): { input: number; output: number } | null {
  let input = 0;
  let output = 0;
  let seen = false;
  for (const record of records) {
    if (!record.tokens) continue;
    seen = true;
    input += record.tokens.input ?? 0;
    output += record.tokens.output ?? 0;
  }
  return seen ? { input, output } : null;
}

/**
 * Record sampling controls explicitly. An executor whose surface exposes no seed or temperature
 * knob reports `sampling: null`, which is a statement about the surface — not an omission that a
 * reader would have to guess at.
 */
function withSampling(descriptor: ExecutorDescriptor): ExecutorDescriptor {
  return { ...descriptor, sampling: descriptor.sampling ?? null };
}

function countErrors(records: TrialOutcome[]): number {
  return records.filter((r) => r.error !== null).length;
}

/**
 * Trials that were graded in BOTH arms, aligned by trial number.
 *
 * A trial whose executor errored was never graded, so counting it as a failure would manufacture a
 * discordant pair out of an API timeout (docs/metrics.md L0, engagement sanity). Dropping it from one
 * arm only would misalign the pairing that McNemar and the paired bootstrap depend on, so the whole
 * (task, trial) pair goes. Filtering per arm independently is the bug this replaces.
 */
function pairedSurvivors(
  outcomes: Record<Condition, TrialOutcome[]>,
): Record<Condition, TrialOutcome[]> {
  const byTrial = new Map<number, Partial<Record<Condition, TrialOutcome>>>();
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      const entry = byTrial.get(record.trial) ?? {};
      entry[condition] = record;
      byTrial.set(record.trial, entry);
    }
  }
  const survivors: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  for (const trial of [...byTrial.keys()].sort((a, b) => a - b)) {
    const pair = byTrial.get(trial);
    const baseline = pair?.baseline;
    const treatment = pair?.treatment;
    if (!baseline || !treatment) continue;
    if (baseline.error !== null || treatment.error !== null) continue;
    survivors.baseline.push(baseline);
    survivors.treatment.push(treatment);
  }
  return survivors;
}

function statsFor(records: TrialOutcome[], errors: number): ConditionStats {
  const passes = records.filter((r) => r.passed).length;
  const trials = records.length;
  const scored = records.filter((r) => r.score !== null);
  const meanScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, r) => sum + (r.score as number), 0) / scored.length;
  return {
    passes,
    trials,
    errors,
    passRate: trials === 0 ? 0 : passes / trials,
    meanScore,
    tokens: sumTokens(records),
  };
}

function tokenDelta(
  baseline: { input: number; output: number } | null,
  treatment: { input: number; output: number } | null,
): { input: number; output: number } | null {
  if (!baseline || !treatment) return null;
  return { input: treatment.input - baseline.input, output: treatment.output - baseline.output };
}

function summarizeJudge(judgeResults: JudgeResult[]): JudgeSummary | null {
  if (judgeResults.length === 0) return null;
  const consistent = judgeResults.filter((r) => r.consistent);
  const mean = (values: number[]): number | null => {
    if (consistent.length === 0) return null;
    const raw = values.reduce((sum, value) => sum + value, 0) / consistent.length;
    return Math.round(raw * 100) / 100;
  };
  return {
    judgedTrials: judgeResults.length,
    consistentTrials: consistent.length,
    baselineMean: mean(consistent.map((r) => r.baselineScore)),
    treatmentMean: mean(consistent.map((r) => r.treatmentScore)),
  };
}

async function judgeTaskTrials(
  plan: ExperimentPlan,
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
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
      });
      results.push(result);
      writeFileSync(
        join(taskDir, `judge-trial-${trial}.json`),
        `${JSON.stringify({ trial, seed, ...result }, null, 2)}\n`,
        'utf8',
      );
    } catch (error) {
      plan.log?.(`Judge failed for ${task.id} trial ${trial}: ${(error as Error).message}`);
    }
  }
  return results;
}

function trialFlags(records: TrialOutcome[]): boolean[] {
  return [...records].sort((a, b) => a.trial - b.trial).map((r) => r.passed);
}

function trialScores(records: TrialOutcome[]): (number | null)[] {
  return [...records].sort((a, b) => a.trial - b.trial).map((r) => r.score);
}

function facetStats(outcomes: Record<Condition, TrialOutcome[]>): FacetSummary[] {
  const names: string[] = [];
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      for (const check of record.checks ?? []) {
        if (!names.includes(check.name)) names.push(check.name);
      }
    }
  }
  return names.map((name) => {
    const rateFor = (records: TrialOutcome[]): { trials: number; passRate: number } => {
      const relevant = records.filter((r) => r.checks?.some((c) => c.name === name));
      const passes = relevant.filter(
        (r) => r.checks?.find((c) => c.name === name)?.pass === true,
      ).length;
      return { trials: relevant.length, passRate: relevant.length === 0 ? 0 : passes / relevant.length };
    };
    const baseline = rateFor(outcomes.baseline);
    const treatment = rateFor(outcomes.treatment);
    return {
      name,
      baselinePassRate: baseline.passRate,
      treatmentPassRate: treatment.passRate,
      baselineTrials: baseline.trials,
      treatmentTrials: treatment.trials,
    };
  });
}

function verifierConsistencyNotes(
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
): string[] {
  const notes = new Set<string>();
  for (const condition of CONDITIONS) {
    for (const record of outcomes[condition]) {
      if (record.verifierPassed !== null && record.verifierPassed !== record.passed) {
        notes.add(
          `Task "${taskId}": the verifier's JSON "passed" flag disagrees with its exit code — the exit code is authoritative, fix the summary line.`,
        );
      }
      if (record.checks !== null && record.verifierExitCode !== null) {
        const allPass = record.checks.every((c) => c.pass);
        if (record.passed && !allPass) {
          notes.add(
            `Task "${taskId}": the verifier exits 0 while some checks fail — exit code and checks disagree.`,
          );
        }
        if (!record.passed && allPass) {
          notes.add(
            `Task "${taskId}": all checks pass but the verifier exits non-zero — exit code and checks disagree.`,
          );
        }
      }
    }
  }
  return [...notes];
}

function discordantCounts(
  outcomeSets: Array<{ baseline: boolean[]; treatment: boolean[] }>,
): { improved: number; regressed: number } {
  let improved = 0;
  let regressed = 0;
  for (const outcomes of outcomeSets) {
    for (let i = 0; i < outcomes.baseline.length && i < outcomes.treatment.length; i++) {
      const baselinePassed = outcomes.baseline[i] === true;
      const treatmentPassed = outcomes.treatment[i] === true;
      if (treatmentPassed && !baselinePassed) improved++;
      else if (baselinePassed && !treatmentPassed) regressed++;
    }
  }
  return { improved, regressed };
}

function summarizeTask(
  taskId: string,
  outcomes: Record<Condition, TrialOutcome[]>,
  survivors: Record<Condition, TrialOutcome[]>,
  judgeResults: JudgeResult[],
): TaskSummary {
  const baseline = statsFor(survivors.baseline, countErrors(outcomes.baseline));
  const treatment = statsFor(survivors.treatment, countErrors(outcomes.treatment));
  const flags = {
    baseline: trialFlags(survivors.baseline),
    treatment: trialFlags(survivors.treatment),
  };
  const deltaPassRate = treatment.passRate - baseline.passRate;
  const scoreDelta =
    baseline.meanScore !== null && treatment.meanScore !== null
      ? treatment.meanScore - baseline.meanScore
      : null;
  const { verdict, reason } = verdictFor({ ...discordantCounts([flags]), deltaPassRate });
  return {
    id: taskId,
    conditions: { baseline, treatment },
    outcomes: flags,
    scores: {
      baseline: trialScores(survivors.baseline),
      treatment: trialScores(survivors.treatment),
    },
    deltaPassRate,
    scoreDelta,
    facets: facetStats(survivors),
    verifierNotes: verifierConsistencyNotes(taskId, outcomes),
    tokenDelta: tokenDelta(baseline.tokens, treatment.tokens),
    verdict,
    verdictReason: reason,
    judge: summarizeJudge(judgeResults),
  };
}

export async function runExperiment(plan: ExperimentPlan): Promise<RunManifest> {
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
    throw new Error(`Run group directory already exists: ${groupDir}`);
  }
  mkdirSync(groupDir, { recursive: true });

  const taskSummaries: TaskSummary[] = [];
  const allOutcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  const allSurvivors: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
  for (const task of plan.bench.tasks) {
    const outcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
    // Interleaved: the trial loop is outermost so the two arms of a pair run adjacently. Running
    // every baseline trial before every treatment trial confounds condition with elapsed time —
    // provider drift or rate-limit degradation would land entirely on one arm.
    for (let trial = 1; trial <= plan.trials; trial++) {
      for (const condition of CONDITIONS) {
        plan.log?.(`Running ${task.id} / ${condition} / trial ${trial}…`);
        const outcome = await runTrial(plan, task.id, condition, trial);
        outcomes[condition].push(outcome);
        allOutcomes[condition].push(outcome);
      }
    }
    const survivors = pairedSurvivors(outcomes);
    allSurvivors.baseline.push(...survivors.baseline);
    allSurvivors.treatment.push(...survivors.treatment);
    const judgeResults = await judgeTaskTrials(plan, task.id, outcomes);
    taskSummaries.push(summarizeTask(task.id, outcomes, survivors, judgeResults));
  }

  const overallBaseline = statsFor(allSurvivors.baseline, countErrors(allOutcomes.baseline));
  const overallTreatment = statsFor(allSurvivors.treatment, countErrors(allOutcomes.treatment));
  const overallDelta = overallTreatment.passRate - overallBaseline.passRate;
  const taskOutcomes = taskSummaries.map((task) => task.outcomes);
  const discordant = discordantCounts(taskOutcomes);
  const overallVerdict = verdictFor({ ...discordant, deltaPassRate: overallDelta });
  const scoreTasks = taskSummaries
    .map((task) => ({
      baseline: task.scores.baseline.filter((s): s is number => s !== null),
      treatment: task.scores.treatment.filter((s): s is number => s !== null),
    }))
    .filter((task) => task.baseline.length > 0 && task.treatment.length > 0);
  const scoreDeltaCi = pairedScoreBootstrapCI(scoreTasks);
  const scoreDelta = scoreDeltaCi ? scoreDeltaCi.point : null;
  const manifestWithoutWarnings: Omit<RunManifest, 'warnings'> = {
    schemaVersion: 3,
    runGroup: plan.runGroup,
    createdAt: new Date().toISOString(),
    skill: {
      name: plan.skill.name,
      sourceDir: plan.skill.sourceDir,
      bundleSha256: plan.skill.sha256,
      files: plan.skill.files,
    },
    bench: {
      name: plan.bench.name,
      dir: plan.bench.dir,
      contentSha256: plan.bench.contentSha256,
      taskCount: plan.bench.tasks.length,
    },
    executor: withSampling(plan.executor.describe()),
    judge: plan.judge ? withSampling(plan.judge.describe()) : null,
    trials: plan.trials,
    tasks: taskSummaries,
    overall: {
      conditions: {
        baseline: overallBaseline,
        treatment: overallTreatment,
      },
      deltaPassRate: overallDelta,
      scoreDelta,
      tokenDelta: tokenDelta(overallBaseline.tokens, overallTreatment.tokens),
      verdict: overallVerdict.verdict,
      verdictReason: overallVerdict.reason,
      stats: {
        discordant,
        mcnemarP: mcnemarExactP(discordant.improved, discordant.regressed),
        deltaCi: pairedDeltaBootstrapCI(taskOutcomes),
        scoreDeltaCi,
      },
    },
  };
  const manifest: RunManifest = {
    ...manifestWithoutWarnings,
    warnings: buildWarnings(manifestWithoutWarnings),
  };
  writeFileSync(join(groupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
