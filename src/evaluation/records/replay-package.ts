import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface ReplayPackage {
  schemaVersion: 1;
  kind: 'skillfit.replay-package';
  sourcePlanSha256: string;
  hasManifest: boolean;
  nativeStatus: string;
  evaluationType?: 'paired' | 'calibration' | 'trigger';
  files: Record<string, string>;
}

export function packageFiles(root: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Portable packages do not support symbolic links: ${path}`);
    if (entry.isDirectory()) files.push(...packageFiles(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported artifact: ${path}`);
  }
  return files.sort();
}

export function packageMember(root: string, path: string): string {
  if (!path || isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.includes('\\') || path.includes('\0') ||
    path.split('/').some(part => !part || part === '.' || part === '..' || part === '.git')) throw new Error(`Unsafe package path: ${path}`);
  const target = resolve(root, path), rel = relative(realpathSync(root), realpathSync(target));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`) || !lstatSync(target).isFile()) throw new Error(`Package file escapes its root: ${path}`);
  return target;
}

export function packageHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Checksums detect changed/missing files; they do not authenticate an unknown publisher. */
export function verifyReplayPackage(root: string): ReplayPackage {
  const metadata = JSON.parse(readFileSync(packageMember(root, 'replay-package.json'), 'utf8')) as ReplayPackage;
  if (metadata.schemaVersion !== 1 || metadata.kind !== 'skillfit.replay-package' ||
    typeof metadata.sourcePlanSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.sourcePlanSha256) ||
    typeof metadata.hasManifest !== 'boolean' || !['completed', 'stopped', 'incomplete'].includes(metadata.nativeStatus) ||
    !metadata.files || typeof metadata.files !== 'object' || Array.isArray(metadata.files)) throw new Error('Invalid replay-package.json.');
  const actual = packageFiles(root).filter(path => path !== 'replay-package.json');
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(metadata.files).sort())) throw new Error('Portable file inventory changed.');
  for (const [path, hash] of Object.entries(metadata.files)) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || packageHash(packageMember(root, path)) !== hash) throw new Error(`Portable file hash mismatch: ${path}`);
  }
  if (packageHash(packageMember(root, 'run/_plan.json')) !== metadata.sourcePlanSha256) throw new Error('Portable native plan changed.');
  const session = JSON.parse(readFileSync(packageMember(root, 'run/_session.json'), 'utf8'));
  if (session.planSha256 !== metadata.sourcePlanSha256 || session.status !== metadata.nativeStatus) throw new Error('Portable session differs from its source plan.');
  for (const file of ['run/_artifacts.json', 'inputs/bench/bench.json', 'runtime/package.json', 'runtime/dist/cli.js', 'reproduce.mjs']) {
    if (!(file in metadata.files)) throw new Error(`Required portable file is missing: ${file}`);
  }
  if (metadata.hasManifest !== ('run/manifest.json' in metadata.files)) throw new Error('Portable manifest coverage changed.');
  if (metadata.evaluationType !== undefined) {
    if (!['paired', 'calibration', 'trigger'].includes(metadata.evaluationType)) throw new Error('Invalid portable evaluation type.');
    const plan = JSON.parse(readFileSync(packageMember(root, 'run/_plan.json'), 'utf8'));
    const plannedType = ['calibration', 'trigger'].includes(plan.details?.mode) ? plan.details.mode : 'paired';
    if (metadata.evaluationType !== plannedType) throw new Error('Portable evaluation type differs from its native plan.');
  }
  return metadata;
}

/** Wait for the pinned CLI to clean its verifier tree before returning a signal exit. */
function runPinnedReplay(root: string, interrupted: (signal: 'SIGINT' | 'SIGTERM') => void): Promise<{ stdout: string; stderr: string; status: number | null }> {
  return new Promise((resolveRun, reject) => {
    // The original cancellation context also covers older pinned CLIs whose
    // report dispatcher predates the public replay wrapper. The CLI stays byte-identical.
    const loader = "import{dirname,join}from'node:path';import{pathToFileURL}from'node:url';process.on('message',message=>{if(message?.kind==='skillfit.replay-signal'&&['SIGINT','SIGTERM'].includes(message.signal))process.emit(message.signal);});process.channel?.unref();const cli=process.argv[1];const{withEvaluationInterrupts}=await import(pathToFileURL(join(dirname(cli),'harness/interruption.js')).href);await withEvaluationInterrupts(async()=>{const idle=new Promise(resolve=>process.once('beforeExit',resolve));await import(pathToFileURL(cli).href);await idle;});";
    const child = spawn(process.execPath, ['--input-type=module', '--eval', loader, join(root, 'runtime/dist/cli.js'), 'report', 'eval', join(root, 'run'), '--json', '--replay', '--bench', join(root, 'inputs/bench')],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    let stdout = '', stderr = '', bytes = 0, failure: Error | null = null, signal: 'SIGINT' | 'SIGTERM' | null = null;
    const stopChild = (value: 'SIGINT' | 'SIGTERM') => {
      if (process.platform === 'win32' && child.connected) child.send({ kind: 'skillfit.replay-signal', signal: value });
      else child.kill(value);
    };
    const forward = (value: 'SIGINT' | 'SIGTERM') => {
      if (signal) return;
      signal = value; interrupted(value);
      stopChild(value);
    };
    const onInt = () => forward('SIGINT'), onTerm = () => forward('SIGTERM');
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
    const cleanup = () => { process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm); };
    const append = (value: string, error: boolean) => {
      bytes += Buffer.byteLength(value);
      if (bytes > 32 * 1024 * 1024) { if (!failure) { failure = new Error('Pinned replay output exceeded 32 MiB.'); stopChild('SIGTERM'); } return; }
      if (error) stderr += value; else stdout += value;
    };
    child.stdout!.setEncoding('utf8'); child.stderr!.setEncoding('utf8');
    child.stdout!.on('data', value => append(String(value), false)); child.stderr!.on('data', value => append(String(value), true));
    child.once('error', error => { failure = error; });
    child.once('close', status => {
      cleanup();
      if (signal) reject(new Error(`Offline replay interrupted by ${signal}; waited for the pinned CLI to stop its verifier processes.`));
      else if (failure) reject(failure);
      else resolveRun({ stdout, stderr, status });
    });
  });
}

/** Serialize these dependency-free functions so old pinned runtimes need no new export API. */
export function portableReproducer(): string {
  return `import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
${packageFiles.toString()}
${packageMember.toString()}
${packageHash.toString()}
${verifyReplayPackage.toString()}
${runPinnedReplay.toString()}
let interruptedSignal=null;
try {
  const root=fileURLToPath(new URL('.',import.meta.url)), metadata=verifyReplayPackage(root);
  if(process.argv.includes('--verify-only')) {
    console.log(JSON.stringify({schemaVersion:1,kind:'skillfit.replay-package-verification',verified:true,files:Object.keys(metadata.files).length,nativeStatus:metadata.nativeStatus,modelCalls:0}));
  } else {
    const child=await runPinnedReplay(root,signal=>{interruptedSignal=signal;});
    if(child.status!==0) throw new Error(child.stderr||'Pinned offline replay failed.');
    const result=JSON.parse(child.stdout);
    if((metadata.hasManifest||metadata.evaluationType==='calibration'||metadata.evaluationType==='trigger')&&!result.evidence?.verified) throw new Error('Offline evidence audit failed: '+JSON.stringify(result.evidence));
    console.log(JSON.stringify({...result,portableReplay:{verified:true,sourcePlanSha256:metadata.sourcePlanSha256,modelCalls:0,scope:'Offline evidence reproduction; no new observations or upgrade authorization.'}},null,2));
  }
} catch(error) { console.error(error.message); process.exitCode=interruptedSignal==='SIGINT'?130:interruptedSignal==='SIGTERM'?143:2; }
`;
}
