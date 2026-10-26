import { parseBenchClaims } from "./claims.js";
import { spawnSync } from 'node:child_process';
import { copyFixture, runOracleGate } from "./gates/check.js";
import { closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { BENCH_SCHEMA_VERSIONS, loadBench, validateBenchTask } from "./read.js";
import { resolveBenchDir } from "./location.js";
import { sha256File, sha256Text } from "../shared/hash.js";
import { runVerifier, verifierFailure } from "./gates/verifier.js";
import { MOCK_MARKER_FILE } from './constants.js';
import type { Executor } from "../agents/contracts.js";
import { commandTemplateFiles } from "./command-template.js";
import { BACKUP_SUFFIX } from '../shared/backup.js';
import { throwIfCancelled as throwIfEvaluationInterrupted } from "../shared/cancellation.js";
import { freezeSourceFiles } from "./source.js";
import { BenchDraftSession, type BenchDraftOptions } from "./draft.js";
import { parseVerifierTimeoutSeconds } from "./gates/timeout.js";

export interface BenchInitOptions {
  schemaVersion?: 1 | 2;
  dir?: string;
  kind?: 'output' | 'command';
  cwd?: string;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (msg: string) => void;
}

export interface BenchAddOptions extends BenchDraftOptions {
  claims?: string[];
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
  oracle?: string;
  decompose?: boolean;
  verifierKind?: 'output' | 'command';
  agent?: string;
  executor?: Executor;
  shouldTrigger?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (msg: string) => void;
}

export interface BenchManageOptions {
  dir: string;
  taskId: string;
  action: 'edit' | 'remove';
  set?: string[];
  unset?: string[];
  dryRun?: boolean;
  yes?: boolean;
  log?: (message: string) => void;
}

export interface BenchAuthoringDependencies {
  now?: () => Date;
  writeFile?: typeof writeFileSync;
}

export interface PreparedBenchChange<Result = unknown> {
  readonly operation: 'init' | 'add' | 'edit' | 'remove';
  readonly dir: string;
  readonly writes: readonly { target: string; content: Buffer | string }[];
  readonly sourceSha256?: string;
  readonly targetSha256: string;
  readonly lines: { before: string[]; preview: string[]; after: string[] };
  readonly confirmation: string;
  readonly draft: boolean;
  readonly result: Result;
  assertCurrent(): void;
}

interface ChangeState { apply(): unknown; draft?: (log: (line: string) => void) => Promise<void>; }
const changes = new WeakMap<object, ChangeState>();
function prepared<Result>(view: PreparedBenchChange<Result>, state: ChangeState): PreparedBenchChange<Result> {
  // Public write previews cannot mutate the private transaction's bytes.
  const change = Object.freeze({ ...view, writes: view.writes.map(write => ({ ...write,
    content: Buffer.isBuffer(write.content) ? Buffer.from(write.content) : write.content })) });
  changes.set(change, state); return change;
}
export function applyBenchChange<Result>(change: PreparedBenchChange<Result>): Result {
  const state = changes.get(change);
  if (!state) throw new Error('Unknown prepared bench change; prepare a fresh change.');
  // Each transaction checks within its own failure/finalization scope so a
  // rejected post-draft apply still retains the completed attempt's summary.
  return state.apply() as Result;
}
/** Explicit, bounded drafting step, called only after the command's existing authorization. */
export async function draftBenchChange(change: PreparedBenchChange, log: (line: string) => void): Promise<void> {
  const state = changes.get(change);
  if (!state?.draft) throw new Error('This bench change has no drafting step.');
  change.assertCurrent(); await state.draft(log);
}

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
            oracle: 'node ground-truth/oracle-example-task.mjs',
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
  console.log(JSON.stringify({ passed: false, checks: [{ name: 'exact-answer', pass: false }], error: 'missing _output.md' }));
  process.exit(1);
}
const passed = output === 'skillfit-ok';
console.log(JSON.stringify({ passed, checks: [{ name: 'exact-answer', pass: passed }] }));
process.exitCode = passed ? 0 : 1;
`,
    'ground-truth/oracle-example-task.mjs': `import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-example-task.mjs <run-dir>');
  process.exit(2);
}

// The oracle applies the reference solution: the exact contents of answer.txt.
const answer = fs.readFileSync(path.join(runDir, 'answer.txt'), 'utf8').trim();
fs.writeFileSync(path.join(runDir, '_output.md'), answer + '\\n', 'utf8');
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
   (quality-improvement target: baseline pass rate 30–70%; efficiency requires
   paired costs, coverage and regression checks — see docs/reference/metrics.md).
