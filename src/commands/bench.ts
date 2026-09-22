import * as readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { loadBench } from '../harness/bench.js';
import { CliExecutor } from '../harness/executors/cli.js';
import { listFilesRecursive } from '../harness/hash.js';
import { runVerifier } from '../harness/runner.js';
import { runTriggerExperiment } from '../harness/trigger.js';
import { MOCK_MARKER_FILE } from '../harness/constants.js';
import type { Executor, SkillBundle } from '../harness/types.js';
import type { Check } from './doctor.js';

export interface BenchInitOptions {
  dir?: string;
  cwd?: string;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (msg: string) => void;
}

export interface BenchCheckCalibrateOptions {
  agent?: string;
  trials?: number;
  executor?: Executor;
  runsRoot?: string;
  runGroup?: string;
}

export interface BenchCheckOptions {
  dir?: string;
  log?: (msg: string) => void;
  calibrate?: BenchCheckCalibrateOptions | false;
}

export interface BenchCheckReport {
  dir: string;
  checks: Check[];
  failures: number;
  warnings: number;
}

const FIXTURE_SIZE_WARN_BYTES = 64 * 1024;

function templateFiles(benchName: string): Record<string, string> {
  return {
    'bench.json': `${JSON.stringify(
      {
        schemaVersion: 1,
        name: benchName,
        description: 'Describe what real-work tasks this bench measures.',
        tasks: [
          {
            id: 'example-task',
            fixture: 'fixtures/example-task',
            prompt: 'prompts/example-task.md',
            verifier: 'node verifiers/example-task.mjs',
            rubric: 'ground-truth/example-task.md',
          },
        ],
      },
      null,
      2,
    )}\n`,
    'prompts/example-task.md': `# Example task

The repository snapshot below contains \`answer.txt\`. Reply with its exact contents and nothing else.
`,
    'prompts/example-task.trigger.md': `# Example task

The repository in your current working directory contains \`answer.txt\`. Reply with its exact contents and nothing else.
`,
    'fixtures/example-task/answer.txt': 'skillfit-ok\n',
    [`fixtures/example-task/${MOCK_MARKER_FILE}`]: `${JSON.stringify(
      { baseline: { output: 'skillfit-ok' }, treatment: { output: 'skillfit-ok' } },
      null,
      2,
    )}\n`,
    'verifiers/example-task.mjs': `import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node example-task.mjs <run-dir>');
  process.exit(2);
}

let output;
try {
  output = fs.readFileSync(path.join(runDir, '_output.md'), 'utf8').trim();
} catch {
  console.log(JSON.stringify({ passed: false, error: 'missing _output.md' }));
  process.exit(1);
}
const passed = output === 'skillfit-ok';
console.log(JSON.stringify({ passed }));
process.exit(passed ? 0 : 1);
`,
    'ground-truth/example-task.md': `# Ground truth — example-task

The expected answer is \`skillfit-ok\` (the exact contents of \`answer.txt\`).

This task is a placeholder so the scaffold passes \`skillfit bench check\` out of the box. Replace it with
a real task from your own work:

1. Drop the real (pre-change) repository state into \`fixtures/<task-id>/\` — the best tasks come from
   failures you have actually seen: a bug that escaped review, a migration that went wrong.
2. Write the prompt a teammate would get (\`prompts/<task-id>.md\`, plus a \`.trigger.md\` variant that
   references the on-disk repo instead of the inline snapshot).
3. Encode what you would check by hand into \`verifiers/<task-id>.mjs\` — exit code 0 = pass, nothing else
   matters. Keep it deterministic: no network, no clocks, no randomness.
4. Record the expected answer here in \`ground-truth/\` so future edits stay honest.
5. Run \`skillfit bench check\`, then calibrate difficulty with a real agent
   (target: baseline pass rate 30–70% — see docs/metrics.md in the skillfit repo).
`,
  };
}

function defaultConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolvePromise) => {
    rl.question(question, (answer) => {
      rl.close();
      resolvePromise(/^(y|yes)$/i.test(answer.trim()));
    });
  });
}

export async function runBenchInit(
  options: BenchInitOptions,
): Promise<{ dir: string; created: string[] } | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const dir = resolve(options.cwd ?? process.cwd(), options.dir ?? 'skillfit-bench');
  const files = templateFiles(basename(dir));
  const created = Object.keys(files);

  if (options.dryRun) {
    log(`Bench scaffold plan (dry run) — ${dir}:`);
    for (const rel of created) log(`  + ${rel}`);
    log('Dry run — nothing was written. Re-run with --yes to apply.');
    return null;
  }
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
  if (!options.yes) {
    const confirm = options.confirm ?? defaultConfirm;
    const ok = await confirm(`Create ${created.length} file(s) in ${dir}? [y/N] `);
    if (!ok) {
      log('Aborted — nothing was written.');
      return null;
    }
  }
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  loadBench(dir);
  log(`Bench scaffolded at ${dir} (${created.length} files, self-check passed).`);
  log('Next:');
  log(`  skillfit bench check ${dir}`);
  log(`  skillfit eval <skill-path> --bench ${dir} --agent <id> --trials 3`);
  return { dir, created };
}

interface MockMarkerOutputs {
  baseline?: { output?: string };
  treatment?: { output?: string };
}

async function probeVerifier(
  benchDir: string,
  verifier: string,
  output: string | null,
): Promise<{ exitCode: number | null; error: string | null }> {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
  try {
    if (output !== null) {
      writeFileSync(join(dir, '_output.md'), output, 'utf8');
    }
    const result = await runVerifier(benchDir, verifier, dir);
    return { exitCode: result.exitCode, error: result.error };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function renderCheck({ status, message }: Check): string {
  return `[${status}] ${message}`;
}

export async function runBenchCheck(options: BenchCheckOptions): Promise<BenchCheckReport> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const dir = resolve(options.dir ?? '.');
  const checks: Check[] = [];
  const push = (status: Check['status'], message: string): void => {
    checks.push({ status, message });
    log(renderCheck({ status, message }));
  };

  let bench;
  try {
    bench = loadBench(dir);
  } catch (error) {
    push('FAIL', `bench does not load: ${(error as Error).message}`);
    return finish(dir, checks, log);
  }
  push('PASS', `bench.json valid (${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…)`);

  let labeledTasks = 0;
  let negativeTasks = 0;
  for (const task of bench.tasks) {
    if ((task.verifierKind ?? 'output') === 'command') {
      const fixtureCopy = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
      try {
        const fixtureDir = join(bench.dir, task.fixture);
        for (const rel of listFilesRecursive(fixtureDir)) {
          const target = join(fixtureCopy, rel);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, readFileSync(join(fixtureDir, rel)));
        }
        const pristine = await runVerifier(bench.dir, task.verifier, fixtureCopy);
        if (pristine.exitCode === 0) {
          push(
            'FAIL',
            `${task.id}: command verifier already passes on the untouched fixture — the task is solved or the verifier is broken`,
          );
        } else {
          push(
            'PASS',
            `${task.id}: command verifier fails on the untouched fixture (the failure reproduces)`,
          );
        }
      } finally {
        rmSync(fixtureCopy, { recursive: true, force: true });
      }
    } else {
      const missing = await probeVerifier(bench.dir, task.verifier, null);
      if (missing.exitCode === 0 || missing.exitCode === null) {
        push('FAIL', `${task.id}: verifier does not reject a missing _output.md`);
      } else {
        push('PASS', `${task.id}: verifier rejects missing output`);
      }
      const empty = await probeVerifier(bench.dir, task.verifier, '');
      if (empty.exitCode === 0 || empty.exitCode === null) {
        push('FAIL', `${task.id}: verifier passes an empty output — it cannot tell success from silence`);
      } else {
        push('PASS', `${task.id}: verifier rejects empty output`);
      }
    }

    const markerPath = join(bench.dir, task.fixture, MOCK_MARKER_FILE);
    if ((task.verifierKind ?? 'output') === 'command') {
      push('INFO', `${task.id}: command verifier — mock-arm probes not applicable`);
    } else if (existsSync(markerPath)) {
      try {
        const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as MockMarkerOutputs;
        for (const arm of ['baseline', 'treatment'] as const) {
          const behavior = marker[arm];
          if (behavior?.output === undefined) continue;
          const probe = await probeVerifier(bench.dir, task.verifier, behavior.output);
          push(
            'INFO',
            `${task.id}: mock ${arm} output → verifier ${probe.exitCode === 0 ? 'pass' : 'fail'}`,
          );
        }
      } catch (error) {
        push('FAIL', `${task.id}: ${MOCK_MARKER_FILE} is unreadable (${(error as Error).message})`);
      }
    } else {
      push('INFO', `${task.id}: no ${MOCK_MARKER_FILE} (offline mock runs will produce empty outputs)`);
    }

    const fixtureDir = join(bench.dir, task.fixture);
    const fixtureBytes = listFilesRecursive(fixtureDir)
      .map((rel) => statSync(join(fixtureDir, rel)).size)
      .reduce((sum, size) => sum + size, 0);
    if (fixtureBytes > FIXTURE_SIZE_WARN_BYTES) {
      push(
        'WARN',
        `${task.id}: fixture is ${Math.round(fixtureBytes / 1024)} KB — inject mode inlines it into every prompt; keep it lean`,
      );
    } else {
      push('PASS', `${task.id}: fixture size ${Math.round(fixtureBytes / 1024)} KB`);
    }

    if (task.shouldTrigger === undefined) {
      push('INFO', `${task.id}: no shouldTrigger label (trigger mode will skip this task)`);
    } else {
      labeledTasks++;
      if (task.shouldTrigger === false) negativeTasks++;
    }
  }

  if (labeledTasks > 0 && negativeTasks === 0) {
    push(
      'WARN',
      'no shouldTrigger:false (negative-control) tasks — trigger mode cannot measure false-trigger rate (see docs/metrics.md)',
    );
  }

  if (options.calibrate) {
    await calibrateBench(bench, options.calibrate, push, log);
  }

  return finish(dir, checks, log, options.calibrate !== false && options.calibrate !== undefined);
}

