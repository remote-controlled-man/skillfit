import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { prepareBenchCalibration, runBenchCalibration, runBenchCheck, runBenchInit } from './bench.js';
import { CasePreflightFailed } from './eval-preflight.js';
import { AgentPreflightFailed } from '../harness/agent-preflight.js';
import type { Executor } from '../harness/types.js';
import { killTree } from '../harness/kill-tree.js';
import { evaluationSignal, withEvaluationInterrupts } from '../harness/interruption.js';
import { sha256File } from '../harness/hash.js';
import { readSingleArmReport } from './eval-single-arm-report.js';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const budget = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
const final = { output: 'skillfit-ok', tokens: { input: 10, cachedInput: 2, output: 3 } };

async function fixture(t: TestContext, kind: 'output' | 'command' = 'output') {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-calibration-guard-')), dir = join(root, 'bench');
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  await runBenchInit({ dir, kind, yes: true, log: () => {} });
  return { root, dir, runsRoot: join(root, 'runs'), runGroup: 'calibration' };
}

test('calibration refuses a solved fixture or broken oracle before any executor, version probe or native output', async t => {
  for (const gate of ['untouched', 'oracle'] as const) await t.test(gate, async t => {
    const f = await fixture(t, 'command');
    if (gate === 'untouched') writeFileSync(join(f.dir, 'verifiers/example-task.mjs'), 'process.exit(0);');
    else writeFileSync(join(f.dir, 'ground-truth/oracle-example-task.mjs'), 'process.exit(4);');
    let calls = 0, versions = 0;
    const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => { calls++; return final; } };
    const report = await runBenchCheck({ dir: f.dir, calibrate: { executor, agent: 'codex', trials: 1,
      runsRoot: f.runsRoot, runGroup: f.runGroup, sessionOptions: { homeDir: join(f.root, 'home'),
        env: { CODEX_HOME: join(f.root, 'home/codex') }, versionProbe: () => { versions++; return 'offline'; } } }, log: () => {} });
    assert.ok(report.failures > 0);
    assert.ok(report.checks.some(check => check.code === 'CALIBRATION' && check.status === 'FAIL' && /preflight blocked/.test(check.message)));
    assert.equal(calls, 0); assert.equal(versions, 0); assert.ok(!existsSync(f.runsRoot));
  });
});

test('calibration preview fingerprints settings without executing verifier/oracle and rejects a stale plan', async t => {
  const f = await fixture(t), sentinel = join(f.root, 'probe');
  writeFileSync(join(f.dir, 'verifiers/example-task.mjs'), `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'bad');process.exit(1);`);
  const options = { dir: f.dir, calibrate: { agent: 'codex', trials: 2, runsRoot: f.runsRoot, runGroup: f.runGroup,
    executorTimeoutSeconds: 17, spendingBudget: budget, sessionOptions: { homeDir: join(f.root, 'home'), env: { PATH: '' } } } };
  const plan = prepareBenchCalibration(options);
  assert.equal(plan.kind, 'skillfit.calibration-plan'); assert.equal(plan.executorTimeoutSeconds, 17);
  assert.equal(plan.plannedCalls, 2); assert.equal(plan.maxCalls, 2); assert.equal(plan.agentPreflight.status, 'blocked');
  assert.ok(plan.agentPreflight.checks.some(check => check.code === 'AUTHENTICATION' && check.status === 'UNKNOWN'));
  assert.ok(!existsSync(sentinel)); assert.ok(!existsSync(f.runsRoot));
  assert.deepEqual(prepareBenchCalibration(options), plan);
  await assert.rejects(runBenchCheck({ ...options, calibrate: { ...options.calibrate,
    executorTimeoutSeconds: 18, reviewedPlanSha256: plan.planSha256 }, log: () => {} }), /plan changed before execution/);
  assert.ok(!existsSync(sentinel));
  const lines: string[] = [];
  await runBenchCheck({ ...options, calibrate: { ...options.calibrate, dryRun: true }, log: line => lines.push(line) });
  assert.ok(!existsSync(sentinel)); assert.match(lines.join('\n'), /no verifier, oracle or agent started/);
});

