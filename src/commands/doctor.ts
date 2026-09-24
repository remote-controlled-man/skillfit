import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, type Dirent, type Stats } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { agentIds, getAgent, loadMatrix, type AgentDef } from '../agents.js';

const CLAUDE_MD_MAX_LINES = 200;
const AGENTS_MD_MAX_BYTES = 32 * 1024;
const SKILL_COUNT_WARN_THRESHOLD = 10;
const MCP_SERVER_WARN_THRESHOLD = 10;
const WHICH_TIMEOUT_MS = 5000;
const SKILL_FILE = 'SKILL.md';
const AGENTS_MD = 'AGENTS.md';
const AGENTS_MD_IMPORT = '@AGENTS.md';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface Check {
  status: CheckStatus;
  message: string;
}

export interface Section {
  title: string;
  checks: Check[];
}

export interface DetectionEntry {
  id: string;
  displayName: string;
  detected: boolean;
  evidence: string[];
}

export interface AgentHealthReport {
  id: string;
  displayName: string;
  detected: boolean;
  sections: Section[];
}

export interface DoctorReport {
  homeDir: string;
  cwd: string;
  detection: DetectionEntry[];
  health: AgentHealthReport[];
}

export interface DoctorOptions {
  agent?: string;
  homeDir?: string;
  cwd?: string;
  which?: (binary: string) => string | null;
}

export interface RunDoctorArgs {
  agent?: string;
  dryRun?: boolean;
  yes?: boolean;
}

interface Ctx {
  homeDir: string;
  cwd: string;
  which: (binary: string) => string | null;
}

function check(status: CheckStatus, message: string): Check {
  return { status, message };
}

function statOrNull(p: string): Stats | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function isFile(p: string): boolean {
  return statOrNull(p)?.isFile() ?? false;
}

function isDirectory(p: string): boolean {
  return statOrNull(p)?.isDirectory() ?? false;
}

