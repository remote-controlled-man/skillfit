import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadBench } from './bench.js';
import { collectInstalledSkillTarget } from './installed-skill.js';
import { ExperimentSession, normalizeProjectTrust, validateCallBudget, type SessionOptions } from './experiment-session.js';
import { sha256File } from './hash.js';
import type { Executor } from './types.js';
import { runEval } from '../commands/eval.js';
import { runBenchCheck } from '../commands/bench.js';
import { packageFiles } from './replay-package.js';

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-session-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const benchDir = join(root, 'bench');
  const skill = join(root, 'skill');
  mkdirSync(join(benchDir, 'fixture'), { recursive: true });
  mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: candidate\ndescription: offline fixture\n---\nInspect boundaries.\n');
  writeFileSync(join(benchDir, 'fixture', 'index.js'), 'module.exports = 1;\n');
  writeFileSync(join(benchDir, 'prompt.md'), 'Fix the cache.\n');
  writeFileSync(join(benchDir, 'verify.mjs'), "import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';const output=join(process.argv[2],'_output.md');process.exit(existsSync(output)&&readFileSync(output,'utf8').trim()?0:1);\n");
  writeFileSync(join(benchDir, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'session-test', tasks: [
    { id: 'one', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node verify.mjs', shouldTrigger: true },
  ] }));
  const bench = loadBench(benchDir);
  const target = collectInstalledSkillTarget(skill);
  const groupDir = join(root, 'runs', 'test');
  const options: SessionOptions = { bench, target, groupDir, workspaces: [join(groupDir, 'one', 'baseline', 'trial-1')],
    plannedCalls: 2, injected: true, details: { mode: 'test' } };
  const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => ({ output: 'done', rawOutput: 'raw\n' }) };
  return { root, benchDir, skill, bench, groupDir, options, executor };
}

test('budget rejects unsafe values and underfunded plans before writes or probes', async t => {
  const s = setup(t);
  for (const n of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateCallBudget(2, n), /positive safe integer/);
  assert.throws(() => new ExperimentSession({ ...s.options, maxCalls: 1, versionProbe: () => { throw new Error('must not probe'); } }), /exceeding --max-calls/);
  assert.equal(existsSync(s.groupDir), false);
  await assert.rejects(() => runEval({ skillPath: s.skill, bench: s.benchDir, trials: 1, executor: s.executor,
    judgeExecutor: s.executor, maxCalls: 3, dryRun: false, yes: true, runsRoot: join(s.root, 'eval'), log: () => {} }), /needs 4 model calls/);
  assert.equal(existsSync(join(s.root, 'eval')), false);
});

test('dry run includes judge budget and never probes a real CLI or writes', async t => {
  const s = setup(t); const lines: string[] = [];
  await runEval({ skillPath: s.skill, bench: s.benchDir, trials: 1, executor: s.executor, judgeExecutor: s.executor,
    agent: 'codex', maxCalls: 4, dryRun: true, yes: true, runsRoot: join(s.root, 'eval'), log: line => lines.push(line),
    sessionOptions: { homeDir: s.root, versionProbe: () => { throw new Error('must not probe'); } } });
  assert.match(lines.join('\n'), /4 planned; ceiling 4/);
  assert.equal(existsSync(join(s.root, 'eval')), false);
});

