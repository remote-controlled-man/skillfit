import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from "./bench.js";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));
const budget = { input: 100, cachedInput: 100, uncachedInput: 100, output: 100, durationSeconds: 60 };

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-calibration-cli-')), dir = join(root, 'bench with spaces');
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  await runBenchInit({ dir, kind: 'command', yes: true, log: () => {} });
  const home = join(root, 'home'), sentinel = join(root, 'unexpected-probe'), budgetPath = join(root, 'budget.json');
  mkdirSync(home); writeFileSync(budgetPath, JSON.stringify(budget));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH')),
    PATH: '', HOME: home, USERPROFILE: home, CODEX_HOME: join(home, 'codex') };
  const manifest = JSON.parse(readFileSync(join(dir, 'bench.json'), 'utf8'));
  manifest.tasks.push({ ...manifest.tasks[0], id: 'second-task' });
  writeFileSync(join(dir, 'bench.json'), JSON.stringify(manifest));
  writeFileSync(join(dir, 'tasks/example-task/verify.mjs'),
    `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'must never run');process.exit(1);`);
  const args = ['bench', 'check', dir, '--calibrate', '--json', '--agent', 'codex', '--run-group', 'reviewed', '--runs-root', join(root, 'results')];
  const cli = (extra: string[], status: number, base = args) => {
    const result = spawnSync(process.execPath, [CLI, ...base, ...extra], { cwd: root, env, encoding: 'utf8', timeout: 20_000 });
    assert.equal(result.status, status, result.stderr || result.stdout);
    const data = JSON.parse(result.stdout);
    assert.equal(data.schemaVersion, 1);
    assert.ok(!existsSync(sentinel), 'plans and rejected executions must not run even the verifier');
    assert.ok(!existsSync(join(root, 'runs'))); assert.ok(!existsSync(join(root, 'results')));
    return { data, stderr: result.stderr };
  };
  return { root, dir, sentinel, budgetPath, args, cli, env };
}

