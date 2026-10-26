import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { prepareBenchSelfTest, runBenchSelfTest, selfTestError, selfTestExitCode } from "./self-test.js";
import { loadBenchControls, selectControlSuites } from "../../bench/controls.js";
import { loadBench } from "../../bench/read.js";
import { sha256File } from "../../shared/hash.js";
import { readEvaluationReport } from "../../cli/evaluation-report.js";
import { exportEvaluation } from "./export.js";
import { ApiExecutor } from "../../agents/adapters/api.js";
import { CliExecutor } from "../../agents/adapters/cli.js";

const rootDir = fileURLToPath(new URL("../../../", import.meta.url));
const cliPath = join(rootDir, 'dist/cli.js');
const sample = join(rootDir, 'benches/_self-test/example');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-self-test-')), bench = join(root, 'bench'), runsRoot = join(root, 'runs');
  cpSync(sample, bench, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const options = { dir: bench, runsRoot, runGroup: 'check', yes: true };
  const rewrite = (edit: (data: any) => void) => { const value = json(join(bench, 'controls.json')); edit(value); writeFileSync(join(bench, 'controls.json'), JSON.stringify(value)); };
  const cli = (args: string[]) => spawnSync(process.execPath, [cliPath, 'bench', 'self-test', bench, '--runs-root', runsRoot, '--run-group', 'check', ...args], {
    encoding: 'utf8', timeout: 30_000, env: { ...process.env, HOME: root, USERPROFILE: root, SKILLFIT_JUDGE: '1',
      SKILLFIT_API_KEY: 'offline-must-not-be-used', SKILLFIT_API_BASE_URL: 'http://127.0.0.1:1' },
  });
  return { root, bench, runsRoot, options, rewrite, cli };
}

