import { renderTriggerSummary } from '../../cli/trigger-summary.js';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadBench } from "../../bench/read.js";
import { collectInstalledSkillFingerprint, collectSkillBundle } from "../../resources/skill.js";
import { MockExecutor } from "./mock-executor.js";
import { runTriggerExperiment, triggerMetrics, type TriggerManifest } from "./activation.js";
import type { Executor, ExecutorResult } from "../../agents/contracts.js";
import { triggerDetection } from "../../agents/observation/trigger-detection.js";

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

test('trigger rejects conflicting versioned labels, target identities and competitor aliases before any call', async t => {
  let calls = 0;
  const declaration = triggerDetection('content-blocks', ['test-skill']);
  const executor: Executor = { describe: () => ({ kind: 'stub', model: 'offline', triggerDetection: declaration }), run: async () => { calls++; return { output: 'done' }; } };
  const plan = makePlan(t, executor, { trials: 1 });
  await assert.rejects(runTriggerExperiment({ ...plan, detection: 'skill-read' }), /contradicts/);
  const wrong = triggerDetection('content-blocks', ['other']);
  await assert.rejects(runTriggerExperiment({ ...plan, executor: { ...executor, describe: () => ({ kind: 'stub', model: 'offline', triggerDetection: wrong }) } }), /contradicts/);
  const wrongPath = triggerDetection('codex-items', ['test-skill'], ['.different/skills/test-skill/SKILL.md']);
  await assert.rejects(runTriggerExperiment({ ...plan, executor: { ...executor, describe: () => ({ kind: 'stub', model: 'offline', triggerDetection: wrongPath }) } }), /read paths do not include/);
  const competitor = makeSkill(t); writeFileSync(join(competitor, 'SKILL.md'), '---\nname: test-skill\ndescription: Conflicting alias.\n---\n');
  await assert.rejects(runTriggerExperiment({ ...plan, competitors: [{ name: 'other', sourceDir: competitor, sha256: collectInstalledSkillFingerprint(competitor).sha256 }] }), /conflicting registered trigger identity/);
  assert.equal(calls, 0); assert.equal(existsSync(join(plan.runsRoot, plan.runGroup)), false);
});

test('trigger verifier exceptions are errors excluded from rates while their output and tokens stay in receipts', async t => {
  const plan = makePlan(t, stubExecutor(() => ({ output: 'done', skillTriggered: true })), { trials: 1 });
  writeFileSync(join(plan.bench.dir, 'verifiers/pass.mjs'), "throw new Error('trigger grader unavailable');");
  plan.bench = loadBench(plan.bench.dir);
  const result = await runTriggerExperiment(plan);
  assert.equal(result.metrics.positives.runs, 0); assert.equal(result.metrics.negatives.runs, 0);
  assert.ok(result.tasks.every(task => task.errors === 1 && task.runs === 0));
  const receipt = JSON.parse(readFileSync(join(plan.runsRoot, plan.runGroup, 'pos-task/installed/trial-1/_result.json'), 'utf8'));
  assert.match(receipt.error, /VERIFIER_RUNTIME_ERROR/); assert.deepEqual(receipt.tokens, { input: 10, output: 5 });
});

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

