import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { getAgent } from "../matrix.js";

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

function sessionsRoot(homeDir: string | undefined, env: NodeJS.ProcessEnv): string {
  const sessions = getAgent('kimi-code').sessions;
  const fallback = '.kimi-code/sessions';
  const relative = sessions?.dir.startsWith('~/') ? sessions.dir.slice(2) : (sessions?.dir ?? fallback);
  // An injected home is a fixture root. Do not let the process environment redirect the read.
  if (homeDir !== undefined) return join(homeDir, relative);
  const override = sessions?.homeOverride;
  const overrideRoot = override === undefined ? undefined : env[override.env];
  if (override && overrideRoot) return join(overrideRoot, override.relativePath);
  return join(homedir(), relative);
}

export function workDirKeyHash(workdir: string): string {
  return createHash('sha256').update(workdir.replaceAll('\\', '/'), 'utf8').digest('hex').slice(0, 12);
}

export async function probeKimiSessionUsage(
  workdir: string,
  startedAtMs: number,
  homeDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionUsage | undefined> {
  const root = sessionsRoot(homeDir, env);
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

  return usageFromWire(newest.file);
}

async function usageFromWire(file: string): Promise<SessionUsage | undefined> {
  const lines = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let input = 0;
  let output = 0;
  let seen = false;
  try {
    for await (const line of lines) {
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
  } finally {
    lines.close();
  }
  return seen ? { input, output } : undefined;
}
