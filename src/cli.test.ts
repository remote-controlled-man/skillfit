import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