test('preview is pure, pins controls/resources and implementation, and drift cannot create outputs', async t => {
  const f = fixture(t), marker = join(f.root, 'must-not-execute');
  writeFileSync(join(f.bench, 'verifiers/output.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'unexpected');process.exit(1);`);
  const preview = await runBenchSelfTest({ ...f.options, dryRun: true });
  assert.equal(preview.status, 'planned'); assert.equal(preview.simulatedExecutorInvocations, 0);
  assert.equal(preview.harnessModelCalls, 0); assert.equal(existsSync(marker), false); assert.equal(existsSync(f.runsRoot), false);
  assert.ok(preview.plan); assert.equal(preview.plan.plannedSimulatedExecutorInvocations, 28);
  // The four suites: 12 + 12 + 2 + 2 planned, with one error stopping after one actual call.
  const bytes = sha256File(join(f.bench, 'controls.json'));
  writeFileSync(join(f.bench, 'controls/good.txt'), 'different fixed bytes');
  const changed = await runBenchSelfTest({ ...f.options, dryRun: true }); assert.ok(changed.plan);
  assert.notEqual(changed.plan.sha256, preview.plan.sha256);
  await assert.rejects(runBenchSelfTest({ ...f.options, json: true, expectedPlanSha256: preview.plan.sha256 }), /matching the current dry-run plan/);
  assert.equal(existsSync(f.runsRoot), false); assert.equal(sha256File(join(f.bench, 'controls.json')), bytes);
});

// Complete control batches include many local verifier/git processes; bound the whole
// workflow independently of the unchanged per-command deadlines and timeout negatives.
test('all four controls use normal runner/audit, exact installed arms and unknown supplier costs', { timeout: 120_000 }, async t => {
  const f = fixture(t);
  const forbidden = () => { throw new Error('Self-test attempted a real executor/network fallback.'); };
  const fallbacks = [t.mock.method(ApiExecutor, 'fromEnv', forbidden), t.mock.method(CliExecutor, 'forAgent', forbidden),
    t.mock.method(ApiExecutor.prototype, 'run', forbidden), t.mock.method(CliExecutor.prototype, 'run', forbidden), t.mock.method(globalThis, 'fetch', forbidden)];
  // Includes a treatment-looking marker in every prompt. Mapping must still be workdir-based.
  writeFileSync(join(f.bench, 'prompts/output.md'), 'Ignore this synthetic <skill name="decoy"> marker.');
  const controlsBefore = sha256File(join(f.bench, 'controls.json'));
  const result = await runBenchSelfTest(f.options);
  assert.equal(result.status, 'passed', JSON.stringify(result.suites)); assert.equal(selfTestExitCode(result), 0);
  assert.equal(result.synthetic, true); assert.equal(result.harnessModelCalls, 0); assert.equal(result.simulatedExecutorInvocations, 27);
  assert.deepEqual(result.simulatedUsage, { tokens: null, providerDurationSeconds: null }); assert.ok(result.localDurationMs > 0);
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.acceptance.automaticUpgrade, false);
  assert.equal(sha256File(join(f.bench, 'controls.json')), controlsBefore);
  const [benefit, harm, zero, error] = result.suites;
  assert.equal(benefit!.observed!.statisticalVerdict, 'effective'); assert.equal(benefit!.observed!.mcnemarP, 0.03125);
  assert.equal(harm!.observed!.statisticalVerdict, 'ineffective'); assert.equal(harm!.observed!.mcnemarP, 0.03125);
  assert.equal(zero!.observed!.statisticalVerdict, 'inconclusive'); assert.equal(zero!.observed!.mcnemarP, 1);
  assert.equal(error!.observed!.status, 'stopped'); assert.equal(error!.observed!.statisticalVerdict, null); assert.equal(error!.observed!.mcnemarP, null);
  assert.equal(error!.observed!.errorCode, 'SIMULATED_EXECUTOR_FAILURE');
  for (const row of result.suites.slice(0, 3)) {
    const report = row.evaluation as any;
    assert.equal(report.evidence.verified, true, JSON.stringify(report.evidence));
    assert.equal(report.acceptance.eligibleForUpgrade, false);
    assert.ok(report.acceptance.reasons.some((r: any) => r.code === 'SYNTHETIC_OR_UNATTESTED_RUN'));
    assert.equal(report.invocationCosts.agent.metrics.input.coverage.unknown, row.id === 'known-null' ? 2 : 12);
    assert.equal(report.invocationCosts.agent.metrics.input.knownTotal, 0);
    assert.equal(report.costs.changes.attempts.input.exact, false);
    assert.equal(report.costs.changes.attempts.input.totalChangeFraction, null);
    assert.equal(report.costs.changes.attempts.input.perSuccess.knownLowerBound, true);
    assert.equal(json(join(row.runDir, 'manifest.json')).executor.kind, 'mock');
    assert.equal(json(join(row.runDir, '_plan.json')).injectedExecutor, true);
  }
  const installed = 'command/treatment/trial-1/.agents/skills/skillfit-synthetic-control/SKILL.md';
  assert.equal(existsSync(join(benefit!.runDir, installed)), true);
  assert.equal(existsSync(join(benefit!.runDir, installed.replace('/treatment/', '/baseline/'))), false);
  assert.equal(existsSync(join(error!.runDir, 'manifest.json')), false);
  assert.equal(existsSync(join(error!.runDir, 'output/treatment')), false, 'stopped prefix must not manufacture partner receipts');
  assert.equal(json(join(error!.runDir, '_session.json')).callsStarted, 1);
  assert.equal(json(join(error!.runDir, 'output/baseline/trial-1/_result.json')).tokens, null);
  assert.equal(json(join(f.runsRoot, 'check/_self-test.json')).status, 'passed');
  assert.ok(fallbacks.every(f => f.mock.callCount() === 0), 'no live executor or network route may be entered');
});

test('controls reject malformed versions, fields, selections, actions and resources before run creation', async t => {
  const cases: [string, (v: any) => void][] = [
    ['version', v => v.schemaVersion = 99], ['unknown field', v => v.extra = true],
    ['duplicate suite', v => v.suites.push(v.suites[0])], ['unknown purpose', v => v.suites[0].purpose = 'automatic-benefit'],
    ['nonstring purpose', v => v.suites[0].purpose = ['benefit']], ['nonstring verdict', v => v.suites[0].expected.statisticalVerdict = ['effective']],
    ['trigger unsupported', v => v.suites[0].mode = 'trigger'], ['unknown agent', v => v.suites[0].agent = 'invented'],
    ['inject agent', v => v.suites[1].agent = 'codex'], ['missing agent', v => delete v.suites[0].agent],
    ['unknown task', v => v.suites[0].taskIds = ['unknown']], ['duplicate task', v => v.suites[0].taskIds.push('command')],
    ['extra arm task', v => v.suites[0].arms.extra = v.suites[0].arms.command],
    ['missing arm', v => delete v.suites[0].arms.command.treatment],
    ['extra action field', v => v.suites[0].arms.command.baseline.extra = 1],
    ['action type', v => v.suites[0].arms.command.baseline = { kind: 'output-file', path: 'controls/good.txt' }],
    ['oracle on output', v => v.suites[1].arms.output.baseline = { kind: 'oracle' }],
    ['unknown error', v => v.suites[3].arms.output.baseline.code = 'anything'],
    ['unsafe answer', v => v.suites[1].arms.output.baseline.path = '../outside'],
    ['absolute answer', v => v.suites[1].arms.output.baseline.path = '/etc/passwd'],
    ['Git metadata', v => v.suites[1].arms.output.baseline.path = '.git/HEAD'],
    ['missing answer', v => v.suites[1].arms.output.baseline.path = 'missing.txt'],
    ['empty trials', v => v.suites[0].trials = 0], ['fractional trials', v => v.suites[0].trials = 1.5],
    ['duplicate expected task', v => v.suites[0].expected.tasks.push(v.suites[0].expected.tasks[0])],
    ['bad counts', v => v.suites[0].expected.tasks[0].treatment.passes = 7],
    ['stopped verdict', v => v.suites[3].expected.statisticalVerdict = 'effective'],
    ['stopped p', v => v.suites[3].expected.mcnemarPRange = { minInclusive: 0, maxExclusive: 0.05 }],
    ['bad p', v => v.suites[0].expected.mcnemarPRange.minInclusive = 0.1],
  ];
  for (const [name, edit] of cases) await t.test(name, async t => {
    const f = fixture(t); f.rewrite(edit);
    // Invalid unselected suites must not hide behind --suite.
    await assert.rejects(prepareBenchSelfTest({ ...f.options, suites: ['known-null'] }));
    assert.equal(existsSync(f.runsRoot), false);
  });
  await t.test('missing oracle', async t => {
    const f = fixture(t); const data = json(join(f.bench, 'bench.json')); delete data.tasks[1].oracle; writeFileSync(join(f.bench, 'bench.json'), JSON.stringify(data));
    assert.throws(() => loadBenchControls(loadBench(f.bench)), /registered oracle/);
  });
  await t.test('invalid UTF-8', async t => {
    const f = fixture(t); writeFileSync(join(f.bench, 'controls/good.txt'), Buffer.from([0xff]));
    await assert.rejects(prepareBenchSelfTest(f.options));
  });
  await t.test('resource directory', async t => {
    const f = fixture(t); f.rewrite(v => v.suites[1].arms.output.baseline.path = 'controls');
    await assert.rejects(prepareBenchSelfTest(f.options), /ordinary file/);
  });
  if (process.platform !== 'win32') await t.test('symbolic links including an unrelated bench entry', async t => {
    const f = fixture(t), outside = join(f.root, 'outside'); writeFileSync(outside, 'fixed'); symlinkSync(outside, join(f.bench, 'link'));
    await assert.rejects(prepareBenchSelfTest(f.options), /symbolic link/); assert.equal(existsSync(f.runsRoot), false);
  });
});

test('suite selection preserves file order and rejects empty, duplicate and unknown IDs', async t => {
  const f = fixture(t), suites = loadBenchControls(loadBench(f.bench)).suites;
  assert.deepEqual(selectControlSuites(suites, ['known-error', 'known-benefit']).map(s => s.id), ['known-benefit', 'known-error']);
  for (const ids of [[], ['missing'], ['known-null', 'known-null']]) assert.throws(() => selectControlSuites(suites, ids));
  const prepared = await prepareBenchSelfTest({ ...f.options, suites: ['known-null'] }); assert.equal(prepared.configured, true);
  if (prepared.configured) assert.deepEqual(prepared.plan.suites.map(s => s.taskIds), [['output']]);
});

test('all matrix installation layouts remain offline and generic failures do not invent zero calls', async t => {
  for (const agent of ['codex', 'claude-code', 'kimi-code']) await t.test(agent, async t => {
    const f = fixture(t); f.rewrite(v => { v.suites = [v.suites[2]]; v.suites[0].mode = 'installed'; v.suites[0].agent = agent; });
    const result = await runBenchSelfTest(f.options);
    assert.equal(result.status, 'passed', JSON.stringify(result.suites)); assert.equal(result.simulatedExecutorInvocations, 2);
    assert.equal(result.harnessModelCalls, 0); assert.equal(result.acceptance.eligibleForUpgrade, false);
    const plan = json(join(result.suites[0]!.runDir, '_plan.json'));
    assert.equal(plan.cliVersion, null); assert.deepEqual(plan.configurations, []); assert.deepEqual(plan.configuredSettings, {});
  });
  const error = selfTestError(new Error('I/O failure'));
  assert.equal(error.simulatedExecutorInvocations, null); assert.equal(error.localDurationMs, null);
  assert.equal(error.acceptance.eligibleForUpgrade, false);
});

test('missing controls are not-configured/exit 1 and do not change ordinary bench check gates', async t => {
  const f = fixture(t); rmSync(join(f.bench, 'controls.json'));
  const result = f.cli(['--json']); assert.equal(result.status, 1, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'not-configured');
  assert.equal(existsSync(f.runsRoot), false);
  const check = spawnSync(process.execPath, [cliPath, 'bench', 'check', f.bench, '--json'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr); assert.equal(JSON.parse(check.stdout).status, 'passed');
});

test('CLI rejects unsupported mode/config/executor knobs as one self-test JSON error', t => {
  const f = fixture(t);
  for (const args of [['--mode', 'trigger'], ['--agent', 'codex'], ['--judge-agent', 'codex'], ['--trials', '1'], ['--max-calls', '2'],
    ['--bench', f.bench], ['--input', 'workspace'], ['--spending-budget', 'no.json'], ['--executor-timeout-seconds', '1'],
    ['--pair-order', 'balanced'], ['--request', 'no.json'], ['--compete-installed'], ['--decompose'], ['--policy', 'no.json']]) {
    const r = f.cli(['--json', '--dry-run', ...args]); assert.equal(r.status, 2, args.join(' '));
    const value = JSON.parse(r.stdout); assert.equal(value.kind, 'skillfit.bench-self-test'); assert.equal(value.status, 'error'); assert.equal(value.harnessModelCalls, 0);
  }
  for (const args of [['--json=true'], ['--json', '--controls'], ['--json', '--suite', 'absent'], ['--json', '--dry-run', '--plan-sha', '']]) {
    const r = f.cli(args); assert.equal(r.status, 2); assert.equal(JSON.parse(r.stdout).kind, 'skillfit.bench-self-test');
  }
  assert.equal(existsSync(f.runsRoot), false);
});

test('JSON preview confirmation cannot be bypassed by yes; a confirmed run emits only one JSON value', t => {
  const f = fixture(t), flags = ['--json', '--suite', 'known-null'];
  const preview = f.cli([...flags, '--dry-run']); assert.equal(preview.status, 0, preview.stderr);
  const hash = JSON.parse(preview.stdout).plan.sha256;
  for (const args of [[], ['--yes'], ['--plan-sha', '0'.repeat(64)]]) {
    const bad = f.cli([...flags, ...args]); assert.equal(bad.status, 2, bad.stderr); assert.equal(JSON.parse(bad.stdout).status, 'error'); assert.equal(existsSync(f.runsRoot), false);
  }
  const noGroup = spawnSync(process.execPath, [cliPath, 'bench', 'self-test', f.bench, '--runs-root', f.runsRoot, '--json', '--suite', 'known-null', '--plan-sha', hash], { encoding: 'utf8' });
  assert.equal(noGroup.status, 2); assert.equal(JSON.parse(noGroup.stdout).status, 'error');
  const ran = f.cli([...flags, '--plan-sha', hash]); assert.equal(ran.status, 0, ran.stderr);
  assert.equal(JSON.parse(ran.stdout).status, 'passed'); assert.equal(JSON.parse(ran.stdout).simulatedExecutorInvocations, 2);
});

test('decline and confirmation-time input drift remain write-free; any output collision rejects all suites', async t => {
  const f = fixture(t);
  const declined = await runBenchSelfTest({ ...f.options, yes: false, confirm: async () => false });
  assert.equal(declined.status, 'planned'); assert.equal(existsSync(f.runsRoot), false);
  await assert.rejects(runBenchSelfTest({ ...f.options, yes: false, confirm: async () => {
    writeFileSync(join(f.bench, 'controls/bad.txt'), 'changed after review'); return true;
  } }), /plan changed/);
  assert.equal(existsSync(f.runsRoot), false);
  mkdirSync(join(f.runsRoot, 'check/known-null'), { recursive: true });
  writeFileSync(join(f.runsRoot, 'check/keep'), 'preserve');
  await assert.rejects(runBenchSelfTest(f.options), /already exists/);
  assert.equal(readFileSync(join(f.runsRoot, 'check/keep'), 'utf8'), 'preserve');
  assert.equal(existsSync(join(f.runsRoot, 'check/known-benefit')), false);
  await assert.rejects(prepareBenchSelfTest({ ...f.options, runsRoot: f.bench, runGroup: 'inside' }), /outside the bench/);
});

test('mismatched controls fail instead of INFO, retain actual effective result and stop remaining suites', async t => {
  const f = fixture(t); f.rewrite(v => v.suites[0].expected.statisticalVerdict = 'inconclusive');
  const result = await runBenchSelfTest(f.options);
  assert.equal(result.status, 'failed'); assert.equal(selfTestExitCode(result), 1); assert.equal(result.simulatedExecutorInvocations, 12);
  assert.equal(result.suites[0]!.observed!.statisticalVerdict, 'effective'); assert.equal(result.suites[0]!.status, 'failed');
  assert.ok(result.suites[0]!.reasons.length); assert.ok(result.suites.slice(1).every(s => s.status === 'not-run'));
  assert.equal(json(join(result.suites[0]!.runDir, 'manifest.json')).overall.verdict, 'effective');
});

test('unexpected oracle failure/timeout is never mistaken for the expected injected error', { timeout: 20_000 }, async t => {
  for (const failure of ['exit', 'timeout'] as const) await t.test(failure, async t => {
    const f = fixture(t), path = join(f.bench, 'ground-truth/command.mjs');
    writeFileSync(path, `import{existsSync,writeFileSync}from'node:fs';import{join}from'node:path';
if(existsSync(join(process.argv[2],'_prompt.txt'))){${failure === 'timeout' ? 'setInterval(()=>{},1000);' : "console.error('unexpected oracle failure');process.exitCode=1;"}}
else writeFileSync(join(process.argv[2],'state.txt'),'fixed\\n');`);
    const bench = json(join(f.bench, 'bench.json')); bench.tasks[1].verifierTimeoutSeconds = 1; writeFileSync(join(f.bench, 'bench.json'), JSON.stringify(bench));
    f.rewrite(v => { const s = v.suites[0]; s.expected = { status: 'stopped', statisticalVerdict: null, tasks: [{ taskId: 'command', baseline: { graded: 1, passes: 0, errors: 0 }, treatment: { graded: 0, passes: 0, errors: 1 } }] }; });
    const result = await runBenchSelfTest(f.options);
    assert.equal(result.status, 'failed', JSON.stringify(result.suites)); assert.equal(result.simulatedExecutorInvocations, 2);
    assert.equal(result.suites[0]!.observed!.status, 'stopped'); assert.equal(result.suites[0]!.observed!.errorCode, null);
    assert.match(result.suites[0]!.reasons.join(' '), /Unexpected execution errors/);
    assert.ok(result.suites.slice(1).every(s => s.status === 'not-run'));
    const receipt = json(join(result.suites[0]!.runDir, 'command/treatment/trial-1/_result.json'));
    assert.match(receipt.error, failure === 'timeout' ? /timed out/ : /oracle exited/);
    assert.equal(receipt.tokens, null); assert.equal(receipt.usageStatus, 'partial');
  });
});

test('completed and stopped controls export and replay after relocation, keeping synthetic eligibility false', { timeout: 120_000 }, async t => {
  const f = fixture(t), result = await runBenchSelfTest({ ...f.options, suites: ['known-benefit', 'known-error'] });
  assert.equal(result.status, 'passed', JSON.stringify(result.suites));
  const exports: string[] = [];
  for (const suite of result.suites) {
    const out = join(f.root, `portable-${suite.id}`); await exportEvaluation(suite.runDir, out, { yes: true, log: () => {} }); exports.push(out);
  }
  rmSync(f.bench, { recursive: true }); rmSync(f.runsRoot, { recursive: true });
  for (const out of exports) {
    const moved = `${out}-moved`; renameSync(out, moved);
    const before = json(join(moved, 'replay-package.json'));
    const replay = spawnSync(process.execPath, [join(moved, 'reproduce.mjs')], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(replay.status, 0, replay.stderr);
    const value = JSON.parse(replay.stdout); assert.equal(value.acceptance.eligibleForUpgrade, false); assert.equal(value.acceptance.automaticUpgrade, false);
    assert.equal(value.status, moved.includes('known-error') ? 'stopped' : 'completed');
    if (!moved.includes('known-error')) { assert.equal(value.evidence.verified, true); assert.equal(value.quality.statisticalVerdict, 'effective'); assert.equal(value.quality.mcnemarP, 0.03125); }
    assert.deepEqual(json(join(moved, 'replay-package.json')), before);
    const current = await readEvaluationReport(moved, { replay: true }); assert.equal(current.acceptance.eligibleForUpgrade, false);
  }
});

test('code-review controls retain the intentional summarize regression and expected inconclusive result', { timeout: 120_000 }, async t => {
  const f = fixture(t);
  const source = join(rootDir, 'benches/code-review');
  rmSync(f.bench, { recursive: true }); cpSync(source, f.bench, { recursive: true });
  const marker = sha256File(join(f.bench, 'fixtures/summarize-s1/.skillfit-mock.json'));
  const result = await runBenchSelfTest(f.options);
  assert.equal(result.status, 'passed', JSON.stringify(result.suites));
  assert.equal(result.suites[0]!.observed!.statisticalVerdict, 'inconclusive'); assert.equal(result.suites[0]!.observed!.mcnemarP, 0.625);
  const regressed = result.suites[0]!.observed!.tasks.find(t => t.taskId === 'summarize-s1')!;
  assert.equal(regressed.baseline.passes, 1); assert.equal(regressed.treatment.passes, 0);
  assert.equal(sha256File(join(f.bench, 'fixtures/summarize-s1/.skillfit-mock.json')), marker);
});
