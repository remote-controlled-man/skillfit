import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgent } from '../../agents.js';
import type { AgentSessions } from '../../agents.js';
import { killTree, treeSpawnOptions } from '../kill-tree.js';
import { probeKimiSessionUsage } from '../kimi-usage.js';
import { probeCodexPartialUsage } from '../codex-usage.js';
import { ExecutorFailure, type TokenUsage } from '../types.js';
import { ExecutionDeadline, type ExecutionClock } from '../execution-timing.js';
import type { Executor, ExecutorDescriptor, ExecutorResult } from '../types.js';

export interface CliExecutorOptions {
  argv: string[];
  label?: string;
  timeoutMs?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
  promptVia?: 'stdin' | 'file';
  promptFile?: string;
  usageFromSessionLog?: boolean;
  partialUsageFromSessionLog?: boolean;
  sessions?: AgentSessions;
  /** Test fixture root; never lets process environment redirect offline tests. */
  homeDir?: string;
  triggerSkillName?: string;
  triggerToolName?: string;
  projectTrustConfigArg?: string;
  /** Injectable clocks for offline timing regression tests. */
  clock?: ExecutionClock;
}

export const DEFAULT_CLI_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_AGENT_OUTPUT_BYTES = 32 * 1024 * 1024;
const DEFAULT_PROMPT_FILE = '_prompt.txt';
const PROMPT_FILE_PLACEHOLDER = '{promptFile}';
const DEFAULT_TRIGGER_TOOL_NAME = 'Skill';