test('strict calibration exposes typed Agent and case preflight failures without changing legacy bench check', async t => {
  const f = await fixture(t, 'command');
  await assert.rejects(runBenchCalibration({ dir: f.dir, calibrate: { agent: 'codex', runsRoot: f.runsRoot, runGroup: f.runGroup,
    sessionOptions: { homeDir: join(f.root, 'home'), env: { PATH: '', CODEX_HOME: join(f.root, 'home/codex') } } }, log: () => {} }),
  (error: unknown) => error instanceof AgentPreflightFailed && error.agentPreflight.status === 'blocked');
  writeFileSync(join(f.dir, 'verifiers/example-task.mjs'), 'process.exit(0);');
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => { calls++; return final; } };
  await assert.rejects(runBenchCalibration({ dir: f.dir, calibrate: { executor, runsRoot: f.runsRoot, runGroup: f.runGroup }, log: () => {} }),
  (error: unknown) => error instanceof CasePreflightFailed && error.preflight.checks.some(check => check.code === 'UNTOUCHED_FIXTURE' && check.status === 'FAIL'));
  assert.equal(calls, 0); assert.ok(!existsSync(f.runsRoot));
});

test('offline warnings and unknown winnability do not block calibration and are retained separately', async t => {
  const f = await fixture(t);
  const manifest = json(join(f.dir, 'bench.json')); delete manifest.tasks[0].oracle;
  writeFileSync(join(f.dir, 'bench.json'), JSON.stringify(manifest));
  writeFileSync(join(f.dir, 'fixtures/example-task/large.txt'), 'x'.repeat(66 * 1024));
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => { calls++; return final; } };
  const options = { dir: f.dir, calibrate: { executor, trials: 1, runsRoot: f.runsRoot, runGroup: f.runGroup, spendingBudget: budget } };
  const preview = prepareBenchCalibration(options);
  const report = await runBenchCheck({ ...options, calibrate: { ...options.calibrate, reviewedPlanSha256: preview.planSha256 }, log: () => {} });
  assert.equal(report.failures, 0); assert.equal(calls, 1);
  const details = json(join(f.runsRoot, f.runGroup, '_plan.json')).details;
  assert.equal(details.reviewedPlan.planSha256, preview.planSha256);
  assert.equal(details.casePreflight.status, 'ready');
  assert.ok(details.casePreflight.checks.some((check: { code: string; status: string }) => check.code === 'ORACLE' && check.status === 'UNKNOWN'));
  assert.ok(details.casePreflight.checks.some((check: { code: string; status: string }) => check.code === 'FIXTURE_SIZE' && check.status === 'WARN'));
  assert.ok(details.agentPreflight.checks.some((check: { code: string; status: string }) => check.code === 'AUTHENTICATION' && check.status === 'UNKNOWN'));
  const result = json(join(f.runsRoot, f.runGroup, '_calibration.json'));
  assert.equal(result.experiment.status, 'completed'); assert.equal(result.costs.attempts.baseline.metrics.input.knownTotal, 10);
});

