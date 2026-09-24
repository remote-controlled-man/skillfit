import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadBench } from './bench.js';
import { collectSkillBundle } from './bundle.js';
import { MockExecutor } from './executors/mock.js';
import { runTriggerExperiment, triggerMetrics, type TriggerManifest } from './trigger.js';
import type { Executor, ExecutorResult } from './types.js';

function tmp(t: import('node:test').TestContext, prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const PASS_VERIFIER = `import fs from 'node:fs';
const out = fs.readFileSync(process.argv[2] + '/_output.md', 'utf8');
process.exit(out.includes('done') ? 0 : 1);
`;

function makeTriggerBench(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-trigger-bench-');
  for (const id of ['pos-task', 'neg-task']) {
    mkdirSync(join(dir, 'fixtures', id), { recursive: true });
    writeFileSync(join(dir, 'fixtures', id, 'index.txt'), 'x\n');
  }
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  writeFileSync(join(dir, 'prompts', 'pos.md'), 'Review this code and finish with done.\n');
  writeFileSync(
    join(dir, 'prompts', 'pos.trigger.md'),
    'TRIGGER variant: Review this code on disk and finish with done.\n',
  );
  writeFileSync(join(dir, 'prompts', 'neg.md'), 'Explain this library and finish with done.\n');
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'verifiers', 'pass.mjs'), PASS_VERIFIER);
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'trigger-bench',
      tasks: [
        { id: 'pos-task', fixture: 'fixtures/pos-task', prompt: 'prompts/pos.md', promptTrigger: 'prompts/pos.trigger.md', verifier: 'node verifiers/pass.mjs', shouldTrigger: true },
        { id: 'neg-task', fixture: 'fixtures/neg-task', prompt: 'prompts/neg.md', verifier: 'node verifiers/pass.mjs', shouldTrigger: false },
      ],
    }),
  );
  return dir;
}

function makeSkill(t: import('node:test').TestContext): string {
  const dir = join(tmp(t, 'skillfit-trigger-skill-'), 'test-skill');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '# test skill\n');
  return dir;
}

function stubExecutor(
  decide: (prompt: string) => Partial<ExecutorResult> & { output: string },
): Executor {
  return {
    describe: () => ({ kind: 'stub', model: 'stub' }),
    run: (prompt: string) => Promise.resolve({ tokens: { input: 10, output: 5 }, ...decide(prompt) }),
  };
}

function makePlan(
  t: import('node:test').TestContext,
  executor: Executor,
  overrides: Partial<Parameters<typeof runTriggerExperiment>[0]> = {},
) {
  const runsRoot = join(tmp(t, 'skillfit-trigger-runs-'), 'runs');
  return {
    bench: loadBench(makeTriggerBench(t)),
    skill: collectSkillBundle(makeSkill(t)),
    executor,
    trials: 3,
    runsRoot,
    runGroup: 'trigger-group',
    skillInstallDir: '.test-skills',
    log: () => {},
    ...overrides,
  };
}

test('runTriggerExperiment measures recall and false-trigger rate', async (t) => {
  const executor = stubExecutor((prompt) => ({
    output: 'done',
    skillTriggered: prompt.includes('Review this code'),
    rawOutput: '{"role":"assistant"}\n',
  }));
  const plan = makePlan(t, executor);
  const manifest = await runTriggerExperiment(plan);

  assert.equal(manifest.mode, 'trigger');
  assert.equal(manifest.tasks.length, 2);
  const pos = manifest.tasks.find((task) => task.id === 'pos-task');
  const neg = manifest.tasks.find((task) => task.id === 'neg-task');
  assert.deepEqual(
    { fired: pos?.fired, runs: pos?.runs, passes: pos?.passes },
    { fired: 3, runs: 3, passes: 3 },
  );
  assert.deepEqual({ fired: neg?.fired, runs: neg?.runs }, { fired: 0, runs: 3 });
  assert.equal(manifest.metrics.recall, 1);
  assert.equal(manifest.metrics.falseTriggerRate, 0);
  assert.equal(manifest.metrics.precision, 1);
  assert.equal(manifest.metrics.f1, 1);
  assert.ok(manifest.metrics.recallCi95);

  const trialDir = join(plan.runsRoot, 'trigger-group', 'pos-task', 'installed', 'trial-1');
  assert.ok(existsSync(join(trialDir, '.test-skills', 'test-skill', 'SKILL.md')), 'skill installed');
  assert.ok(existsSync(join(trialDir, '_transcript.jsonl')), 'raw transcript saved');
  const prompt = readFileSync(join(trialDir, '_prompt.txt'), 'utf8');
  assert.ok(!prompt.includes('<skill name='), 'skill is not injected into the prompt');
  assert.ok(!prompt.includes('Experiment isolation rules'), 'no no-tools isolation block');
  assert.ok(!prompt.includes('Repository snapshot'), 'trigger mode never inlines the repository snapshot');
  assert.ok(prompt.includes('TRIGGER variant'), 'promptTrigger file is used when present');
  assert.ok(existsSync(join(plan.runsRoot, 'trigger-group', 'manifest.json')));
});

