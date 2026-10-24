import { parseBenchClaims, measurementScope, measurementScopeText, type MeasurementScope } from '../harness/measurement-scope.js';
import { spawnSync } from 'node:child_process';
import { inspectBenchIntegrity, copyFixture, runOracleGate } from '../harness/bench-check.js';
import { CasePreflightFailed } from './eval-preflight-error.js';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { getAgent } from '../agents.js';
import { BENCH_SCHEMA_VERSIONS, loadBench, selectBenchTasks, validateBenchTask } from '../harness/bench.js';
import { resolveBenchDir } from '../harness/bench-location.js';
import { listFilesRecursive, sha256File, sha256Text } from '../harness/hash.js';
import { runVerifier, verifierFailure } from '../harness/verifier.js';
import { MOCK_MARKER_FILE } from '../harness/constants.js';
import type { BenchTask, Executor } from '../harness/types.js';
import { confirm as confirmPrompt } from './confirm.js';
import { commandTemplateFiles } from './bench-command-template.js';
import { benchDiagnostic, benchCheckEvidence, type BenchCheckCode, type BenchCheckEvidence,
  type BenchCheckReport, type BenchDiagnostic } from '../harness/bench-diagnostics.js';
export type { BenchCheckReport } from '../harness/bench-diagnostics.js';
import { BACKUP_SUFFIX } from './install.js';
import { withEvaluationInterrupts, throwIfEvaluationInterrupted } from '../harness/interruption.js';
import type { Check } from './doctor.js';
import { assertAgentEnvironment, renderAgentEnvironment } from '../harness/agent-preflight.js';
import { calibrationCasePreflight, executeCalibration, prepareCalibration, type BenchCheckCalibrateOptions } from '../harness/calibration-service.js';
import { freezeSourceFiles } from './bench-source.js';
import { BenchDraftSession, type BenchDraftOptions } from './bench-draft.js';
import { parseVerifierTimeoutSeconds } from '../harness/verifier-timeout.js';
export { captureSourceFiles } from './bench-source.js';
export { prepareBenchCalibration } from '../harness/calibration-service.js';
export type { BenchCheckCalibrateOptions, BenchCalibrationPreview } from '../harness/calibration-service.js';

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

export interface BenchCheckOptions {
  dir?: string;
  /** Internal eval scope; preserves the full bench fingerprint. */
  taskIds?: string[];
  log?: (msg: string) => void;
  calibrate?: BenchCheckCalibrateOptions | false;
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
   paired costs, coverage and regression checks — see docs/metrics.md).