test('call ledger and index retain completed calls; a larger ceiling never adds samples', async t => {
  const s = setup(t); let calls = 0;
  const session = new ExperimentSession({ ...s.options, maxCalls: 10 });
  const guarded = session.wrap({ ...s.executor, run: async () => { calls++; return { output: 'ok' }; } }, 'agent');
  await guarded.run('a', s.root); await guarded.run('b', s.root);
  await assert.rejects(() => guarded.run('replacement', s.root), /ceiling reached/);
  assert.equal(calls, 2);
  const linkTarget = process.platform === 'win32' ? 'missing-unfollowed-target' : '/missing-unfollowed-target';
  symlinkSync(linkTarget, join(s.groupDir, 'agent-link'));
  session.finish();
  assert.equal(session.summary().status, 'stopped');
  const ledger = readFileSync(join(s.groupDir, '_calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(ledger.map(row => row.event), ['started', 'finished', 'started', 'finished']);
  const index = JSON.parse(readFileSync(join(s.groupDir, '_artifacts.json'), 'utf8'));
  assert.equal(index.files['_plan.json'], sha256File(join(s.groupDir, '_plan.json')));
  assert.equal(index.files['_session.json'], sha256File(join(s.groupDir, '_session.json')));
  assert.equal(index.links['agent-link'], linkTarget);
});

test('a changed frozen input retains returned output but blocks subsequent calls', async t => {
  const s = setup(t); let calls = 0;
  const session = new ExperimentSession(s.options);
  const guarded = session.wrap({ ...s.executor, run: async () => {
    calls++; writeFileSync(join(s.benchDir, 'prompt.md'), 'changed'); return { output: 'returned', rawOutput: 'retained' };
  } }, 'agent');
  const result = await guarded.run('first', s.root);
  assert.match(result.guardError!, /Frozen bench input changed/);
  assert.equal(result.output, 'returned'); assert.equal(result.rawOutput, 'retained');
  await assert.rejects(() => guarded.run('second', s.root), /Frozen bench input changed/);
  session.finish(); assert.equal(calls, 1); assert.equal(session.summary().status, 'stopped');
});

test('input snapshots exist and are bound before dispatch; modifying one stops further calls with usage retained', async t => {
  const s = setup(t), session = new ExperimentSession(s.options);
  const plan = JSON.parse(readFileSync(join(s.groupDir, '_plan.json'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(join(s.groupDir, '_inputs.json'), 'utf8'));
  assert.equal(plan.inputSnapshot.sha256, sha256File(join(s.groupDir, '_inputs.json')));
  assert.deepEqual(snapshot.entries.map((entry: { label: string }) => entry.label).sort(), ['bench', 'implementation', 'target']);
  const files = packageFiles(join(s.groupDir, '_inputs'));
  assert.equal(plan.inputSnapshot.cost.files, files.length + 1);
  assert.equal(plan.inputSnapshot.cost.bytes, files.reduce((sum, file) => sum + readFileSync(join(s.groupDir, '_inputs', file)).length, 0) + readFileSync(join(s.groupDir, '_inputs.json')).length);
  assert.equal(plan.inputSnapshot.cost.modelCalls, 0); assert.ok(plan.inputSnapshot.cost.durationMs >= 0);
  let calls = 0;
  const guarded = session.wrap({ ...s.executor, run: async () => {
    calls++; assert.equal(readFileSync(join(s.groupDir, '_inputs/target/SKILL.md'), 'utf8'), readFileSync(join(s.skill, 'SKILL.md'), 'utf8'));
    writeFileSync(join(s.groupDir, '_inputs/target/SKILL.md'), 'changed snapshot');
    return { output: 'retained', tokens: { input: 12, output: 3 } };
  } }, 'agent');
  const result = await guarded.run('first', s.root);
  assert.match(result.guardError!, /snapshot hash mismatch/); assert.deepEqual(result.tokens, { input: 12, output: 3 });
  await assert.rejects(guarded.run('partner', s.root), /snapshot hash mismatch/);
  assert.equal(calls, 1); session.finish(); assert.equal(session.summary().status, 'stopped');
});

test('source drift during snapshot setup fails before dispatch and removes only its fresh output', async t => {
  const s = setup(t); let calls = 0;
  const runsRoot = join(s.root, 'drift'), group = join(runsRoot, 'saved');
  mkdirSync(runsRoot); writeFileSync(join(runsRoot, 'kept'), 'existing sibling');
  await assert.rejects(runEval({ skillPath: s.skill, bench: s.benchDir, executor: { ...s.executor, run: async () => { calls++; return { output: 'done' }; } },
    judgeExecutor: null, agent: 'codex', trials: 1, dryRun: false, yes: true, runsRoot, runGroup: 'saved', log: () => {},
    sessionOptions: { homeDir: s.root, env: {}, versionProbe: () => { writeFileSync(join(s.benchDir, 'prompt.md'), 'changed after fingerprinting'); return 'fake 1.0'; } } }), /changed.*snapshot|snapshot.*changed/i);
  assert.equal(calls, 0); assert.ok(!existsSync(group)); assert.equal(readFileSync(join(runsRoot, 'kept'), 'utf8'), 'existing sibling');
});

test('executor failure stops further actual calls and keeps a failure receipt without secrets', async t => {
  const s = setup(t); let calls = 0;
  const session = new ExperimentSession(s.options);
  const guarded = session.wrap({ ...s.executor, run: async () => { calls++; throw new Error('PRIVATE_SECRET'); } }, 'agent');
  await assert.rejects(() => guarded.run('first', s.root), /PRIVATE_SECRET/);
  await assert.rejects(() => guarded.run('second', s.root), /executor failed/);
  session.finish(); assert.equal(calls, 1);
  assert.equal(readFileSync(join(s.groupDir, '_session.json'), 'utf8').includes('PRIVATE_SECRET'), false);
  assert.match(readFileSync(join(s.groupDir, '_calls.jsonl'), 'utf8'), /"event":"failed"/);
});

test('finalizing arbitrary errors keeps generic session diagnostics instead of copying secret-bearing messages', t => {
  const s = setup(t), session = new ExperimentSession(s.options);
  session.finish(new Error('secret-bearing untrusted executor error'));
  const saved = readFileSync(join(s.groupDir, '_session.json'), 'utf8');
  assert.doesNotMatch(saved, /secret-bearing/); assert.equal(session.summary().stopCode, undefined);
  assert.match(session.summary().stopReason!, /Experiment setup or execution stopped/);
});

test('trust normalization covers declared pure blocks only and preserves other configuration bytes', () => {
  const trust = { table: 'projects', field: 'trust_level', value: 'trusted' };
  const base = 'model = "m"\n'; const block = '[projects."/tmp/trial"]\ntrust_level = "trusted"\n';
  assert.equal(normalizeProjectTrust(base + '\n' + block, trust, ['/tmp/trial']), base);
  for (const altered of [block.replace('/tmp/trial', '/tmp/other'), block.replace('"trusted"', '"untrusted"'), block + 'model = "other"\n']) {
    assert.notEqual(normalizeProjectTrust(base + altered, trust, ['/tmp/trial']), base);
  }
  assert.notEqual(normalizeProjectTrust('model = "m" \n', trust, []), base);
});

test('temporary profile config is pinned, planned trust additions are allowed, model changes stop', t => {
  const s = setup(t); const profile = join(s.root, 'profile'); mkdirSync(profile);
  const config = join(profile, 'config.toml'); writeFileSync(config, 'model = "offline"\nmodel_reasoning_effort = "high"\napi_key = "PRIVATE_SECRET"\n');
  const session = new ExperimentSession({ ...s.options, agent: 'codex', homeDir: join(s.root, 'home'),
    env: { CODEX_HOME: profile }, versionProbe: () => 'codex-cli 1.2.3' });
  const plan = readFileSync(join(s.groupDir, '_plan.json'), 'utf8');
  assert.equal(plan.includes('PRIVATE_SECRET'), false); assert.match(plan, /"model_reasoning_effort": "high"/);
  const snapshot = JSON.parse(readFileSync(join(s.groupDir, '_inputs.json'), 'utf8'));
  assert.deepEqual(snapshot.entries.map((entry: { label: string }) => entry.label).sort(), ['bench', 'implementation', 'target'], 'private agent configuration remains fingerprint-only');
  writeFileSync(config, readFileSync(config, 'utf8') + `\n[projects.${JSON.stringify(s.options.workspaces[0])}]\ntrust_level = "trusted"\n`);
  session.check();
  writeFileSync(config, readFileSync(config, 'utf8').replace('"offline"', '"changed"'));
  assert.throws(() => session.check(), /Agent configuration changed/); session.finish();
});

test('recorded CLI configuration stays intent only and does not mutate the frozen descriptor or plan', async t => {
  const s = setup(t), profile = join(s.root, 'profile'); mkdirSync(profile);
  writeFileSync(join(profile, 'config.toml'), 'model = "configured-alias"\napi_key = "PRIVATE_IDENTITY_SECRET"\n');
  const session = new ExperimentSession({ ...s.options, agent: 'codex', homeDir: join(s.root, 'home'),
    env: { CODEX_HOME: profile }, versionProbe: () => 'offline 1.0' });
  const before = readFileSync(join(s.groupDir, '_plan.json'), 'utf8');
  const executor = { describe: () => ({ kind: 'cli', model: 'cli-configured' }), run: async () => ({ output: 'offline answer' }) };
  const descriptor = JSON.stringify(executor.describe());
  const result = await session.wrap(executor, 'agent').run('offline prompt', s.options.workspaces[0]!);
  assert.equal(result.modelIdentity?.configured, 'configured-alias'); assert.equal(result.modelIdentity?.requested, null);
  assert.equal(result.modelIdentity?.status, 'unrecorded'); assert.deepEqual(result.modelIdentity.reportedModels, []);
  assert.equal(JSON.stringify(executor.describe()), descriptor); assert.equal(readFileSync(join(s.groupDir, '_plan.json'), 'utf8'), before);
  assert.equal(JSON.stringify(result).includes('PRIVATE_IDENTITY_SECRET'), false); session.finish();
});

test('canonical trust names for frozen workspace aliases are allowed, unrelated names and overrides are not', t => {
  const s = setup(t); const profile = join(s.root, 'profile'); mkdirSync(profile);
  const real = join(s.root, 'physical'); mkdirSync(real);
  const alias = join(s.root, 'alias'); symlinkSync(real, alias, 'junction');
  const logical = join(alias, 'new', 'task', 'trial-1');
  const physical = join(realpathSync(real), 'new', 'task', 'trial-1');
  const config = join(profile, 'config.toml'); writeFileSync(config, 'model = "offline"\n');
  const options = { ...s.options, agent: 'codex', homeDir: join(s.root, 'home'), env: { CODEX_HOME: profile },
    versionProbe: () => 'offline 1.0', workspaces: [logical] };
  const session = new ExperimentSession(options);
  writeFileSync(config, `model = "offline"\n[projects.${JSON.stringify(physical)}]\ntrust_level = "trusted"\n`);
  mkdirSync(logical, { recursive: true }); session.check();
  const plan = JSON.parse(readFileSync(join(s.groupDir, '_plan.json'), 'utf8'));
  assert.deepEqual(plan.workspaceAliases, [{ logical, physical }]);
  writeFileSync(config, readFileSync(config, 'utf8') + 'model = "overridden"\n');
  assert.throws(() => session.check(), /Agent configuration changed/);
  session.finish();
  writeFileSync(config, 'model = "offline"\n');
  const other = new ExperimentSession({ ...options, groupDir: join(s.root, 'other-run') });
  writeFileSync(config, `model = "offline"\n[projects.${JSON.stringify(join(real, 'other'))}]\ntrust_level = "trusted"\n`);
  assert.throws(() => other.check(), /Agent configuration changed/); other.finish();
});

test('retargeting a declared workspace alias cannot expand its frozen trust allowlist', t => {
  const s = setup(t); const real = join(s.root, 'physical'); const other = join(s.root, 'other');
  mkdirSync(real); mkdirSync(other);
  const alias = join(s.root, 'alias'); symlinkSync(real, alias, 'junction');
  const session = new ExperimentSession({ ...s.options, workspaces: [join(alias, 'trial')] });
  session.check(); rmSync(alias); symlinkSync(other, alias, 'junction');
  assert.throws(() => session.check(), /workspace alias changed/); session.finish();
});

test('global Skill directory aliases are pinned and candidate aliases reject contamination', t => {
  const s = setup(t); const home = join(s.root, 'home'); const skills = join(home, '.agents', 'skills');
  mkdirSync(skills, { recursive: true }); const other = join(s.root, 'other'); mkdirSync(other);
  writeFileSync(join(other, 'SKILL.md'), '---\nname: other\n---\n'); symlinkSync(other, join(skills, 'alias'));
  const options = { ...s.options, agent: 'codex', homeDir: home, env: {}, versionProbe: () => 'offline 1.0' };
  const session = new ExperimentSession(options); session.check();
  writeFileSync(join(other, 'SKILL.md'), 'changed'); assert.throws(() => session.check(), /global Skill input changed/); session.finish();
  symlinkSync(s.skill, join(skills, 'candidate-alias'));
  assert.throws(() => new ExperimentSession({ ...options, groupDir: join(s.root, 'new') }), /Baseline contamination/);
  assert.equal(existsSync(join(s.root, 'new')), false);
});

test('installed read observations exclude errored pairs and managed eval retains receipts', async t => {
  const s = setup(t); let calls = 0;
  const result = await runEval({ skillPath: s.skill, bench: s.benchDir, trials: 2, mode: 'installed',
    agent: 'codex', dryRun: false, yes: true, runsRoot: join(s.root, 'eval'), runGroup: 'reads', log: () => {},
    executor: { ...s.executor, run: async () => { calls++; if (calls === 3) throw new Error('offline failure');
      return { output: 'done', skillTriggered: calls === 2, rawOutput: 'offline transcript' }; } } });
  assert.ok(result && 'overall' in result);
  assert.equal(calls, 3); assert.equal(result.experiment!.status, 'stopped');
  assert.deepEqual(result.overall.conditions.treatment.skillReads, { observed: 1, unobserved: 0, unknown: 0 });
  assert.deepEqual(result.overall.conditions.baseline.skillReads, { observed: 0, unobserved: 1, unknown: 0 });
  assert.equal(result.overall.conditions.baseline.trials, 1);
  assert.equal(existsSync(join(s.root, 'eval', 'reads', '_artifacts.json')), true);
});

test('calibration rejects insufficient budget before creating its run group', async t => {
  const s = setup(t);
  await assert.rejects(() => runBenchCheck({ dir: s.benchDir, log: () => {}, calibrate: {
    executor: s.executor, trials: 2, maxCalls: 1, runsRoot: join(s.root, 'calibrate') } }), /needs 2 model calls/);
  assert.equal(existsSync(join(s.root, 'calibrate')), false);
});

test('final verification backs up and reconciles the manifest when drift occurs after aggregation', t => {
  const s = setup(t); const session = new ExperimentSession(s.options);
  const result = { experiment: session.summary(), warnings: [] as string[] };
  const path = join(s.groupDir, 'manifest.json'); const bytes = JSON.stringify(result) + '\n'; writeFileSync(path, bytes);
  writeFileSync(join(s.benchDir, 'prompt.md'), 'late drift');
  session.finish(undefined, result);
  assert.equal(result.experiment.status, 'stopped');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).experiment.status, 'stopped');
  assert.equal(readFileSync(join(s.groupDir, '_before-finalize-manifest.json'), 'utf8'), bytes);
});

test('trigger delivery uses the same cap and managed receipts without real CLI calls', async t => {
  const s = setup(t); let calls = 0;
  const result = await runEval({ skillPath: s.skill, bench: s.benchDir, trials: 1, mode: 'trigger',
    agent: 'codex', dryRun: false, yes: true, runsRoot: join(s.root, 'trigger'), runGroup: 'one', maxCalls: 1, log: () => {},
    executor: { ...s.executor, run: async () => { calls++; return { output: 'done', skillTriggered: true }; } } });
  assert.ok(result && 'metrics' in result); assert.equal(calls, 1); assert.equal(result.experiment!.status, 'completed');
  assert.equal(existsSync(join(s.root, 'trigger', 'one', '_artifacts.json')), true);
});

test('matrix override instructions are watched at default and overridden homes, including creation', t => {
  const s = setup(t);
  for (const redirected of [false, true]) for (const present of [false, true]) {
    const home = join(s.root, `home-${redirected}-${present}`);
    const profile = redirected ? join(s.root, `profile-${present}`) : join(home, '.codex');
    mkdirSync(profile, { recursive: true });
    const override = join(profile, 'AGENTS.override.md');
    if (present) writeFileSync(override, 'original effective instructions\n');
    const session = new ExperimentSession({ ...s.options, groupDir: join(s.root, `run-${redirected}-${present}`),
      agent: 'codex', homeDir: home, env: redirected ? { CODEX_HOME: profile } : {} });
    session.check(); writeFileSync(override, 'changed effective instructions\n');
    assert.throws(() => session.check(), /Agent configuration changed/); session.finish();
  }
});

test('an output parent alias into a fixture is rejected before any input writes', t => {
  const s = setup(t); const alias = join(s.root, 'output-alias');
  symlinkSync(join(s.benchDir, 'fixture'), alias);
  assert.throws(() => new ExperimentSession({ ...s.options, groupDir: join(alias, 'new-group') }), /output must be outside/);
  assert.equal(existsSync(join(s.benchDir, 'fixture', 'new-group')), false);
});