test('trigger manifests and receipts identify all installed scripts and binary resources', async (t) => {
  const skillDir = makeSkill(t);
  mkdirSync(join(skillDir, 'scripts'));
  writeFileSync(join(skillDir, 'scripts', 'helper.sh'), 'printf first\n');
  writeFileSync(join(skillDir, 'asset.bin'), Buffer.from([0, 255]));
  const executor = stubExecutor(() => ({ output: 'done', skillTriggered: true }));
  const plan = makePlan(t, executor, { skill: collectSkillBundle(skillDir), trials: 1 });
  const first = await runTriggerExperiment(plan);
  assert.deepEqual(first.skill.installedFiles, ['SKILL.md', 'asset.bin', 'scripts/helper.sh']);
  const installedDir = join(plan.runsRoot, plan.runGroup, 'pos-task', 'installed', 'trial-1', '.test-skills', 'test-skill');
  assert.equal(first.skill.installedSha256, collectInstalledSkillFingerprint(installedDir).sha256);
  const receipt = JSON.parse(readFileSync(join(installedDir, '..', '..', '_result.json'), 'utf8'));
  assert.equal(receipt.skillInstalledSha256, first.skill.installedSha256);
  assert.deepEqual(receipt.skillInstalledFiles, first.skill.installedFiles);
  writeFileSync(join(skillDir, 'scripts', 'helper.sh'), 'printf second\n');
  const second = await runTriggerExperiment({ ...plan, skill: collectSkillBundle(skillDir), runGroup: 'second' });
  assert.equal(first.skill.bundleSha256, second.skill.bundleSha256);
  assert.notEqual(first.skill.installedSha256, second.skill.installedSha256);
  assert.match(renderTriggerSummary(second, 'manifest.json'), /Installed: sha256 .*3 files \(before execution\)/);
  const legacy: TriggerManifest = { ...first, skill: { name: first.skill.name, sourceDir: first.skill.sourceDir, bundleSha256: first.skill.bundleSha256, files: first.skill.files } };
  assert.match(renderTriggerSummary(legacy, 'manifest.json'), /Installed: not recorded \(legacy manifest/);
});

test('trigger rejects changed resources before running another trial under the same fingerprint', async (t) => {
  const skillDir = makeSkill(t);
  writeFileSync(join(skillDir, 'helper.sh'), 'first\n');
  let calls = 0;
  const executor = stubExecutor(() => {
    calls++;
    writeFileSync(join(skillDir, 'helper.sh'), 'changed\n');
    return { output: 'done', skillTriggered: true };
  });
  const plan = makePlan(t, executor, { skill: collectSkillBundle(skillDir), trials: 2 });
  await assert.rejects(runTriggerExperiment(plan), /Installed Skill content does not match the planned fingerprint/);
  assert.equal(calls, 1);
});

test('trigger rejects nested symbolic links before creating a run or starting an executor', async (t) => {
  const skillDir = makeSkill(t);
  const outside = tmp(t, 'skillfit-trigger-link-target-');
  writeFileSync(join(outside, 'helper.sh'), 'outside resource\n');
  // Directory junctions require no symlink privilege on Windows CI.
  symlinkSync(outside, join(skillDir, 'linked'), 'junction');
  let calls = 0;
  const executor = stubExecutor(() => { calls++; return { output: 'done' }; });
  const plan = makePlan(t, executor, { skill: collectSkillBundle(skillDir), trials: 1 });
  await assert.rejects(runTriggerExperiment(plan), /Symbolic links are not supported/);
  assert.equal(calls, 0);
  assert.ok(!existsSync(join(plan.runsRoot, plan.runGroup)));
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
  assert.ok(manifest.warnings.some((w) => w.includes('executor, verifier, or engagement error')));
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

test('triggerClass is recorded only on positive tasks and splits recall', async (t) => {
  const dir = makeTriggerBench(t);
  const benchJson = JSON.parse(readFileSync(join(dir, 'bench.json'), 'utf8')) as { tasks: Array<Record<string, unknown>> };
  benchJson.tasks[0]!['triggerClass'] = 'explicit';
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(benchJson));
  const executor = stubExecutor(() => ({ output: 'done', skillTriggered: true }));
  const manifest = await runTriggerExperiment(makePlan(t, executor, { bench: loadBench(dir), trials: 1 }));
  assert.equal(manifest.metrics.classRecall?.explicit?.fired, 1);
  assert.equal(manifest.metrics.classRecall?.implicit, undefined);
  benchJson.tasks[1]!['triggerClass'] = 'explicit';
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(benchJson));
  assert.throws(() => loadBench(dir), /shouldTrigger: true/);
});

test('a competing Skill is copied beside the Skill under test and recall is no longer described as alone', async (t) => {
  const other = join(tmp(t, 'skillfit-other-skill-'), 'other-skill');
  mkdirSync(other, { recursive: true });
  writeFileSync(join(other, 'SKILL.md'), '# other\n');
  const pin = collectInstalledSkillFingerprint(other);
  const executor = stubExecutor(() => ({ output: 'done', skillTriggered: false }));
  const plan = makePlan(t, executor, { trials: 1, detection: 'skill-read' });
  const manifest = await runTriggerExperiment({
    ...plan,
    competitors: [{ name: 'other-skill', sourceDir: other, sha256: pin.sha256 }],
  });
  assert.equal(manifest.competition?.mode, 'installed');
  assert.equal(readFileSync(join(plan.runsRoot, plan.runGroup, 'pos-task', 'installed', 'trial-1', '.test-skills', 'other-skill', 'SKILL.md'), 'utf8'), '# other\n');
  const summary = renderTriggerSummary(manifest, 'manifest.json');
  assert.match(summary, /other-skill/);
  assert.match(summary, /SKILL.md read, not a Skill-invocation event/);
  assert.ok(!summary.includes('installed alone'));
});
