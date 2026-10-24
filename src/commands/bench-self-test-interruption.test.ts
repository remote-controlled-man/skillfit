import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { killTree } from '../harness/kill-tree.js';
import { sha256File } from '../harness/hash.js';

const rootDir = fileURLToPath(new URL('../../', import.meta.url));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && readFileSync(`/proc/${pid}/stat`, 'utf8').split(')').at(-1)!.trim().startsWith('Z')) return false;
    return true;
  } catch { return false; }
}
const transports: ('os' | 'ipc')[] = process.platform === 'win32' ? ['ipc'] : ['os', 'ipc'];
for (const signal of ['SIGINT', 'SIGTERM'] as const) for (const transport of transports) test(`self-test ${signal} (${transport}) terminates verifier descendants and cannot pass an error control`, { timeout: 30_000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-self-cancel-')), bench = join(root, 'bench'), ready = join(root, 'ready.json'), heartbeat = join(root, 'heartbeat');
  cpSync(join(rootDir, 'benches/_self-test/example'), bench, { recursive: true });
  let child: ChildProcess | undefined;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) killTree(child);
    if (existsSync(ready)) for (const pid of JSON.parse(readFileSync(ready, 'utf8')).pids) if (running(pid)) try { process.kill(pid, 'SIGKILL'); } catch { /* exited */ }
    await delay(50); rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  writeFileSync(join(bench, 'verifiers/leaf.mjs'), `import{appendFileSync}from'node:fs';process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>appendFileSync(${JSON.stringify(heartbeat)},'x'),20);`);
  writeFileSync(join(bench, 'verifiers/command.mjs'), `import{existsSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';import{spawn}from'node:child_process';
if(existsSync(join(process.argv[2],'_prompt.txt'))){
process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});
const leaf=spawn(process.execPath,[${JSON.stringify(join(bench, 'verifiers/leaf.mjs'))}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(heartbeat)})){clearInterval(timer);writeFileSync(${JSON.stringify(ready)},JSON.stringify({pids:[process.pid,leaf.pid]}));}},20);
}else{const passed=readFileSync(join(process.argv[2],'state.txt'),'utf8')==='fixed\\n';console.log(JSON.stringify({passed,checks:[{name:'fixed',pass:passed},{name:'bytes',pass:passed}]}));process.exitCode=passed?0:1;}`);
  const bootstrap = join(root, 'start.mjs');
  writeFileSync(bootstrap, `process.on('message',message=>process.emit(message.signal));await import(${JSON.stringify(pathToFileURL(join(rootDir, 'dist/cli.js')).href)});
// Importing the CLI starts async work; wait for its exit status and signal cleanup.
const timer=setInterval(()=>{if(process.exitCode!==undefined&&process.listenerCount('SIGINT')===0){clearInterval(timer);if(process.connected)process.disconnect();}},20);`);
  child = spawn(process.execPath, [bootstrap, 'bench', 'self-test', bench, '--runs-root', join(root, 'runs'), '--run-group', 'cancel', '--suite', 'known-benefit', '--yes'], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, HOME: root, USERPROFILE: root, SKILLFIT_JUDGE: '1' },
  });
  let stderr = ''; child.stdout!.resume(); child.stderr!.on('data', data => stderr += data);
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.on('exit', (code, signal) => resolve({ code, signal })));
  for (let i = 0; i < 300 && !existsSync(ready) && child.exitCode === null; i++) await delay(50);
  assert.ok(existsSync(ready), stderr);
  if (transport === 'ipc') await new Promise<void>((resolve, reject) => child!.send({ signal }, error => error ? reject(error) : resolve()));
  else child.kill(signal);
  let timer: NodeJS.Timeout | undefined;
  const exit = await Promise.race([closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(stderr || 'Self-test interruption did not settle.')), 10_000); })]).finally(() => clearTimeout(timer));
  assert.deepEqual(exit, { code: signal === 'SIGINT' ? 130 : 143, signal: null }, stderr);
  const group = join(root, 'runs/cancel'), result = JSON.parse(readFileSync(join(group, '_self-test.json'), 'utf8'));
  assert.equal(result.status, 'interrupted'); assert.equal(result.suites[0].status, 'interrupted');
  assert.equal(result.harnessModelCalls, 0); assert.equal(result.simulatedExecutorInvocations, 1); assert.equal(result.acceptance.eligibleForUpgrade, false);
  const run = join(group, 'known-benefit');
  assert.equal(existsSync(join(run, 'manifest.json')), false); assert.equal(existsSync(join(run, 'command/treatment')), false);
  assert.equal(JSON.parse(readFileSync(join(run, '_session.json'), 'utf8')).status, 'stopped');
  const index = JSON.parse(readFileSync(join(run, '_artifacts.json'), 'utf8'));
  for (const [path, hash] of Object.entries(index.files)) assert.equal(sha256File(join(run, path)), hash);
  const pids: number[] = JSON.parse(readFileSync(ready, 'utf8')).pids;
  for (let i = 0; i < 100 && pids.some(running); i++) await delay(50);
  assert.ok(pids.every(pid => !running(pid)), 'trusted verifier and grandchild must stop');
  const before = readFileSync(heartbeat, 'utf8'); await delay(100); assert.equal(readFileSync(heartbeat, 'utf8'), before);
});