`,
  };
}

function prepareInit(options: BenchInitOptions, dependencies: BenchAuthoringDependencies): PreparedBenchChange<{ dir: string; created: string[] }> {
  const kind = options.kind ?? 'output', schemaVersion = options.schemaVersion ?? 1;
  if (!BENCH_SCHEMA_VERSIONS.includes(schemaVersion)) throw new Error('bench init schemaVersion must be 1 or 2.');
  if (kind !== 'output' && kind !== 'command') throw new Error(`Unknown bench kind: ${kind} (expected "output" or "command")`);
  const dir = resolve(options.cwd ?? process.cwd(), options.dir ?? 'skillfit-bench');
  const files = kind === 'command' ? commandTemplateFiles(basename(dir)) : templateFiles(basename(dir));
  if (schemaVersion === 2) {
    const manifest = JSON.parse(files['bench.json']!); manifest.schemaVersion = 2;
    for (const task of manifest.tasks) task.claims = ['quality'];
    files['bench.json'] = JSON.stringify(manifest, null, 2) + '\n';
  }
  const created = Object.keys(files), writes = created.map(rel => ({ target: join(dir, rel), content: files[rel]! }));
  const assertCurrent = () => {
    if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`Target directory is not empty: ${dir}`);
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error(`Refusing a symlink in bench output: ${dir}`);
    assertBenchWrites(dir, writes.map(write => write.target));
  };
  const result = { dir, created };
  return prepared({ operation: 'init', dir, writes, targetSha256: sha256Text(JSON.stringify(created.map(() => null))),
    confirmation: `Create ${created.length} file(s) in ${dir}? [y/N] `, draft: false, result, assertCurrent,
    lines: { before: [], preview: [`Bench scaffold plan (dry run) — ${dir}:`, ...created.map(rel => `  + ${rel}`),
      'Dry run — nothing was written. Re-run with --yes to apply.'],
      after: [`Bench scaffolded at ${dir} (${created.length} files, self-check passed).`, 'Next:',
        `  skillfit bench check ${dir}`,
        `  skillfit eval <skill-path> --bench ${dir} --agent <id>${kind === 'command' ? ' --input workspace' : ''} --trials 1 --max-calls 2 --dry-run`,
        'This is a teaching case. Replace it with your own task before measuring Skill benefit.'] } }, {
      apply: () => {
        assertCurrent();
        const applied: string[] = [];
        try {
          for (const write of writes) {
            mkdirSync(dirname(write.target), { recursive: true });
            const fd = openSync(write.target, 'wx');
            applied.push(write.target);
            try { (dependencies.writeFile ?? writeFileSync)(fd, write.content); }
            finally { closeSync(fd); }
          }
          loadBench(dir); return result;
        } catch (error) { for (const target of applied.reverse()) rmSync(target, { force: true }); throw error; }
      },
    });
}

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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
if (result.error || result.signal || result.status === null) {
  console.log(JSON.stringify({ schemaVersion: 1, kind: 'skillfit.verifier-error',
    message: result.error ? String(result.error) : 'Verifier command ended without a verdict: ' + (result.signal ?? 'no exit code') }));
  process.exit(2);
}
process.exitCode = result.status;
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
process.exitCode = passed ? 0 : 1;
`;
}

interface PreparedAdd {
  defaultTaskId: string;
  promptText: string;
  verifierSource: string;
  verifierKind: 'output' | 'command';
  oracleSource?: string;
  fixtureFiles: Array<{ rel: string; content: Buffer }>;
  groundTruth: string;
  planFixtureLine: string;
}

function buildDecomposePrompt(
  taskPrompt: string,
  fixtureFiles: string[],
  verifierKind: 'output' | 'command',
): string {
  const listing = fixtureFiles.map((rel) => `- fixture/${rel}`).join('\n');
  const grading =
    verifierKind === 'command'
      ? 'The verifier runs a real command inside the run directory and grades the final file state (the agent edits files).'
      : "The verifier grades the agent's final message at <run-dir>/_output.md.";
  const solving =
    verifierKind === 'command'
      ? 'applies the reference fix to the files inside <run-dir>'
      : 'writes the reference answer to <run-dir>/_output.md';
  return `You are drafting a skillfit bench task verifier and its oracle (reference solution).

# The task the bench measures

${taskPrompt}

# The fixture

A pristine copy of the task fixture lives at ./fixture/ (${fixtureFiles.length} file(s)):

${listing}

Read whatever fixture files you need. Do NOT modify anything under fixture/ — it is the
untouched starting state and must stay that way.

# What you must write

Two files in the current directory (NOT under fixture/):

1. verifier.mjs — run as \`node verifier.mjs <run-dir>\`. ${grading}
   - Deterministic: same run directory in, same verdict out. No network, no clocks, no randomness.
   - Exit code 0 = pass, anything else = fail. That is the only pass/fail signal.
   - The LAST stdout line must be one JSON object: {"passed": boolean, "checks": [{"name": string, "pass": boolean}]}.
     Decompose the task's acceptance criteria into named checks (2–8 of them); "passed" is true
     exactly when every check passes. Grade the outcome, not the path taken.
   - It MUST exit non-zero on the untouched fixture (the task starts unsolved).

2. oracle.mjs — run as \`node oracle.mjs <run-dir>\`; it ${solving}.
   After the oracle runs, \`node verifier.mjs <run-dir>\` must exit 0 with every check passing.

Both scripts run with the bench root as cwd and receive the run directory as argv[2]. Use only
Node built-ins. Your draft is validated automatically: the verifier must fail the untouched
fixture and pass the oracle-solved one, so test both directions before you finish.
`;
}