const CALIBRATE_DEFAULT_TRIALS = 2;

async function calibrateBench(
  bench: ReturnType<typeof loadBench>,
  options: BenchCheckCalibrateOptions,
  push: (status: Check['status'], message: string) => void,
  log: (msg: string) => void,
): Promise<void> {
  if (!options.agent && !options.executor) {
    push('FAIL', '--calibrate needs --agent (a CLI executor for real runs)');
    return;
  }
  const trials = options.trials ?? CALIBRATE_DEFAULT_TRIALS;
  const emptySkillDir = mkdtempSync(join(tmpdir(), 'skillfit-calibrate-'));
  try {
    const skill: SkillBundle = {
      name: 'calibration-none',
      sourceDir: emptySkillDir,
      files: [],
      sha256: '0'.repeat(64),
      payload: '',
    };
    const executor = options.executor ?? CliExecutor.forAgent(options.agent ?? '');
    const runGroup =
      options.runGroup ??
      `calibrate-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now() % 100000).padStart(5, '0')}`;
    const manifest = await runTriggerExperiment({
      bench,
      skill,
      executor,
      trials,
      runsRoot: options.runsRoot ?? resolve('runs'),
      runGroup,
      skillInstallDir: '.skillfit-empty-skills',
      log,
    });
    push('INFO', `calibration: ${trials} run(s) per task with no skill installed (baseline difficulty)`);
    let discriminative = 0;
    for (const task of manifest.tasks) {
      const total = task.runs + task.unknown + task.errors;
      const rate = total === 0 ? null : task.passes / total;
      if (rate === null) {
        push('WARN', `${task.id}: no completed runs — cannot assess difficulty`);
        continue;
      }
      if (rate >= 0.9) {
        push('WARN', `${task.id}: baseline ${task.passes}/${total} — too easy (saturated; cannot discriminate skill effects)`);
      } else if (rate <= 0.1) {
        push('WARN', `${task.id}: baseline ${task.passes}/${total} — too hard or broken (floor)`);
      } else {
        discriminative++;
        push('PASS', `${task.id}: baseline ${task.passes}/${total} — discriminative band`);
      }
    }
    push(
      discriminative === manifest.tasks.length ? 'PASS' : 'INFO',
      `calibration: ${discriminative}/${manifest.tasks.length} task(s) in the discriminative band (runs under ${runGroup}; use --trials 3+ for steadier reads)`,
    );
  } finally {
    rmSync(emptySkillDir, { recursive: true, force: true });
  }
}

