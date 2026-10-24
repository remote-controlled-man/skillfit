import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { runBenchInit, runBenchAdd } from '../commands/bench.js';
import { manageBench, inspectBench } from '../commands/bench-manage.js';
import { loadBench, selectBenchTasks } from './bench.js';
import { assertBenchClaimSupported, measurementScope, parseMeasurementScope } from './measurement-scope.js';
import { runEval } from '../commands/eval.js';
import { prepareEvalPlan } from '../commands/eval-plan.js';
import { runEvalCli } from '../commands/eval-cli.js';
import { reportEvalComponent } from '../commands/eval-component.js';
import { parseEvalReport } from './eval-manifest.js';
import { sha256File } from './hash.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-claims-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'bench');
  await runBenchInit({ dir, yes: true, log: () => {} });
  const file = join(dir, 'bench.json'), raw = JSON.parse(readFileSync(file, 'utf8'));
  return { root, dir, file, raw, save: () => writeFileSync(file, JSON.stringify(raw)) };
}

test('schema 2 requires explicit claims while schema 1 keeps ignored fields unrecorded', async t => {
  const f = await fixture(t);
  f.raw.tasks[0].claims = ['process']; f.save();
  assert.equal(loadBench(f.dir).tasks[0]!.claims, undefined);
  f.raw.schemaVersion = 2;
  for (const claims of [undefined, [], ['process'], ['quality', 'quality'], 'quality', [true]]) {
    f.raw.tasks[0].claims = claims; f.save();
    assert.throws(() => loadBench(f.dir), /claims/);
  }
  f.raw.tasks[0].claims = ['quality', 'efficiency']; f.save();
  assert.equal(loadBench(f.dir).schemaVersion, 2);
  assert.deepEqual(loadBench(f.dir).tasks[0]!.claims, ['quality', 'efficiency']);
  f.raw.tasks[0].claims = ['activation']; f.save();
  assert.throws(() => loadBench(f.dir), /shouldTrigger/);
  f.raw.tasks[0].shouldTrigger = false; f.save();
  assert.deepEqual(loadBench(f.dir).tasks[0]!.claims, ['activation']);
});

test('native reports retain scope and refuse task/claim/assessment tampering while legacy stays absent', async t => {
  const f = await fixture(t), skill = join(f.root, 'target');
  const { mkdirSync } = await import('node:fs'); mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# offline');
  f.raw.schemaVersion = 2; f.raw.tasks[0].claims = ['quality']; f.save();
  const options = { skillPath: skill, bench: f.dir, runsRoot: join(f.root, 'runs'), runGroup: 'native', trials: 1, maxCalls: 2,
    dryRun: false, yes: true, log: () => {}, executor: { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => ({ output: 'skillfit-ok' }) } };
  const result = await runEvalCli(options);
  assert.equal(result.measurementScope?.assessment, 'supported');
  assert.ok('evidence' in result);
  assert.equal(result.evidence.verified, true);
  const file = join(options.runsRoot, 'native/manifest.json'), original = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(parseEvalReport(original).measurementScope?.requestedClaim, 'quality');
  const legacy = structuredClone(original); delete legacy.measurementScope;
  assert.equal(parseEvalReport(legacy).measurementScope, undefined);
  const indexFile = join(options.runsRoot, 'native/_artifacts.json'), indexBytes = readFileSync(indexFile);
  const resealed = structuredClone(original); resealed.measurementScope.taskClaims[0].claims.push('efficiency');
  writeFileSync(file, JSON.stringify(resealed));
  const index = JSON.parse(indexBytes.toString()); index.files['manifest.json'] = sha256File(file); writeFileSync(indexFile, JSON.stringify(index));
  const rejected = await reportEvalComponent(join(options.runsRoot, 'native'));
  assert.equal(rejected.evidence.verified, false);
  assert.ok(rejected.evidence.reasons.some(r => r.includes('measurementScope')));
  writeFileSync(file, JSON.stringify(original, null, 2) + '\n'); writeFileSync(indexFile, indexBytes);
  for (const mutate of [
    (m: typeof original) => { m.measurementScope.taskClaims[0].taskId = 'another'; },
    (m: typeof original) => { m.measurementScope.requestedClaim = 'activation'; },
    (m: typeof original) => { m.measurementScope.assessment = 'unsupported'; },
  ]) {
    const altered = structuredClone(original); mutate(altered);
    assert.throws(() => parseEvalReport(altered), /measurementScope/);
  }
  // Current external inputs must not fill or replace frozen declarations.
  f.raw.tasks[0].claims = ['efficiency']; f.save();
  const saved = await reportEvalComponent(join(options.runsRoot, 'native'));
  assert.deepEqual(saved.measurementScope, original.measurementScope);
  assert.equal(saved.evidence.verified, true);
});

