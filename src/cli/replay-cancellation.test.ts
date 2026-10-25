import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from "./bench.js";
import { runEval } from "./eval.js";
import { killTree } from "../shared/process-tree.js";
import { packageFiles } from "../evaluation/records/replay-package.js";
import { sha256File } from "../shared/hash.js";

const cli = fileURLToPath(new URL("./main.js", import.meta.url));
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && readFileSync(`/proc/${pid}/stat`, 'utf8').split(')').at(-1)!.trim().startsWith('Z')) return false;
    return true;
  } catch { return false; }
}

async function scenario(t: TestContext, signal: 'SIGINT' | 'SIGTERM', repeat = false) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-replay-cancel-'));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), run = join(root, 'runs/saved');
  const ready = join(root, 'ready.json'), heartbeat = join(root, 'heartbeat');
  let child: ChildProcess | undefined;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) killTree(child);
    if (existsSync(ready)) for (const pid of json(ready).pids) if (running(pid)) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* Already stopped. */ }
    }
    await pause(100); rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# Offline cancellation fixture\n');
  const leaf = join(root, 'leaf.mjs');
  writeFileSync(leaf, `import{appendFileSync}from'node:fs';process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>appendFileSync(${JSON.stringify(heartbeat)},'x'),30);setTimeout(()=>process.exit(),30000);`);
  writeFileSync(join(bench, 'verifiers/example-task.mjs'), `import{spawn}from'node:child_process';import{existsSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';
if(process.env.SKILLFIT_OFFLINE_REPLAY_BLOCK==='yes'){
process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});
const leaf=spawn(process.execPath,[${JSON.stringify(leaf)}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(heartbeat)})){clearInterval(timer);writeFileSync(${JSON.stringify(ready)},JSON.stringify({pids:[process.pid,leaf.pid]}));}},20);
setTimeout(()=>process.exit(),30000);
}else{const out=join(process.argv[2],'_output.md');process.exit(existsSync(out)&&readFileSync(out,'utf8').trim()==='skillfit-ok'?0:1);}`);
  let fakeCalls = 0;
  await runEval({ skillPath: skill, bench, trials: 1, maxCalls: 2, runsRoot: join(root, 'runs'), runGroup: 'saved',
    dryRun: false, yes: true, judgeExecutor: null, log: () => {}, executor: {
      describe: () => ({ kind: 'stub', model: 'offline-only' }), run: async () => { fakeCalls++; return { output: 'skillfit-ok', tokens: { input: 10, cachedInput: 2, output: 3 } }; },
    } });
  assert.equal(fakeCalls, 2);
  const evidence = packageFiles(run).map(path => [path, sha256File(join(run, path))]);
  const harness = join(root, 'replay-harness.mjs');
  writeFileSync(harness, `process.on('message',message=>{process.emit(message.signal);if(message.repeat){process.emit(message.signal);process.emit('SIGTERM');}});
process.argv=[process.execPath,${JSON.stringify(cli)},'report','eval',${JSON.stringify(run)},'--json','--replay'];
await import(${JSON.stringify(pathToFileURL(cli).href)});
const timer=setInterval(()=>{if(process.exitCode!==undefined&&process.listenerCount('SIGINT')===0){clearInterval(timer);process.disconnect();}},20);`);
  child = spawn(process.execPath, [harness], { env: { ...process.env, SKILLFIT_OFFLINE_REPLAY_BLOCK: 'yes' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '', stderr = '';
  child.stdout!.on('data', chunk => { stdout += chunk; }); child.stderr!.on('data', chunk => { stderr += chunk; });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.once('close', (code, signal) => resolve({ code, signal })));
  for (let i = 0; i < 200 && !existsSync(ready) && child.exitCode === null; i++) await pause(50);
  assert.ok(existsSync(ready), `Offline replay verifier did not start: ${stderr}`);
  // Windows kill('SIGINT') terminates forcibly; IPC emits the same JS console event
  // while taskkill /T remains the real process-tree cancellation implementation.
  if (process.platform === 'win32' || repeat) child.send({ signal, repeat }); else child.kill(signal);
  let timeout: NodeJS.Timeout | undefined;
  const exit = await Promise.race([closed, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Replay did not stop: ${stderr}`)), 10_000); })]).finally(() => clearTimeout(timeout));
  assert.deepEqual(exit, { code: signal === 'SIGINT' ? 130 : 143, signal: null }, stderr);
  const result = JSON.parse(stdout); assert.equal(result.kind, 'skillfit.eval-error'); assert.match(result.error.message, new RegExp(signal));
  for (let i = 0; i < 100 && json(ready).pids.some(running); i++) await pause(50);
  assert.ok(json(ready).pids.every((pid: number) => !running(pid)), 'Replay verifier and its grandchild must stop.');
  const finalHeartbeat = readFileSync(heartbeat, 'utf8'); await pause(100); assert.equal(readFileSync(heartbeat, 'utf8'), finalHeartbeat);
  assert.deepEqual(packageFiles(run).map(path => [path, sha256File(join(run, path))]), evidence, 'Read-only replay cancellation must leave native evidence unchanged.');
  assert.equal(fakeCalls, 2, 'Replay adds no executor observations.');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`${signal} cancels saved delivery replay, kills verifier descendants and emits one JSON document`, { timeout: 30_000 }, async t => {
  await scenario(t, signal);
});

test('repeated replay interrupts preserve the first exit code and clean up without changing receipts', { timeout: 30_000 }, async t => {
  await scenario(t, 'SIGINT', true);
});
