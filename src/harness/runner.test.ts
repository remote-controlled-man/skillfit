import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.tasks.length, 5);
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
  assert.equal(task.conditions.treatment.meanScore, 1);
  assert.ok(task.conditions.baseline.meanScore !== null);
  // The mock baseline finds the bare-Error bug but reports the C-style-loop decoy, so it scores 1 of
  // 4 checks: bare-error only. `no-false-positives` is what costs it the fourth.
  assert.ok(Math.abs((task.conditions.baseline.meanScore as number) - 0.25) < 1e-9);
  assert.ok(task.scoreDelta !== null);
  assert.ok(Math.abs((task.scoreDelta as number) - 0.75) < 1e-9);
  assert.deepEqual(task.scores.baseline, [0.25, 0.25, 0.25]);
  assert.deepEqual(task.scores.treatment, [1, 1, 1]);
  assert.deepEqual(
    task.facets.find((facet) => facet.name === 'discount-boundary'),
    {
      name: 'discount-boundary',
      baselinePassRate: 0,
      treatmentPassRate: 1,
      baselineTrials: 3,
      treatmentTrials: 3,
    },
  );
  assert.deepEqual(
    task.facets.find((facet) => facet.name === 'no-false-positives'),
    {
      name: 'no-false-positives',
      baselinePassRate: 0,
      treatmentPassRate: 1,
      baselineTrials: 3,
      treatmentTrials: 3,
    },
    'reporting a decoy must cost the review a facet, not just get recorded',
  );
  assert.equal(task.verifierNotes.length, 0);
  // summarize-s1 is a negative control whose mock treatment arm slips into review framing and fails,
  // so the pooled run regresses on 3 pairs. Nine improved against three regressed is not significant
  // at this sample size — which is the honest reading, and the point of the task being in the bench.
  assert.equal(manifest.overall.verdict, 'inconclusive');
  assert.deepEqual(manifest.overall.stats.discordant, { improved: 9, regressed: 3 });
  assert.equal(manifest.overall.stats.mcnemarP, 0.14599609375);
  const scoreDeltaCi = manifest.overall.stats.scoreDeltaCi;
  assert.ok(scoreDeltaCi !== null);
  // pooled treatment mean 0.9333 minus pooled baseline mean 0.55 (r1 .25, r2 .5, r3 0, x1 1, s1 1)
  assert.ok(Math.abs(scoreDeltaCi.point - 23 / 60) < 1e-9);
  assert.equal(manifest.skill.bundleSha256.length, 64);
  assert.ok(manifest.warnings.some((w) => w.includes('synthetic')));
  assert.ok(
    manifest.warnings.some((w) => w.includes('"review-r3"') && w.includes('too hard or broken')),
  );
  assert.ok(
    manifest.warnings.some((w) => w.includes('"explain-x1"') && w.includes('facet "states-purpose"')),
  );

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
    schemaVersion: number;
    passed: boolean;
    score: number | null;
    checks: { name: string; pass: boolean }[] | null;
    gitInitialized: boolean;
    skillBundleSha256: string | null;
  };
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.passed, true);
  assert.equal(result.score, 1);
  assert.equal(result.checks?.length, 4);
  assert.equal(result.gitInitialized, true);
  assert.equal(result.skillBundleSha256, manifest.skill.bundleSha256);

  const verifierLog = readFileSync(
    join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_verifier.txt'),
    'utf8',
  );
  assert.match(verifierLog, /"missed":\["discount-boundary","missing-tests"\]/);
  // The mock baseline reports the C-style-loop decoy; it is now scored, not merely recorded.
  assert.match(verifierLog, /"decoys":\["c-style-loop"\]/);
  assert.match(verifierLog, /"name":"no-false-positives","pass":false/);
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