// Characters that a shell would interpret as something other than literal argument text.
// Backslash is deliberately absent: every Windows path in the matrix contains them and cmd.exe treats
// them as separators, not escapes. Parentheses are absent too — a bare `(` after a command name is a
// syntax error in sh and a block opener in cmd.exe, not a way to run a second command, and rejecting
// them would break legitimate arguments such as a `node -e` expression. Every payload that actually
// injects (`a;rm`, `a&&rm`, `a|rm`, `x$(whoami)`, "a`id`") is caught by the set below.
const SHELL_UNSAFE = /[;&|<>`$\r\n]/;

/**
 * Quote an argument for a `shell: true` spawn.
 *
 * Arguments reach here from `src/matrix/agents.json` and from filenames skillfit chose — never from
 * user input today. The function is exported, though, and the previous version returned anything
 * without whitespace verbatim, so `a;rm`, `x$(whoami)` and `` a`id` `` all reached the shell
 * untouched. Quoting harder is not the answer either: inside double quotes a POSIX shell still
 * expands `$(...)` and backticks, and cmd.exe still expands `%VAR%`, so no single scheme is correct
 * for both. Unsafe characters are therefore rejected rather than escaped — a loud refusal beats a
 * silently injected command, and no command name, flag or path in the matrix contains any of them.
 */
export function quoteShellArg(arg: string): string {
  if (SHELL_UNSAFE.test(arg) || (process.platform === 'win32' && /[%!^]/.test(arg))) {
    throw new Error(
      `Refusing to pass a shell-unsafe argument to a shell spawn: ${JSON.stringify(arg)} ` +
        '(contains a shell expansion or control character)',
    );
  }
  if (arg.length === 0) return '""';
  if (arg.startsWith('"') && arg.endsWith('"')) return arg;
  // TOML quoted keys in a project-trust override contain apostrophes. If left bare, a POSIX shell
  // consumes those quote characters before the CLI can parse the key; cmd.exe also needs the whole
  // value kept as one argument when a Windows workdir contains spaces.
  if (!/[\s']/.test(arg)) return arg;
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
  private readonly usageFromSessionLog: boolean;
  private readonly partialUsageFromSessionLog: boolean;
  private readonly sessions?: AgentSessions;
  private readonly homeDir?: string;
  private readonly triggerSkillName?: string;
  private readonly triggerToolName: string;
  private readonly projectTrustConfigArg?: string;
  private readonly clock?: ExecutionClock;

  constructor(options: CliExecutorOptions) {
    if (options.argv.length === 0) {
      throw new Error('CliExecutor requires a non-empty argv command template');
    }
    if (options.promptVia === 'file' && options.promptFile === '') {
      throw new Error('CliExecutor promptVia "file" requires a non-empty promptFile');
    }
    this.argv = options.argv;
    this.label = options.label ?? options.argv[0] ?? 'cli';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS;
    this.shell = options.shell ?? true;
    this.env = options.env;
    this.promptVia = options.promptVia ?? 'stdin';
    this.promptFile = options.promptFile ?? DEFAULT_PROMPT_FILE;
    this.usageFromSessionLog = options.usageFromSessionLog ?? false;
    this.partialUsageFromSessionLog = options.partialUsageFromSessionLog ?? false;
    this.sessions = options.sessions;
    this.homeDir = options.homeDir;
    this.triggerSkillName = options.triggerSkillName;
    this.triggerToolName = options.triggerToolName ?? DEFAULT_TRIGGER_TOOL_NAME;
    this.projectTrustConfigArg = options.projectTrustConfigArg;
    this.clock = options.clock;
    new ExecutionDeadline(this.timeoutMs, this.clock);
  }

  static forAgent(agentId: string, opts?: { triggerSkillName?: string; trustProjectConfig?: boolean; timeoutMs?: number }): CliExecutor {
    const agent = getAgent(agentId);
    const headless = agent.headless;
    const projectTrustConfigArg = opts?.trustProjectConfig ? headless.projectTrustConfigArg : undefined;
    if (opts?.trustProjectConfig && !projectTrustConfigArg) {
      throw new Error(`Agent "${agent.id}" has no project trust override in the matrix`);
    }
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
        timeoutMs: opts.timeoutMs,
        promptVia: headless.promptVia,
        promptFile: headless.promptFile,
        usageFromSessionLog: headless.usageFromSessionLog ?? false,
        partialUsageFromSessionLog: headless.partialUsageFromSessionLog ?? false,
        sessions: agent.sessions,
        triggerSkillName: opts.triggerSkillName,
        triggerToolName: streamJson.triggerToolName,
        projectTrustConfigArg,
      });
    }
    if (!headless || headless.argv.length === 0) {
      throw new Error(`No default headless command template for agent "${agent.id}"`);
    }
    return new CliExecutor({
      argv: headless.argv,
      label: agent.id,
      timeoutMs: opts?.timeoutMs,
      promptVia: headless.promptVia,
      promptFile: headless.promptFile,
      usageFromSessionLog: headless.usageFromSessionLog ?? false,
      partialUsageFromSessionLog: headless.partialUsageFromSessionLog ?? false,
      sessions: agent.sessions,
      projectTrustConfigArg,
    });
  }

  describe(): ExecutorDescriptor {
    // The headless CLI surfaces in the matrix expose no seed or temperature knob.
    return {
      kind: 'cli',
      model: 'cli-configured',
      detail: `${this.label}: ${this.argv.join(' ')}${this.projectTrustConfigArg ? ' (trusts each disposable project for config loading)' : ''}`,
      sampling: null,
    };
  }

  run(prompt: string, workdir: string): Promise<ExecutorResult> {
    const startedAtMs = Date.now();
    let argv = this.argv;
    if (this.projectTrustConfigArg) {
      if (!workdir || argv.at(-1) !== '-' || !this.projectTrustConfigArg.includes('{workdir}')) {
        return Promise.reject(new Error('Project trust override requires a workdir and a stdin CLI template ending in "-"'));
      }
      if (/[\r\n'\"]/.test(workdir)) {
        return Promise.reject(new Error('Project trust override cannot encode quotes or newlines in the workdir path'));
      }
      argv = [...argv.slice(0, -1), '-c', this.projectTrustConfigArg.replaceAll('{workdir}', workdir), '-'];
    }
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
      const deadline = new ExecutionDeadline(this.timeoutMs, this.clock);
      const child = spawn(spawnCommand, spawnArgs, {
        cwd: workdir,
        shell: this.shell,
        env: { ...process.env, ...this.env },
        ...treeSpawnOptions(),
      });
      let stdout = '';
      let stderr = '';
      let bytes = 0;
      let timedOut = false;
      let overflow = false;
      let stopping = false;
      let drainTimer: NodeJS.Timeout | undefined;
      const parseResult = (): ExecutorResult => ({
        ...(this.triggerSkillName !== undefined
          ? parseStreamJsonTranscript(stdout, this.triggerToolName, this.triggerSkillName)
          : { output: stdout }), executionTiming: deadline.snapshot(),
      });
      const failure = (message: string): ExecutorFailure => {
        const result = parseResult();
        if (this.partialUsageFromSessionLog && this.sessions) {
          const snapshot = probeCodexPartialUsage({ sessions: this.sessions, stdout, workdir, startedAtMs,
            finishedAtMs: Date.now(), homeDir: this.homeDir, env: { ...process.env, ...this.env } });
          // Never replace a more complete public counter with a smaller local snapshot.
          if (snapshot && (['input', 'cachedInput', 'output'] as const).every(key => (snapshot.tokens[key] ?? 0) >= (result.tokens?.[key] ?? 0))) {
            result.tokens = snapshot.tokens; result.usageEvidence = snapshot.evidence;
          }
        }
        return new ExecutorFailure(message, { ...result, usageStatus: 'partial' });
      };
      const stopMessage = (): string => overflow
        ? `"${command}" produced more than ${MAX_AGENT_OUTPUT_BYTES} bytes of output`
        : deadline.timingError ? `"${command}" execution timing anomaly: ${deadline.timingError}`
          : `"${command}" timed out after ${this.timeoutMs}ms`;
      const stopChild = (): void => {
        if (stopping) return;
        stopping = true;
        deadline.markTermination(timedOut);
        killTree(child);
        // A descendant that escaped the process group can retain a pipe after its parent dies.
        // Bound pipe draining too; the normal close handler still collects output first.
        drainTimer = setTimeout(() => {
          deadline.observe();
          clearTimers();
          child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
          rejectPromise(failure(stopMessage()));
        }, 2000);
      };
      const checkDeadline = (terminate = true): void => {
        deadline.observe();
        if (!timedOut && !deadline.timingError && !deadline.exceeded) return;
        timedOut ||= deadline.exceeded && deadline.timingError === null;
        if (terminate) stopChild();
      };
      const timer = setTimeout(() => {
        checkDeadline();
      }, this.timeoutMs);
      const heartbeat = setInterval(() => checkDeadline(), deadline.heartbeatMs);
      const clearTimers = (): void => { clearTimeout(timer); clearInterval(heartbeat); clearTimeout(drainTimer); };
      const take = (chunk: Buffer, sink: 'stdout' | 'stderr'): void => {
        checkDeadline();
        bytes += chunk.length;
        if (bytes > MAX_AGENT_OUTPUT_BYTES) {
          overflow = true;
          stopChild();
          return;
        }
        if (sink === 'stdout') stdout += chunk.toString('utf8');
        else stderr += chunk.toString('utf8');
      };
      child.stdout.on('data', (chunk: Buffer) => take(chunk, 'stdout'));
      child.stderr.on('data', (chunk: Buffer) => take(chunk, 'stderr'));
      child.on('error', (error) => {
        clearTimers();
        deadline.observe();
        rejectPromise(new ExecutorFailure(`Failed to start "${command}": ${error.message}`, { output: '', executionTiming: deadline.snapshot() }));
      });
      child.on('close', (code) => {
        checkDeadline(false);
        clearTimers();
        if (overflow) {
          rejectPromise(failure(`"${command}" produced more than ${MAX_AGENT_OUTPUT_BYTES} bytes of output`));
          return;
        }
        if (deadline.timingError) {
          rejectPromise(failure(`"${command}" execution timing anomaly: ${deadline.timingError}`));
          return;
        }
        if (timedOut) {
          rejectPromise(failure(`"${command}" timed out after ${this.timeoutMs}ms`));
          return;
        }
        if (code !== 0) {
          const detail = (this.triggerSkillName !== undefined ? terminalStreamError(stdout) : null)
            ?? stderr.trim().slice(0, 500);
          rejectPromise(
            failure(`"${command}" exited with code ${code ?? 'null'}${detail ? `: ${detail}` : ''}`),
          );
          return;
        }
        const result = parseResult();
        // Capability from the matrix, not an agent name: this surface reports no usable token counts
        // in its transcript, so they are read from its session log afterwards. probeKimiSessionUsage
        // is currently the only implementation, which is why the flag is set on exactly one agent.
        if (this.usageFromSessionLog && result.tokens === undefined) {
          void probeKimiSessionUsage(workdir, startedAtMs, undefined, { ...process.env, ...this.env })
            .then((usage) => {
              if (usage) result.tokens = { input: usage.input, output: usage.output };
              resolvePromise(result);
            })
            .catch(() => resolvePromise(result));
          return;
        }
        resolvePromise(result);
      });
      if (this.promptVia === 'stdin') {
        // A child that exits before draining stdin makes the write fail (EPIPE on POSIX, EOF on
        // Windows). With no listener that surfaces as an uncaught exception rather than a rejection,
        // so the caller's catch never runs and the process dies mid-trial leaving a half-populated
        // run group behind. Reject instead, and kill the child so it cannot outlive the failure.
        child.stdin.on('error', (error: Error) => {
          clearTimers();
          deadline.observe();
          killTree(child);
          rejectPromise(
            new ExecutorFailure(`Failed to write the prompt to "${command}" on stdin: ${error.message}`, { output: stdout, executionTiming: deadline.snapshot(), usageStatus: 'partial' }),
          );
        });
        child.stdin.write(prompt, 'utf8');
      }
      child.stdin.end();
    });
  }
}

/** Public terminal stream failures are more useful than leading startup warnings. */
function terminalStreamError(stdout: string): string | null {
  let lastError: string | null = null;
  let terminalError: string | null = null;
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line) as { type?: string; message?: unknown; error?: { message?: unknown } };
      if (event?.type === 'turn.failed' && typeof event.error?.message === 'string') terminalError = event.error.message;
      else if (event?.type === 'error' && typeof event.message === 'string') lastError = event.message;
    } catch { /* Other output remains in the retained transcript. */ }
  }
  return (terminalError ?? lastError)?.trim().slice(0, 500) || null;
}

interface StreamJsonTranscript {
  output: string;
  skillTriggered?: boolean;
  rawOutput?: string;
  tokens?: TokenUsage;
  usageStatus?: 'final' | 'partial';
}

function parseStreamJsonTranscript(
  stdout: string,
  triggerToolName: string,
  skillName: string,
): StreamJsonTranscript {
  const textParts: string[] = [];
  let parsedAny = false;
  let triggered = false;
  let tokens: TokenUsage | undefined;
  let usageTurns = 0;
  const totals = { input: 0, output: 0, cachedInput: 0 };
  const coverage = { input: 0, output: 0, cachedInput: 0 };
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
      usageTurns++;
      const usage = record.usage;
      if (typeof usage === 'object' && usage !== null) {
        const usageRecord = usage as Record<string, unknown>;
        const count = (value: unknown): number | undefined =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
        const input = count(usageRecord.input_tokens);
        const cachedInput = count(usageRecord.cached_input_tokens);
        const values = { input, output: count(usageRecord.output_tokens), cachedInput:
          input !== undefined && cachedInput !== undefined && cachedInput <= input ? cachedInput : undefined };
        // Codex records per-turn increments. Missing fields on any completed turn prevent
        // treating the aggregate as complete; in particular missing cache counts are not zero.
        for (const field of ['input', 'output', 'cachedInput'] as const) {
          if (values[field] !== undefined) {
            totals[field] += values[field];
            coverage[field]++;
          }
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
  let usageStatus: 'final' | 'partial' | undefined;
  if (usageTurns > 0) {
    tokens = {};
    for (const field of ['input', 'output', 'cachedInput'] as const) {
      if (coverage[field] > 0 && (field !== 'cachedInput' || coverage[field] === usageTurns)) tokens[field] = totals[field];
    }
    if (Object.keys(tokens).length === 0) tokens = undefined;
    usageStatus = coverage.input === usageTurns && coverage.output === usageTurns ? 'final' : 'partial';
  }
  return { output: textParts.join('\n'), skillTriggered: triggered, rawOutput: stdout, tokens, usageStatus };
}
