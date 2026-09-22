import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from './bench.js';
import { collectSkillBundle } from './bundle.js';
import { MockExecutor } from './executors/mock.js';
import { gitInit, runExperiment, type ExperimentPlan } from './runner.js';
import type { Executor, ExecutorResult } from './types.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');

function tmp(t: import('node:test').TestContext, prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function makeSkill(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-skill-');
  writeFileSync(join(dir, 'SKILL.md'), '# review discipline\ncheck boundaries and error codes\n');
  return dir;
}

function plan(overrides: Partial<ExperimentPlan> & { runsRoot: string }): ExperimentPlan {
  return {
    bench: loadBench(BUNDLED_CODE_REVIEW),
    skill: collectSkillBundle(makeSkillSync(overrides.runsRoot), 'review-skill'),
    executor: new MockExecutor(),
    trials: 3,
    runGroup: 'test-group',
    ...overrides,
  };
}

let skillCounter = 0;
function makeSkillSync(runsRoot: string): string {
  const dir = join(runsRoot, `skill-${process.pid}-${skillCounter++}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '# review discipline\ncheck boundaries and error codes\n');
  return dir;
}

test('runExperiment pairs baseline/treatment and records everything', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const skillDir = makeSkill(t);
  const manifest = await runExperiment({
    bench: loadBench(BUNDLED_CODE_REVIEW),
    skill: collectSkillBundle(skillDir, 'review-skill'),
    executor: new MockExecutor(),
    trials: 3,
    runsRoot,
    runGroup: 'test-group',
  });

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.tasks.length, 4);
  const task = manifest.tasks[0];
  assert.ok(task);
  assert.equal(task.id, 'review-r1');
  assert.deepEqual(
    { passes: task.conditions.baseline.passes, trials: task.conditions.baseline.trials },
    { passes: 0, trials: 3 },
  );
  assert.deepEqual(
    { passes: task.conditions.treatment.passes, trials: task.conditions.treatment.trials },
    { passes: 3, trials: 3 },
  );
  assert.deepEqual(task.outcomes.baseline, [false, false, false]);
  assert.deepEqual(task.outcomes.treatment, [true, true, true]);
  assert.equal(task.verdict, 'inconclusive');
  assert.match(task.verdictReason, /only 3 discordant pair/);
  assert.deepEqual(task.tokenDelta, { input: 2400, output: 240 });
  assert.equal(manifest.overall.verdict, 'effective');
  assert.deepEqual(manifest.overall.stats.discordant, { improved: 9, regressed: 0 });
  assert.equal(manifest.overall.stats.mcnemarP, 0.00390625);
  assert.equal(manifest.skill.bundleSha256.length, 64);
  assert.ok(manifest.warnings.some((w) => w.includes('synthetic')));

  const trialDir = join(runsRoot, 'test-group', 'review-r1', 'treatment', 'trial-1');
  assert.ok(existsSync(join(runsRoot, 'test-group', 'manifest.json')));
  assert.ok(existsSync(join(trialDir, '_prompt.txt')));
  assert.ok(existsSync(join(trialDir, '_output.md')));
  assert.ok(existsSync(join(trialDir, '_verifier.txt')));
  assert.ok(existsSync(join(trialDir, '_result.json')));
  assert.ok(existsSync(join(trialDir, '.git')), 'run directory is a git repository');

  const treatmentPrompt = readFileSync(join(trialDir, '_prompt.txt'), 'utf8');
  assert.match(treatmentPrompt, /<skill name="review-skill">/);
  assert.match(treatmentPrompt, /--- repository file: src\/order\.js ---/);
  assert.ok(!treatmentPrompt.includes('skillfit-mock'));
  const baselinePrompt = readFileSync(
    join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_prompt.txt'),
    'utf8',
  );
  assert.ok(!baselinePrompt.includes('<skill name='));

  const result = JSON.parse(readFileSync(join(trialDir, '_result.json'), 'utf8')) as {
    passed: boolean;
    gitInitialized: boolean;
    skillBundleSha256: string | null;
  };
  assert.equal(result.passed, true);
  assert.equal(result.gitInitialized, true);
  assert.equal(result.skillBundleSha256, manifest.skill.bundleSha256);

  const verifierLog = readFileSync(
    join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_verifier.txt'),
    'utf8',
  );
  assert.match(verifierLog, /"missed":\["discount-boundary","missing-tests"\]/);
  assert.match(verifierLog, /"decoys":\["c-style-loop"\]/);
});

test('runExperiment keeps executor errors as failed trials instead of crashing', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const failing: Executor = {
    describe: () => ({ kind: 'cli', model: 'broken' }),
    run: (): Promise<ExecutorResult> => Promise.reject(new Error('agent exploded')),
  };
  const manifest = await runExperiment({
    bench: loadBench(BUNDLED_CODE_REVIEW),
    skill: collectSkillBundle(makeSkill(t)),
    executor: failing,
    trials: 1,
    runsRoot,
    runGroup: 'test-group',
  });
  const task = manifest.tasks[0];
  assert.ok(task);
  assert.equal(task.conditions.baseline.passes, 0);
  assert.equal(task.conditions.treatment.passes, 0);
  assert.equal(manifest.overall.verdict, 'inconclusive');
  const errorFile = join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_executor-error.txt');
  assert.match(readFileSync(errorFile, 'utf8'), /agent exploded/);
});

test('runExperiment marks verdicts inconclusive when discordant pairs are too few', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const manifest = await runExperiment(plan({ runsRoot, trials: 1 }));
  const task = manifest.tasks[0];
  assert.ok(task);
  assert.equal(task.verdict, 'inconclusive');
  assert.match(task.verdictReason, /only 1 discordant pair/);
});

test('runExperiment warns when the baseline already passes (bench too easy)', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const benchDir = join(runsRoot, 'easy-bench');
  mkdirSync(join(benchDir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(benchDir, 'prompts'), { recursive: true });
  mkdirSync(join(benchDir, 'verifiers'), { recursive: true });
  writeFileSync(join(benchDir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(
    join(benchDir, 'fixtures', 't1', '.skillfit-mock.json'),
    JSON.stringify({ baseline: { output: 'ok' }, treatment: { output: 'ok' } }),
  );
  writeFileSync(join(benchDir, 'prompts', 't1.md'), 'do it\n');
  writeFileSync(join(benchDir, 'verifiers', 't1.mjs'), 'console.log("{\\"passed\\":true}");\n');
  writeFileSync(
    join(benchDir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      tasks: [{ id: 't1', fixture: 'fixtures/t1', prompt: 'prompts/t1.md', verifier: 'node verifiers/t1.mjs' }],
    }),
  );
  const manifest = await runExperiment({
    bench: loadBench(benchDir),
    skill: collectSkillBundle(makeSkill(t)),
    executor: new MockExecutor(),
    trials: 3,
    runsRoot,
    runGroup: 'test-group',
  });
  assert.equal(manifest.overall.verdict, 'inconclusive');
  assert.ok(manifest.warnings.some((w) => w.includes('"t1"') && w.includes('too easy')));
});

test('runExperiment refuses to reuse an existing run group', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const base = plan({ runsRoot });
  await runExperiment(base);
  await assert.rejects(() => runExperiment(base), /already exists/);
});

test('runExperiment validates the run group name', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  await assert.rejects(() => runExperiment(plan({ runsRoot, runGroup: '../evil' })), /Invalid run group/);
});

test('runExperiment validates trials', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  await assert.rejects(() => runExperiment(plan({ runsRoot, trials: 0 })), /trials must be/);
});

test('runExperiment aggregates blind judge scores per task', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const judge: Executor = {
    describe: () => ({ kind: 'api', model: 'judge-model' }),
    run: (): Promise<ExecutorResult> =>
      Promise.resolve({
        output:
          '{"A": {"correct":true,"complete":true,"grounded":true}, "B": {"correct":false,"complete":false,"grounded":false}}',
      }),
  };
  const manifest = await runExperiment({ ...plan({ runsRoot }), judge });
  const task = manifest.tasks[0];
  assert.ok(task);
  assert.ok(task.judge);
  assert.equal(task.judge?.judgedTrials, 3);
  assert.equal(task.judge?.consistentTrials, 0, 'a judge that always favors A is inconsistent');
  assert.equal(task.judge?.baselineMean, null);
  assert.equal(task.judge?.treatmentMean, null);
  assert.equal(manifest.judge?.model, 'judge-model');
  assert.ok(existsSync(join(runsRoot, 'test-group', 'review-r1', 'judge-trial-1.json')));
});

test('runExperiment averages judge scores only over consistent trials', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const judge: Executor = {
    describe: () => ({ kind: 'api', model: 'judge-model' }),
    run: (prompt: string): Promise<ExecutorResult> => {
      const aIndex = prompt.indexOf('Answer A:');
      const bIndex = prompt.indexOf('Answer B:');
      const aIsTreatment = prompt.slice(aIndex, bIndex).includes('bulk discount');
      const win = '{"correct":true,"complete":true,"grounded":true}';
      const partial = '{"correct":true,"complete":false,"grounded":true}';
      return Promise.resolve({ output: aIsTreatment ? `{"A": ${win}, "B": ${partial}}` : `{"A": ${partial}, "B": ${win}}` });
    },
  };
  const manifest = await runExperiment({ ...plan({ runsRoot }), judge });
  const task = manifest.tasks[0];
  assert.ok(task?.judge);
  assert.equal(task.judge?.judgedTrials, 3);
  assert.equal(task.judge?.consistentTrials, 3);
  assert.equal(task.judge?.baselineMean, 2);
  assert.equal(task.judge?.treatmentMean, 3);
});

test('runExperiment strips the mock marker for non-mock executors', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-');
  const fake: Executor = {
    describe: () => ({ kind: 'api', model: 'fake' }),
    run: (): Promise<ExecutorResult> => Promise.resolve({ output: 'nothing useful' }),
  };
  await runExperiment({ ...plan({ runsRoot, trials: 1 }), executor: fake });
  const runDir = join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1');
  assert.ok(!existsSync(join(runDir, '.skillfit-mock.json')));
});

test('gitInit initializes a real repository', async (t) => {
  const dir = tmp(t, 'skillfit-git-');
  writeFileSync(join(dir, 'file.txt'), 'x\n');
  const ok = await gitInit(dir);
  assert.equal(ok, true);
  assert.ok(existsSync(join(dir, '.git')));
});