async function draftVerifierWithOracle(
  session: BenchDraftSession,
  log: (msg: string) => void,
): Promise<{ verifierSource: string; oracleSource: string }> {
  const staging = session.workspace;
  const fixtureDir = join(staging, 'fixture');
  log(`Drafting verifier + oracle; at most 1 call. Records: ${session.dir}`);
  await session.run();
  const verifierPath = join(staging, 'verifier.mjs');
  const oraclePath = join(staging, 'oracle.mjs');
  if (!existsSync(verifierPath) || !existsSync(oraclePath)) {
    throw new Error(
      'the drafting agent did not write verifier.mjs and oracle.mjs into its working directory — nothing was added',
    );
  }

  const nopDir = mkdtempSync(join(tmpdir(), 'skillfit-decompose-nop-'));
  try {
    copyFixture(fixtureDir, nopDir);
    const nop = await runVerifier(staging, 'node verifier.mjs', nopDir, session.plan.verifierTimeoutSeconds);
    session.gate('untouched-fixture', nop);
    if (nop.error !== null || nop.exitCode === null) {
      throw new Error(`draft rejected: ${verifierFailure('verifier', 'node verifier.mjs', nop.error)}`);
    }
    if (nop.exitCode === 0) {
      throw new Error(
        'draft rejected: the verifier passes the untouched fixture — the task would start solved (NOP gate)',
      );
    }
  } finally {
    rmSync(nopDir, { recursive: true, force: true });
  }

  const solvedGate = await runOracleGate(staging, fixtureDir, 'node oracle.mjs', 'node verifier.mjs', session.plan.verifierTimeoutSeconds,
    (name, result) => session.gate(name, result));
  if (solvedGate.kind === 'oracle-failed') {
    throw new Error(
      `draft rejected: ${solvedGate.reason ?? 'the oracle command failed on a fresh fixture copy'}`,
    );
  }
  if (solvedGate.kind === 'verifier-failed') {
    throw new Error(
      `draft rejected: ${
        solvedGate.reason ?? 'the verifier fails even after the oracle solved the task (oracle gate)'
      }`,
    );
  }
  if (solvedGate.kind === 'low-score') {
    throw new Error(
      `draft rejected: the oracle scores ${solvedGate.score.toFixed(2)} on the drafted checks — checks are stricter than the oracle`,
    );
  }

  return {
    verifierSource: readFileSync(verifierPath, 'utf8'),
    oracleSource: readFileSync(oraclePath, 'utf8'),
  };
}

