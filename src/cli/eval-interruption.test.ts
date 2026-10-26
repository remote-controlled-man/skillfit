import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from "./bench.js";
import { reportEvalComponent } from "./eval-component.js";
import { exportEvaluation } from "../evaluation/application/export.js";
import { sha256File } from "../shared/hash.js";
import { killTree } from "../shared/process-tree.js";

const dist = fileURLToPath(new URL("..", import.meta.url));
const moduleUrl = (path: string) => JSON.stringify(pathToFileURL(join(dist, path)).href);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    // An orphan reaped late by a Linux container's init is dead, despite kill(pid, 0).
    if (process.platform === 'linux' && readFileSync(`/proc/${pid}/stat`, 'utf8').split(')').at(-1)!.trim().startsWith('Z')) return false;
    return true;
  } catch { return false; }
}

async function scenario(t: TestContext, mode: string, signal: 'SIGINT' | 'SIGTERM' = 'SIGINT') {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-interrupt-'));
  let child: ChildProcess | undefined;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) killTree(child);
    if (existsSync(join(root, 'ready.json'))) for (const pid of json(join(root, 'ready.json')).pids) {
      if (running(pid)) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    }
    await delay(100);
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const bench = join(root, 'bench'), skill = join(root, 'skill'), old = join(root, 'old');
  writeFileSync(join(root, 'draft-source.txt'), 'synthetic offline fixture');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  for (const [dir, version] of [[skill, 'new'], [old, 'old']]) {
    mkdirSync(dir!); writeFileSync(join(dir!, 'SKILL.md'), `---\nname: interrupt-skill\ndescription: Synthetic offline interruption test.\n---\n${version}\n`);
  }
  const raw = json(join(bench, 'bench.json')); raw.tasks[0].shouldTrigger = true;
  const leaf = join(root, 'leaf.mjs'), heartbeat = join(root, 'heartbeat'), ready = join(root, 'ready.json');
  writeFileSync(leaf, `import{appendFileSync}from'node:fs';process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>appendFileSync(${JSON.stringify(heartbeat)},'x'),30);setTimeout(()=>process.exit(),30000);`);
  const fakeSource = `import{spawn}from'node:child_process';import{existsSync,writeFileSync}from'node:fs';
process.stdin.resume();process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});
process.stdout.write(${JSON.stringify([
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'retained partial output' } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, cached_input_tokens: 7, output_tokens: 3 } }),
  ].join('\n') + '\n')});
const leaf=spawn(process.execPath,[${JSON.stringify(leaf)}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(heartbeat)})){clearInterval(timer);writeFileSync(${JSON.stringify(ready)},JSON.stringify({pids:[process.pid,leaf.pid]}));}},20);
setTimeout(()=>process.exit(),30000);`;
  const fake = join(root, 'fake.mjs'); writeFileSync(fake, fakeSource);
  if (mode === 'verifier' || mode === 'preflight') {
    writeFileSync(join(bench, 'tasks/example-task/live-block.mjs'), fakeSource);
    // Only the post-agent verifier blocks in the verifier scenario. Preflight
    // still exercises the real missing/empty/oracle gates of the starter.
    writeFileSync(join(bench, 'tasks/example-task/block.mjs'), mode === 'preflight' ? fakeSource :
      "import{existsSync}from'node:fs';import{join}from'node:path';await import(existsSync(join(process.argv[2],'_prompt.txt'))?'./live-block.mjs':'./verify.mjs');");
    raw.tasks[0].verifier = 'node tasks/example-task/block.mjs';
  }
  writeFileSync(join(bench, 'bench.json'), JSON.stringify(raw));
  const request = join(root, 'request.json');
  writeFileSync(request, JSON.stringify({ schemaVersion: 1, baselineSkill: old, candidateSkill: skill,
    bench, agent: 'codex', purpose: 'development', trials: 2, maxCalls: 4, runsRoot: join(root, 'runs'), runGroup: 'saved' }));
  const harness = join(root, 'harness.mjs');
  writeFileSync(harness, `import{writeFileSync}from'node:fs';
import{runEval}from ${moduleUrl('commands/eval.js')};
import{runBenchCheck,runBenchAdd}from ${moduleUrl('commands/bench.js')};
import{runEvalComponent}from ${moduleUrl('cli/eval-component.js')};
import{CliExecutor}from ${moduleUrl('harness/executors/cli.js')};
import{ApiExecutor}from ${moduleUrl('agents/adapters/api.js')};
const mode=${JSON.stringify(mode)}, root=${JSON.stringify(root)};
const counts=()=>[process.listenerCount('SIGINT'),process.listenerCount('SIGTERM')],before=counts();
process.on('message',message=>{process.emit(message.signal);if(message.repeat){process.emit(message.signal);process.emit('SIGTERM');}});
const fake=new CliExecutor({argv:[process.execPath,${JSON.stringify(fake)}],shell:false,triggerSkillName:'interrupt-skill',timeoutMs:20000});
let calls=0;const mock={describe:()=>({kind:'mock',model:'offline'}),run:async()=>{calls++;return{output:'offline answer',tokens:{input:20,cachedInput:5,output:4}}}};
const api=new ApiExecutor({apiKey:'offline-only',fetchImpl:async(_url,options)=>{writeFileSync(${JSON.stringify(ready)},JSON.stringify({pids:[]}));return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{writeFileSync(root+'/api-aborted','yes');reject(options.signal.reason);},{once:true}));}});
const base={skillPath:${JSON.stringify(skill)},bench:${JSON.stringify(bench)},trials:2,maxCalls:4,executor:mode==='verifier'||mode==='preflight'||mode==='judge'||mode==='between'?mock:mode==='api'?api:fake,judgeExecutor:mode==='judge'?fake:null,yes:true,dryRun:false,runsRoot:root+'/runs',runGroup:'saved',log:message=>{if(mode==='between'&&message.includes('/ treatment / trial 1'))process.emit('SIGINT');}};
try{
 if(mode==='request'){const options={executor:fake,skillInstallDir:'skills',dryRun:true};const preview=await runEvalComponent(${JSON.stringify(request)},options);const result=await runEvalComponent(${JSON.stringify(request)},{...options,dryRun:false,expectedPlanSha256:preview.plan.sha256});writeFileSync(root+'/component.json',JSON.stringify(result));}
 else if(mode==='draft')await runBenchAdd({benchDir:base.bench,sourceDir:root,include:['draft-source.txt'],task:'interrupted-draft',prompt:'Solve the task',freeze:true,decompose:true,executor:fake,yes:true,runsRoot:base.runsRoot,runGroup:base.runGroup,log:()=>{}});
 else if(mode==='calibration')await runBenchCheck({dir:base.bench,log:()=>{},calibrate:{executor:fake,trials:2,maxCalls:2,runsRoot:base.runsRoot,runGroup:base.runGroup}});
 else await runEval({...base,...(mode==='trigger'?{mode:'trigger',skillInstallDir:'skills'}:{}),...(mode==='judge'?{maxCalls:8}:{})});
}catch(error){writeFileSync(root+'/error.txt',error.message);}
finally{writeFileSync(root+'/done.json',JSON.stringify({before,after:counts(),calls,exitCode:process.exitCode}));process.disconnect();}
`);
  child = spawn(process.execPath, [harness], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = ''; child.stdout!.resume(); child.stderr!.on('data', chunk => { stderr += chunk; });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.on('exit', (code, signal) => resolve({ code, signal })));
  if (mode !== 'between') {
    for (let i = 0; i < 300 && !existsSync(ready) && child.exitCode === null; i++) await delay(50);
    assert.ok(existsSync(ready), `Fake process did not start: ${stderr}`);
    await delay(100);
    // Windows kill('SIGINT') forcibly terminates rather than delivering a console
    // control event. Emit that event in the isolated harness; taskkill /T remains real.
    if (process.platform === 'win32' || mode === 'request') child.send({ signal, repeat: mode === 'request' });
    else child.kill(signal);
  }
  let timer: NodeJS.Timeout | undefined;
  const exit = await Promise.race([closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Interrupted evaluation did not exit: ${stderr}`)), 10_000); })]).finally(() => clearTimeout(timer));
  assert.deepEqual(exit, { code: signal === 'SIGINT' ? 130 : 143, signal: null }, stderr);
  const run = join(root, 'runs/saved'), done = json(join(root, 'done.json'));
  assert.deepEqual(done.after, done.before, 'signal handlers must be removed after sealing');
  if (mode === 'preflight') {
    assert.equal(done.calls, 0); assert.ok(!existsSync(run));
    assert.match(readFileSync(join(root, 'error.txt'), 'utf8'), new RegExp(signal));
    for (let i = 0; i < 100 && json(ready).pids.some(running); i++) await delay(50);
    assert.ok(json(ready).pids.every((pid: number) => !running(pid)), 'preflight verifier and grandchild must stop');
    return { root, run, done, session: null, events: [], stderr };
  }
  if (mode === 'draft') {
    const session = json(join(run, '_summary.json'));
    assert.equal(session.status, 'stopped'); assert.equal(session.callsStarted, 1); assert.equal(session.callsFinished, 1);
    assert.equal(session.automaticRetry, false);
    for (let i = 0; i < 100 && json(ready).pids.some(running); i++) await delay(50);
    assert.ok(json(ready).pids.every((pid: number) => !running(pid)), 'drafting CLI and grandchild must stop');
    const before = readFileSync(heartbeat, 'utf8'); await delay(100); assert.equal(readFileSync(heartbeat, 'utf8'), before);
    return { root, run, done, session, events: [], stderr };
  }
  const session = json(join(run, '_session.json'));
  assert.equal(session.status, 'stopped'); assert.match(session.stopReason, new RegExp(signal));
  const interruption = json(join(run, '_interruption.json'));
  assert.equal(interruption.signal, signal); assert.equal(interruption.automaticRetry, false);
  const index = json(join(run, '_artifacts.json'));
  for (const [path, sha] of Object.entries(index.files)) assert.equal(sha256File(join(run, path)), sha, path);
  assert.ok(!existsSync(join(run, 'manifest.json')), 'an interrupted prefix must not publish a completed quality verdict');
  const events = readFileSync(join(run, '_calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.filter(event => event.event === 'started').length, mode === 'judge' ? 5 : 1, 'no automatic retry, partner or extra trial');
  if (mode !== 'between') {
    for (let i = 0; i < 100 && json(ready).pids.some(running); i++) await delay(50);
    assert.ok(json(ready).pids.every((pid: number) => !running(pid)), 'fake CLI and grandchild must both stop');
    if (existsSync(heartbeat)) { const before = readFileSync(heartbeat, 'utf8'); await delay(100); assert.equal(readFileSync(heartbeat, 'utf8'), before); }
  }
  return { root, run, done, session, events, stderr };
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`${signal} stops the CLI process tree, retains partial usage and seals stopped records`, { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'paired', signal), record = json(join(f.run, 'example-task/baseline/trial-1/_result.json'));
  assert.equal(record.executorInvoked, true); assert.equal(record.usageStatus, 'partial'); assert.equal(record.verifierExitCode, null);
  assert.deepEqual(record.tokens, { input: 12, cachedInput: 7, output: 3 });
  assert.match(readFileSync(join(f.run, 'example-task/baseline/trial-1/_output.md'), 'utf8'), /retained partial output/);
  const report = await reportEvalComponent(f.run); assert.equal(report.status, 'stopped'); assert.equal(report.acceptance.eligibleForUpgrade, false);
  assert.ok('costs' in report && 'startedAgentDispatches' in report.costs && report.costs.startedAgentDispatches === 1);
  if (signal === 'SIGINT') {
    const output = join(f.root, 'export');
    await exportEvaluation(f.run, output, { yes: true, log: () => {} });
    const replay = spawnSync(process.execPath, [join(output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(replay.status, 0, replay.stderr);
    const saved = JSON.parse(replay.stdout);
    assert.equal(saved.status, 'stopped'); assert.equal(saved.acceptance.eligibleForUpgrade, false);
    assert.deepEqual(saved.costs, report.costs, 'sealed interruption costs must reproduce unchanged');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`${signal} cancels offline preflight without dispatch or a misleading completed run`, { timeout: 30_000 }, async t => {
  await scenario(t, 'preflight', signal);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`${signal} also stops a drafting process tree and retains its partial costs`, { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'draft', signal), receipt = json(join(f.run, '_result.json'));
  assert.deepEqual(receipt.tokens, { input: 12, cachedInput: 7, output: 3 }); assert.equal(receipt.usageStatus, 'partial');
  assert.equal(f.session.costs.metrics.input.knownTotal, 12); assert.equal(f.session.costs.metrics.input.coverage.partial, 1);
  assert.ok(!existsSync(join(f.root, 'bench/tasks/interrupted-draft/verify.mjs')));
});

test('interrupting a verifier kills its tree and preserves final agent usage', { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'verifier'), record = json(join(f.run, 'example-task/baseline/trial-1/_result.json'));
  assert.deepEqual(record.tokens, { input: 20, cachedInput: 5, output: 4 }); assert.equal(record.usageStatus, 'final');
  assert.match(record.error, /SIGINT/); assert.equal(record.passed, false);
});

test('repeated interrupts keep a request stopped and never launch its partner', { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'request'), result = json(join(f.root, 'component.json'));
  assert.equal(result.status, 'stopped'); assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.acceptance.automaticUpgrade, false);
});

test('trigger and calibration evaluations also seal an interrupted prefix', { timeout: 60_000 }, async t => {
  for (const mode of ['trigger', 'calibration']) {
    const f = await scenario(t, mode);
    const arm = mode === 'trigger' ? 'installed' : 'baseline';
    const record = json(join(f.run, `example-task/${arm}/trial-1/_result.json`));
    assert.deepEqual(record.tokens, { input: 12, cachedInput: 7, output: 3 }); assert.equal(record.usageStatus, 'partial');
    assert.match(record.error, /SIGINT/);
  }
});

test('an interrupted judge keeps available output and does not run the reverse-order call', { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'judge');
  const saved = json(join(f.run, '_interrupted-judge-5.json'));
  assert.match(saved.result.output, /retained partial output/); assert.equal(saved.result.usageStatus, 'partial');
  assert.deepEqual(saved.result.tokens, { input: 12, cachedInput: 7, output: 3 });
});

test('API interruption aborts the injected fetch and leaves unavailable usage unknown', { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'api'), record = json(join(f.run, 'example-task/baseline/trial-1/_result.json'));
  assert.equal(readFileSync(join(f.root, 'api-aborted'), 'utf8'), 'yes'); assert.equal(record.tokens, null);
  assert.equal(record.usageStatus, 'unknown'); assert.match(record.error, /SIGINT/);
});

test('interrupting between calls preserves the settled receipt without dispatching another call', { timeout: 30_000 }, async t => {
  const f = await scenario(t, 'between'); assert.equal(f.done.calls, 1);
  assert.ok(!existsSync(join(f.run, 'example-task/treatment/trial-1')));
  assert.deepEqual(json(join(f.run, 'example-task/baseline/trial-1/_result.json')).tokens, { input: 20, cachedInput: 5, output: 4 });
});

test('CLI plain and JSON errors preserve the interruption exit code instead of replacing it with 1 or 2', () => {
  for (const signal of ['SIGINT', 'SIGTERM']) for (const machine of [false, true]) {
    const args = machine ? ['eval', '--request', 'missing-offline-request.json', '--dry-run']
      : ['eval', 'missing-offline-skill', '--bench', 'missing-offline-bench', '--dry-run'];
    const script = `import{withEvaluationInterrupts}from ${moduleUrl('harness/interruption.js')};
try{await withEvaluationInterrupts(async()=>{process.emit(${JSON.stringify(signal)});});}catch{}
process.argv=[process.execPath,${JSON.stringify(join(dist, 'cli.js'))},...${JSON.stringify(args)}];await import(${moduleUrl('cli.js')});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, signal === 'SIGINT' ? 130 : 143, result.stderr);
    if (machine) assert.equal(JSON.parse(result.stdout).kind, 'skillfit.eval-error');
  }
});
