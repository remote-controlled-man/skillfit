import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = fileURLToPath(new URL('./cli.js', import.meta.url));
const COMMANDS = [
  ['eval', join(PACKAGE_ROOT, 'skills', 'skillfit'), '--bench', join(PACKAGE_ROOT, 'benches', 'code-review')],
  ['bench', 'check', join(PACKAGE_ROOT, 'benches', 'code-review'), '--calibrate'],
];

test('CLI rejects fractional, malformed and out-of-range trials in eval and calibration dry-runs', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-trials-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const command of COMMANDS) {
    for (const value of ['2.9', '2junk', '', '0', '21', 'NaN']) {
      // Dry-run is mandatory even when exercising the broken parser: no agent CLI may run in tests.
      const result = spawnSync(process.execPath, [CLI, ...command, '--agent', 'codex', '--input', 'workspace', '--trials', value, '--dry-run'],
        { cwd, encoding: 'utf8', timeout: 30_000 });
      assert.ifError(result.error);
      assert.equal(result.status, 1, `${command[0]} --trials ${JSON.stringify(value)}`);
      assert.match(result.stderr, /--trials must be an integer between 1 and 20/);
      assert.equal(result.stdout, '', 'reject before a bench verifier or experiment plan starts');
    }
  }
  assert.ok(!existsSync(join(cwd, 'runs')));
});

test('CLI keeps valid and default repetition counts in offline eval and calibration plans', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-trials-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const command of COMMANDS) {
    for (const trialArgs of [[], ['--trials', '3']]) {
      const result = spawnSync(process.execPath, [CLI, ...command, '--agent', 'codex', '--input', 'workspace', ...trialArgs, '--dry-run'],
        { cwd, encoding: 'utf8', timeout: 30_000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      const repetitions = trialArgs.length ? 3 : command[0] === 'eval' ? 5 : 2;
      if (command[0] === 'eval') assert.match(result.stdout, new RegExp(`Trials\\s+: ${repetitions} per condition`));
      else assert.ok(result.stdout.includes(`× ${repetitions} baseline run(s)`));
    }
  }
  assert.ok(!existsSync(join(cwd, 'runs')));
});

test('CLI rejects malformed call ceilings and unrelated commands without writes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-budget-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const value of ['0', '-1', '1.5', '2junk', 'NaN', '9007199254740992']) {
    const result = spawnSync(process.execPath, [CLI, 'eval', `--max-calls=${value}`, '--dry-run'], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /positive safe integer/); assert.equal(result.stdout, '');
  }
  const unrelated = spawnSync(process.execPath, [CLI, 'doctor', '--max-calls', '2'], { cwd, encoding: 'utf8' });
  assert.equal(unrelated.status, 1); assert.match(unrelated.stderr, /applies only to eval/);
  assert.equal(existsSync(join(cwd, 'runs')), false);
});

test('CLI version comes from package.json and the matrix schema file exists', () => {
  const version = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
  const result = spawnSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), version);
  const matrix = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'src/matrix/agents.json'), 'utf8')) as { $schema: string };
  assert.equal(matrix.$schema, './agents.schema.json');
  assert.equal(existsSync(join(PACKAGE_ROOT, 'src/matrix/agents.schema.json')), true);
});

test('baseline calibration plans use the matrix transcript CLI without starting it', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-calibrate-wire-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [CLI, ...COMMANDS[1]!, '--agent', 'codex', '--input', 'workspace', '--trials', '2', '--max-calls', '10', '--dry-run'], { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /calibration executor: codex: codex exec --json/);
  assert.equal(existsSync(join(cwd, 'runs')), false);
});