test('runTriggerExperiment excludes undetectable transcripts from rates', async (t) => {
  let calls = 0;
  const executor = stubExecutor(() => {
    calls++;
    return calls <= 3
      ? { output: 'done', skillTriggered: true }
      : { output: 'done' };
  });
  const manifest = await runTriggerExperiment(makePlan(t, executor));
  const neg = manifest.tasks.find((task) => task.id === 'neg-task');
  assert.deepEqual({ fired: neg?.fired, runs: neg?.runs, unknown: neg?.unknown }, { fired: 0, runs: 0, unknown: 3 });
  assert.equal(manifest.metrics.falseTriggerRate, null);
  assert.ok(manifest.warnings.some((w) => w.includes('detection was impossible')));
});

test('runTriggerExperiment records executor errors without crashing', async (t) => {
  const executor: Executor = {
    describe: () => ({ kind: 'stub', model: 'stub' }),
    run: () => Promise.reject(new Error('agent exploded')),
  };
  const manifest = await runTriggerExperiment(makePlan(t, executor, { trials: 1 }));
  assert.equal(manifest.tasks[0]?.errors, 1);
  assert.equal(manifest.metrics.recall, null);
  assert.ok(manifest.warnings.some((w) => w.includes('executor errors')));
});

test('runTriggerExperiment warns when the bench has no negative-control tasks', async (t) => {
  const dir = makeTriggerBench(t);
  const benchJson = JSON.parse(readFileSync(join(dir, 'bench.json'), 'utf8'));
  benchJson.tasks = benchJson.tasks.filter((task: { id: string }) => task.id === 'pos-task');
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(benchJson));
  const executor = stubExecutor(() => ({ output: 'done', skillTriggered: true }));
  const plan = makePlan(t, executor);
  const manifest = await runTriggerExperiment({ ...plan, bench: loadBench(dir) });
  assert.ok(manifest.warnings.some((w) => w.includes('false-trigger rate is unmeasurable')));
});

test('runTriggerExperiment rejects the mock executor', async (t) => {
  await assert.rejects(
    () => runTriggerExperiment(makePlan(t, new MockExecutor())),
    /requires a real CLI executor/,
  );
});

test('runTriggerExperiment skips tasks without a shouldTrigger label', async (t) => {
  const dir = makeTriggerBench(t);
  const benchJson = JSON.parse(readFileSync(join(dir, 'bench.json'), 'utf8'));
  benchJson.tasks.push({ id: 'unlabeled', fixture: 'fixtures/pos-task', prompt: 'prompts/pos.md', verifier: 'node verifiers/pass.mjs' });
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(benchJson));
  const executor = stubExecutor(() => ({ output: 'done', skillTriggered: true }));
  const plan = makePlan(t, executor, { trials: 1 });
  const manifest = await runTriggerExperiment({ ...plan, bench: loadBench(dir) });
  assert.equal(manifest.tasks.length, 2);
  assert.ok(!existsSync(join(plan.runsRoot, 'trigger-group', 'unlabeled')));
});

test('triggerMetrics is null-safe at zero runs', () => {
  const metrics = triggerMetrics([
    { id: 'a', shouldTrigger: true, runs: 0, fired: 0, unknown: 2, errors: 0, passes: 0, tokens: null },
  ]);
  assert.equal(metrics.recall, null);
  assert.equal(metrics.precision, null);
  assert.equal(metrics.precisionCi95, null);
  assert.equal(metrics.f1, null);
  assert.equal(metrics.falseTriggerRate, null);
});

test('triggerMetrics carries a Wilson CI for precision and leaves F1 bare', () => {
  const metrics = triggerMetrics([
    { id: 'pos', shouldTrigger: true, runs: 10, fired: 8, unknown: 0, errors: 0, passes: 8, tokens: null },
    { id: 'neg', shouldTrigger: false, runs: 10, fired: 2, unknown: 0, errors: 0, passes: 0, tokens: null },
  ]);
  // precision = positives fired / all fired = 8 / (8 + 2)
  assert.equal(metrics.precision, 0.8);
  const ci = metrics.precisionCi95;
  assert.ok(ci, 'precision is a proportion over the fired runs, so it gets an interval');
  assert.ok(ci.lo >= 0 && ci.hi <= 1, `interval must stay in [0,1], got ${ci.lo}-${ci.hi}`);
  assert.ok(ci.lo < 0.8 && 0.8 < ci.hi, `interval must bracket the point estimate, got ${ci.lo}-${ci.hi}`);
  assert.ok(ci.lo > 0.4 && ci.hi < 1, 'a 10-run interval should be wide but not degenerate');
  // F1 is a harmonic mean of two proportions: no closed-form binomial interval exists, so the
  // metric stays bare rather than printing invented precision.
  assert.equal(typeof metrics.f1, 'number');
  assert.ok(!('f1Ci95' in metrics));
});
