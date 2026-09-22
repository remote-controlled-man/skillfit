import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MOCK_MARKER_FILE, RUN_GROUP_PATTERN } from './constants.js';
import { OUTPUT_CONTRACT } from './prompt.js';
import { gitInit, runVerifier } from './runner.js';
import { wilson95 } from './stats.js';
import type {
  Bench,
  Executor,
  ExecutorDescriptor,
  SkillBundle,
  TokenUsage,
} from './types.js';

export interface TriggerPlan {
  bench: Bench;
  skill: SkillBundle;
  executor: Executor;
  trials: number;
  runsRoot: string;
  runGroup: string;
  skillInstallDir: string;
  log?: (msg: string) => void;
}

export interface TriggerTrialRecord {
  taskId: string;
  trial: number;
  runDir: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  triggered: boolean | null;
  passed: boolean;
  error: string | null;
  tokens: TokenUsage | null;
}

export interface TriggerTaskSummary {
  id: string;
  shouldTrigger: boolean;
  runs: number;
  fired: number;
  unknown: number;
  errors: number;
  passes: number;
  tokens: { input: number; output: number } | null;
}

export interface TriggerMetrics {
  recall: number | null;
  recallCi95: { lo: number; hi: number } | null;
  falseTriggerRate: number | null;
  falseTriggerRateCi95: { lo: number; hi: number } | null;
  precision: number | null;
  f1: number | null;
  positives: { fired: number; runs: number };
  negatives: { fired: number; runs: number };
  tokens: { input: number; output: number } | null;
}

export interface TriggerManifest {
  schemaVersion: 1;
  mode: 'trigger';
  runGroup: string;
  createdAt: string;
  skill: { name: string; sourceDir: string; bundleSha256: string; files: string[] };
  bench: { name: string; dir: string; contentSha256: string; taskCount: number };
  executor: ExecutorDescriptor;
  trials: number;
  skillInstallDir: string;
  tasks: TriggerTaskSummary[];
  metrics: TriggerMetrics;
  warnings: string[];
}

