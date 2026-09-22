import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SessionUsage {
  input: number;
  output: number;
}

interface UsageEventUsage {
  inputOther?: number;
  inputCacheRead?: number;
  inputCacheCreation?: number;
  output?: number;
}

function sessionsRoot(homeDir?: string): string {
  const kimiHome = process.env['KIMI_CODE_HOME'];
  return kimiHome ? join(kimiHome, 'sessions') : join(homeDir ?? homedir(), '.kimi-code', 'sessions');
}

export function workDirKeyHash(workdir: string): string {
  return createHash('sha256').update(workdir.replaceAll('\\', '/'), 'utf8').digest('hex').slice(0, 12);
}

export function probeKimiSessionUsage(
  workdir: string,
  startedAtMs: number,
  homeDir?: string,
): SessionUsage | undefined {
  const root = sessionsRoot(homeDir);
  if (!existsSync(root)) return undefined;
  const suffix = `_${workDirKeyHash(workdir)}`;
  let buckets;
  try {
    buckets = readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  let newest: { file: string; mtime: number } | null = null;
  for (const bucket of buckets) {
    if (!bucket.isDirectory() || !bucket.name.endsWith(suffix)) continue;
    let sessions;
    try {
      sessions = readdirSync(join(root, bucket.name), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      const wire = join(root, bucket.name, session.name, 'agents', 'main', 'wire.jsonl');
      if (!existsSync(wire)) continue;
      const mtime = statSync(wire).mtimeMs;
      if (mtime < startedAtMs - 5000) continue;
      if (!newest || mtime > newest.mtime) newest = { file: wire, mtime };
    }
  }
  if (!newest) return undefined;

  let input = 0;
  let output = 0;
  let seen = false;
  for (const line of readFileSync(newest.file, 'utf8').split('\n')) {
    if (!line.includes('usage.record')) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof event !== 'object' || event === null) continue;
    const record = event as Record<string, unknown>;
    if (record['type'] !== 'usage.record') continue;
    const usage = record['usage'] as UsageEventUsage | undefined;
    if (typeof usage !== 'object' || usage === null) continue;
    seen = true;
    input += (usage.inputOther ?? 0) + (usage.inputCacheRead ?? 0) + (usage.inputCacheCreation ?? 0);
    output += usage.output ?? 0;
  }
  return seen ? { input, output } : undefined;
}
