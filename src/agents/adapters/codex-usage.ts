import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import type { AgentSessions } from "../matrix.js";
import { resolveHome, walkGlob } from '../../shared/local-files.js';
import type { TokenUsage, UsageEvidence } from "../contracts.js";

const MAX_LOG_BYTES = 16 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const canonical = (path: string): string => { try { return realpathSync(path); } catch { return resolve(path); } };

/** Numeric-only, identity-bound snapshot. Internal rollout formats are best-effort. */
export function probeCodexPartialUsage(options: {
  sessions: AgentSessions; stdout: string; workdir: string; startedAtMs: number; finishedAtMs: number;
  homeDir?: string; env?: NodeJS.ProcessEnv;
}): { tokens: TokenUsage; evidence: UsageEvidence } | undefined {
  if (options.sessions.wireShape !== 'codex-rollout') return undefined;
  try {
    const ids = new Set<string>();
    for (const line of options.stdout.split(/\r?\n/)) {
      try {
        const event = JSON.parse(line);
        if (event?.type === 'thread.started' && typeof event.thread_id === 'string' && UUID.test(event.thread_id)) ids.add(event.thread_id);
      } catch { /* Public output may be incomplete. */ }
    }
    if (ids.size !== 1) return undefined;
    const id = [...ids][0]!;
    const env = options.env ?? process.env, cfg = options.sessions;
    const override = options.homeDir === undefined && cfg.homeOverride ? env[cfg.homeOverride.env] : undefined;
    const root = override && cfg.homeOverride
      ? join(isAbsolute(override) ? override : resolve(options.workdir, override), cfg.homeOverride.relativePath)
      : resolveHome(cfg.dir, options.homeDir ?? homedir());
    const matches = walkGlob(root, cfg.transcriptGlob).filter(path => path.endsWith(`-${id}.jsonl`));
    if (matches.length !== 1) return undefined;
    const info = lstatSync(matches[0]!);
    if (!info.isFile() || info.size > MAX_LOG_BYTES) return undefined;
    const bytes = readFileSync(matches[0]!);
    if (bytes.length > MAX_LOG_BYTES) return undefined;
    let identity = false;
    let identitySeen = false;
    let last: { tokens: Required<TokenUsage>; evidence: UsageEvidence } | undefined;
    for (const line of bytes.toString('utf8').split(/\r?\n/)) {
      let event; try { event = JSON.parse(line); } catch { continue; }
      const at = Date.parse(event?.timestamp);
      if (!Number.isFinite(at) || at < options.startedAtMs - 5000 || at > options.finishedAtMs) continue;
      if (event?.type === 'session_meta') {
        if (identitySeen) return undefined;
        identitySeen = true;
        identity = event.payload?.id === id && typeof event.payload?.cwd === 'string' && canonical(event.payload.cwd) === canonical(options.workdir);
        if (!identity) return undefined;
      }
      if (event?.type !== 'event_msg' || event.payload?.type !== 'token_count') continue;
      if (!identity) return undefined;
      const usage = event.payload.info?.total_token_usage;
      const values = [usage?.input_tokens, usage?.cached_input_tokens, usage?.output_tokens];
      if (values.some(value => !Number.isSafeInteger(value) || value < 0) || usage.cached_input_tokens > usage.input_tokens) return undefined;
      const tokens = { input: usage.input_tokens as number, cachedInput: usage.cached_input_tokens as number, output: usage.output_tokens as number };
      if (last && (at < Date.parse(last.evidence.counterAt) || tokens.input < last.tokens.input || tokens.cachedInput < last.tokens.cachedInput || tokens.output < last.tokens.output)) return undefined;
      last = { tokens, evidence: { source: 'local-session-token-count', threadId: id, counterAt: event.timestamp,
        recordSha256: createHash('sha256').update(line).digest('hex'), tokens,
        scope: 'Partial cumulative usage through this matched local event; not final usage or complete billing.' } };
    }
    return identity ? last : undefined;
  } catch { return undefined; }
}