test('public calibration JSON preview is read-only and retains blocked CLI, capabilities, unknown login and effective settings', async t => {
  const f = await fixture(t);
  const settings = ['--dry-run', '--trials', '3', '--max-calls', '3', '--task', 'second-task', '--input', 'workspace',
    '--executor-timeout-seconds', '13', '--spending-budget', f.budgetPath];
  const first = f.cli(settings, 0), plan = first.data.plan;
  assert.equal(first.stderr, ''); assert.equal(first.data.kind, 'skillfit.calibration-result'); assert.equal(first.data.status, 'planned');
  assert.equal(plan.kind, 'skillfit.calibration-plan'); assert.match(plan.planSha256, /^[0-9a-f]{64}$/);
  assert.match(plan.implementationSha256, /^[0-9a-f]{64}$/); assert.match(plan.bench.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(plan.bench.taskIds, ['second-task']); assert.equal(plan.trials, 3); assert.equal(plan.plannedCalls, 3);
  assert.equal(plan.maxCalls, 3); assert.equal(plan.executorTimeoutSeconds, 13); assert.equal(plan.inputMode, 'workspace');
  assert.deepEqual(plan.spendingBudget, budget); assert.equal(plan.outputDir, join(f.root, 'results/reviewed'));
  assert.equal(plan.casePreflight.status, 'pending'); assert.equal(plan.agentPreflight.status, 'blocked');
  assert.ok(plan.agentPreflight.checks.some((check: { code: string; status: string }) => check.code === 'CLI_AVAILABLE' && check.status === 'FAIL'));
  assert.ok(plan.agentPreflight.checks.some((check: { code: string; status: string }) => check.code === 'MATRIX_CAPABILITY' && check.status === 'PASS'));
  assert.ok(plan.agentPreflight.checks.some((check: { code: string; status: string }) => check.code === 'AUTHENTICATION' && check.status === 'UNKNOWN'));
  assert.equal(plan.agentPreflight.cost.modelCalls, 0); assert.equal(plan.agentPreflight.cost.cliInvocations, 0);
  assert.equal(first.data.acceptance.automaticUpgrade, false); assert.equal(first.data.acceptance.eligibleForUpgrade, false);
  assert.deepEqual(f.cli(settings, 0).data, first.data, 'identical effective settings yield a reproducible plan');
});

test('JSON calibration execution requires a current plan and its explicit output group before any call', async t => {
  const f = await fixture(t);
  assert.match(f.cli([], 2).data.error.message, /requires --plan-sha/);
  const withoutGroup = f.args.filter((_, index, values) => values[index - 1] !== '--run-group' && values[index] !== '--run-group');
  assert.match(f.cli(['--plan-sha', '0'.repeat(64)], 2, withoutGroup).data.error.message, /requires --run-group/);
  assert.match(f.cli(['--plan-sha', '0'.repeat(64)], 2).data.error.message, /plan changed/);
  assert.match(f.cli(['--dry-run', '--plan-sha', '0'.repeat(64)], 2).data.error.message, /non-dry-run/);
  const preview = f.cli(['--dry-run'], 0).data;
  const live = f.cli(['--plan-sha', preview.plan.planSha256], 2);
  assert.equal(live.data.kind, 'skillfit.eval-error');
  assert.equal(live.data.error.code, 'AGENT_PREFLIGHT_FAILED');
  assert.equal(live.data.agentPreflight.status, 'blocked');
  assert.match(live.data.error.message, /CLI executable is missing/);
  assert.doesNotMatch(live.data.error.message, /ENOENT|no such file or directory/i);
});

test('changing a calibration bench, spending lines, task set or executor deadline invalidates its reviewed plan', async t => {
  for (const change of ['bench', 'budget', 'tasks', 'timeout'] as const) await t.test(change, async t => {
    const f = await fixture(t), settings = ['--spending-budget', f.budgetPath];
    const preview = f.cli(['--dry-run', ...settings], 0).data;
    let altered: string[] = [];
    if (change === 'bench') writeFileSync(join(f.dir, 'tasks/example-task/prompt.md'), 'A new task.');
    if (change === 'budget') writeFileSync(f.budgetPath, JSON.stringify({ ...budget, input: 101 }));
    if (change === 'tasks') altered = ['--task', 'second-task'];
    if (change === 'timeout') altered = ['--executor-timeout-seconds', '12'];
    const live = f.cli([...settings, ...altered, '--plan-sha', preview.plan.planSha256], 2).data;
    assert.equal(live.kind, 'skillfit.eval-error'); assert.equal(live.status, 'error');
    assert.equal(live.acceptance.eligibleForUpgrade, false); assert.match(live.error.message, /plan changed/);
  });
});

test('invalid calibration task selection, budgets, timeout, output and paired-only settings fail before probes', async t => {
  const f = await fixture(t), invalidBudget = join(f.root, 'bad-budget.json');
  writeFileSync(invalidBudget, JSON.stringify({ ...budget, input: 0 }));
  const malformedBudget = join(f.root, 'malformed-budget.json'); writeFileSync(malformedBudget, '{');
  const cases: [string[], RegExp][] = [
    [['--task', 'missing'], /Unknown task/],
    [['--task', 'second-task', '--task', 'second-task'], /Duplicate task/],
    [['--max-calls', '1'], /exceeding --max-calls/],
    [['--executor-timeout-seconds', '0'], /executorTimeoutSeconds/],
    [['--executor-timeout-seconds', '3601'], /executorTimeoutSeconds/],
    [['--executor-timeout-seconds', '1.5'], /executorTimeoutSeconds/],
    [['--spending-budget', invalidBudget], /spendingBudget.input/],
    [['--spending-budget', malformedBudget], /JSON/],
    [['--pair-order', 'balanced'], /requires a paired eval/],
    [['--run-group', '../outside'], /Invalid run group/],
  ];
  for (const [extra, message] of cases) {
    const data = f.cli(['--dry-run', ...extra], 2).data;
    assert.equal(data.kind, 'skillfit.eval-error'); assert.match(data.error.message, message);
  }
});

test('ordinary offline bench JSON retains its own integrity contract while calibration JSON returns a plan', async t => {
  const f = await fixture(t);
  const ordinary = spawnSync(process.execPath, [CLI, 'bench', 'check', f.dir, '--json'],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 20_000 });
  // PATH is deliberately empty, so Node verifier commands cannot start; that is an offline
  // integrity failure, distinct from a paid calibration or a model outcome.
  assert.equal(ordinary.status, 1, ordinary.stderr || ordinary.stdout);
  assert.equal(ordinary.stderr, '');
  const data = JSON.parse(ordinary.stdout);
  assert.equal(data.kind, 'skillfit.bench-check'); assert.equal(data.scope, 'offline-integrity'); assert.equal(data.status, 'failed');
  assert.ok(data.summary.failures > 0); assert.equal(data.plan, undefined);
  assert.ok(!existsSync(f.sentinel));
  const preview = f.cli(['--dry-run'], 0).data;
  assert.equal(preview.kind, 'skillfit.calibration-result'); assert.equal(preview.status, 'planned'); assert.ok(preview.plan);
});
