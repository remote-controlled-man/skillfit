import { ExecutorFailure, type Executor } from '../agents/contracts.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents/matrix.js';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CliExecutor } from "../agents/adapters/cli.js";
import { AgentPreflightFailed } from "../agents/preflight.js";
import { runBenchInit, runBenchCalibration, prepareBenchCalibration } from "./bench.js";
import { runEvalCli } from "./eval-cli.js";
import { runEval, type EvalOptions } from "./eval.js";

async function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-cli-cost-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = join(root, 'skill'), bench = join(root, 'bench'), home = join(root, 'home'), bin = join(root, 'bin');
  for (const path of [skill, home, bin]) mkdirSync(path);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: ordinary-cost\ndescription: Offline cost regression.\n---\nAnswer correctly.\n');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  const limits = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
  const base: EvalOptions = { skillPath: skill, bench, agent: 'codex', trials: 1, maxCalls: 4, dryRun: false, yes: true,
    runsRoot: join(root, 'runs'), runGroup: 'ordinary', spendingBudget: limits, log: () => {},
    sessionOptions: { homeDir: home, env: { PATH: bin }, versionProbe: () => { throw new Error('No real CLI probe allowed.'); } } };
  return { root, skill, bench, home, bin, base, limits };
}

for (const tokenOnly of [false, true]) test(`ordinary paired CLI and judge retain full costs (${tokenOnly ? 'Token-only' : 'legacy budget'})`, async t => {
  const f = await setup(t);
  function executor(name: string, answer: string, input: number, cached: number, output: number) {
    const script = join(f.root, name + '.cjs');
    writeFileSync(script, `process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:${JSON.stringify(answer)}}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:${input},cached_input_tokens:${cached},output_tokens:${output}}}));});`);
    return new CliExecutor({ argv: [process.execPath, script], shell: false, streamJson: true,
      ...(tokenOnly ? { timeoutMs: null, wireShape: 'codex-items', partialUsageFromSessionLog: true, sessions: getAgent('codex').sessions, homeDir: f.home } : {}) });
  }
  const primary = executor('primary', 'skillfit-ok', 10, 4, 2);
  const judge = executor('judge', '{"A":{"correct":true,"complete":true,"grounded":true},"B":{"correct":true,"complete":true,"grounded":true}}', 5, 2, 1);
  const base = { ...f.base, executor: primary, judgeExecutor: judge,
    ...(tokenOnly ? { executorTimeoutSeconds: null, spendingBudget: { ...f.limits, durationSeconds: null } } : {}),
    sessionOptions: { ...f.base.sessionOptions, versionProbe: () => 'synthetic offline CLI' } };
  const preview = await runEvalCli({ ...base, dryRun: true });
  const result = await runEvalCli(base, preview.plan.sha256);
  assert.equal(result.status, 'completed', 'executionError' in result ? String(result.executionError) : '');
  assert.ok('invocationCosts' in result); assert.equal(result.evidence.verified, true);
  assert.equal(result.invocationCosts?.agent?.runs, 2); assert.equal(result.invocationCosts?.judge?.runs, 2);
  assert.equal(result.invocationCosts?.total?.metrics.input.knownTotal, 30);
  assert.equal(result.invocationCosts?.total?.metrics.cachedInput.knownTotal, 12);
  assert.equal(result.invocationCosts?.total?.metrics.output.knownTotal, 6);
  assert.equal(result.invocationCosts?.total?.metrics.input.coverage.final, 4);
  const receipt = JSON.parse(readFileSync(join(f.base.runsRoot!, 'ordinary/example-task/baseline/trial-1/_result.json'), 'utf8'));
  assert.equal(readFileSync(join(f.base.runsRoot!, 'ordinary/example-task/baseline/trial-1/_output.md'), 'utf8'), 'skillfit-ok');
  assert.equal(receipt.skillTriggered, undefined);
  assert.deepEqual(receipt.tokens, { input: 10, cachedInput: 4, output: 2 });
  assert.match(readFileSync(join(f.base.runsRoot!, 'ordinary/example-task/baseline/trial-1/_transcript.jsonl'), 'utf8'), /turn.completed/);
  assert.equal(result.acceptance.eligibleForUpgrade, false);
});

