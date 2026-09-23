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
import { verdictFromOutput } from '../harness/verifier-summary.js';
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
process.exit(passed ? 0 : 1);
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

function copyFixture(fixtureDir: string, dest: string): void {
  for (const rel of listFilesRecursive(fixtureDir)) {
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(fixtureDir, rel)));
  }
}

type OracleGateOutcome =
  | { kind: 'oracle-failed'; exitCode: number | null }
  | { kind: 'verifier-failed' }
  | { kind: 'low-score'; score: number }
  | { kind: 'pass'; score: number | null };

async function runOracleGate(
  benchDir: string,
  fixtureDir: string,
  oracle: string,
  verifier: string,
): Promise<OracleGateOutcome> {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-check-'));
  try {
    copyFixture(fixtureDir, dir);
    const oracleRun = await runVerifier(benchDir, oracle, dir);
    if (oracleRun.exitCode !== 0) {
      return { kind: 'oracle-failed', exitCode: oracleRun.exitCode };
    }
    const graded = await runVerifier(benchDir, verifier, dir);
    if (graded.exitCode !== 0) {
      return { kind: 'verifier-failed' };
    }
    const score = verdictFromOutput(graded.output)?.score ?? null;
    if (score !== null && score < 1) {
      return { kind: 'low-score', score };
    }
    return { kind: 'pass', score };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function probeOracle(
  benchDir: string,
  fixture: string,
  oracle: string,
  verifier: string,
): Promise<{ status: Check['status']; message: string }> {
  const gate = await runOracleGate(benchDir, join(benchDir, fixture), oracle, verifier);
  switch (gate.kind) {
    case 'oracle-failed':
      return {
        status: 'FAIL',
        message: `oracle command itself failed (exit ${gate.exitCode ?? 'null'}) — the reference solution cannot run`,
      };
    case 'verifier-failed':
      return {
        status: 'FAIL',
        message: 'oracle solution does not pass the verifier — the task is unwinnable or the oracle is stale',
      };
    case 'low-score':
      return {
        status: 'FAIL',
        message: `oracle passes the verifier but scores ${gate.score.toFixed(2)} on its checks — the checks are stricter than the exit code`,
      };
    case 'pass':
      return {
        status: 'PASS',
        message: `oracle solution passes the verifier${gate.score !== null ? ' with full checks' : ''}`,
      };
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
        copyFixture(join(bench.dir, task.fixture), fixtureCopy);
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

    if (task.oracle) {
      const oracleResult = await probeOracle(bench.dir, task.fixture, task.oracle, task.verifier);
      push(oracleResult.status, `${task.id}: ${oracleResult.message}`);
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
  options: BenchAddOptions,
  prepared: PreparedAdd,
  log: (msg: string) => void,
): Promise<{ verifierSource: string; oracleSource: string }> {
  const executor =
    options.executor ?? (options.agent ? CliExecutor.forAgent(options.agent) : undefined);
  if (!executor) {
    throw new Error('bench add --decompose needs an agent to draft with: --agent <id>.');
  }
  const staging = mkdtempSync(join(tmpdir(), 'skillfit-decompose-'));
  try {
    const fixtureDir = join(staging, 'fixture');
    for (const file of prepared.fixtureFiles) {
      const target = join(fixtureDir, file.rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
    log(`Drafting verifier + oracle with ${executor.describe().kind} (${executor.describe().model})…`);
    await executor.run(
      buildDecomposePrompt(prepared.promptText, prepared.fixtureFiles.map((f) => f.rel), prepared.verifierKind),
      staging,
    );
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
      const nop = await runVerifier(staging, 'node verifier.mjs', nopDir);
      if (nop.exitCode === 0) {
        throw new Error(
          'draft rejected: the verifier passes the untouched fixture — the task would start solved (NOP gate)',
        );
      }
    } finally {
      rmSync(nopDir, { recursive: true, force: true });
    }

    const solvedGate = await runOracleGate(staging, fixtureDir, 'node oracle.mjs', 'node verifier.mjs');
    if (solvedGate.kind === 'oracle-failed') {
      throw new Error('draft rejected: the oracle command failed on a fresh fixture copy');
    }
    if (solvedGate.kind === 'verifier-failed') {
      throw new Error(
        'draft rejected: the verifier fails even after the oracle solved the task (oracle gate)',
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
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
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

  if (options.decompose && !options.dryRun) {
    const drafted = await draftVerifierWithOracle(options, prepared, log);
    prepared.verifierSource = drafted.verifierSource;
    prepared.oracleSource = drafted.oracleSource;
  }

  const generated: Record<string, string> = {
    [`prompts/${taskId}.md`]: `${prepared.promptText.trimEnd()}\n`,
    [`prompts/${taskId}.trigger.md`]: `${prepared.promptText.trimEnd()}\n\nThe repository is in your current working directory.\n`,
    [`verifiers/${taskId}.mjs`]: prepared.verifierSource,
    [`ground-truth/${taskId}.md`]: prepared.groundTruth,
  };
  if (prepared.oracleSource) {
    generated[`ground-truth/oracle-${taskId}.mjs`] = prepared.oracleSource;
  }
  const taskEntry = {
    id: taskId,
    fixture: `fixtures/${taskId}`,
    prompt: `prompts/${taskId}.md`,
    promptTrigger: `prompts/${taskId}.trigger.md`,
    verifier: `node verifiers/${taskId}.mjs`,
    verifierKind: prepared.verifierKind,
    rubric: `ground-truth/${taskId}.md`,
    ...(prepared.oracleSource ? { oracle: `node ground-truth/oracle-${taskId}.mjs` } : {}),
    ...(options.oracle ? { oracle: options.oracle } : {}),
    ...(options.shouldTrigger !== undefined ? { shouldTrigger: options.shouldTrigger } : {}),
  };

  if (options.dryRun) {
    log(`bench add plan (dry run) — task "${taskId}" into ${benchDir}:`);
    log(`  + fixtures/${taskId}/ (${prepared.planFixtureLine})`);
    for (const rel of Object.keys(generated)) log(`  + ${rel}`);
    if (options.decompose) {
      log('  ~ draft verifier.mjs + oracle.mjs with an agent, validated by the NOP + oracle gates (skipped in dry run)');
    }
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
  const captured = captureSourceFiles(sourceDir);
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
    fixtureFiles: captured.map((rel) => ({ rel, content: readFileSync(join(sourceDir, rel)) })),
    groundTruth: `# Ground truth — frozen task

Frozen from a real failure on ${new Date().toISOString().slice(0, 10)}.

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
