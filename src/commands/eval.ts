import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents.js';
import { loadBench } from '../harness/bench.js';
import { collectSkillBundle } from '../harness/bundle.js';
import { ApiExecutor } from '../harness/executors/api.js';
import { CliExecutor } from '../harness/executors/cli.js';
import { renderSummary, type RunManifest } from '../harness/report.js';
import { runExperiment } from '../harness/runner.js';
import type { Bench, Executor, SkillBundle } from '../harness/types.js';

export interface EvalOptions {
  skillPath: string;
  bench?: string;
  trials: number;
  agent?: string;
  dryRun: boolean;
  yes: boolean;
  executor?: Executor;
  judgeExecutor?: Executor | null;
  runsRoot?: string;
  runGroup?: string;
  log?: (msg: string) => void;
}

function bundledBenchesRoot(): string {
  return fileURLToPath(new URL('../../benches', import.meta.url));
}

function resolveBenchDir(bench: string | undefined): string {
  if (bench) {
    const dir = resolve(bench);
    if (!existsSync(join(dir, 'bench.json'))) {
      throw new Error(`Not a bench directory (missing bench.json): ${dir}`);
    }
    return dir;
  }
  const root = bundledBenchesRoot();
  const candidates = existsSync(root)
    ? readdirSync(root)
        .map((entry) => join(root, entry))
        .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, 'bench.json')))
    : [];
  if (candidates.length === 1 && candidates[0]) {
    return candidates[0];
  }
  if (candidates.length === 0) {
    throw new Error(`No bundled benches found under ${root}; pass --bench <path>`);
  }
  const names = candidates.map((dir) => `  --bench ${dir}`).join('\n');
  throw new Error(`More than one bundled bench is available; pick one explicitly:\n${names}`);
}

function resolveExecutor(agent: string | undefined): Executor {
  if (agent) {
    getAgent(agent);
    return CliExecutor.forAgent(agent);
  }
  return ApiExecutor.fromEnv();
}

function resolveJudge(): Executor | null {
  const flag = process.env['SKILLFIT_JUDGE'];
  if (!flag || flag === '0' || flag === 'false') return null;
  try {
    return new ApiExecutor({
      apiKey: process.env['SKILLFIT_JUDGE_API_KEY'] ?? process.env['SKILLFIT_API_KEY'] ?? process.env['OPENAI_API_KEY'],
      model: process.env['SKILLFIT_JUDGE_MODEL'] ?? process.env['SKILLFIT_API_MODEL'],
      baseUrl: process.env['SKILLFIT_JUDGE_BASE_URL'] ?? process.env['SKILLFIT_API_BASE_URL'],
    });
  } catch {
    return null;
  }
}

function defaultRunGroup(now: Date = new Date()): string {
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `eval-${date}-${time}`;
}

function renderPlan(
  bench: Bench,
  skill: SkillBundle,
  executor: Executor | null,
  judge: Executor | null,
  trials: number,
  runsRoot: string,
  runGroup: string,
): string {
  const lines: string[] = [];
  lines.push('Experiment plan (dry run)');
  lines.push(`Skill    : ${skill.name} (${skill.files.length} files, bundle sha256 ${skill.sha256.slice(0, 12)}…)`);
  lines.push(`Bench    : ${bench.name} @ ${bench.dir}`);
  lines.push(`           ${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…`);
  const descriptor = executor?.describe();
  lines.push(
    `Executor : ${descriptor ? `${descriptor.kind} (${descriptor.model})${descriptor.detail ? ` — ${descriptor.detail}` : ''}` : 'unresolved (pass --agent or set SKILLFIT_API_KEY)'}`,
  );
  const judgeDescriptor = judge?.describe();
  lines.push(`Judge    : ${judgeDescriptor ? `${judgeDescriptor.kind} (${judgeDescriptor.model})` : 'disabled'}`);
  const totalRuns = bench.tasks.length * 2 * trials;
  lines.push(`Trials   : ${trials} per condition (${bench.tasks.length} task(s) × 2 conditions × ${trials} = ${totalRuns} runs)`);
  lines.push('Tasks    :');
  for (const task of bench.tasks) {
    lines.push(`- ${task.id}: fixture ${task.fixture}, verifier \`${task.verifier}\`${task.rubric ? `, rubric ${task.rubric}` : ''}`);
  }
  lines.push(`Output   : ${join(runsRoot, runGroup)} (not created)`);
  lines.push('Dry run — nothing was written.');
  return lines.join('\n');
}

export async function runEval(options: EvalOptions): Promise<RunManifest | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  if (!Number.isInteger(options.trials) || options.trials < 1 || options.trials > 20) {
    throw new Error(`--trials must be an integer between 1 and 20, got ${options.trials}`);
  }
  const benchDir = resolveBenchDir(options.bench);
  const bench = loadBench(benchDir);
  const skill = collectSkillBundle(options.skillPath);
  let executor: Executor | null = null;
  try {
    executor = options.executor ?? resolveExecutor(options.agent);
  } catch (error) {
    if (!options.dryRun) throw error;
    log(`Note: ${(error as Error).message}`);
  }
  const judge = options.judgeExecutor !== undefined ? options.judgeExecutor : resolveJudge();
  const runsRoot = options.runsRoot ?? resolve('runs');
  const runGroup = options.runGroup ?? defaultRunGroup();

  if (options.dryRun) {
    log(renderPlan(bench, skill, executor, judge, options.trials, runsRoot, runGroup));
    return null;
  }
  if (!executor) {
    throw new Error('No executor available; pass --agent or set SKILLFIT_API_KEY.');
  }

  const manifest = await runExperiment({
    bench,
    skill,
    executor,
    judge,
    trials: options.trials,
    runsRoot,
    runGroup,
    log,
  });
  log(renderSummary(manifest, join(runsRoot, runGroup, 'manifest.json')));
  return manifest;
}
