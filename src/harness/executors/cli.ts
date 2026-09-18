import { spawn } from 'node:child_process';
import { getAgent } from '../../agents.js';
import type { Executor, ExecutorDescriptor, ExecutorResult } from '../types.js';

export const DEFAULT_CLI_COMMANDS: Record<string, string[]> = {
  'claude-code': ['claude', '-p'],
  codex: ['codex', 'exec', '-'],
  'kimi-code': ['kimi', '--print'],
};

export interface CliExecutorOptions {
  argv: string[];
  label?: string;
  timeoutMs?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export class CliExecutor implements Executor {
  private readonly argv: string[];
  private readonly label: string;
  private readonly timeoutMs: number;
  private readonly shell: boolean;
  private readonly env?: NodeJS.ProcessEnv;

  constructor(options: CliExecutorOptions) {
    if (options.argv.length === 0) {
      throw new Error('CliExecutor requires a non-empty argv command template');
    }
    this.argv = options.argv;
    this.label = options.label ?? options.argv[0] ?? 'cli';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.shell = options.shell ?? true;
    this.env = options.env;
  }

  static forAgent(agentId: string): CliExecutor {
    const agent = getAgent(agentId);
    const argv = DEFAULT_CLI_COMMANDS[agent.id];
    if (!argv) {
      throw new Error(`No default headless command template for agent "${agent.id}"`);
    }
    return new CliExecutor({ argv, label: agent.id });
  }

  describe(): ExecutorDescriptor {
    return { kind: 'cli', model: 'cli-configured', detail: `${this.label}: ${this.argv.join(' ')}` };
  }

  run(prompt: string, workdir: string): Promise<ExecutorResult> {
    const [command, ...args] = this.argv;
    if (!command) {
      return Promise.reject(new Error('CliExecutor has an empty command'));
    }
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
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
      child.stdin.write(prompt, 'utf8');
      child.stdin.end();
    });
  }
}
