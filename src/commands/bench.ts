import * as readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { loadBench } from '../harness/bench.js';
import { listFilesRecursive } from '../harness/hash.js';
import { runVerifier } from '../harness/runner.js';
import { MOCK_MARKER_FILE } from '../harness/constants.js';
import type { Check } from './doctor.js';

export interface BenchInitOptions {
  dir?: string;
  cwd?: string;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (msg: string) => void;
}

export interface BenchCheckOptions {
  dir?: string;
  log?: (msg: string) => void;
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

  return finish(dir, checks, log);
}

function finish(dir: string, checks: Check[], log: (msg: string) => void): BenchCheckReport {
  const failures = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;
  const passes = checks.filter((c) => c.status === 'PASS').length;
  log('');
  log(`Summary: ${passes} passed, ${warnings} warning(s), ${failures} failure(s)`);
  log('Next: calibrate difficulty against a real agent —');
  log(`  skillfit eval <skill-path> --bench ${dir} --agent <id> --trials 3`);
  log('  target: baseline pass rate in the 30–70% discriminative band (docs/metrics.md).');
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

export async function runBenchAdd(
  options: BenchAddOptions,
): Promise<{ dir: string; taskId: string; files: string[] } | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  if (!options.freeze) {
    throw new Error('bench add currently supports only --freeze (git-history and other importers are planned).');
  }
  const cwd = options.cwd ?? process.cwd();
  const benchDir = resolve(cwd, options.benchDir ?? '.');
  const benchJsonPath = join(benchDir, 'bench.json');
  if (!existsSync(benchJsonPath)) {
    throw new Error(`Not a bench directory (missing bench.json): ${benchDir} — run \`skillfit bench init\` first.`);
  }
  const taskId = options.task ?? '';
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error(`Invalid --task id "${taskId}" (must match ${TASK_ID_PATTERN}).`);
  }
  const benchJson = JSON.parse(readFileSync(benchJsonPath, 'utf8')) as {
    tasks?: Array<{ id?: unknown }>;
  } & Record<string, unknown>;
  const tasks = Array.isArray(benchJson.tasks) ? benchJson.tasks : [];
  if (tasks.some((task) => task?.id === taskId)) {
    throw new Error(`Task "${taskId}" already exists in ${benchJsonPath}.`);
  }

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

  const verifierKind = options.verifierCmd ? 'command' : 'output';
  const generated: Record<string, string> = {
    [`prompts/${taskId}.md`]: `${promptText.trimEnd()}\n`,
    [`prompts/${taskId}.trigger.md`]: `${promptText.trimEnd()}\n\nThe repository is in your current working directory.\n`,
    [`verifiers/${taskId}.mjs`]: options.verifierCmd
      ? verifierForCmd(options.verifierCmd)
      : verifierForExpect(options.expect ?? ''),
    [`ground-truth/${taskId}.md`]: `# Ground truth — ${taskId}

Frozen from a real failure on ${new Date().toISOString().slice(0, 10)}.

- Source directory: \`${sourceDir}\`
- Verifier: ${options.verifierCmd ? `\`${options.verifierCmd}\` (command, run in the task run directory)` : `agent output contains ${JSON.stringify(options.expect)}`}

TODO: describe what a correct outcome looks like, so future bench edits stay honest.
`,
  };
  const taskEntry = {
    id: taskId,
    fixture: `fixtures/${taskId}`,
    prompt: `prompts/${taskId}.md`,
    promptTrigger: `prompts/${taskId}.trigger.md`,
    verifier: `node verifiers/${taskId}.mjs`,
    verifierKind,
    rubric: `ground-truth/${taskId}.md`,
    ...(options.shouldTrigger !== undefined ? { shouldTrigger: options.shouldTrigger } : {}),
  };

  if (options.dryRun) {
    log(`bench add --freeze plan (dry run) — task "${taskId}" into ${benchDir}:`);
    log(`  + fixtures/${taskId}/ (${captured.length} file(s) from ${sourceDir})`);
    for (const rel of Object.keys(generated)) log(`  + ${rel}`);
    log('  ~ bench.json (register task)');
    log('Dry run — nothing was written. Re-run with --yes to apply.');
    return null;
  }
  if (!options.yes) {
    const confirm = options.confirm ?? defaultConfirm;
    const ok = await confirm(
      `Freeze ${captured.length} fixture file(s) + ${Object.keys(generated).length} generated file(s) into ${benchDir}? [y/N] `,
    );
    if (!ok) {
      log('Aborted — nothing was written.');
      return null;
    }
  }

  for (const rel of captured) {
    const target = join(benchDir, 'fixtures', taskId, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(sourceDir, rel)));
  }
  for (const [rel, content] of Object.entries(generated)) {
    const target = join(benchDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  benchJson.tasks = [...tasks, taskEntry];
  writeFileSync(benchJsonPath, `${JSON.stringify(benchJson, null, 2)}\n`, 'utf8');
  loadBench(benchDir);

  log(`Task "${taskId}" frozen into ${benchDir} (${captured.length} fixture file(s), verifier: ${verifierKind}).`);
  log('Next:');
  log(`  skillfit bench check ${benchDir}`);
  log(`  skillfit eval <skill-path> --bench ${benchDir} --agent <id> --trials 3`);
  return {
    dir: benchDir,
    taskId,
    files: [
      ...captured.map((rel) => `fixtures/${taskId}/${rel}`),
      ...Object.keys(generated),
      'bench.json',
    ],
  };
}