test('schema 2 authoring is opt-in, requires claims before import and validates JSON edits', async t => {
  const f = await fixture(t), declared = join(f.root, 'declared');
  await runBenchInit({ dir: declared, schemaVersion: 2, yes: true, log: () => {} });
  assert.deepEqual(loadBench(declared).tasks[0]!.claims, ['quality']);
  const before = readFileSync(join(declared, 'bench.json'), 'utf8');
  await assert.rejects(runBenchAdd({ benchDir: declared, freeze: true, sourceDir: f.root, include: ['missing.txt'], prompt: 'Task', expect: 'fixed', yes: true, log: () => {} }), /claims/);
  assert.equal(readFileSync(join(declared, 'bench.json'), 'utf8'), before);
  manageBench({ dir: declared, taskId: 'example-task', action: 'edit', set: ['claims=["quality","efficiency"]'], yes: true, log: () => {} });
  assert.deepEqual(loadBench(declared).tasks[0]!.claims, ['quality', 'efficiency']);
  assert.deepEqual(inspectBench(declared).tasks[0]!.claims, ['quality', 'efficiency']);
  for (const value of ['[]', '["process"]', '["efficiency","efficiency"]', 'quality']) {
    assert.throws(() => manageBench({ dir: declared, taskId: 'example-task', action: 'edit', set: [`claims=${value}`], yes: true, log: () => {} }), /claims|JSON/);
  }
  assert.throws(() => manageBench({ dir: f.dir, taskId: 'example-task', action: 'edit', set: ['claims=["quality"]'], yes: true, log: () => {} }), /schema 2/);
  assert.equal(loadBench(f.dir).schemaVersion, 1);
});

test('unsupported schema 2 target is visible in preview and refuses before verifier, oracle or executor', async t => {
  const f = await fixture(t);
  f.raw.schemaVersion = 2; f.raw.tasks[0].claims = ['efficiency']; f.save();
  let calls = 0;
  const options = { skillPath: join(f.root, 'skill'), bench: f.dir, runsRoot: join(f.root, 'runs'), runGroup: 'scope',
    trials: 1, maxCalls: 2, dryRun: true, yes: true, log: () => {},
    executor: { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: 'skillfit-ok' }; } } };
  const { mkdirSync } = await import('node:fs'); mkdirSync(options.skillPath);
  writeFileSync(join(options.skillPath, 'SKILL.md'), '# offline\n');
  const preview = await prepareEvalPlan(options, {});
  assert.equal(preview.plan.evaluation.measurementScope?.assessment, 'unsupported');
  const sentinel = join(f.root, 'verifier-started');
  writeFileSync(join(f.dir, 'verifiers/example-task.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'bad');process.exit(1);`);
  await assert.rejects(runEval({ ...options, dryRun: false }), /BENCH_CLAIM_UNSUPPORTED/);
  const { existsSync } = await import('node:fs');
  assert.equal(calls, 0); assert.equal(existsSync(sentinel), false); assert.equal(existsSync(options.runsRoot), false);
});

test('scope records ordered task intersections without silently selecting compatible tasks', async t => {
  const f = await fixture(t);
  f.raw.schemaVersion = 2;
  f.raw.tasks[0].claims = ['quality', 'efficiency'];
  f.raw.tasks.push({ ...f.raw.tasks[0], id: 'second', claims: ['efficiency'] }); f.save();
  const bench = loadBench(f.dir), unsupported = measurementScope(bench, 'quality');
  assert.equal(unsupported.assessment, 'unsupported');
  assert.throws(() => assertBenchClaimSupported(unsupported), /BENCH_CLAIM_UNSUPPORTED/);
  assert.deepEqual(unsupported.taskClaims.map(t => t.taskId), ['example-task', 'second']);
  assert.equal(measurementScope(bench, 'efficiency').assessment, 'supported');
  assert.equal(measurementScope(bench, null).assessment, 'not-applicable');
  assert.equal(measurementScope(selectBenchTasks(bench, ['example-task']), 'quality').assessment, 'supported');
  assert.deepEqual(measurementScope(selectBenchTasks(bench, ['second', 'example-task']), 'efficiency').taskClaims.map(t => t.taskId), ['example-task', 'second']);
  assert.throws(() => parseMeasurementScope({ ...unsupported, schemaVersion: 2 }), /Unsupported/);
  assert.throws(() => parseMeasurementScope({ ...unsupported, assessment: 'supported' }), /assessment/);
  f.raw.schemaVersion = 1; f.save();
  assert.deepEqual(measurementScope(loadBench(f.dir), 'quality'), { schemaVersion: 1, benchSchemaVersion: 1,
    taskClaims: [{ taskId: 'example-task', claims: null }, { taskId: 'second', claims: null }], requestedClaim: 'quality', assessment: 'legacy-unrecorded' });
});
