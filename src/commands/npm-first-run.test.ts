import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';

const pkg = fileURLToPath(new URL('../..', import.meta.url)), cli = join(pkg, 'dist/cli.js');
function setup(t: TestContext) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'skillfit-first-run-'))); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const skill = join(cwd, 'my-skill'); mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: npm-first-run-offline\ndescription: Offline first-run regression.\n---\nInspect files.\n');
  const invoke = (args: string[], expected = 0, pure = false) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 30_000,
      env: pure ? { PATH: '' } : { ...process.env, SKILLFIT_JUDGE: '0' } });
    assert.equal(result.status, expected, result.stderr || result.stdout);
    return result;
  };
  return { cwd, skill, invoke };
}

test('installed-CLI onboarding works from an empty project without a source checkout or agent', t => {
  const f = setup(t);
  f.invoke(['bench', 'init', 'my-bench', '--kind', 'command', '--dry-run']);
  assert.equal(existsSync(join(f.cwd, 'my-bench')), false);
  f.invoke(['bench', 'init', 'my-bench', '--kind', 'command', '--yes']);
  const checked = JSON.parse(f.invoke(['bench', 'check', './my-bench', '--json']).stdout);
  assert.equal(checked.status, 'passed'); assert.equal(checked.summary.failures, 0);
  const result = JSON.parse(f.invoke(['eval', f.skill, '--bench', './my-bench', '--mode', 'installed', '--agent', 'codex',
    '--trials', '1', '--max-calls', '2', '--runs-root', './runs', '--run-group', 'first-eval', '--json', '--dry-run'], 0, true).stdout);
  assert.equal(result.status, 'planned'); assert.equal(result.plan.evaluation.plannedCalls, 2);
  assert.equal(result.plan.evaluation.agentPreflight.status, 'blocked'); assert.equal(result.acceptance.eligibleForUpgrade, false);
  assert.equal(existsSync(join(f.cwd, 'runs')), false);
});

test('bundled names work in read-only commands and calibration preview without mutating the package', t => {
  const f = setup(t), manifest = join(pkg, 'benches/code-review/bench.json'), original = readFileSync(manifest, 'utf8');
  const checked = JSON.parse(f.invoke(['bench', 'check', 'code-review', '--json']).stdout);
  assert.equal(checked.status, 'passed'); assert.equal(checked.bench.taskCount, 5);
  const listed = JSON.parse(f.invoke(['bench', 'list', 'code-review', '--json'], 0, true).stdout);
  const shown = JSON.parse(f.invoke(['bench', 'show', 'code-review', 'review-r1', '--json'], 0, true).stdout);
  assert.equal(listed.tasks.length, 5); assert.equal(shown.tasks[0].id, 'review-r1');
  const preview = JSON.parse(f.invoke(['eval', f.skill, '--bench', 'code-review', '--agent', 'codex', '--trials', '1', '--json', '--dry-run'], 0, true).stdout);
  assert.equal(preview.plan.evaluation.bench.sha256, checked.bench.sha256);
  const calibration = JSON.parse(f.invoke(['bench', 'check', 'code-review', '--calibrate', '--agent', 'codex', '--trials', '1',
    '--runs-root', './runs', '--run-group', 'calibration', '--json', '--dry-run'], 0, true).stdout);
  assert.equal(calibration.plan.bench.sha256, checked.bench.sha256);
  assert.equal(calibration.plan.plannedCalls, 5);
  const edit = f.invoke(['bench', 'edit', 'code-review', 'review-r1', '--set', 'shouldTrigger=false', '--yes', '--json'], 2, true);
  assert.equal(JSON.parse(edit.stdout).kind, 'skillfit.bench-error');
  assert.equal(readFileSync(manifest, 'utf8'), original); assert.equal(existsSync(join(f.cwd, 'runs')), false);
});

test('local names take precedence and broken local inputs cannot fall back to bundled cases', t => {
  const f = setup(t);
  f.invoke(['bench', 'init', 'code-review', '--kind', 'command', '--yes']);
  const local = JSON.parse(f.invoke(['bench', 'check', 'code-review', '--json']).stdout);
  assert.equal(local.status, 'passed'); assert.equal(local.bench.taskCount, 1);
  assert.equal(local.dir, join(f.cwd, 'code-review'));
  writeFileSync(join(f.cwd, 'code-review/bench.json'), '{invalid local data');
  const failed = JSON.parse(f.invoke(['bench', 'check', 'code-review', '--json'], 1).stdout);
  assert.equal(failed.status, 'failed'); assert.equal(failed.dir, join(f.cwd, 'code-review'));
  assert.match(failed.checks[0].message, /Invalid bench.json/);
  mkdirSync(join(f.cwd, 'debugging'));
  const missing = JSON.parse(f.invoke(['bench', 'check', 'debugging', '--json'], 1).stdout);
  assert.match(missing.checks[0].message, /missing bench.json/);
});