`,
  };
}

export async function runBenchInit(
  options: BenchInitOptions,
): Promise<{ dir: string; created: string[] } | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const kind = options.kind ?? 'output';
  const schemaVersion = options.schemaVersion ?? 1;
  if (!BENCH_SCHEMA_VERSIONS.includes(schemaVersion)) throw new Error('bench init schemaVersion must be 1 or 2.');
  if (kind !== 'output' && kind !== 'command') {
    throw new Error(`Unknown bench kind: ${kind} (expected "output" or "command")`);
  }
  const dir = resolve(options.cwd ?? process.cwd(), options.dir ?? 'skillfit-bench');
  const files = kind === 'command' ? commandTemplateFiles(basename(dir)) : templateFiles(basename(dir));
  if (schemaVersion === 2) {
    const manifest = JSON.parse(files['bench.json']!); manifest.schemaVersion = 2;
    for (const task of manifest.tasks) task.claims = ['quality'];
    files['bench.json'] = JSON.stringify(manifest, null, 2) + '\n';
  }
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
    const confirm = options.confirm ?? confirmPrompt;
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
  log(`  skillfit eval <skill-path> --bench ${dir} --agent <id>${kind === 'command' ? ' --input workspace' : ''} --trials 1 --max-calls 2 --dry-run`);
  log('This is a teaching case. Replace it with your own task before measuring Skill benefit.');
  return { dir, created };
}

function renderCheck({ status, message }: Check): string {
  return `[${status}] ${message}`;
}

export async function runBenchCheck(options: BenchCheckOptions): Promise<BenchCheckReport> {
  return withEvaluationInterrupts(() => runBenchCheckWithinInterrupts(options));
}

export async function runBenchCalibration(options: BenchCheckOptions & { calibrate: BenchCheckCalibrateOptions }): Promise<BenchCheckReport> {
  return withEvaluationInterrupts(() => runBenchCheckWithinInterrupts(options, true));
}

async function runBenchCheckWithinInterrupts(options: BenchCheckOptions, strictCalibration = false): Promise<BenchCheckReport> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  let dir = resolve(options.dir ?? '.');
  const checks: BenchDiagnostic[] = [];
  let identity: BenchCheckReport['bench'] = null;
  let scope: MeasurementScope | undefined;
  const push = (code: BenchCheckCode, status: Check['status'], message: string, task?: BenchTask, evidence?: BenchCheckEvidence): void => {
    throwIfEvaluationInterrupted();
    checks.push(benchDiagnostic(code, status, message, task, evidence));
    log(renderCheck({ status, message }));
  };

  let bench;
  try {
    dir = resolveBenchDir(options.dir ?? '.');
    bench = selectBenchTasks(loadBench(dir), options.taskIds ?? (options.calibrate ? options.calibrate.taskIds : undefined));
  } catch (error) {
    push('BENCH_LOAD', 'FAIL', `bench does not load: ${(error as Error).message}`);
    return finish(dir, checks, log, false, identity, scope);
  }
  scope = measurementScope(bench, null); log(measurementScopeText(scope));
  identity = { name: bench.name, sha256: bench.contentSha256, taskCount: bench.tasks.length };
  push('BENCH_LOAD', 'PASS', `bench.json valid (${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…)`);
  const calibration = options.calibrate ? prepareCalibration({ dir, taskIds: options.taskIds, calibrate: options.calibrate }) : null;
  if (calibration) {
    log(renderAgentEnvironment(calibration.plan.agentPreflight));
    if (options.calibrate && options.calibrate.dryRun) {
      push('CALIBRATION', 'INFO', `calibration executor: ${calibration.plan.executor?.detail ?? calibration.plan.executor?.model ?? 'unavailable'}`);
      push('CALIBRATION', 'INFO', `calibration plan: ${bench.tasks.length} task(s) × ${calibration.plan.trials} baseline run(s), input ${calibration.plan.inputMode}; ${calibration.plan.plannedCalls} calls, ceiling ${calibration.plan.maxCalls}; deadline ${calibration.plan.executorTimeoutSeconds}s; no verifier, oracle or agent started and no run directory created`);
      push('CALIBRATION', 'INFO', `Plan SHA-256: ${calibration.plan.planSha256}; fresh output ${calibration.plan.outputDir}`);
      return finish(dir, checks, log, true, identity, scope);
    }
    try { assertAgentEnvironment(calibration.plan.agentPreflight); }
    catch (error) {
      if (strictCalibration) throw error;
      push('CALIBRATION', 'FAIL', (error as Error).message);
      return finish(dir, checks, log, true, identity, scope);
    }
  }
  const offlineStarted = performance.now();

  await inspectBenchIntegrity(bench, push);

  if (calibration) {
    const offlineReport = { dir, bench: identity, checks, failures: checks.filter(check => check.status === 'FAIL').length,
      warnings: checks.filter(check => check.status === 'WARN').length };
    const casePreflight = calibrationCasePreflight(bench, offlineReport, Math.round(performance.now() - offlineStarted));
    log(`Case preflight: ${casePreflight.status}; ${casePreflight.summary.failures} failure(s), ${casePreflight.summary.warnings} warning(s), ${casePreflight.summary.unknown} unknown(s); 0 model calls`);
    for (const check of casePreflight.checks.filter(check => check.status === 'UNKNOWN')) log(`[UNKNOWN] ${check.code}: ${check.message}`);
    if (casePreflight.status === 'blocked') {
      if (strictCalibration) {
        throw new CasePreflightFailed(casePreflight);
      }
      push('CALIBRATION', 'FAIL', 'Offline case preflight blocked calibration; no agent calls or run directory were created. Fix every hard failure before a fresh plan.');
      for (const check of casePreflight.checks.filter(check => check.code === 'INPUT_CHANGED')) push('CALIBRATION', 'FAIL', check.message);
    } else {
      await executeCalibration(calibration, casePreflight, (status, message) => push('CALIBRATION', status, message), log);
    }
  }

  return finish(dir, checks, log, options.calibrate !== false && options.calibrate !== undefined, identity, scope);
}

function finish(
  dir: string,
  checks: BenchDiagnostic[],
  log: (msg: string) => void,
  calibrated = false,
  bench: BenchCheckReport['bench'] = null,
  scope?: MeasurementScope,
): BenchCheckReport {
  const failures = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;
  const passes = checks.filter((c) => c.status === 'PASS').length;
  log('');
  log(`Summary: ${passes} passed, ${warnings} warning(s), ${failures} failure(s)`);
  if (!calibrated) {
    log('Next: calibrate difficulty against a real agent —');
    log(`  skillfit eval <skill-path> --bench ${dir} --agent <id> --trials 5`);
    log('  quality-improvement target: baseline pass rate 30–70%; --calibrate warns outside 10–90% (docs/metrics.md L0).');
    log('  efficiency needs paired costs, variance, coverage and regression checks; activation needs positive/negative labels and observed detection coverage.');
  }
  return { dir, bench, ...(scope ? { measurementScope: scope } : {}), checks, failures, warnings };
}

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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

export async function runBenchAdd(
  options: BenchAddOptions,
): Promise<{ dir: string; taskId: string; files: string[] } | null> {
  return options.dryRun ? runBenchAddWithinInterrupts(options) : withEvaluationInterrupts(() => runBenchAddWithinInterrupts(options));
}

async function runBenchAddWithinInterrupts(options: BenchAddOptions): Promise<{ dir: string; taskId: string; files: string[] } | null> {
  const log = options.log ?? ((msg: string) => console.log(msg));
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

  const draft = options.decompose ? new BenchDraftSession(options, taskId, benchDir, cwd, prepared.fixtureFiles,
    buildDecomposePrompt(prepared.promptText, prepared.fixtureFiles.map(file => file.rel), prepared.verifierKind)) : undefined;

  const generated: Record<string, string> = {
    [`prompts/${taskId}.md`]: `${prepared.promptText.trimEnd()}\n`,
    [`prompts/${taskId}.trigger.md`]: `${prepared.promptText.trimEnd()}\n\nThe repository is in your current working directory.\n`,
    [`verifiers/${taskId}.mjs`]: prepared.verifierSource,
    [`ground-truth/${taskId}.md`]: prepared.groundTruth,
  };
  if (prepared.oracleSource || options.decompose) {
    generated[`ground-truth/oracle-${taskId}.mjs`] = prepared.oracleSource ?? '';
  }
  const taskEntry = {
    ...(claims ? { claims } : {}),
    id: taskId,
    fixture: `fixtures/${taskId}`,
    prompt: `prompts/${taskId}.md`,
    promptTrigger: `prompts/${taskId}.trigger.md`,
    verifier: `node verifiers/${taskId}.mjs`,
    verifierKind: prepared.verifierKind,
    ...timeout,
    rubric: `ground-truth/${taskId}.md`,
    ...(prepared.oracleSource || options.decompose ? { oracle: `node ground-truth/oracle-${taskId}.mjs` } : {}),
    ...(options.oracle ? { oracle: options.oracle } : {}),
    ...(options.shouldTrigger !== undefined ? { shouldTrigger: options.shouldTrigger } : {}),
  };

  const targets = [...prepared.fixtureFiles.map(file => join(benchDir, 'fixtures', taskId, file.rel)),
    ...Object.keys(generated).map(rel => join(benchDir, rel)), benchJsonPath];
  assertBenchWrites(benchDir, targets);
  if (sha256File(benchJsonPath) !== sha256Text(originalManifest)) throw new Error('Bench manifest changed while preparing the task; nothing was written.');
  const writeState = () => targets.flatMap(target => [target, target + BACKUP_SUFFIX]).map(path => existsSync(path) ? sha256File(path) : null);
  const expectedWrites = JSON.stringify(writeState());
  const assertOutputsUnchanged = () => {
    assertBenchWrites(benchDir, targets);
    if (JSON.stringify(writeState()) !== expectedWrites) throw new Error('Bench outputs changed while preparing the task; nothing was written. Review a fresh plan.');
  };
  if (claims) log(`Claims: ${claims.join(', ')} (schema 2 design support; not proof of validity or efficacy).`);
  if (draft) {
    log(`Draft plan: 1 call; ceiling ${draft.plan.maxCalls}; executor deadline ${draft.plan.executorTimeoutSeconds}s; no automatic retry.`);
    log(`Draft records: ${draft.dir}`);
    log(`Spending limits: ${draft.plan.spendingBudget ? JSON.stringify(draft.plan.spendingBudget) : 'not set; token/cache usage may remain unknown'}. Authentication: unknown offline.`);
  }
  if (options.verifierCmd) {
    // The string is not used once and discarded: it is written into a generated .mjs and re-executed
    // with a shell on every later `bench check` and `eval`. Disclose it before writing, in both the
    // dry-run and the real path, because the scripted `--yes` case is the one where nobody is
    // reading a prompt.
    log(
      `Note: --verifier-cmd ${JSON.stringify(options.verifierCmd)} is written into verifiers/${taskId}.mjs and re-executed with a shell on every later \`bench check\` and \`eval\` — it outlives this command.`,
    );
  }

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
    const confirm = options.confirm ?? confirmPrompt;
    const ok = await confirm(
      `${draft ? 'Authorize 1 drafting call, retain its costs, then ' : ''}Add ${prepared.fixtureFiles.length} fixture file(s) + ${Object.keys(generated).length} generated file(s) into ${benchDir}? [y/N] `,
    );
    if (!ok) {
      log('Aborted — nothing was written.');
      return null;
    }
  }

  let failure: unknown;
  try {
    throwIfEvaluationInterrupted();
    assertOutputsUnchanged();
    if (draft) {
      const drafted = await draftVerifierWithOracle(draft, log);
      generated[`verifiers/${taskId}.mjs`] = drafted.verifierSource;
      generated[`ground-truth/oracle-${taskId}.mjs`] = drafted.oracleSource;
    }
    const writes: Array<{ target: string; content: Buffer | string }> = [];
    for (const file of prepared.fixtureFiles) {
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
    throwIfEvaluationInterrupted();
    assertOutputsUnchanged();
    applyBenchWrites(benchDir, writes);

    log(`Task "${taskId}" added to ${benchDir} (${prepared.fixtureFiles.length} fixture file(s), verifier: ${prepared.verifierKind}).`);
    log('Next:');
    log(`  skillfit bench check ${benchDir}`);
    log(`  skillfit eval <skill-path> --bench ${benchDir} --agent <id> --trials 5`);
    return {
      dir: benchDir,
      taskId,
      files: [
        ...prepared.fixtureFiles.map((file) => `fixtures/${taskId}/${file.rel}`),
        ...Object.keys(generated),
        'bench.json',
      ],
    };
  } catch (error) { failure = error; throw error; }
  finally { draft?.finish(failure); }
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

function prepareFromCommit(options: BenchAddOptions, cwd: string): PreparedAdd {
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

Mined from git history on ${new Date().toISOString().slice(0, 10)}.

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
