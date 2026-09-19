import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOCK_MARKER_FILE, RUN_GROUP_PATTERN } from './constants.js';
import { judgePair, type JudgeResult } from './judge.js';
import { buildTaskPrompt, snapshotRepoFiles } from './prompt.js';
import {
  buildWarnings,
  verdictFor,
  type ConditionStats,
  type JudgeSummary,
  type RunManifest,
  type TaskSummary,
} from './report.js';
import { mcnemarExactP, pairedDeltaBootstrapCI } from './stats.js';
import type { Bench, Condition, Executor, SkillBundle, TokenUsage } from './types.js';
import { CONDITIONS } from './types.js';

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

interface TrialOutcome {
  taskId: string;
  condition: Condition;
  trial: number;
  runDir: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  passed: boolean;
  verifierExitCode: number | null;
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
      child = spawn(command, args, { cwd, shell: false, env });
    } catch (error) {
      resolvePromise({ exitCode: null, output: '', error: (error as Error).message });
      return;
    }
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
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

async function runTrial(
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
  if (error === null) {
    const verifier = await runVerifier(bench.dir, task.verifier, runDir);
    verifierExitCode = verifier.exitCode;
    passed = verifier.exitCode === 0;
    const verifierLog = verifier.error
      ? `${verifier.output}\n[${verifier.error}]`
      : verifier.output;
    writeFileSync(join(runDir, '_verifier.txt'), verifierLog, 'utf8');
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
        schemaVersion: 1,
        ...serializable,
        runGroup: plan.runGroup,
        skillBundleSha256: condition === 'treatment' ? skill.sha256 : null,
        executor: executor.describe(),
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

function statsFor(records: TrialOutcome[]): ConditionStats {
  const passes = records.filter((r) => r.passed).length;
  const trials = records.length;
  return {
    passes,
    trials,
    passRate: trials === 0 ? 0 : passes / trials,
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
  const baselineMean =
    judgeResults.reduce((sum, r) => sum + r.baselineScore, 0) / judgeResults.length;
  const treatmentMean =
    judgeResults.reduce((sum, r) => sum + r.treatmentScore, 0) / judgeResults.length;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    judgedTrials: judgeResults.length,
    baselineMean: round(baselineMean),
    treatmentMean: round(treatmentMean),
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
    const judgeDir = join(plan.runsRoot, plan.runGroup, task.id);
    const seed = `${plan.runGroup}:${task.id}:${trial}`;
    try {
      const result = await judgePair(judge, {
        taskPromptText,
        rubricText,
        baselineOutput: baseline.output,
        treatmentOutput: treatment.output,
        seed,
        workdir: judgeDir,
      });
      results.push(result);
      writeFileSync(
        join(judgeDir, `judge-trial-${trial}.json`),
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
  judgeResults: JudgeResult[],
): TaskSummary {
  const baseline = statsFor(outcomes.baseline);
  const treatment = statsFor(outcomes.treatment);
  const flags = {
    baseline: trialFlags(outcomes.baseline),
    treatment: trialFlags(outcomes.treatment),
  };
  const deltaPassRate = treatment.passRate - baseline.passRate;
  const { verdict, reason } = verdictFor({ ...discordantCounts([flags]), deltaPassRate });
  return {
    id: taskId,
    conditions: { baseline, treatment },
    outcomes: flags,
    deltaPassRate,
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
  for (const task of plan.bench.tasks) {
    const outcomes: Record<Condition, TrialOutcome[]> = { baseline: [], treatment: [] };
    for (const condition of CONDITIONS) {
      for (let trial = 1; trial <= plan.trials; trial++) {
        plan.log?.(`Running ${task.id} / ${condition} / trial ${trial}…`);
        const outcome = await runTrial(plan, task.id, condition, trial);
        outcomes[condition].push(outcome);
        allOutcomes[condition].push(outcome);
      }
    }
    const judgeResults = await judgeTaskTrials(plan, task.id, outcomes);
    taskSummaries.push(summarizeTask(task.id, outcomes, judgeResults));
  }

  const overallBaseline = statsFor(allOutcomes.baseline);
  const overallTreatment = statsFor(allOutcomes.treatment);
  const overallDelta = overallTreatment.passRate - overallBaseline.passRate;
  const taskOutcomes = taskSummaries.map((task) => task.outcomes);
  const discordant = discordantCounts(taskOutcomes);
  const overallVerdict = verdictFor({ ...discordant, deltaPassRate: overallDelta });
  const manifestWithoutWarnings: Omit<RunManifest, 'warnings'> = {
    schemaVersion: 2,
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
    executor: plan.executor.describe(),
    judge: plan.judge ? plan.judge.describe() : null,
    trials: plan.trials,
    tasks: taskSummaries,
    overall: {
      conditions: {
        baseline: overallBaseline,
        treatment: overallTreatment,
      },
      deltaPassRate: overallDelta,
      tokenDelta: tokenDelta(overallBaseline.tokens, overallTreatment.tokens),
      verdict: overallVerdict.verdict,
      verdictReason: overallVerdict.reason,
      stats: {
        discordant,
        mcnemarP: mcnemarExactP(discordant.improved, discordant.regressed),
        deltaCi: pairedDeltaBootstrapCI(taskOutcomes),
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
