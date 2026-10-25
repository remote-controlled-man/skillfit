import { installedUserSkills } from '../agents/installed-skills.js';
export { installedUserSkills } from '../agents/installed-skills.js';
import { resolveHome, walkGlob } from '../shared/local-files.js';
export { resolveHome, walkGlob } from '../shared/local-files.js';
import { extractSkillNames, sessionKey } from "../agents/session-observation.js";
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { agentIds, getAgent, type AgentDef, type AgentSessions } from "../agents/matrix.js";

export interface SkillReceipt {
  name: string;
  fires: number;
  sessionCount: number;
  lastSeen: number | null;
}

export interface SkillTax {
  descTokens: number;
  bodyTokens: number;
}

export interface AgentReceipt {
  agentId: string;
  sessionsDir: string;
  present: boolean;
  sessionsFound: number;
  transcriptsRead: number;
  skills: SkillReceipt[];
  installed: string[];
  installedCount: number;
  neverFired: string[];
  tax: {
    descTokensTotal: number;
    bodyTokensMedian: number;
    heaviest: Array<{ name: string; descTokens: number }>;
  };
}

export interface ReceiptsOptions {
  homeDir?: string;
  agent?: string;
  env?: NodeJS.ProcessEnv;
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function measureSkillTax(skillDir: string): SkillTax {
  const file = join(skillDir, 'SKILL.md');
  const empty = { descTokens: 0, bodyTokens: 0 };
  if (!existsSync(file)) return empty;
  const text = readFileSync(file, 'utf8');
  let description = '';
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) {
      const frontmatter = text.slice(3, end);
      const match = /^description:\s*(.+)$/m.exec(frontmatter);
      description = match?.[1]?.trim() ?? '';
    }
  }
  return { descTokens: estimateTokens(description), bodyTokens: estimateTokens(text) };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

export async function collectAgentReceipt(
  agent: AgentDef,
  homeDir: string,
  env: NodeJS.ProcessEnv = {},
): Promise<AgentReceipt> {
  const emptyTax = { descTokensTotal: 0, bodyTokensMedian: 0, heaviest: [] };
  const cfg = agent.sessions;
  if (!cfg) {
    return {
      agentId: agent.id,
      sessionsDir: '',
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installed: [],
      installedCount: 0,
      neverFired: [],
      tax: emptyTax,
    };
  }
  const homeOverride = cfg.homeOverride;
  const overrideRoot = homeOverride === undefined ? undefined : env[homeOverride.env];
  const sessionsDir = overrideRoot
    ? resolve(overrideRoot, homeOverride!.relativePath)
    : resolveHome(cfg.dir, homeDir);
  const installed = installedUserSkills(agent, homeDir, env);
  const taxes = installed.map((skill) => ({ name: skill.name, ...measureSkillTax(skill.dir) }));
  const tax = {
    descTokensTotal: taxes.reduce((sum, entry) => sum + entry.descTokens, 0),
    bodyTokensMedian: median(taxes.map((entry) => entry.bodyTokens)),
    heaviest: [...taxes]
      .sort((a, b) => b.descTokens - a.descTokens)
      .filter((entry) => entry.descTokens > 0)
      .slice(0, 3)
      .map((entry) => ({ name: entry.name, descTokens: entry.descTokens })),
  };
  if (!existsSync(sessionsDir)) {
    return {
      agentId: agent.id,
      sessionsDir,
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installed: installed.map((skill) => skill.name),
      installedCount: installed.length,
      neverFired: installed.map((skill) => skill.name),
      tax,
    };
  }
  const transcripts = walkGlob(sessionsDir, cfg.transcriptGlob);
  const perSkill = new Map<string, { fires: number; sessions: Set<string>; lastSeen: number }>();
  const allSessions = new Set<string>();
  for (const file of transcripts) {
    const rel = relative(sessionsDir, file).split('\\').join('/');
    const session = sessionKey(rel, cfg);
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
    installed: installed.map((skill) => skill.name),
    installedCount: installed.length,
    neverFired: installed.filter((skill) => !perSkill.has(skill.name)).map((skill) => skill.name),
    tax,
  };
}

export async function collectReceipts(options: ReceiptsOptions = {}): Promise<AgentReceipt[]> {
  const homeDir = options.homeDir ?? homedir();
  const env = options.env ?? (options.homeDir === undefined ? process.env : {});
  const ids = options.agent ? [options.agent] : agentIds();
  const receipts: AgentReceipt[] = [];
  for (const id of ids) {
    receipts.push(await collectAgentReceipt(getAgent(id), homeDir, env));
  }
  return receipts;
}