test('calibration rechecks environment and bench changes introduced by offline probes before first dispatch', async t => {
  for (const change of ['environment', 'bench'] as const) await t.test(change, async t => {
    const f = await fixture(t), home = join(f.root, 'home'), codex = join(home, 'codex');
    const path = join(f.dir, 'verifiers/example-task.mjs'), source = readFileSync(path, 'utf8');
    const mutation = change === 'environment'
      ? `mkdirSync(${JSON.stringify(join(codex, 'skills/calibration-none'))},{recursive:true});writeFileSync(${JSON.stringify(join(codex, 'skills/calibration-none/SKILL.md'))},'---\\nname: calibration-none\\n---\\nbody');`
      : `writeFileSync(${JSON.stringify(join(f.dir, 'prompts/example-task.md'))},'changed');`;
    writeFileSync(path, `import{mkdirSync,writeFileSync}from'node:fs';${mutation}\n${source}`);
    let calls = 0;
    const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => { calls++; return final; } };
    const options = { dir: f.dir, calibrate: { agent: 'codex', executor, trials: 1, runsRoot: f.runsRoot,
      runGroup: f.runGroup, sessionOptions: { homeDir: home, env: { CODEX_HOME: codex } } }, log: () => {} };
    if (change === 'environment') await assert.rejects(runBenchCheck(options), /Baseline contamination|environment preflight blocked/);
    else assert.ok((await runBenchCheck(options)).failures > 0);
    assert.equal(calls, 0); assert.ok(!existsSync(f.runsRoot));
  });
});