function finish(
  dir: string,
  checks: Check[],
  log: (msg: string) => void,
  calibrated = false,
): BenchCheckReport {
  const failures = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;
  const passes = checks.filter((c) => c.status === 'PASS').length;
  log('');
  log(`Summary: ${passes} passed, ${warnings} warning(s), ${failures} failure(s)`);
  if (!calibrated) {
    log('Next: calibrate difficulty against a real agent —');
    log(`  skillfit eval <skill-path> --bench ${dir} --agent <id> --trials 3`);
    log('  target: baseline pass rate in the 30–70% discriminative band (docs/metrics.md).');
  }
  return { dir, checks, failures, warnings };
}

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface BenchAddOptions {
  benchDir?: string;
  cwd?: string;
  task?: string;
  prompt?: string;
  promptFile?: string;
  freeze?: boolean;
  fromCommit?: string;
  include?: string[];
  sourceDir?: string;
  verifierCmd?: string;
  expect?: string;
  shouldTrigger?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (msg: string) => void;
}

export function captureSourceFiles(sourceDir: string): string[] {
  const git = spawnSync('git', ['ls-files', '-z'], { cwd: sourceDir, encoding: 'utf8' });
  if (git.status === 0 && git.stdout.trim() !== '') {
    return git.stdout.split('\0').filter(Boolean);
  }
  return listFilesRecursive(sourceDir).filter(
    (rel) => !rel.split(/[\\/]/).some((part) => part === '.git' || part === 'node_modules'),
  );
}

function verifierForCmd(cmd: string): string {
  return `import { spawnSync } from 'node:child_process';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node <verifier> <run-dir>');
  process.exit(2);
}
function scrubbedEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

const result = spawnSync(${JSON.stringify(cmd)}, { cwd: runDir, shell: true, encoding: 'utf8', env: scrubbedEnv() });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(String(result.error));
  process.exit(1);
}
process.exit(result.status ?? 1);
`;
}

function verifierForExpect(needle: string): string {
  return `import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node <verifier> <run-dir>');
  process.exit(2);
}

let output;
try {
  output = fs.readFileSync(path.join(runDir, '_output.md'), 'utf8');
} catch {
  console.log(JSON.stringify({ passed: false, error: 'missing _output.md' }));
  process.exit(1);
}
const passed = output.includes(${JSON.stringify(needle)});
console.log(JSON.stringify({ passed }));
process.exit(passed ? 0 : 1);
`;
}

interface PreparedAdd {
  defaultTaskId: string;
  promptText: string;
  verifierSource: string;
  verifierKind: 'output' | 'command';
  fixtureFiles: Array<{ rel: string; content: Buffer }>;
  groundTruth: string;
  planFixtureLine: string;
}