test('CLI wires the previous Skill into an installed dry-run and rejects single-arm comparison', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-revision-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const current = join(cwd, 'new');
  const previous = join(cwd, 'old');
  for (const dir of [current, previous]) cpSync(join(PACKAGE_ROOT, 'skills', 'skillfit'), dir, { recursive: true });
  writeFileSync(join(previous, 'SKILL.md'), readFileSync(join(previous, 'SKILL.md'), 'utf8') + '\nPrevious-version fixture.\n');
  const args = ['eval', current, '--baseline-skill', previous, '--bench', join(PACKAGE_ROOT, 'benches', 'code-review'), '--agent', 'codex', '--trials', '1', '--dry-run'];
  const result = spawnSync(process.execPath, [CLI, ...args, '--mode', 'installed'], { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Baseline\s+: skillfit/);
  assert.match(result.stdout, /previous Skill in baseline vs target Skill in treatment/);
  assert.match(result.stdout, /installed in both conditions/);
  const invalid = spawnSync(process.execPath, [CLI, ...args, '--mode', 'trigger'], { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /requires --mode installed/);
  const unrelated = spawnSync(process.execPath, [CLI, 'doctor', '--baseline-skill', previous], { cwd, encoding: 'utf8' });
  assert.equal(unrelated.status, 1);
  assert.match(unrelated.stderr, /applies only to eval/);
  assert.equal(unrelated.stdout, '');
  assert.equal(existsSync(join(cwd, 'runs')), false);
});

test('ordinary JSON/human and Agent request previews expose the same effective installed no-Skill plan', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-shared-plan-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const skill = join(cwd, 'candidate'); cpSync(join(PACKAGE_ROOT, 'skills/skillfit'), skill, { recursive: true });
  const bench = join(PACKAGE_ROOT, 'benches/code-review'), task = JSON.parse(readFileSync(join(bench, 'bench.json'), 'utf8')).tasks[0].id;
  const limits = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
  const budget = join(cwd, 'budget.json'), request = join(cwd, 'request.json'); writeFileSync(budget, JSON.stringify(limits));
  writeFileSync(request, JSON.stringify({ schemaVersion: 1, baselineSkill: null, candidateSkill: skill, bench, taskIds: [task], agent: 'codex',
    purpose: 'development', trials: 1, maxCalls: 2, pairOrder: 'balanced', executorTimeoutSeconds: 17, spendingBudget: limits,
    runsRoot: join(cwd, 'runs'), runGroup: 'shared' }));
  const args = ['eval', skill, '--mode', 'installed', '--bench', bench, '--task', task, '--agent', 'codex', '--trials', '1', '--max-calls', '2',
    '--pair-order', 'balanced', '--executor-timeout-seconds', '17', '--spending-budget', budget, '--runs-root', join(cwd, 'runs'), '--run-group', 'shared', '--dry-run'];
  const env = { ...process.env, SKILLFIT_JUDGE: '0' };
  const ordinary = spawnSync(process.execPath, [CLI, ...args, '--json'], { cwd, env, encoding: 'utf8', timeout: 30_000 });
  const agent = spawnSync(process.execPath, [CLI, 'eval', '--request', request, '--dry-run'], { cwd, env, encoding: 'utf8', timeout: 30_000 });
  const human = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: 'utf8', timeout: 30_000 });
  for (const result of [ordinary, agent, human]) assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(ordinary.stdout).plan, agentPlan = JSON.parse(agent.stdout).plan;
  assert.deepEqual(plan.evaluation, agentPlan.evaluation); assert.equal(plan.evaluation.baseline, null);
  assert.deepEqual(plan.evaluation.spendingBudget, limits); assert.equal(plan.evaluation.executorTimeoutSeconds, 17);
  assert.equal(agentPlan.request.baselineSkill, null); assert.match(human.stdout, /no Skill installed by the harness/);
  assert.ok(human.stdout.includes(plan.sha256)); assert.match(human.stdout, /Agent deadline: 17s/);
  assert.equal(existsSync(join(cwd, 'runs')), false);
  for (const override of [['--executor-timeout-seconds', '18'], ['--spending-budget', budget], ['--run-group', 'other']]) {
    const bad = spawnSync(process.execPath, [CLI, 'eval', '--request', request, '--dry-run', ...override], { cwd, env, encoding: 'utf8' });
    assert.equal(bad.status, 2); assert.match(JSON.parse(bad.stdout).error.message, /cannot be combined/);
  }
});