test('calibration budgets stop at the next boundary and retain stopped receipts without retries', async t => {
  for (const usage of ['reached', 'missing', 'error'] as const) await t.test(usage, async t => {
    const f = await fixture(t);
    const manifest = json(join(f.dir, 'bench.json'));
    manifest.tasks.push({ ...manifest.tasks[0], id: 'later-task' });
    writeFileSync(join(f.dir, 'bench.json'), JSON.stringify(manifest));
    let calls = 0;
    const executor: Executor = { describe: () => ({ kind: 'cli', model: 'offline' }), run: async () => {
      calls++;
      if (usage === 'error') throw new Error('offline executor failure');
      return usage === 'missing' ? { output: final.output } : final;
    } };
    await assert.rejects(runBenchCheck({ dir: f.dir, calibrate: { executor, trials: 3,
      spendingBudget: { ...budget, input: usage === 'reached' ? 10 : 1000 }, runsRoot: f.runsRoot, runGroup: f.runGroup }, log: () => {} }),
    usage === 'reached' ? /SPENDING_BUDGET_REACHED/ : usage === 'missing' ? /FINAL_USAGE_MISSING/ : /EXECUTION_FAILED/);
    assert.equal(calls, 1);
    const group = join(f.runsRoot, f.runGroup), session = json(join(group, '_session.json'));
    assert.equal(session.status, 'stopped'); assert.equal(session.callsStarted, 1);
    const result = json(join(group, '_calibration.json'));
    assert.equal(result.experiment.status, 'stopped');
    assert.deepEqual(result.tasks[1], { id: 'later-task', passes: 0, completed: 0, errors: 0 });
    const report = readSingleArmReport(group);
    assert.ok(report); assert.equal(report.status, 'stopped');
    const events = readFileSync(join(group, '_budget.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(events.filter(event => event.phase === 'after-call').length, 1);
    assert.equal(events.at(-1).state.reason, usage === 'reached' ? 'SPENDING_BUDGET_REACHED' : usage === 'missing' ? 'FINAL_USAGE_MISSING' : 'EXECUTION_FAILED');
    const index = json(join(group, '_artifacts.json'));
    for (const [path, sha] of Object.entries(index.files)) assert.equal(sha256File(join(group, path)), sha, path);
  });
});

test('standalone bench check reuses an enclosing evaluation cancellation context and removes only its own handlers', async t => {
  const f = await fixture(t);
  const counts = () => [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')], initial = counts();
  await withEvaluationInterrupts(async () => {
    const signal = evaluationSignal(), before = counts();
    const result = await runBenchCheck({ dir: f.dir, log: () => assert.equal(evaluationSignal(), signal) });
    assert.equal(result.failures, 0); assert.deepEqual(counts(), before); assert.equal(evaluationSignal(), signal);
  });
  assert.deepEqual(counts(), initial); assert.equal(evaluationSignal(), undefined);
});

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && readFileSync(`/proc/${pid}/stat`, 'utf8').split(')').at(-1)!.trim().startsWith('Z')) return false;
    return true;
  } catch { return false; }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) for (const stage of ['verifier', 'oracle'] as const) {
  test(`${signal} cancels independent bench check ${stage} and its descendants and removes disposable probes`, { timeout: 30_000 }, async t => {
    const f = await fixture(t), ready = join(f.root, 'ready.json'), heartbeat = join(f.root, 'heartbeat'), leaf = join(f.root, 'leaf.mjs');
    let child: ChildProcess | undefined;
    t.after(async () => {
      if (child?.exitCode === null && child.signalCode === null) killTree(child);
      if (existsSync(ready)) for (const pid of json(ready).pids) if (running(pid)) try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
      await delay(100);
    });
    writeFileSync(leaf, `import{appendFileSync}from'node:fs';setInterval(()=>appendFileSync(${JSON.stringify(heartbeat)},'x'),30);setTimeout(()=>process.exit(),20000);`);
    const source = `import{spawn}from'node:child_process';import{existsSync,writeFileSync}from'node:fs';
const leaf=spawn(process.execPath,[${JSON.stringify(leaf)}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(heartbeat)})){clearInterval(timer);writeFileSync(${JSON.stringify(ready)},JSON.stringify({dir:process.argv[2],pids:[process.pid,leaf.pid]}));}},20);
setTimeout(()=>process.exit(),20000);`;
    writeFileSync(join(f.dir, stage === 'oracle' ? 'ground-truth/oracle-example-task.mjs' : 'verifiers/example-task.mjs'), source);
    const module = pathToFileURL(fileURLToPath(new URL('./bench.js', import.meta.url))).href;
    const harness = join(f.root, 'harness.mjs');
    writeFileSync(harness, `import{writeFileSync}from'node:fs';import{runBenchCheck}from ${JSON.stringify(module)};
const counts=()=>[process.listenerCount('SIGINT'),process.listenerCount('SIGTERM')],before=counts();
process.on('message',message=>process.emit(message.signal));
try{await runBenchCheck({dir:${JSON.stringify(f.dir)},log:()=>{}});}catch(error){writeFileSync(${JSON.stringify(join(f.root, 'error'))},error.message);}
finally{writeFileSync(${JSON.stringify(join(f.root, 'done.json'))},JSON.stringify({before,after:counts()}));process.disconnect();}`);
    child = spawn(process.execPath, [harness], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stderr = ''; child.stdout!.resume(); child.stderr!.on('data', chunk => { stderr += chunk; });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.on('exit', (code, signal) => resolve({ code, signal })));
    for (let index = 0; index < 200 && !existsSync(ready) && child.exitCode === null; index++) await delay(50);
    assert.ok(existsSync(ready), `Offline ${stage} did not start: ${stderr}`);
    if (process.platform === 'win32') child.send({ signal }); else child.kill(signal);
    let timeout: NodeJS.Timeout | undefined;
    const exit = await Promise.race([exited, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`bench check did not stop: ${stderr}`)), 8000); })]).finally(() => clearTimeout(timeout));
    assert.deepEqual(exit, { code: signal === 'SIGINT' ? 130 : 143, signal: null }, stderr);
    assert.deepEqual(json(join(f.root, 'done.json')).after, json(join(f.root, 'done.json')).before);
    assert.match(readFileSync(join(f.root, 'error'), 'utf8'), new RegExp(signal));
    assert.ok(!existsSync(json(ready).dir), 'the interrupted disposable fixture must be removed');
    for (let index = 0; index < 100 && json(ready).pids.some(running); index++) await delay(50);
    assert.ok(json(ready).pids.every((pid: number) => !running(pid)), 'both verifier/oracle and grandchild must stop');
    const before = readFileSync(heartbeat, 'utf8'); await delay(100); assert.equal(readFileSync(heartbeat, 'utf8'), before);
    assert.ok(!existsSync(f.runsRoot), 'offline interruption must not create a calibration run');
  });
}
