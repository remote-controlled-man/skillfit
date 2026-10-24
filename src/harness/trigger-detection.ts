import { posix } from 'node:path';
import { realpathSync } from 'node:fs';
import { parseCommand } from './command.js';

import { triggerDetection, type StreamWireShape, type TriggerDetection, type TriggerEvidence } from './trigger-contract.js';
export { triggerDetection, parseTriggerDetection, parseTriggerEvidence } from './trigger-contract.js';
export type { StreamWireShape, TriggerDetection, TriggerEvidence } from './trigger-contract.js';

function normalizedPath(path: string): string {
  return posix.normalize(path.replace(/\\+/g, '/'));
}

/** Deliberately recognize only literal read commands, never evaluate shell text. */
function readPaths(command: string, depth = 0, windowsShell = process.platform === 'win32'): string[] | null {
  if (depth > 2 || /[;&|<>$`\r\n]/.test(command)) return null;
  if (command.trimStart().startsWith('#')) return [];
  if (command.includes('#')) return null;
  let args: string[];
  try { args = parseCommand(command); } catch { return null; }
  const executable = args.shift()!.replaceAll('\\', '/').split('/').at(-1)!.replace(/\.exe$/i, '').toLowerCase();
  if (['sh', 'bash', 'zsh', 'powershell', 'pwsh'].includes(executable)) {
    return args.length === 2 && ['-c', '-lc', '-command'].includes(args[0]!.toLowerCase())
      ? readPaths(args[1]!, depth + 1, ['powershell', 'pwsh'].includes(executable)) : null;
  }
  if (executable === 'type' && !windowsShell) return [];
  if (['echo', 'printf', 'write-output', 'rg', 'grep'].includes(executable)) return [];
  if (executable === 'sed') {
    if (args[0] !== '-n' || !/^\d+(,\d+)?p$/.test(args[1] ?? '')) return null;
    args = args.slice(2);
  } else if (executable === 'get-content') {
    const paths: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (['-raw', '-path', '-literalpath'].includes(arg.toLowerCase())) continue;
      if (arg.startsWith('-')) return null;
      paths.push(arg);
    }
    args = paths;
  } else if (executable === 'cat') {
    args = args.filter(arg => arg !== '--' && !/^-[AbenstuvET]+$/.test(arg));
  } else if (executable !== 'type') return null;
  // Windows temp roots commonly contain literal 8.3 names such as RUNNER~1.
  // Only a drive-qualified Windows path makes that tilde unambiguously literal.
  return args.length && args.every(arg => !arg.startsWith('-') && !/[*?\[\]{},()%]/.test(arg) &&
    (!arg.includes('~') || (windowsShell && /^[A-Za-z]:[\\/]/.test(arg))) &&
    !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(arg) &&
    !(!windowsShell && ['cat', 'sed'].includes(executable) && arg.includes('\\'))) ? args : null;
}

export function observesSkillRead(command: string, paths: readonly string[], workdir: string): string | false | null {
  const reads = readPaths(command);
  if (reads === null || !paths.length) return null;
  const resolve = (path: string, root = workdir) => normalizedPath(/^(?:\/|[A-Za-z]:[\\/])/.test(path) ? path : `${root}/${path}`);
  const roots = [workdir];
  try { roots.push(realpathSync(workdir)); } catch { /* Offline Windows/synthetic paths need not exist on this host. */ }
  const expected = roots.flatMap(root => paths.map(path => resolve(path, root)));
  for (const path of reads) if (roots.some(root => expected.includes(resolve(path, root)))) return path;
  return false;
}

export interface DetectionOptions {
  wireShape?: StreamWireShape;
  toolName: string;
  skillKey: string;
  identities: readonly string[];
  skillPaths: readonly string[];
  workdir: string;
}

/** A missing/ambiguous observation is not a negative detection. */
export class TriggerObserver {
  private shape?: StreamWireShape;
  private invalid = false;
  private terminal = false;
  private started = false;
  private matched: string | null = null;
  private lines: number[] = [];
  constructor(private readonly options: DetectionOptions) { this.shape = options.wireShape; }

  malformed(): void { this.invalid = true; }
  private skill(args: unknown, line: number): void {
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { this.malformed(); return; } }
    if (!args || typeof args !== 'object' || Array.isArray(args)) { this.malformed(); return; }
    const identity = (args as Record<string, unknown>)[this.options.skillKey];
    if (typeof identity !== 'string' || !identity) { this.malformed(); return; }
    if (this.options.identities.includes(identity)) { this.matched ??= identity; this.lines.push(line); }
  }

  event(row: Record<string, unknown>, line: number): void {
    const inferred: StreamWireShape | undefined = typeof row.role === 'string' ? 'flat-tool-call'
      : ['thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'item.started', 'item.completed'].includes(String(row.type)) ? 'codex-items'
        : ['assistant', 'user', 'system', 'result', 'stream_event'].includes(String(row.type)) ? 'content-blocks' : undefined;
    if (!inferred || (this.shape && inferred !== this.shape)) { this.malformed(); return; }
    this.shape ??= inferred;
    if (inferred === 'flat-tool-call') {
      if (!['assistant', 'tool', 'user', 'system', 'meta'].includes(String(row.role))) { this.malformed(); return; }
      this.terminal = false;
      if (row.role !== 'assistant') return;
      if (row.tool_calls !== undefined && !Array.isArray(row.tool_calls)) { this.malformed(); return; }
      const calls = (row.tool_calls ?? []) as unknown[];
      for (const call of calls) {
        const fn = call && typeof call === 'object' ? (call as Record<string, unknown>).function : null;
        if (!fn || typeof fn !== 'object') { this.malformed(); continue; }
        const f = fn as Record<string, unknown>;
        if (typeof f.name !== 'string') { this.malformed(); continue; }
        if (f.name === this.options.toolName) this.skill(f.arguments, line);
      }
      this.terminal = calls.length === 0 && typeof row.content === 'string' && row.content.length > 0 &&
        (row.finish_reason === undefined || row.finish_reason === 'stop' || row.finish_reason === 'end_turn');
    } else if (inferred === 'content-blocks') {
      if (row.type === 'system' && row.subtype === 'init') this.started = true;
      if (row.type === 'result') { this.terminal = row.subtype === 'success' && row.is_error === false; return; }
      this.terminal = false;
      if (row.type !== 'assistant') return;
      const message = row.message as Record<string, unknown> | null;
      if (!message || !Array.isArray(message.content)) { this.malformed(); return; }
      for (const block of message.content) {
        if (!block || typeof block !== 'object') { this.malformed(); continue; }
        if (!['text', 'thinking', 'redacted_thinking', 'tool_use'].includes(block.type)) { this.malformed(); continue; }
        if (block.type === 'tool_use' && typeof block.name !== 'string') this.malformed();
        if (block.type === 'tool_use' && block.name === this.options.toolName) this.skill(block.input, line);
      }
    } else {
      if (row.type === 'thread.started') this.started = true;
      this.terminal = row.type === 'turn.completed';
      if (row.type !== 'item.started' && row.type !== 'item.completed') return;
      this.terminal = false;
      const item = row.item as Record<string, unknown> | null;
      if (!item || typeof item.type !== 'string') { this.malformed(); return; }
      if (item.type !== 'command_execution') return;
      if (typeof item.command !== 'string') { this.malformed(); return; }
      const read = observesSkillRead(item.command, this.options.skillPaths, this.options.workdir);
      if (read === null) this.malformed();
      else if (read !== false) { this.matched ??= this.options.identities[0] ?? null; this.lines.push(line); }
    }
  }

  finish(succeeded: boolean): TriggerEvidence {
    const complete = succeeded && !!this.shape && (this.shape === 'flat-tool-call' || this.started) && this.terminal && !this.invalid;
    return { status: this.matched ? 'observed' : complete ? 'not-observed' : 'unknown', complete,
      matchedIdentity: this.matched, eventLines: [...new Set(this.lines)] };
  }
}