test('positional JSON eval rejects unconfirmed execution and invalid new controls without writes or calls', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-new-controls-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  // No target or executor is supplied: even a broken guard cannot dispatch a real model.
  for (const args of [['eval', '--json'], ['eval', '--json', '--plan-sha', 'a'.repeat(64)]]) {
    const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 2); const error = JSON.parse(result.stdout); assert.equal(error.kind, 'skillfit.eval-error');
    assert.match(error.error.message, /plan-sha|run-group/); assert.equal(error.acceptance.eligibleForUpgrade, false);
  }
  for (const value of ['0', '3601', '1.5', 'NaN', '2junk']) {
    const result = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--agent', 'codex', '--dry-run', '--json', '--executor-timeout-seconds', value], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(JSON.parse(result.stdout).error.message, /executorTimeoutSeconds/);
  }
  const file = join(cwd, 'budget.json'); writeFileSync(file, JSON.stringify({ input: 10 }));
  const invalid = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--dry-run', '--json', '--spending-budget', file], { cwd, encoding: 'utf8' });
  assert.equal(invalid.status, 2); assert.match(JSON.parse(invalid.stdout).error.message, /spendingBudget/);
  const unrelated = spawnSync(process.execPath, [CLI, 'doctor', '--executor-timeout-seconds', '17'], { cwd, encoding: 'utf8' });
  assert.equal(unrelated.status, 1); assert.match(unrelated.stderr, /apply only to eval/);
  for (const args of [['eval'], [...COMMANDS[0]!, '--mode', 'invalid'], [...COMMANDS[0]!, '--runs-root', '']]) {
    const invalid = spawnSync(process.execPath, [CLI, ...args, '--json', '--dry-run'], { cwd, encoding: 'utf8' });
    assert.equal(invalid.status, 2); assert.equal(JSON.parse(invalid.stdout).kind, 'skillfit.eval-error');
  }
  assert.equal(existsSync(join(cwd, 'runs')), false);
});

test('ordinary API previews bind explicit deadlines while unsupported trigger plans and budgets fail offline', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-cli-api-plan-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, SKILLFIT_API_KEY: 'synthetic-dry-run-only', SKILLFIT_API_BASE_URL: 'https://offline.invalid/v1', SKILLFIT_JUDGE: '0' };
  const api = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--dry-run', '--json', '--executor-timeout-seconds', '9'], { cwd, env, encoding: 'utf8' });
  assert.equal(api.status, 0, api.stderr); const plan = JSON.parse(api.stdout).plan.evaluation;
  assert.equal(plan.executor.kind, 'api'); assert.equal(plan.executorTimeoutSeconds, 9);
  const defaults = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--dry-run', '--json'], { cwd, env, encoding: 'utf8' });
  assert.equal(defaults.status, 0, defaults.stderr); assert.equal(JSON.parse(defaults.stdout).plan.evaluation.executorTimeoutSeconds, 120);
  const trigger = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--agent', 'codex', '--mode', 'trigger', '--dry-run', '--json'], { cwd, env, encoding: 'utf8' });
  assert.equal(trigger.status, 2); assert.match(JSON.parse(trigger.stdout).error.message, /require a paired evaluation/);
  const file = join(cwd, 'budget.json'); writeFileSync(file, JSON.stringify({ input: 100, cachedInput: 100, uncachedInput: 100, output: 100, durationSeconds: 100 }));
  for (const flags of [['--mode', 'trigger', '--agent', 'codex'], ['--judge-agent', 'codex', '--agent', 'codex']]) {
    const result = spawnSync(process.execPath, [CLI, ...COMMANDS[0]!, '--dry-run', '--json', '--spending-budget', file, ...flags], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(JSON.parse(result.stdout).error.message, /paired evaluation|without a judge/);
  }
  assert.equal(existsSync(join(cwd, 'runs')), false);
});
