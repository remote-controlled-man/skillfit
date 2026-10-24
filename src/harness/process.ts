import { spawn } from 'node:child_process';
import { killTree, treeSpawnOptions } from './kill-tree.js';
import { evaluationSignal } from './interruption.js';

export interface ProcessResult {
  exitCode: number | null;
  output: string;
  error: string | null;
}

const MAX_PROCESS_OUTPUT_BYTES = 8 * 1024 * 1024;

export function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  const signal = evaluationSignal();
  if (signal?.aborted) return Promise.resolve({ exitCode: null, output: '', error: (signal.reason as Error).message });
  return new Promise((resolvePromise) => {
    let child;
    try {
      const env = { ...process.env };
      delete env['NODE_TEST_CONTEXT'];
      child = spawn(command, args, { cwd, shell: false, env, ...treeSpawnOptions() });
    } catch (error) {
      resolvePromise({ exitCode: null, output: '', error: (error as Error).message });
      return;
    }
    let output = '';
    let bytes = 0;
    let timedOut = false;
    let overflow = false;
    let stopping = false;
    let settled = false;
    let drainTimer: NodeJS.Timeout | undefined;
    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(drainTimer);
      signal?.removeEventListener('abort', onAbort);
      resolvePromise(result);
    };
    const result = (code: number | null): ProcessResult => ({
      exitCode: signal?.aborted || timedOut || overflow ? null : code,
      output: timedOut ? `${output}\n[timed out after ${timeoutMs}ms]` : output,
      error: signal?.aborted ? (signal.reason as Error).message : overflow
        ? `output exceeded ${MAX_PROCESS_OUTPUT_BYTES} bytes` : timedOut ? `timed out after ${timeoutMs}ms` : null,
    });
    const stop = (): void => {
      if (stopping || settled) return;
      stopping = true;
      killTree(child);
      drainTimer = setTimeout(() => {
        child.stdin?.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
        finish(result(null));
      }, 2000);
    };
    const onAbort = (): void => stop();
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    const take = (chunk: Buffer): void => {
      bytes += chunk.length;
      if (bytes > MAX_PROCESS_OUTPUT_BYTES) {
        overflow = true;
        stop();
        return;
      }
      output += chunk.toString('utf8');
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    // Verifiers and git do not read a prompt. Leave the pipe open and a command that reads stdin
    // waits until the timeout instead of seeing EOF.
    child.stdin?.on('error', () => {});
    child.stdin?.end();
    child.on('error', (error) => {
      finish({ exitCode: null, output, error: error.message });
    });
    child.on('close', (code) => {
      finish(result(code));
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}