export async function runBenchAdd(
  options: BenchAddOptions,
): Promise<{ dir: string; taskId: string; files: string[] } | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  if (!options.freeze && !options.fromCommit) {
    throw new Error('bench add needs an importer: --freeze (current directory) or --from-commit <sha> (git history).');
  }
  if (options.freeze && options.fromCommit) {
    throw new Error('Pass exactly one importer: --freeze OR --from-commit, not both.');
  }
  const cwd = options.cwd ?? process.cwd();
  const benchDir = resolve(cwd, options.benchDir ?? '.');
  const benchJsonPath = join(benchDir, 'bench.json');
  if (!existsSync(benchJsonPath)) {
    throw new Error(`Not a bench directory (missing bench.json): ${benchDir} — run \`skillfit bench init\` first.`);
  }
  const benchJson = JSON.parse(readFileSync(benchJsonPath, 'utf8')) as {
    tasks?: Array<{ id?: unknown }>;
  } & Record<string, unknown>;
  const tasks = Array.isArray(benchJson.tasks) ? benchJson.tasks : [];

  const prepared = options.fromCommit
    ? prepareFromCommit(options, cwd)
    : prepareFreeze(options, cwd);
  const taskId = options.task ?? prepared.defaultTaskId;
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error(`Invalid --task id "${taskId}" (must match ${TASK_ID_PATTERN}).`);
  }
  if (tasks.some((task) => task?.id === taskId)) {
    throw new Error(`Task "${taskId}" already exists in ${benchJsonPath}.`);
  }

  const generated: Record<string, string> = {
    [`prompts/${taskId}.md`]: `${prepared.promptText.trimEnd()}\n`,
    [`prompts/${taskId}.trigger.md`]: `${prepared.promptText.trimEnd()}\n\nThe repository is in your current working directory.\n`,
    [`verifiers/${taskId}.mjs`]: prepared.verifierSource,
    [`ground-truth/${taskId}.md`]: prepared.groundTruth,
  };
  const taskEntry = {
    id: taskId,
    fixture: `fixtures/${taskId}`,
    prompt: `prompts/${taskId}.md`,
    promptTrigger: `prompts/${taskId}.trigger.md`,
    verifier: `node verifiers/${taskId}.mjs`,
    verifierKind: prepared.verifierKind,
    rubric: `ground-truth/${taskId}.md`,
    ...(options.shouldTrigger !== undefined ? { shouldTrigger: options.shouldTrigger } : {}),
  };

  if (options.dryRun) {
    log(`bench add plan (dry run) — task "${taskId}" into ${benchDir}:`);
    log(`  + fixtures/${taskId}/ (${prepared.planFixtureLine})`);
    for (const rel of Object.keys(generated)) log(`  + ${rel}`);
    log('  ~ bench.json (register task)');
    log('Dry run — nothing was written. Re-run with --yes to apply.');
    return null;
  }
  if (!options.yes) {
    const confirm = options.confirm ?? defaultConfirm;
    const ok = await confirm(
      `Add ${prepared.fixtureFiles.length} fixture file(s) + ${Object.keys(generated).length} generated file(s) into ${benchDir}? [y/N] `,
    );
    if (!ok) {
      log('Aborted — nothing was written.');
      return null;
    }
  }

  for (const file of prepared.fixtureFiles) {
    const target = join(benchDir, 'fixtures', taskId, file.rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
  for (const [rel, content] of Object.entries(generated)) {
    const target = join(benchDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  benchJson.tasks = [...tasks, taskEntry];
  writeFileSync(benchJsonPath, `${JSON.stringify(benchJson, null, 2)}\n`, 'utf8');
  loadBench(benchDir);

  log(`Task "${taskId}" added to ${benchDir} (${prepared.fixtureFiles.length} fixture file(s), verifier: ${prepared.verifierKind}).`);
  log('Next:');
  log(`  skillfit bench check ${benchDir}`);
  log(`  skillfit eval <skill-path> --bench ${benchDir} --agent <id> --trials 3`);
  return {
    dir: benchDir,
    taskId,
    files: [
      ...prepared.fixtureFiles.map((file) => `fixtures/${taskId}/${file.rel}`),
      ...Object.keys(generated),
      'bench.json',
    ],
  };
}

function prepareFreeze(options: BenchAddOptions, cwd: string): PreparedAdd {
  const promptText =
    options.prompt ??
    (options.promptFile ? readFileSync(resolve(cwd, options.promptFile), 'utf8') : undefined);
  if (!promptText || promptText.trim() === '') {
    throw new Error('bench add --freeze needs a task prompt: --prompt <text> or --prompt-file <path>.');
  }
  if (options.verifierCmd && options.expect !== undefined) {
    throw new Error('Pass exactly one verifier: --verifier-cmd OR --expect, not both.');
  }
  if (!options.verifierCmd && options.expect === undefined) {
    throw new Error('bench add --freeze needs a verifier: --verifier-cmd <cmd> or --expect <string>.');
  }

  const sourceDir = resolve(cwd, options.sourceDir ?? '.');
  if (!existsSync(sourceDir)) {
    throw new Error(`--source-dir does not exist: ${sourceDir}`);
  }
  const captured = captureSourceFiles(sourceDir);
  if (captured.length === 0) {
    throw new Error(`No capturable files in ${sourceDir} (empty git index or directory).`);
  }

  return {
    defaultTaskId: 'frozen-task',
    promptText: promptText.trimEnd(),
    verifierSource: options.verifierCmd
      ? verifierForCmd(options.verifierCmd)
      : verifierForExpect(options.expect ?? ''),
    verifierKind: options.verifierCmd ? 'command' : 'output',
    fixtureFiles: captured.map((rel) => ({ rel, content: readFileSync(join(sourceDir, rel)) })),
    groundTruth: `# Ground truth — frozen task

Frozen from a real failure on ${new Date().toISOString().slice(0, 10)}.

- Source directory: \`${sourceDir}\`
- Verifier: ${options.verifierCmd ? `\`${options.verifierCmd}\` (command, run in the task run directory)` : `agent output contains ${JSON.stringify(options.expect)}`}

TODO: describe what a correct outcome looks like, so future bench edits stay honest.
`,
    planFixtureLine: `${captured.length} file(s) from ${sourceDir}`,
  };
}

const MINED_TEST_PATH = /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i;
const MINED_MAX_FILES = 200;
const MINED_MAX_BYTES = 1024 * 1024;

function gitRun(
  repo: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function gitMust(repo: string, args: string[]): string {
  const result = gitRun(repo, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${repo}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function gitShow(repo: string, ref: string, path: string): Buffer {
  const result = spawnSync('git', ['show', `${ref}:${path}`], {
    cwd: repo,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || result.stdout === undefined) {
    throw new Error(`git show ${ref}:${path} failed in ${repo}`);
  }
  return result.stdout as Buffer;
}

function verifierForMinedTests(tests: Array<{ rel: string; content: Buffer }>, cmd: string): string {
  const embedded: Record<string, string> = {};
  for (const test of tests) {
    embedded[test.rel] = test.content.toString('utf8');
  }
  return `import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node <verifier> <run-dir>');
  process.exit(2);
}
function scrubbedEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

const TEST_FILES = ${JSON.stringify(embedded, null, 2)};
for (const [rel, content] of Object.entries(TEST_FILES)) {
  const target = path.join(runDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

const result = spawnSync(${JSON.stringify(cmd)}, { cwd: runDir, shell: true, encoding: 'utf8', env: scrubbedEnv() });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(String(result.error));
  process.exit(1);
}
process.exit(result.status ?? 1);
`;
}

function prepareFromCommit(options: BenchAddOptions, cwd: string): PreparedAdd {
  const repo = resolve(cwd, options.sourceDir ?? '.');
  if (!existsSync(repo)) {
    throw new Error(`--source-dir does not exist: ${repo}`);
  }
  const sha = gitMust(repo, ['rev-parse', '--verify', `${options.fromCommit}^{commit}`]).trim();
  const shortSha = sha.slice(0, 7);
  const subject = gitMust(repo, ['show', '-s', '--format=%s', sha]).trim();
  const body = gitMust(repo, ['show', '-s', '--format=%b', sha]).trim();

  const changed = gitMust(repo, ['diff-tree', '--no-commit-id', '--name-status', '-r', sha])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status: status ?? '', path: rest.join('\t') };
    });
  const minedTests = changed.filter((entry) => MINED_TEST_PATH.test(entry.path) && entry.status !== 'D');
  const nonTests = changed.filter((entry) => !MINED_TEST_PATH.test(entry.path));
  if (minedTests.length === 0) {
    throw new Error(
      `Commit ${shortSha} changes no test files — --from-commit needs a fix that ships a test (the test becomes the verifier).`,
    );
  }
  if (nonTests.length === 0) {
    throw new Error(`Commit ${shortSha} changes only test files — there is no fix for the agent to write.`);
  }

  const parentLookup = gitRun(repo, ['rev-parse', '--verify', `${sha}^`]);
  if (parentLookup.status !== 0) {
    throw new Error(
      `Commit ${shortSha} has no parent — --from-commit needs a fix commit with a parent state to use as the fixture.`,
    );
  }
  const parent = parentLookup.stdout.trim();
  const parentShort = parent.slice(0, 8);

  let tree = gitMust(repo, ['ls-tree', '-r', '--format=%(objectsize) %(path)', parent])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s(.+)$/);
      return { size: Number(match?.[1] ?? 0), path: match?.[2] ?? '' };
    })
    .filter((entry) => entry.path !== '');
  if (options.include && options.include.length > 0) {
    const prefixes = options.include.map((prefix) => prefix.replace(/\/?$/, '/'));
    tree = tree.filter((entry) => prefixes.some((prefix) => entry.path.startsWith(prefix)));
    if (tree.length === 0) {
      throw new Error(`--include pathspec(s) ${options.include.join(', ')} match nothing at ${parentShort}.`);
    }
  }
  const totalBytes = tree.reduce((sum, entry) => sum + entry.size, 0);
  if (tree.length > MINED_MAX_FILES || totalBytes > MINED_MAX_BYTES) {
    throw new Error(
      `Repo state at ${parentShort} is ${tree.length} files / ${Math.round(totalBytes / 1024)} KB — too large for a bench fixture. Narrow it with --include <dir> (repeatable).`,
    );
  }

  const fixtureFiles = tree.map((entry) => ({ rel: entry.path, content: gitShow(repo, parent, entry.path) }));
  const tests = minedTests.map((entry) => ({ rel: entry.path, content: gitShow(repo, sha, entry.path) }));
  const verifierCmd = options.verifierCmd ?? 'node --test';

  return {
    defaultTaskId: `fix-${shortSha}`,
    promptText: `# Task: implement the following change request

The repository below is \`${basename(repo)}\` at commit \`${parentShort}\` — the state before the fix that resolved this request was applied.

## Change request

${subject}${body !== '' ? `\n\n${body}` : ''}

## Rules

- Do not change public export names.
- Hidden grading runs the project's tests afterward — make the behavior correct, not merely plausible.`,
    verifierSource: verifierForMinedTests(tests, verifierCmd),
    verifierKind: 'command',
    fixtureFiles,
    groundTruth: `# Ground truth — fix-${shortSha}

Mined from git history on ${new Date().toISOString().slice(0, 10)}.

- Repository: \`${repo}\`
- Fix commit: \`${sha}\` — ${subject}
- Parent (fixture state): \`${parent}\`
- Verifier: the fix commit's own tests (${tests.map((test) => `\`${test.rel}\``).join(', ')}), run via \`${verifierCmd}\` — they fail on the parent state and pass once the fix is implemented (FAIL_TO_PASS).
- The fix itself: see \`git show ${sha}\` in the source repository.

TODO: summarize the correct fix here so future bench edits stay honest.
`,
    planFixtureLine: `${fixtureFiles.length} file(s) at parent ${parentShort} from ${repo} (+${tests.length} hidden test file(s) embedded in the verifier)`,
  };
}
