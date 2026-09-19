import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgent } from '../../agents.js';
import type { Executor, ExecutorDescriptor, ExecutorResult } from '../types.js';

export interface CliExecutorOptions {
  argv: string[];
  label?: string;
  timeoutMs?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
  promptVia?: 'stdin' | 'file';
  promptFile?: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PROMPT_FILE = '_prompt.txt';
const PROMPT_FILE_PLACEHOLDER = '{promptFile}';

export function quoteShellArg(arg: string): string {
  if (arg.length === 0) return '""';
  if (arg.startsWith('"') && arg.endsWith('"')) return arg;
  if (!/\s/.test(arg)) return arg;
  return `"${arg}"`;
}

export class CliExecutor implements Executor {
  private readonly argv: string[];
  private readonly label: string;
  private readonly timeoutMs: number;
  private readonly shell: boolean;
  private readonly env?: NodeJS.ProcessEnv;
  private readonly promptVia: 'stdin' | 'file';
  private readonly promptFile: string;

  constructor(options: CliExecutorOptions) {
    if (options.argv.length === 0) {
      throw new Error('CliExecutor requires a non-empty argv command template');
    }
    if (options.promptVia === 'file' && options.promptFile === '') {
      throw new Error('CliExecutor promptVia "file" requires a non-empty promptFile');
    }
    this.argv = options.argv;
    this.label = options.label ?? options.argv[0] ?? 'cli';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.shell = options.shell ?? true;
    this.env = options.env;
    this.promptVia = options.promptVia ?? 'stdin';
    this.promptFile = options.promptFile ?? DEFAULT_PROMPT_FILE;
  }

  static forAgent(agentId: string): CliExecutor {
    const agent = getAgent(agentId);
    const headless = agent.headless;
    if (!headless || headless.argv.length === 0) {
      throw new Error(`No default headless command template for agent "${agent.id}"`);
    }
    return new CliExecutor({
      argv: headless.argv,
      label: agent.id,
      promptVia: headless.promptVia,
      promptFile: headless.promptFile,
    });
  }

  describe(): ExecutorDescriptor {
    return { kind: 'cli', model: 'cli-configured', detail: `${this.label}: ${this.argv.join(' ')}` };
  }

  run(prompt: string, workdir: string): Promise<ExecutorResult> {
    let argv = this.argv;
    if (this.promptVia === 'file') {
      if (!workdir) {
        return Promise.reject(new Error('CliExecutor promptVia "file" requires a workdir'));
      }
      writeFileSync(join(workdir, this.promptFile), prompt, 'utf8');
      argv = argv.map((arg) => arg.split(PROMPT_FILE_PLACEHOLDER).join(this.promptFile));
    }
    const [command, ...args] = argv;
    if (!command) {
      return Promise.reject(new Error('CliExecutor has an empty command'));
    }
    const spawnArgv = this.shell ? [command, ...args].map(quoteShellArg) : [command, ...args];
    const spawnCommand = spawnArgv[0] ?? command;
    const spawnArgs = spawnArgv.slice(1);
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(spawnCommand, spawnArgs, {
        cwd: workdir,
        shell: this.shell,
        env: { ...process.env, ...this.env },
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        rejectPromise(new Error(`Failed to start "${command}": ${error.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          rejectPromise(new Error(`"${command}" timed out after ${this.timeoutMs}ms`));
          return;
        }
        if (code !== 0) {
          const detail = stderr.trim().slice(0, 500);
          rejectPromise(
            new Error(`"${command}" exited with code ${code ?? 'null'}${detail ? `: ${detail}` : ''}`),
          );
          return;
        }
        resolvePromise({ output: stdout });
      });
      if (this.promptVia === 'stdin') {
        child.stdin.write(prompt, 'utf8');
      }
      child.stdin.end();
    });
  }
}