function assertInsideBench(benchDir: string, target: string): void {
  const rel = relative(benchDir, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to write outside the bench directory: ${target}`);
  }
}

function assertBenchWrites(benchDir: string, targets: readonly string[]): void {
  for (const target of targets) {
    assertInsideBench(benchDir, target);
    const parts = relative(benchDir, target).split(/[\\/]/);
    let path = benchDir;
    for (let index = 0; index < parts.length; index++) {
      path = join(path, parts[index]!);
      try {
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) throw new Error(`Refusing a symlink in bench output: ${path}`);
        if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) throw new Error(`Refusing to overwrite a non-file or traverse a non-directory: ${path}`);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    try {
      const stat = lstatSync(target + BACKUP_SUFFIX);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Refusing an unsafe backup target: ${target + BACKUP_SUFFIX}`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}

export function applyBenchWrites(benchDir: string, writes: Array<{ target: string; content: Buffer | string }>): void {
  assertBenchWrites(benchDir, writes.map(write => write.target));
  const applied: Array<{ target: string; previous: Buffer | null }> = [];
  try {
    for (const write of writes) {
      assertInsideBench(benchDir, write.target);
      mkdirSync(dirname(write.target), { recursive: true });
      let previous: Buffer | null = null;
      try {
        const stat = lstatSync(write.target);
        if (stat.isSymbolicLink()) throw new Error(`Refusing to overwrite a symlink: ${write.target}`);
        if (!stat.isFile()) throw new Error(`Refusing to overwrite a non-file: ${write.target}`);
        previous = readFileSync(write.target);
        const backup = write.target + BACKUP_SUFFIX;
        let backupExists = false;
        try {
          const backupStat = lstatSync(backup);
          if (backupStat.isSymbolicLink() || !backupStat.isFile()) throw new Error(`Refusing an unsafe backup target: ${backup}`);
          backupExists = true;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (!backupExists) writeFileSync(backup, previous, { flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      applied.push({ target: write.target, previous });
      writeFileSync(write.target, write.content);
    }
    loadBench(benchDir);
  } catch (error) {
    for (const entry of [...applied].reverse()) {
      if (entry.previous === null) rmSync(entry.target, { force: true });
      else writeFileSync(entry.target, entry.previous);
    }
    throw error;
  }
}

function prepareAdd(options: BenchAddOptions, now: () => Date): PreparedBenchChange<{ dir: string; taskId: string; files: string[] }> {
  const preparedAt = now();
  const timeout = options.verifierTimeoutSeconds === undefined ? {} : { verifierTimeoutSeconds: parseVerifierTimeoutSeconds(options.verifierTimeoutSeconds) };
  if (!options.freeze && !options.fromCommit) {
    throw new Error('bench add needs an importer: --freeze (current directory) or --from-commit <sha> (git history).');
  }
  if (options.freeze && options.fromCommit) {
    throw new Error('Pass exactly one importer: --freeze OR --from-commit, not both.');
  }
  if (options.prompt !== undefined && options.promptFile !== undefined) {
    throw new Error('Pass exactly one prompt: --prompt OR --prompt-file, not both.');
  }
  if (options.decompose && !options.freeze) {
    throw new Error('--decompose works only with --freeze.');
  }
  if (options.decompose && options.oracle) {
    throw new Error('--decompose writes its own oracle — do not pass --oracle as well.');
  }
  const cwd = options.cwd ?? process.cwd();
  const benchDir = resolve(cwd, options.benchDir ?? '.');
  const benchJsonPath = join(benchDir, 'bench.json');
  if (!existsSync(benchJsonPath)) {
    throw new Error(`Not a bench directory (missing bench.json): ${benchDir} — run \`skillfit bench init\` first.`);
  }
  const originalManifest = readFileSync(benchJsonPath, 'utf8');
  const benchJson = JSON.parse(originalManifest) as {
    tasks?: Array<{ id?: unknown }>;
  } & Record<string, unknown>;
  const tasks = Array.isArray(benchJson.tasks) ? benchJson.tasks : [];
  if (!BENCH_SCHEMA_VERSIONS.includes(benchJson.schemaVersion as 1 | 2) || !Array.isArray(benchJson.tasks)) throw new Error('Invalid bench.json schema or task list; fix the bench before adding a task.');
  for (const [index, task] of tasks.entries()) validateBenchTask(benchDir, task, index, benchJson.schemaVersion as number);
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error('Duplicate task IDs in bench.json; fix the bench before adding a task.');

  if (benchJson.schemaVersion === 1 && options.claims !== undefined) throw new Error('--claim requires explicit bench schema 2; no automatic upgrade.');
  const claims = benchJson.schemaVersion === 2 ? parseBenchClaims(options.claims) : undefined;
  if (claims?.includes('activation') && typeof options.shouldTrigger !== 'boolean') throw new Error('activation claims require shouldTrigger.');
  const captured = options.fromCommit
    ? prepareFromCommit(options, cwd, preparedAt)
    : prepareFreeze(options, cwd, preparedAt);
  const originalSource = sha256Text(JSON.stringify(captured));
  const taskId = options.task ?? captured.defaultTaskId;
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error(`Invalid --task id "${taskId}" (must match ${TASK_ID_PATTERN}).`);
  }
  if (tasks.some((task) => task?.id === taskId)) {
    throw new Error(`Task "${taskId}" already exists in ${benchJsonPath}.`);
  }

  const draft = options.decompose ? new BenchDraftSession(options, taskId, benchDir, cwd, captured.fixtureFiles,
    buildDecomposePrompt(captured.promptText, captured.fixtureFiles.map(file => file.rel), captured.verifierKind)) : undefined;

  const generated: Record<string, string> = {
    [`prompts/${taskId}.md`]: `${captured.promptText.trimEnd()}\n`,
    [`prompts/${taskId}.trigger.md`]: `${captured.promptText.trimEnd()}\n\nThe repository is in your current working directory.\n`,
    [`verifiers/${taskId}.mjs`]: captured.verifierSource,
    [`ground-truth/${taskId}.md`]: captured.groundTruth,
  };
  if (captured.oracleSource || options.decompose) {
    generated[`ground-truth/oracle-${taskId}.mjs`] = captured.oracleSource ?? '';
  }
  const taskEntry = {
    ...(claims ? { claims } : {}),
    id: taskId,
    fixture: `fixtures/${taskId}`,
    prompt: `prompts/${taskId}.md`,
    promptTrigger: `prompts/${taskId}.trigger.md`,
    verifier: `node verifiers/${taskId}.mjs`,
    verifierKind: captured.verifierKind,
    ...timeout,
    rubric: `ground-truth/${taskId}.md`,
    ...(captured.oracleSource || options.decompose ? { oracle: `node ground-truth/oracle-${taskId}.mjs` } : {}),
    ...(options.oracle ? { oracle: options.oracle } : {}),
    ...(options.shouldTrigger !== undefined ? { shouldTrigger: options.shouldTrigger } : {}),
  };

  const targets = [...captured.fixtureFiles.map(file => join(benchDir, 'fixtures', taskId, file.rel)),
    ...Object.keys(generated).map(rel => join(benchDir, rel)), benchJsonPath];
  assertBenchWrites(benchDir, targets);
  if (sha256File(benchJsonPath) !== sha256Text(originalManifest)) throw new Error('Bench manifest changed while preparing the task; nothing was written.');
  const writeState = () => targets.flatMap(target => [target, target + BACKUP_SUFFIX]).map(path => existsSync(path) ? sha256File(path) : null);
  const expectedWrites = JSON.stringify(writeState());
  const assertOutputsUnchanged = () => {
    assertBenchWrites(benchDir, targets);
    if (JSON.stringify(writeState()) !== expectedWrites) throw new Error('Bench outputs changed while preparing the task; nothing was written. Review a fresh plan.');
    const currentSource = options.fromCommit ? prepareFromCommit(options, cwd, preparedAt) : prepareFreeze(options, cwd, preparedAt);
    if (sha256Text(JSON.stringify(currentSource)) !== originalSource) throw new Error('Bench source changed while preparing the task; nothing was written. Review a fresh plan.');
  };
  const before: string[] = [], preview: string[] = [];
  if (claims) before.push(`Claims: ${claims.join(', ')} (schema 2 design support; not proof of validity or efficacy).`);
  if (draft) {
    before.push(`Draft plan: 1 call; ceiling ${draft.plan.maxCalls}; executor deadline ${draft.plan.executorTimeoutSeconds}s; no automatic retry.`);
    before.push(`Draft records: ${draft.dir}`);
    before.push(`Spending limits: ${draft.plan.spendingBudget ? JSON.stringify(draft.plan.spendingBudget) : 'not set; token/cache usage may remain unknown'}. Authentication: unknown offline.`);
  }
  if (options.verifierCmd) {
    // The string is not used once and discarded: it is written into a generated .mjs and re-executed
    // with a shell on every later `bench check` and `eval`. Disclose it before writing, in both the
    // dry-run and the real path, because the scripted `--yes` case is the one where nobody is
    // reading a prompt.
    before.push(
      `Note: --verifier-cmd ${JSON.stringify(options.verifierCmd)} is written into verifiers/${taskId}.mjs and re-executed with a shell on every later \`bench check\` and \`eval\` — it outlives this command.`,
    );
  }

  preview.push(`bench add plan (dry run) — task "${taskId}" into ${benchDir}:`);
  preview.push(`  + fixtures/${taskId}/ (${captured.planFixtureLine})`);
  for (const rel of Object.keys(generated)) preview.push(`  + ${rel}`);
  if (options.decompose) {
    preview.push('  ~ draft verifier.mjs + oracle.mjs with an agent, validated by the NOP + oracle gates (skipped in dry run)');
  }
  preview.push('  ~ bench.json (register task)');
  preview.push('Dry run — nothing was written. Re-run with --yes to apply.');
  const writes: Array<{ target: string; content: Buffer | string }> = [];
  for (const file of captured.fixtureFiles) {
    if (file.rel.split(/[\\/]/).includes('..') || isAbsolute(file.rel)) {
      throw new Error(`Fixture path escapes the task directory: ${file.rel}`);
    }
    writes.push({ target: join(benchDir, 'fixtures', taskId, file.rel), content: file.content });
  }
  for (const [rel, content] of Object.entries(generated)) {
    writes.push({ target: join(benchDir, rel), content });
  }
  benchJson.tasks = [...tasks, taskEntry];
  writes.push({ target: benchJsonPath, content: `${JSON.stringify(benchJson, null, 2)}\n` });
  const result = {
    dir: benchDir,
    taskId,
    files: [
      ...captured.fixtureFiles.map((file) => `fixtures/${taskId}/${file.rel}`),
      ...Object.keys(generated),
      'bench.json',
    ],
  };
  let drafted = !draft;
  return prepared({ operation: 'add', dir: benchDir, writes, sourceSha256: originalSource,
    targetSha256: sha256Text(expectedWrites), confirmation: `${draft ? 'Authorize 1 drafting call, retain its costs, then ' : ''}Add ${captured.fixtureFiles.length} fixture file(s) + ${Object.keys(generated).length} generated file(s) into ${benchDir}? [y/N] `, draft: !!draft, result,
    assertCurrent: assertOutputsUnchanged, lines: { before, preview, after: [
      `Task "${taskId}" added to ${benchDir} (${captured.fixtureFiles.length} fixture file(s), verifier: ${captured.verifierKind}).`,
      'Next:', `  skillfit bench check ${benchDir}`, `  skillfit eval <skill-path> --bench ${benchDir} --agent <id> --trials 5`] } }, {
    draft: draft ? async log => {
      try {
        const output = await draftVerifierWithOracle(draft, log);
        generated[`verifiers/${taskId}.mjs`] = output.verifierSource;
        generated[`ground-truth/oracle-${taskId}.mjs`] = output.oracleSource;
        for (const write of writes) {
          const rel = relative(benchDir, write.target).split('\\').join('/');
          if (rel in generated) write.content = generated[rel]!;
        }
        drafted = true;
      } catch (error) { draft.finish(error); throw error; }
    } : undefined,
    apply: () => {
      let failure: unknown;
      try {
        if (!drafted) throw new Error('Explicit drafting must complete before applying this change.');
        throwIfEvaluationInterrupted(); assertOutputsUnchanged(); applyBenchWrites(benchDir, writes); return result;
      } catch (error) { failure = error; throw error; }
      finally { draft?.finish(failure); }
    },
  });
}

function prepareFreeze(options: BenchAddOptions, cwd: string, preparedAt: Date): PreparedAdd {
  const promptText =
    options.prompt ??
    (options.promptFile ? readFileSync(resolve(cwd, options.promptFile), 'utf8') : undefined);
  if (!promptText || promptText.trim() === '') {
    throw new Error('bench add --freeze needs a task prompt: --prompt <text> or --prompt-file <path>.');
  }
  if (options.decompose) {
    if (options.verifierCmd || options.expect !== undefined) {
      throw new Error('--decompose drafts the verifier for you — do not pass --verifier-cmd or --expect.');
    }
  } else {
    if (options.verifierCmd && options.expect !== undefined) {
      throw new Error('Pass exactly one verifier: --verifier-cmd OR --expect, not both.');
    }
    if (!options.verifierCmd && options.expect === undefined) {
      throw new Error('bench add --freeze needs a verifier: --verifier-cmd <cmd> or --expect <string>.');
    }
  }

  const sourceDir = resolve(cwd, options.sourceDir ?? '.');
  if (!existsSync(sourceDir)) {
    throw new Error(`--source-dir does not exist: ${sourceDir}`);
  }
  const captured = freezeSourceFiles(sourceDir, resolve(cwd, options.benchDir ?? '.'), options.include);
  if (captured.length === 0) {
    throw new Error(`No capturable files in ${sourceDir} (empty git index or directory).`);
  }

  return {
    defaultTaskId: 'frozen-task',
    promptText: promptText.trimEnd(),
    verifierSource: options.decompose
      ? ''
      : options.verifierCmd
        ? verifierForCmd(options.verifierCmd)
        : verifierForExpect(options.expect ?? ''),
    verifierKind: options.decompose
      ? (options.verifierKind ?? 'output')
      : options.verifierCmd
        ? 'command'
        : 'output',
    fixtureFiles: captured,
    groundTruth: `# Ground truth — frozen task

Frozen from a real failure on ${preparedAt.toISOString().slice(0, 10)}.

- Source directory: \`${sourceDir}\`
- Verifier: ${options.decompose ? 'drafted by an agent (--decompose), gated by the NOP + oracle checks' : options.verifierCmd ? `\`${options.verifierCmd}\` (command, run in the task run directory)` : `agent output contains ${JSON.stringify(options.expect)}`}

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
  // `core.quotePath=false` is what stops git from quoting paths. Without it a non-ASCII path
  // comes back octal-escaped and wrapped in quotes — `"caf\303\251-notes.txt"` — and the later
  // `git show` then fails on a path that does not exist. `-z` on ls-tree alone does not help.
  const result = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
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

function prepareFromCommit(options: BenchAddOptions, cwd: string, preparedAt: Date): PreparedAdd {
  const issuePrompt = options.prompt ?? (options.promptFile !== undefined
    ? readFileSync(resolve(cwd, options.promptFile), 'utf8') : undefined);
  if (issuePrompt !== undefined && issuePrompt.trim() === '') {
    throw new Error('The supplied task prompt must not be empty.');
  }
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

  // `-z` gives NUL-separated records, so a path containing a newline or a tab still parses.
  let tree = gitMust(repo, ['ls-tree', '-r', '-z', '--format=%(objectsize) %(path)', parent])
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf(' ');
      const rawSize = separator === -1 ? '' : record.slice(0, separator);
      const path = separator === -1 ? record : record.slice(separator + 1);
      const size = /^\d+$/.test(rawSize) ? Number(rawSize) : Number.NaN;
      if (!Number.isFinite(size)) {
        // ls-tree reports `-` for a gitlink. A non-numeric size used to poison the running total
        // with NaN, and `NaN > MINED_MAX_BYTES` is false — so the size guard silently stopped
        // guarding and a repository of any size would have been accepted.
        throw new Error(
          `Repo state at ${parentShort} has a gitlink (submodule) at "${path}" — --from-commit cannot mine submodules, because the fixture would need the submodule's own checkout. Vendor the files in, or narrow with --include.`,
        );
      }
      return { size, path };
    });
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
    promptText: issuePrompt ?? `# Task: implement the following change request

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

Mined from git history on ${preparedAt.toISOString().slice(0, 10)}.

- Repository: \`${repo}\`
- Fix commit: \`${sha}\` — ${subject}
- Parent (fixture state): \`${parent}\`
- Task prompt: ${issuePrompt === undefined ? 'generated from fix commit subject/body; review for solution hints before efficacy evaluation' : 'user-supplied issue request; fix commit subject/body was not injected'}.
- Verifier: the fix commit's own tests (${tests.map((test) => `\`${test.rel}\``).join(', ')}), run via \`${verifierCmd}\` — they fail on the parent state and pass once the fix is implemented (FAIL_TO_PASS).
- The fix itself: see \`git show ${sha}\` in the source repository.

TODO: summarize the correct fix here so future bench edits stay honest.
`,
    planFixtureLine: `${fixtureFiles.length} file(s) at parent ${parentShort} from ${repo} (+${tests.length} hidden test file(s) embedded in the verifier)`,
  };
}