test('runExperiment never runs the judge inside the run group', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-judgecwd-');
  const cwds: string[] = [];
  const listings: string[][] = [];
  const judge: Executor = {
    describe: () => ({ kind: 'api', model: 'judge-model' }),
    run: (_prompt: string, workdir: string): Promise<ExecutorResult> => {
      cwds.push(workdir);
      listings.push(readdirSync(workdir).sort());
      return Promise.resolve({
        output:
          '{"A": {"correct":true,"complete":true,"grounded":true}, "B": {"correct":false,"complete":false,"grounded":false}}',
      });
    },
  };
  await runExperiment({ ...plan({ runsRoot }), judge, trials: 1 });
  const groupDir = join(runsRoot, 'test-group');
  assert.ok(cwds.length > 0, 'the judge ran');
  cwds.forEach((cwd, index) => {
    assert.ok(
      !cwd.startsWith(groupDir),
      `judge call ${index} ran inside the run group (${cwd}), where both arms and their _result.json live`,
    );
    assert.deepEqual(listings[index], ['answerA.md', 'answerB.md']);
  });
  // The transcript is still written to the task directory, after the call rather than around it.
  assert.ok(existsSync(join(groupDir, 'review-r1', 'judge-trial-1.json')));
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

test('runExperiment drops an errored trial from both arms instead of scoring it as a failure', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-errored-');
  const inner = new MockExecutor();
  const flaky: Executor = {
    // Must report kind 'mock': runTrial deletes .skillfit-mock.json for any other kind, which
    // would starve the delegate and fail both arms for the wrong reason.
    describe: () => inner.describe(),
    run: (prompt: string, workdir: string) => {
      const tail = workdir.split(/[\\/]/).slice(-2).join('/');
      if (tail === 'baseline/trial-2') {
        return Promise.reject(new Error('simulated API timeout'));
      }
      return inner.run(prompt, workdir);
    },
  };
  const manifest = await runExperiment(plan({ runsRoot, executor: flaky }));

  const task = manifest.tasks[0];
  assert.ok(task);
  assert.equal(task.id, 'review-r1');
  assert.equal(task.conditions.baseline.errors, 1);
  assert.equal(task.conditions.treatment.errors, 0);
  assert.equal(task.conditions.baseline.trials, 2);
  assert.equal(task.conditions.treatment.trials, 2, 'the paired treatment trial is dropped too');
  assert.equal(task.outcomes.baseline.length, 2);
  assert.equal(task.outcomes.treatment.length, 2);
  assert.equal(task.scores.baseline.length, 2);
  assert.equal(task.scores.treatment.length, 2);

  // Five tasks x two surviving pairs. review-r1/r2/r3 improve (6 discordant), explain-x1 passes in
  // both arms so its 2 pairs are concordant, and summarize-s1 regresses (2 more). Before the fix the
  // errored baseline trial counted as a failure, which also flipped explain-x1's pairs to "improved"
  // and inflated the count — a timeout masquerading as a result.
  assert.deepEqual(manifest.overall.stats.discordant, { improved: 6, regressed: 2 });
  assert.equal(manifest.overall.conditions.baseline.errors, 5);
  assert.equal(manifest.overall.conditions.baseline.trials, 10);
  assert.equal(manifest.overall.conditions.treatment.trials, 10);
  assert.equal(
    manifest.overall.verdict,
    'inconclusive',
    'the hole must not manufacture the significance a real effect would need',
  );
  assert.ok(
    manifest.warnings.some(
      (w) => w.includes('"review-r1" (baseline)') && w.includes('executor or verifier error'),
    ),
    'the exclusion is surfaced, not silent',
  );
});

test('runExperiment excludes a trial whose verifier could not be spawned', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-nospawn-');
  const benchDir = tmp(t, 'skillfit-bench-nospawn-');
  cpSync(BUNDLED_CODE_REVIEW, benchDir, { recursive: true });
  const benchJson = JSON.parse(readFileSync(join(benchDir, 'bench.json'), 'utf8')) as {
    tasks: Array<{ id: string; verifier: string }>;
  };
  const broken = benchJson.tasks[0];
  assert.ok(broken);
  // Swap only the executable, so the path token still resolves: this is the shape a Windows author
  // hits with `"verifier": "npm test"` (ENOENT) or a `.cmd` wrapper (EINVAL). There is no exit code,
  // so there is no verdict — and "no verdict" used to be recorded as the agent failing the task.
  broken.verifier = `no-such-verifier-binary ${broken.verifier.split(/\s+/).slice(1).join(' ')}`;
  writeFileSync(join(benchDir, 'bench.json'), `${JSON.stringify(benchJson, null, 2)}\n`);

  const manifest = await runExperiment({
    bench: loadBench(benchDir),
    skill: collectSkillBundle(makeSkillSync(runsRoot), 'review-skill'),
    executor: new MockExecutor(),
    trials: 1,
    runsRoot,
    runGroup: 'test-group',
  });

  const task = manifest.tasks[0];
  assert.ok(task);
  assert.equal(task.id, broken.id);
  assert.equal(task.conditions.baseline.errors, 1);
  assert.equal(task.conditions.baseline.passes, 0);
  assert.equal(task.conditions.baseline.trials, 0, 'an unrunnable verifier grades nothing');
  assert.equal(task.conditions.treatment.trials, 0, 'and its paired arm is dropped with it');
  assert.ok(
    manifest.warnings.some((w) => w.includes(`"${broken.id}" (baseline)`) && w.includes('executor or verifier error')),
    'the exclusion is surfaced, not silent',
  );

  const result = JSON.parse(
    readFileSync(
      join(runsRoot, 'test-group', broken.id, 'baseline', 'trial-1', '_result.json'),
      'utf8',
    ),
  ) as { error: string | null; passed: boolean; verifierExitCode: number | null };
  assert.equal(result.passed, false);
  assert.equal(result.verifierExitCode, null);
  assert.match(result.error ?? '', /verifier could not be started/);
  assert.match(result.error ?? '', /spawned without a shell/);
});

test('runExperiment interleaves conditions within each trial and records sampling', async (t) => {
  const runsRoot = tmp(t, 'skillfit-runs-order-');
  const inner = new MockExecutor();
  const order: string[] = [];
  const spy: Executor = {
    describe: () => inner.describe(),
    run: (prompt: string, workdir: string) => {
      order.push(workdir.split(/[\\/]/).slice(-3).join('/'));
      return inner.run(prompt, workdir);
    },
  };
  const manifest = await runExperiment(plan({ runsRoot, executor: spy, trials: 2 }));
  assert.deepEqual(
    order.slice(0, 4),
    [
      'review-r1/baseline/trial-1',
      'review-r1/treatment/trial-1',
      'review-r1/baseline/trial-2',
      'review-r1/treatment/trial-2',
    ],
    'the two arms of a pair must run adjacently; all-baselines-first confounds condition with elapsed time',
  );
  assert.equal(
    manifest.executor.sampling,
    null,
    'the matrix CLIs expose no seed or temperature knob, and the manifest says so rather than implying one',
  );
});