async function runTriggerTrial(
  plan: TriggerPlan,
  taskId: string,
  trial: number,
): Promise<TriggerTrialRecord> {
  const task = plan.bench.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  const runDir = join(plan.runsRoot, plan.runGroup, task.id, 'installed', `trial-${trial}`);
  if (existsSync(runDir)) {
    throw new Error(`Run directory already exists: ${runDir}`);
  }
  mkdirSync(runDir, { recursive: true });
  cpSync(join(plan.bench.dir, task.fixture), runDir, { recursive: true });
  rmSync(join(runDir, MOCK_MARKER_FILE), { force: true });
  const gitInitialized = await gitInit(runDir);

  const taskPromptText = readFileSync(
    join(plan.bench.dir, task.promptTrigger ?? task.prompt),
    'utf8',
  );
  const prompt = `${[taskPromptText.trimEnd(), OUTPUT_CONTRACT].join('\n\n')}\n`;
  writeFileSync(join(runDir, '_prompt.txt'), prompt, 'utf8');

  const skillDest = join(runDir, plan.skillInstallDir, plan.skill.name);
  mkdirSync(dirname(skillDest), { recursive: true });
  cpSync(plan.skill.sourceDir, skillDest, { recursive: true });

  const started = new Date();
  let output = '';
  let rawOutput: string | null = null;
  let error: string | null = null;
  let tokens: TokenUsage | null = null;
  let triggered: boolean | null = null;
  try {
    const result = await plan.executor.run(prompt, runDir);
    output = result.output;
    rawOutput = result.rawOutput ?? null;
    tokens = result.tokens ?? null;
    triggered = result.skillTriggered ?? null;
  } catch (executorError) {
    error = (executorError as Error).message;
  }
  const finished = new Date();
  writeFileSync(join(runDir, '_output.md'), output, 'utf8');
  if (rawOutput !== null) {
    writeFileSync(join(runDir, '_transcript.jsonl'), rawOutput, 'utf8');
  }

  let passed = false;
  if (error === null) {
    const verifier = await runVerifier(plan.bench.dir, task.verifier, runDir);
    passed = verifier.exitCode === 0;
    const verifierLog = verifier.error ? `${verifier.output}\n[${verifier.error}]` : verifier.output;
    writeFileSync(join(runDir, '_verifier.txt'), verifierLog, 'utf8');
  } else {
    writeFileSync(join(runDir, '_executor-error.txt'), error, 'utf8');
  }

  const record: TriggerTrialRecord = {
    taskId,
    trial,
    runDir,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationSeconds: Math.round(((finished.getTime() - started.getTime()) / 1000) * 1000) / 1000,
    triggered,
    passed,
    error,
    tokens,
  };
  writeFileSync(
    join(runDir, '_result.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        ...record,
        runGroup: plan.runGroup,
        skillBundleSha256: plan.skill.sha256,
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

function summarizeTriggerTask(
  taskId: string,
  shouldTrigger: boolean,
  records: TriggerTrialRecord[],
): TriggerTaskSummary {
  let input = 0;
  let output = 0;
  let seenTokens = false;
  for (const record of records) {
    if (!record.tokens) continue;
    seenTokens = true;
    input += record.tokens.input ?? 0;
    output += record.tokens.output ?? 0;
  }
  return {
    id: taskId,
    shouldTrigger,
    runs: records.filter((r) => r.error === null && r.triggered !== null).length,
    fired: records.filter((r) => r.error === null && r.triggered === true).length,
    unknown: records.filter((r) => r.error === null && r.triggered === null).length,
    errors: records.filter((r) => r.error !== null).length,
    passes: records.filter((r) => r.passed).length,
    tokens: seenTokens ? { input, output } : null,
  };
}

export function triggerMetrics(tasks: TriggerTaskSummary[]): TriggerMetrics {
  const positives = tasks.filter((t) => t.shouldTrigger);
  const negatives = tasks.filter((t) => !t.shouldTrigger);
  const posFired = positives.reduce((sum, t) => sum + t.fired, 0);
  const posRuns = positives.reduce((sum, t) => sum + t.runs, 0);
  const negFired = negatives.reduce((sum, t) => sum + t.fired, 0);
  const negRuns = negatives.reduce((sum, t) => sum + t.runs, 0);
  const recall = posRuns > 0 ? posFired / posRuns : null;
  const falseTriggerRate = negRuns > 0 ? negFired / negRuns : null;
  const precision = posFired + negFired > 0 ? posFired / (posFired + negFired) : null;
  const f1 =
    recall !== null && precision !== null && recall + precision > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  let input = 0;
  let output = 0;
  let seenTokens = false;
  for (const task of tasks) {
    if (!task.tokens) continue;
    seenTokens = true;
    input += task.tokens.input;
    output += task.tokens.output;
  }
  return {
    recall,
    recallCi95: posRuns > 0 ? wilson95(posFired, posRuns) : null,
    falseTriggerRate,
    falseTriggerRateCi95: negRuns > 0 ? wilson95(negFired, negRuns) : null,
    precision,
    f1,
    positives: { fired: posFired, runs: posRuns },
    negatives: { fired: negFired, runs: negRuns },
    tokens: seenTokens ? { input, output } : null,
  };
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
    warnings.push(`${errors} run(s) failed with executor errors — excluded from rates.`);
  }
  return warnings;
}

export async function runTriggerExperiment(plan: TriggerPlan): Promise<TriggerManifest> {
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
  const groupDir = join(plan.runsRoot, plan.runGroup);
  if (existsSync(groupDir)) {
    throw new Error(`Run group directory already exists: ${groupDir}`);
  }
  mkdirSync(groupDir, { recursive: true });

  const eligible = plan.bench.tasks.filter((task) => task.shouldTrigger !== undefined);
  const skipped = plan.bench.tasks.length - eligible.length;
  if (skipped > 0) {
    plan.log?.(`Skipping ${skipped} task(s) without a shouldTrigger label.`);
  }

  const taskSummaries: TriggerTaskSummary[] = [];
  for (const task of eligible) {
    const records: TriggerTrialRecord[] = [];
    for (let trial = 1; trial <= plan.trials; trial++) {
      plan.log?.(`Running ${task.id} / installed / trial ${trial}…`);
      records.push(await runTriggerTrial(plan, task.id, trial));
    }
    taskSummaries.push(summarizeTriggerTask(task.id, task.shouldTrigger ?? false, records));
  }

  const manifestWithoutWarnings: Omit<TriggerManifest, 'warnings'> = {
    schemaVersion: 1,
    mode: 'trigger',
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
      taskCount: eligible.length,
    },
    executor: plan.executor.describe(),
    trials: plan.trials,
    skillInstallDir: plan.skillInstallDir,
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

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function rateWithCi(
  fired: number,
  runs: number,
  ci: { lo: number; hi: number } | null,
): string {
  if (runs === 0) return 'n/a (no runs)';
  const base = `${fired}/${runs} (${pct(fired / runs)})`;
  return ci ? `${base} [95% CI ${pct(ci.lo)}–${pct(ci.hi)}]` : base;
}

export function renderTriggerSummary(manifest: TriggerManifest, manifestPath: string): string {
  const lines: string[] = [];
  lines.push(`Skill    : ${manifest.skill.name} (bundle sha256 ${manifest.skill.bundleSha256.slice(0, 12)}…, ${manifest.skill.files.length} files)`);
  lines.push(`Bench    : ${manifest.bench.name} (${manifest.bench.taskCount} task(s), content sha256 ${manifest.bench.contentSha256.slice(0, 12)}…)`);
  lines.push(`Executor : ${manifest.executor.kind} (${manifest.executor.model})${manifest.executor.detail ? ` — ${manifest.executor.detail}` : ''}`);
  lines.push(`Mode     : trigger — skill installed into ${manifest.skillInstallDir}, not injected into the prompt`);
  lines.push(`Trials   : ${manifest.trials} per task`);
  lines.push('');
  const idWidth = Math.max(7, ...manifest.tasks.map((t) => t.id.length));
  lines.push(`${pad('TASK', idWidth)}  FIRE?  FIRED    UNKNOWN  ERRORS  PASS`);
  for (const task of manifest.tasks) {
    const total = task.runs + task.unknown + task.errors;
    lines.push(
      `${pad(task.id, idWidth)}  ${pad(task.shouldTrigger ? 'yes' : 'no', 5)}  ${pad(`${task.fired}/${total}`, 8)} ${pad(String(task.unknown), 7)}  ${pad(String(task.errors), 6)}  ${task.passes}/${total}`,
    );
  }
  lines.push('');
  const m = manifest.metrics;
  lines.push(`Trigger recall      : ${rateWithCi(m.positives.fired, m.positives.runs, m.recallCi95)}`);
  lines.push(
    `False-trigger rate  : ${rateWithCi(m.negatives.fired, m.negatives.runs, m.falseTriggerRateCi95)}`,
  );
  lines.push(`Precision           : ${m.precision === null ? 'n/a' : m.precision.toFixed(2)}`);
  lines.push(`F1                  : ${m.f1 === null ? 'n/a' : m.f1.toFixed(2)}`);
  const tokenLines = manifest.tasks
    .filter((task) => task.tokens !== null)
    .map((task) => {
      const tokens = task.tokens;
      return tokens ? `- ${task.id}: input ${tokens.input}, output ${tokens.output}` : null;
    })
    .filter((line): line is string => line !== null);
  if (tokenLines.length > 0) {
    lines.push('');
    lines.push('Tokens used (per task):');
    lines.push(...tokenLines);
    if (m.tokens) {
      lines.push(`- total: input ${m.tokens.input}, output ${m.tokens.output}`);
    }
  }
  lines.push('');
  lines.push('Warnings:');
  if (manifest.warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of manifest.warnings) lines.push(`- ${warning}`);
  }
  lines.push('');
  lines.push(`Manifest: ${manifestPath}`);
  return lines.join('\n');
}