const EDITABLE = ['fixture', 'prompt', 'promptTrigger', 'verifier', 'verifierKind', 'verifierTimeoutSeconds', 'oracle', 'rubric', 'shouldTrigger', 'claims'] as const;
const OPTIONAL = ['promptTrigger', 'verifierTimeoutSeconds', 'oracle', 'rubric', 'shouldTrigger'] as const;

export function inspectBench(dir: string, taskId?: string) {
  const bench = loadBench(resolveBenchDir(dir));
  const tasks = taskId === undefined ? bench.tasks : bench.tasks.filter(task => task.id === taskId);
  if (!tasks.length) throw new Error(`Unknown task: ${taskId}`);
  return { schemaVersion: 1, benchSchemaVersion: bench.schemaVersion, kind: taskId === undefined ? 'skillfit.bench-list' : 'skillfit.bench-task',
    dir: bench.dir, name: bench.name, sha256: bench.contentSha256,
    tasks: tasks.map(task => ({ ...task, claims: task.claims ?? null, claimsStatus: bench.schemaVersion === 1 ? 'legacy-unrecorded' : 'declared', verifierKind: task.verifierKind ?? 'output', shouldTrigger: task.shouldTrigger ?? null })) };
}

function prepareManagement(options: BenchManageOptions) {
  const dir = resolve(options.dir), path = join(dir, 'bench.json');
  if (lstatSync(path).isSymbolicLink()) throw new Error('Refusing to edit a symlinked bench.json.');
  const before = readFileSync(path, 'utf8');
  const bench = loadBench(dir);
  const manifest = JSON.parse(before) as { tasks: Record<string, unknown>[] };
  const index = manifest.tasks.findIndex(task => task.id === options.taskId);
  if (index < 0) throw new Error(`Unknown task: ${options.taskId}`);
  const original = { ...manifest.tasks[index]! };
  if (options.action === 'remove') {
    if (options.set?.length || options.unset?.length) throw new Error('Removal cannot be combined with --set or --unset.');
    if (manifest.tasks.length === 1) throw new Error('Cannot remove the last task. Add a real task before removing the teaching case.');
    manifest.tasks.splice(index, 1);
  } else {
    if (!options.set?.length && !options.unset?.length) throw new Error('Editing requires --set field=value or --unset field.');
    const next = { ...original }, touched = new Set<string>();
    for (const assignment of options.set ?? []) {
      const at = assignment.indexOf('=');
      if (at < 1) throw new Error(`Invalid --set: ${assignment}; expected field=value.`);
      const field = assignment.slice(0, at), value = assignment.slice(at + 1);
      if (!(EDITABLE as readonly string[]).includes(field)) throw new Error(`Field is not editable: ${field}`);
      if (touched.has(field)) throw new Error(`Repeated edit field: ${field}`);
      touched.add(field);
      if (field === 'claims') {
        if (bench.schemaVersion !== 2) throw new Error('claims editing requires explicit schema 2; no automatic upgrade.');
        try { next[field] = JSON.parse(value); } catch { throw new Error('claims must be a JSON array.'); }
      } else if (field === 'shouldTrigger') {
        if (value !== 'true' && value !== 'false') throw new Error('shouldTrigger must be true or false.');
        next[field] = value === 'true';
      } else next[field] = field === 'verifierTimeoutSeconds' ? Number(value) : value;
    }
    for (const field of options.unset ?? []) {
      if (!(OPTIONAL as readonly string[]).includes(field)) throw new Error(`Field cannot be unset: ${field}`);
      if (touched.has(field)) throw new Error(`Repeated edit field: ${field}`);
      touched.add(field); delete next[field];
    }
    validateBenchTask(dir, next, index, bench.schemaVersion);
    manifest.tasks[index] = next;
  }
  const after = options.action === 'remove' ? null : manifest.tasks[index]!;
  const changed = JSON.stringify(original) !== JSON.stringify(after);
  const result = { schemaVersion: 1, kind: 'skillfit.bench-change', action: options.action,
    dir, taskId: options.taskId, status: changed ? 'planned' : 'unchanged', before: original, after, filesPreserved: true,
    backup: path + BACKUP_SUFFIX, previousSha256: bench.contentSha256, sha256: bench.contentSha256 };
  const writes = [{ target: path, content: JSON.stringify(manifest, null, 2) + '\n' }];
  const assertCurrent = () => {
    if (readFileSync(path, 'utf8') !== before) throw new Error('bench.json changed after the plan; nothing written.');
    assertBenchWrites(dir, [path]);
    if (loadBench(dir).contentSha256 !== bench.contentSha256) throw new Error('Bench source changed after the plan; nothing written.');
  };
  return prepared({ operation: options.action, dir, writes, targetSha256: sha256Text(before), draft: false,
    result, assertCurrent, confirmation: '', lines: { before: [], preview: [], after: [] } }, {
      apply: () => {
        assertCurrent();
        if (changed) { applyBenchWrites(dir, writes); result.sha256 = loadBench(dir).contentSha256; result.status = 'applied'; }
        return result;
      },
  });
}

export function prepareBenchChange(request: { operation: 'init'; options: BenchInitOptions }, dependencies?: BenchAuthoringDependencies): ReturnType<typeof prepareInit>;
export function prepareBenchChange(request: { operation: 'add'; options: BenchAddOptions }, dependencies?: BenchAuthoringDependencies): ReturnType<typeof prepareAdd>;
export function prepareBenchChange(request: { operation: 'edit' | 'remove'; options: BenchManageOptions }, dependencies?: BenchAuthoringDependencies): ReturnType<typeof prepareManagement>;
export function prepareBenchChange(request: { operation: 'init'; options: BenchInitOptions } | { operation: 'add'; options: BenchAddOptions } |
  { operation: 'edit' | 'remove'; options: BenchManageOptions }, dependencies: BenchAuthoringDependencies = {}): PreparedBenchChange {
  if (request.operation === 'init') return prepareInit({ ...request.options }, dependencies);
  if (request.operation === 'add') return prepareAdd({ ...request.options,
    include: request.options.include?.slice(), claims: request.options.claims?.slice() }, dependencies.now ?? (() => new Date()));
  return prepareManagement({ ...request.options, action: request.operation,
    set: request.options.set?.slice(), unset: request.options.unset?.slice() });
}
