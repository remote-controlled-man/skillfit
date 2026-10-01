import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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