function readText(p: string): string | null {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function readDir(p: string): Dirent[] | null {
  try {
    return readdirSync(p, { withFileTypes: true });
  } catch {
    return null;
  }
}

function resolveSpecPath(spec: string, ctx: Ctx): string {
  if (spec === '~') return ctx.homeDir;
  if (spec.startsWith('~/') || spec.startsWith('~\\')) return path.join(ctx.homeDir, spec.slice(2));
  if (path.isAbsolute(spec)) return spec;
  return path.join(ctx.cwd, spec);
}

function defaultWhich(binary: string): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [binary], {
    encoding: 'utf8',
    timeout: WHICH_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  const first = (result.stdout ?? '').split(/\r?\n/).find((line) => line.trim() !== '');
  return first?.trim() ?? null;
}

function unquote(value: string): string {
  const match = /^(['"])([\s\S]*)\1$/.exec(value);
  return match?.[2] ?? value;
}

export function parseFrontmatter(content: string): Record<string, string> | null {
  const text = content.replace(/^\uFEFF/, '');
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match || match[1] === undefined) return null;
  const fields: Record<string, string> = {};
  let blockKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/.exec(line);
    if (kv && kv[1] !== undefined) {
      const value = (kv[2] ?? '').trim();
      if (value === '>' || value === '|') {
        fields[kv[1]] = '';
        blockKey = kv[1];
      } else {
        fields[kv[1]] = unquote(value);
        blockKey = null;
      }
      continue;
    }
    if (blockKey !== null && /^\s+\S/.test(line)) {
      const prior = fields[blockKey] ?? '';
      fields[blockKey] = prior === '' ? line.trim() : `${prior} ${line.trim()}`;
      continue;
    }
    blockKey = null;
  }
  return fields;
}

function skillFrontmatterError(content: string): string | null {
  const fields = parseFrontmatter(content);
  if (fields === null) return 'missing or malformed YAML frontmatter';
  const missing = ['name', 'description'].filter((key) => !(fields[key] ?? '').trim());
  if (missing.length > 0) return `frontmatter missing required field(s): ${missing.join(', ')}`;
  return null;
}

function detectAgent(agent: AgentDef, ctx: Ctx): DetectionEntry {
  const evidence: string[] = [];
  for (const binary of agent.detect.binaries) {
    const found = ctx.which(binary);
    if (found !== null) evidence.push(`binary "${binary}" on PATH (${found})`);
  }
  for (const dir of agent.detect.userDirs) {
    if (isDirectory(resolveSpecPath(dir, ctx))) evidence.push(`directory ${dir} exists`);
  }
  for (const file of agent.detect.userFiles) {
    if (isFile(resolveSpecPath(file, ctx))) evidence.push(`file ${file} exists`);
  }
  return { id: agent.id, displayName: agent.displayName, detected: evidence.length > 0, evidence };
}

function countLines(content: string): number {
  if (content === '') return 0;
  const lines = content.split('\n').length;
  return content.endsWith('\n') ? lines - 1 : lines;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function isAgentsMdName(name: string): boolean {
  return /^AGENTS(?:\..+)?\.md$/i.test(name);
}

function bridgeChecks(agent: AgentDef, ctx: Ctx): Check[] {
  if (agent.rules.readsAgentsMd || agent.rules.agentsMdBridge === null) return [];
  if (!isFile(path.join(ctx.cwd, AGENTS_MD))) return [];
  for (const spec of agent.rules.projectFiles) {
    const content = readText(resolveSpecPath(spec, ctx));
    if (content?.includes(AGENTS_MD_IMPORT)) {
      return [check('PASS', `project ${AGENTS_MD} is bridged into ${spec} via "${AGENTS_MD_IMPORT}"`)];
    }
  }
  return [check('WARN', `project root has ${AGENTS_MD} but ${agent.displayName} does not read it — ${agent.rules.agentsMdBridge}`)];
}

function checkRules(agent: AgentDef, ctx: Ctx): Check[] {
  const checks: Check[] = [];
  for (const spec of [...agent.rules.userFiles, ...agent.rules.projectFiles]) {
    const resolved = resolveSpecPath(spec, ctx);
    const stat = statOrNull(resolved);
    if (stat === null || !stat.isFile()) {
      checks.push(check('INFO', `${spec} — not present`));
      continue;
    }
    const content = readText(resolved);
    if (content === null) {
      checks.push(check('WARN', `${spec} — unreadable`));
      continue;
    }
    const stats = `${countLines(content)} lines, ${formatBytes(stat.size)}`;
    const name = path.basename(resolved);
    if (name.toUpperCase() === 'CLAUDE.MD' && countLines(content) > CLAUDE_MD_MAX_LINES) {
      checks.push(check('WARN', `${spec} — ${stats} — exceeds ${CLAUDE_MD_MAX_LINES} lines; long memory files dilute every prompt`));
    } else if (isAgentsMdName(name) && stat.size > AGENTS_MD_MAX_BYTES) {
      checks.push(check('WARN', `${spec} — ${stats} — exceeds the ${AGENTS_MD_MAX_BYTES / 1024} KiB AGENTS.md budget; the agent may truncate it`));
    } else {
      checks.push(check('PASS', `${spec} — ${stats}`));
    }
  }
  checks.push(...bridgeChecks(agent, ctx));
  checks.push(check('INFO', `notes: ${agent.rules.notes}`));
  return checks;
}

interface SkillLocation {
  shared: string[];
  private: string[];
}

function skillSummaryCheck(presentDirs: number, valid: number): Check {
  if (presentDirs === 0) return check('INFO', 'no skills directories present');
  if (valid === 0) return check('INFO', 'skills directories present but no valid skills found');
  return check('PASS', `${valid} valid skill(s) across ${presentDirs} director(y/ies)`);
}

function checkSkills(agent: AgentDef, ctx: Ctx): Check[] {
  const checks: Check[] = [];
  const sharedDirs = new Set(agent.skills.sharedDirs.map((spec) => resolveSpecPath(spec, ctx)));
  const seen = new Set<string>();
  const dirs: { spec: string; resolved: string }[] = [];
  for (const spec of [...agent.skills.userDirs, ...agent.skills.projectDirs]) {
    const resolved = resolveSpecPath(spec, ctx);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    dirs.push({ spec, resolved });
  }
  let valid = 0;
  let presentDirs = 0;
  const locations = new Map<string, SkillLocation>();
  for (const { spec, resolved } of dirs) {
    if (!isDirectory(resolved)) {
      checks.push(check('INFO', `${spec} — not present`));
      continue;
    }
    const entries = readDir(resolved);
    if (entries === null) {
      checks.push(check('WARN', `${spec} — unreadable directory`));
      continue;
    }
    presentDirs++;
    const bucket = sharedDirs.has(resolved) ? 'shared' : 'private';
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const location = locations.get(entry.name) ?? { shared: [], private: [] };
      location[bucket].push(spec);
      locations.set(entry.name, location);
      const label = `${spec}/${entry.name}`;
      const skillFile = path.join(resolved, entry.name, SKILL_FILE);
      if (!isFile(skillFile)) {
        checks.push(check('WARN', `${label} — no ${SKILL_FILE}; directory is not a loadable skill`));
        continue;
      }
      const content = readText(skillFile);
      const error = content === null ? `unreadable ${SKILL_FILE}` : skillFrontmatterError(content);
      if (error !== null) {
        checks.push(check('WARN', `${label}/${SKILL_FILE} — ${error}`));
        continue;
      }
      valid++;
    }
  }
  checks.push(skillSummaryCheck(presentDirs, valid));
  if (valid > SKILL_COUNT_WARN_THRESHOLD) {
    checks.push(check('WARN', `${valid} skills installed (> ${SKILL_COUNT_WARN_THRESHOLD}) — every skill adds routing tokens to each prompt; keep only skills with measured benefit`));
  }
  for (const [name, location] of locations) {
    if (location.shared.length > 0 && location.private.length > 0) {
      checks.push(check('WARN', `skill "${name}" exists in both shared (${location.shared.join(', ')}) and private (${location.private.join(', ')}) dirs — copies can silently diverge`));
    }
  }
  return checks;
}

type JsonOutcome = { ok: true; value: unknown } | { ok: false; error: string };

function parseJson(content: string): JsonOutcome {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

type McpServers = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'ok'; names: string[] };

function jsonMcpServers(value: unknown): McpServers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { kind: 'invalid' };
  const servers = (value as Record<string, unknown>).mcpServers;
  if (servers === undefined) return { kind: 'missing' };
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) return { kind: 'invalid' };
  return { kind: 'ok', names: Object.keys(servers) };
}

