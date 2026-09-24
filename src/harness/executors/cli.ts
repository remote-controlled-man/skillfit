import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgent } from '../../agents.js';
import { probeKimiSessionUsage } from '../kimi-usage.js';
import type { Executor, ExecutorDescriptor, ExecutorResult } from '../types.js';

export interface CliExecutorOptions {
  argv: string[];
  label?: string;
  timeoutMs?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
  promptVia?: 'stdin' | 'file';
  promptFile?: string;
  triggerSkillName?: string;
  triggerToolName?: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PROMPT_FILE = '_prompt.txt';
const PROMPT_FILE_PLACEHOLDER = '{promptFile}';
const DEFAULT_TRIGGER_TOOL_NAME = 'Skill';

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
  private readonly triggerSkillName?: string;
  private readonly triggerToolName: string;

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
    this.triggerSkillName = options.triggerSkillName;
    this.triggerToolName = options.triggerToolName ?? DEFAULT_TRIGGER_TOOL_NAME;
  }

  static forAgent(agentId: string, opts?: { triggerSkillName?: string }): CliExecutor {
    const agent = getAgent(agentId);
    const headless = agent.headless;
    if (opts?.triggerSkillName !== undefined) {
      const streamJson = headless.streamJson;
      if (!streamJson || streamJson.argv.length === 0) {
        throw new Error(
          `Agent "${agent.id}" has no headless streamJson command template; trigger detection is unavailable for it`,
        );
      }
      return new CliExecutor({
        argv: streamJson.argv,
        label: agent.id,
        promptVia: headless.promptVia,
        promptFile: headless.promptFile,
        triggerSkillName: opts.triggerSkillName,
        triggerToolName: streamJson.triggerToolName,
      });
    }
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
    // The headless CLI surfaces in the matrix expose no seed or temperature knob.
    return {
      kind: 'cli',
      model: 'cli-configured',
      detail: `${this.label}: ${this.argv.join(' ')}`,
      sampling: null,
    };
  }

  run(prompt: string, workdir: string): Promise<ExecutorResult> {
    const startedAtMs = Date.now();
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
        let result: ExecutorResult;
        if (this.triggerSkillName !== undefined) {
          result = parseStreamJsonTranscript(stdout, this.triggerToolName, this.triggerSkillName);
        } else {
          result = { output: stdout };
        }
        if (this.label === 'kimi-code' && result.tokens === undefined) {
          const usage = probeKimiSessionUsage(workdir, startedAtMs);
          if (usage) {
            result.tokens = { input: usage.input, output: usage.output };
          }
        }
        resolvePromise(result);
      });
      if (this.promptVia === 'stdin') {
        child.stdin.write(prompt, 'utf8');
      }
      child.stdin.end();
    });
  }
}

interface StreamJsonTranscript {
  output: string;
  skillTriggered?: boolean;
  rawOutput?: string;
  tokens?: { input?: number; output?: number };
}

function parseStreamJsonTranscript(
  stdout: string,
  triggerToolName: string,
  skillName: string,
): StreamJsonTranscript {
  const textParts: string[] = [];
  let parsedAny = false;
  let triggered = false;
  let tokens: { input?: number; output?: number } | undefined;
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    parsedAny = true;
    if (typeof event !== 'object' || event === null) {
      continue;
    }
    const record = event as Record<string, unknown>;
    if (record.role === 'assistant') {
      if (typeof record.content === 'string' && record.content !== '') {
        textParts.push(record.content);
      }
      if (Array.isArray(record.tool_calls)) {
        for (const call of record.tool_calls) {
          if (typeof call !== 'object' || call === null) {
            continue;
          }
          const fn = (call as Record<string, unknown>).function;
          if (typeof fn !== 'object' || fn === null) {
            continue;
          }
          const fnRecord = fn as Record<string, unknown>;
          if (fnRecord.name !== triggerToolName) {
            continue;
          }
          const args = fnRecord.arguments;
          const argsText = typeof args === 'string' ? args : JSON.stringify(args ?? null);
          if (argsText.includes(skillName)) {
            triggered = true;
          }
        }
      }
    }
    if (record.type === 'assistant') {
      const message = record.message;
      const content =
        typeof message === 'object' && message !== null
          ? (message as Record<string, unknown>).content
          : undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block !== 'object' || block === null) {
            continue;
          }
          const blockRecord = block as Record<string, unknown>;
          if (
            blockRecord.type === 'text' &&
            typeof blockRecord.text === 'string' &&
            blockRecord.text !== ''
          ) {
            textParts.push(blockRecord.text);
          }
          if (
            blockRecord.type === 'tool_use' &&
            blockRecord.name === triggerToolName &&
            JSON.stringify(blockRecord.input ?? null).includes(skillName)
          ) {
            triggered = true;
          }
        }
      }
    }
    if (record.type === 'turn.completed') {
      const usage = record.usage;
      if (typeof usage === 'object' && usage !== null) {
        const usageRecord = usage as Record<string, unknown>;
        const input = typeof usageRecord.input_tokens === 'number' ? usageRecord.input_tokens : undefined;
        const output =
          typeof usageRecord.output_tokens === 'number' ? usageRecord.output_tokens : undefined;
        if (input !== undefined || output !== undefined) {
          tokens = { input, output };
        }
      }
    }
    if (record.type === 'item.completed' || record.type === 'item.started') {
      const item = record.item;
      if (typeof item === 'object' && item !== null) {
        const itemRecord = item as Record<string, unknown>;
        if (
          record.type === 'item.completed' &&
          itemRecord.type === 'agent_message' &&
          typeof itemRecord.text === 'string' &&
          itemRecord.text !== ''
        ) {
          textParts.push(itemRecord.text);
        }
        if (itemRecord.type === 'command_execution' && typeof itemRecord.command === 'string') {
          const normalized = itemRecord.command.replace(/\\+/g, '/');
          if (normalized.includes(`skills/${skillName}/SKILL.md`)) {
            triggered = true;
          }
        }
      }
    }
  }
  if (!parsedAny) {
    return { output: stdout };
  }
  return { output: textParts.join('\n'), skillTriggered: triggered, rawOutput: stdout, tokens };
}
