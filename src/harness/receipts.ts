import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { agentIds, getAgent, type AgentDef, type AgentSessions } from '../agents.js';

export interface SkillReceipt {
  name: string;
  fires: number;
  sessionCount: number;
  lastSeen: number | null;
}

export interface AgentReceipt {
  agentId: string;
  sessionsDir: string;
  present: boolean;
  sessionsFound: number;
  transcriptsRead: number;
  skills: SkillReceipt[];
  installedCount: number;
  neverFired: string[];
}

export interface ReceiptsOptions {
  homeDir?: string;
  agent?: string;
}

export function resolveHome(dirPattern: string, homeDir: string): string {
  return dirPattern.startsWith('~') ? join(homeDir, dirPattern.slice(1)) : dirPattern;
}

function matchSegment(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const star = pattern.indexOf('*');
  if (star === -1) return name === pattern;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return (
    name.startsWith(prefix) &&
    name.endsWith(suffix) &&
    name.length >= prefix.length + suffix.length
  );
}

export function walkGlob(rootDir: string, pattern: string): string[] {
  const segments = pattern.split('/');
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth === segments.length) {
      if (statSync(dir).isFile()) out.push(dir);
      return;
    }
    const segment = segments[depth];
    if (segment === undefined) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (segment === '**') {
      walk(dir, depth + 1);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), depth);
        }
      }
      return;
    }
    for (const entry of entries) {
      if (matchSegment(entry.name, segment)) {
        walk(join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(rootDir, 0);
  return out.sort();
}

function extractSkillNames(event: Record<string, unknown>, cfg: AgentSessions): string[] {
  const names: string[] = [];
  const skillKey = cfg.skillKey ?? 'skill';
  if (cfg.wireShape === 'flat-tool-call') {
    let target = event;
    if (event['type'] === 'context.append_loop_event') {
      const nested = event['event'];
      if (typeof nested === 'object' && nested !== null) {
        target = nested as Record<string, unknown>;
      }
    }
    if (target['type'] === 'tool.call' && target['name'] === cfg.skillToolName) {
      const args = target['args'];
      if (typeof args === 'object' && args !== null) {
        const skill = (args as Record<string, unknown>)[skillKey];
        if (typeof skill === 'string' && skill !== '') names.push(skill);
      }
    }
    return names;
  }
  if (cfg.wireShape === 'codex-rollout') {
    if (event['type'] !== 'response_item') return names;
    const payload = event['payload'];
    if (typeof payload !== 'object' || payload === null) return names;
    const record = payload as Record<string, unknown>;
    if (record['type'] !== 'custom_tool_call') return names;
    const input = record['input'];
    if (typeof input !== 'string') return names;
    const normalized = input.replace(/\\+/g, '/');
    for (const match of normalized.matchAll(/skills\/([\w.-]+)\/SKILL\.md/gi)) {
      const name = match[1];
      if (name) names.push(name);
    }
    return names;
  }
  if (event['type'] !== 'assistant') return names;
  const message = event['message'];
  const content =
    typeof message === 'object' && message !== null
      ? (message as Record<string, unknown>)['content']
      : undefined;
  if (!Array.isArray(content)) return names;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const record = block as Record<string, unknown>;
    if (record['type'] === 'tool_use' && record['name'] === cfg.skillToolName) {
      const input = record['input'];
      if (typeof input === 'object' && input !== null) {
        const skill = (input as Record<string, unknown>)[skillKey];
        if (typeof skill === 'string' && skill !== '') names.push(skill);
      }
    }
  }
  return names;
}

function sessionKey(relPath: string, wireShape: string): string {
  const parts = relPath.split('/');
  if (wireShape === 'flat-tool-call') {
    return parts[1] ?? relPath;
  }
  const last = parts[parts.length - 1] ?? relPath;
  return last.replace(/\.jsonl$/, '');
}

async function scanTranscript(
  file: string,
  cfg: AgentSessions,
): Promise<Map<string, number>> {
  const fires = new Map<string, number>();
  const stream = createReadStream(file, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed === '' || !trimmed.startsWith('{')) continue;
      let event: unknown;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (typeof event !== 'object' || event === null) continue;
      for (const name of extractSkillNames(event as Record<string, unknown>, cfg)) {
        fires.set(name, (fires.get(name) ?? 0) + 1);
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return fires;
}

export function installedUserSkills(agent: AgentDef, homeDir: string): string[] {
  const names = new Set<string>();
  for (const dirPattern of agent.skills.userDirs) {
    const dir = resolveHome(dirPattern, homeDir);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(dir, entry.name, 'SKILL.md'))) {
        names.add(entry.name);
      }
    }
  }
  return [...names].sort();
}

export async function collectAgentReceipt(
  agent: AgentDef,
  homeDir: string,
): Promise<AgentReceipt> {
  const cfg = agent.sessions;
  if (!cfg) {
    return {
      agentId: agent.id,
      sessionsDir: '',
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installedCount: 0,
      neverFired: [],
    };
  }
  const sessionsDir = resolveHome(cfg.dir, homeDir);
  const installed = installedUserSkills(agent, homeDir);
  if (!existsSync(sessionsDir)) {
    return {
      agentId: agent.id,
      sessionsDir,
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installedCount: installed.length,
      neverFired: installed,
    };
  }
  const transcripts = walkGlob(sessionsDir, cfg.transcriptGlob);
  const perSkill = new Map<string, { fires: number; sessions: Set<string>; lastSeen: number }>();
  const allSessions = new Set<string>();
  for (const file of transcripts) {
    const rel = relative(sessionsDir, file).split('\\').join('/');
    const session = sessionKey(rel, cfg.wireShape);
    allSessions.add(session);
    const mtime = statSync(file).mtimeMs;
    const fires = await scanTranscript(file, cfg);
    for (const [name, count] of fires) {
      const entry = perSkill.get(name) ?? { fires: 0, sessions: new Set<string>(), lastSeen: 0 };
      entry.fires += count;
      entry.sessions.add(session);
      entry.lastSeen = Math.max(entry.lastSeen, mtime);
      perSkill.set(name, entry);
    }
  }
  const skills: SkillReceipt[] = [...perSkill.entries()]
    .map(([name, entry]) => ({
      name,
      fires: entry.fires,
      sessionCount: entry.sessions.size,
      lastSeen: entry.lastSeen,
    }))
    .sort((a, b) => b.fires - a.fires || a.name.localeCompare(b.name));
  return {
    agentId: agent.id,
    sessionsDir,
    present: true,
    sessionsFound: allSessions.size,
    transcriptsRead: transcripts.length,
    skills,
    installedCount: installed.length,
    neverFired: installed.filter((name) => !perSkill.has(name)),
  };
}

export async function collectReceipts(options: ReceiptsOptions = {}): Promise<AgentReceipt[]> {
  const homeDir = options.homeDir ?? homedir();
  const ids = options.agent ? [options.agent] : agentIds();
  const receipts: AgentReceipt[] = [];
  for (const id of ids) {
    receipts.push(await collectAgentReceipt(getAgent(id), homeDir));
  }
  return receipts;
}