function tomlMcpServerNames(content: string): string[] {
  const names = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*\[mcp_servers\.([A-Za-z0-9_-]+|"[^"]*"|'[^']*')/.exec(line);
    if (match?.[1] !== undefined) names.add(match[1].replace(/^["']|["']$/g, ''));
  }
  return [...names];
}

function listNames(names: string[]): string {
  return names.length === 0 ? '' : `: ${names.join(', ')}`;
}

function checkMcp(agent: AgentDef, ctx: Ctx): Check[] {
  const checks: Check[] = [];
  const seen = new Set<string>();
  let totalServers = 0;
  for (const spec of [...agent.mcp.userFiles, ...agent.mcp.projectFiles]) {
    const resolved = resolveSpecPath(spec, ctx);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (!isFile(resolved)) {
      checks.push(check('INFO', `${spec} — not present`));
      continue;
    }
    const content = readText(resolved);
    if (content === null) {
      checks.push(check('WARN', `${spec} — unreadable`));
      continue;
    }
    if (agent.mcp.format === 'json-mcpServers') {
      const outcome = parseJson(content);
      if (!outcome.ok) {
        checks.push(check('FAIL', `${spec} — invalid JSON (${outcome.error}); the agent cannot load this MCP config`));
        continue;
      }
      const servers = jsonMcpServers(outcome.value);
      if (servers.kind === 'missing') {
        checks.push(check('INFO', `${spec} — no "mcpServers" key`));
        continue;
      }
      if (servers.kind === 'invalid') {
        checks.push(check('FAIL', `${spec} — "mcpServers" is not an object; the agent cannot load this MCP config`));
        continue;
      }
      totalServers += servers.names.length;
      checks.push(check('PASS', `${spec} — ${servers.names.length} MCP server(s)${listNames(servers.names)}`));
      continue;
    }
    const names = tomlMcpServerNames(content);
    totalServers += names.length;
    checks.push(check('PASS', `${spec} — ${names.length} MCP server(s)${listNames(names)} (TOML scanned superficially, not fully parsed)`));
  }
  if (totalServers > MCP_SERVER_WARN_THRESHOLD) {
    checks.push(check('WARN', `${totalServers} MCP servers configured (> ${MCP_SERVER_WARN_THRESHOLD}) — tool schemas inflate context and confuse tool choice; keep only servers with measured benefit`));
  }
  return checks;
}

function checkAgent(agent: AgentDef, ctx: Ctx, detected: boolean): AgentHealthReport {
  return {
    id: agent.id,
    displayName: agent.displayName,
    detected,
    sections: [
      { title: 'Rules', checks: checkRules(agent, ctx) },
      { title: 'Skills', checks: checkSkills(agent, ctx) },
      { title: 'MCP', checks: checkMcp(agent, ctx) },
    ],
  };
}

export function collectDoctorReport(options: DoctorOptions = {}): DoctorReport {
  const ctx: Ctx = {
    homeDir: options.homeDir ?? homedir(),
    cwd: options.cwd ?? process.cwd(),
    which: options.which ?? defaultWhich,
  };
  const matrix = loadMatrix();
  const detection = matrix.agents.map((agent) => detectAgent(agent, ctx));
  let targets: AgentDef[];
  if (options.agent !== undefined) {
    targets = [getAgent(options.agent)];
  } else {
    const detectedIds = new Set(detection.filter((entry) => entry.detected).map((entry) => entry.id));
    targets = matrix.agents.filter((agent) => detectedIds.has(agent.id));
  }
  const health = targets.map((agent) =>
    checkAgent(agent, ctx, detection.find((entry) => entry.id === agent.id)?.detected ?? false),
  );
  return { homeDir: ctx.homeDir, cwd: ctx.cwd, detection, health };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    'skillfit doctor — read-only configuration health report',
    `home: ${report.homeDir}`,
    `project: ${report.cwd}`,
    '',
    'Agent detection',
    '===============',
  ];
  for (const entry of report.detection) {
    if (entry.detected) {
      lines.push(`[PASS] ${entry.displayName} — detected (${entry.evidence.join('; ')})`);
    } else {
      lines.push(`[INFO] ${entry.displayName} — not detected`);
    }
  }
  for (const agent of report.health) {
    lines.push('', `${agent.displayName} (${agent.id})`, '='.repeat(agent.displayName.length + agent.id.length + 3));
    if (!agent.detected) {
      lines.push('[INFO] agent not detected on this machine — inspected because --agent selected it');
    }
    for (const section of agent.sections) {
      lines.push('', section.title, '-'.repeat(section.title.length));
      for (const item of section.checks) {
        lines.push(`[${item.status}] ${item.message}`);
      }
    }
  }
  const counts: Record<CheckStatus, number> = { PASS: 0, WARN: 0, FAIL: 0, INFO: 0 };
  let total = 0;
  for (const agent of report.health) {
    for (const section of agent.sections) {
      for (const item of section.checks) {
        counts[item.status]++;
        total++;
      }
    }
  }
  const detected = report.detection.filter((entry) => entry.detected).length;
  lines.push(
    '',
    'Summary',
    '=======',
    `${detected}/${report.detection.length} agents detected — ${total} checks: ${counts.PASS} PASS, ${counts.WARN} WARN, ${counts.FAIL} FAIL, ${counts.INFO} INFO`,
    'Findings are advisory: skillfit doctor is read-only and always exits 0.',
  );
  return lines.join('\n');
}

export async function runDoctor(args: RunDoctorArgs = {}): Promise<void> {
  if (args.agent !== undefined && !agentIds().includes(args.agent)) {
    console.error(`Unknown agent "${args.agent}". Known agents: ${agentIds().join(', ')}`);
    // A usage error, not a finding. Findings are advisory and always exit 0, but an unrecognised
    // --agent means the health check never ran, and exiting 0 there lets CI read a typo as a clean
    // bill of health. 2 is this CLI's usage-error code.
    process.exitCode = 2;
    return;
  }
  console.log(formatDoctorReport(collectDoctorReport({ agent: args.agent })));
}