test('known missing CLI counters block primary, judge and calibration before probes or spending', async t => {
  const f = await setup(t), sentinel = join(f.root, 'must-not-run');
  writeFileSync(join(f.bench, 'tasks/example-task/verify.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'called');process.exit(1);`);
  for (const name of ['claude', 'codex']) {
    const executable = join(f.bin, name + (process.platform === 'win32' ? '.CMD' : ''));
    writeFileSync(executable, 'A synthetic availability marker, never executed.'); chmodSync(executable, 0o755);
  }
  const primary = { ...f.base, agent: 'claude-code', judgeExecutor: null };
  const preview = await runEvalCli({ ...primary, dryRun: true });
  assert.equal(preview.plan.evaluation.agentPreflight.status, 'blocked');
  assert.equal(preview.plan.evaluation.agentPreflight.checks.find(c => c.code === 'CLI_AVAILABLE')!.status, 'PASS');
  await assert.rejects(runEval(primary), AgentPreflightFailed);
  await assert.rejects(runEval({ ...f.base, judgeAgent: 'claude-code' }), AgentPreflightFailed);
  const calibrate = { agent: 'claude-code', trials: 1, spendingBudget: f.limits, runsRoot: f.base.runsRoot,
    runGroup: 'calibration', sessionOptions: f.base.sessionOptions };
  const calibration = prepareBenchCalibration({ dir: f.bench, calibrate });
  assert.equal(calibration.agentPreflight.checks.find(c => c.code === 'USAGE_CAPABILITY')!.status, 'FAIL');
  await assert.rejects(runBenchCalibration({ dir: f.bench, calibrate, log: () => {} }), AgentPreflightFailed);
  assert.equal(existsSync(sentinel), false); assert.equal(existsSync(f.base.runsRoot!), false);
});


test('ordinary CLI previews explicit none with Token-only limits without invoking an Agent', async t => {
  const f = await setup(t), budget = join(f.root, 'budget.json');
  writeFileSync(budget, JSON.stringify({ ...f.limits, durationSeconds: null }));
  const fake = join(f.bin, process.platform === 'win32' ? 'codex.cmd' : 'codex');
  writeFileSync(fake, process.platform === 'win32' ? '@echo off\r\nexit /b 91\r\n' : '#!/bin/sh\nexit 91\n', { mode: 0o755 });
  const args = [fileURLToPath(new URL('./main.js', import.meta.url)), 'eval', f.skill, '--bench', f.bench,
    '--agent', 'codex', '--mode', 'installed', '--trials', '1', '--max-calls', '4', '--executor-timeout-seconds', 'none',
    '--spending-budget', budget, '--runs-root', join(f.root, 'runs'), '--run-group', 'cli-none', '--json', '--dry-run'];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000,
    env: { ...process.env, HOME: f.home, USERPROFILE: f.home, CODEX_HOME: join(f.home, '.codex'), PATH: f.bin + delimiter + dirname(process.execPath) } });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.plan.evaluation.executorTimeoutSeconds, null);
  assert.equal(data.plan.evaluation.spendingBudget.durationSeconds, null);
  assert.equal(data.plan.evaluation.agentPreflight.status, 'ready');
  assert.equal(existsSync(join(f.root, 'runs')), false);
});


test('a live judge budget stop retains its partial call and cannot dispatch reverse judging', async t => {
  const f = await setup(t); let primaryCalls = 0, judgeCalls = 0;
  const primary: Executor = { supportsLiveTokenBudget: true, describe: () => ({ kind: 'mock', model: 'offline-primary' }),
    run: async () => { primaryCalls++; return { output: 'skillfit-ok', tokens: { input: 10, cachedInput: 4, output: 2 } }; } };
  const judge: Executor = { supportsLiveTokenBudget: true, describe: () => ({ kind: 'mock', model: 'offline-judge' }),
    run: async (_prompt, _dir, options) => {
      judgeCalls++; assert.equal(options?.tokenBudget?.input, 5);
      throw new ExecutorFailure('SPENDING_BUDGET_REACHED: offline judge stop', { output: 'partial',
        tokens: { input: 5, cachedInput: 2, output: 1 }, usageStatus: 'partial', budgetStop: 'SPENDING_BUDGET_REACHED' });
    } };
  const base = { ...f.base, executor: primary, judgeExecutor: judge, executorTimeoutSeconds: null,
    spendingBudget: { ...f.limits, input: 25, durationSeconds: null },
    sessionOptions: { ...f.base.sessionOptions, versionProbe: () => 'offline fixture' } };
  const preview = await runEvalCli({ ...base, dryRun: true });
  const result = await runEvalCli(base, preview.plan.sha256);
  assert.equal(result.status, 'stopped'); assert.equal(primaryCalls, 2); assert.equal(judgeCalls, 1);
  const run = join(f.base.runsRoot!, 'ordinary'), call = JSON.parse(readFileSync(join(run, 'example-task/judge-trial-1/call-1.json'), 'utf8'));
  assert.equal(call.budgetStop, 'SPENDING_BUDGET_REACHED'); assert.equal(call.usageStatus, 'partial');
  assert.equal(existsSync(join(run, 'example-task/judge-trial-1/call-2.json')), false);
  const session = JSON.parse(readFileSync(join(run, '_session.json'), 'utf8'));
  assert.equal(session.stopCode, 'SPENDING_BUDGET_REACHED');
  assert.equal(result.acceptance.eligibleForUpgrade, false);
});
