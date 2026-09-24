import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { getAgent, type AgentDef } from '../agents.js';

export const MARKER_START = '<!-- SKILLFIT_START -->';
export const MARKER_END = '<!-- SKILLFIT_END -->';
export const BACKUP_SUFFIX = '.skillfit-bak';
export const LOCKFILE_NAME = 'skillfit.lock.json';

const BRIDGE_LINE = '@AGENTS.md';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface InstallOptions {
  profile: string;
  agent?: string;
  dryRun?: boolean;
  yes?: boolean;
  project?: boolean;
  homeDir?: string;
  projectDir?: string;
  profilesDir?: string;
  env?: NodeJS.ProcessEnv;
  confirm?: (question: string) => Promise<boolean>;
  log?: (line: string) => void;
  now?: () => Date;
}

export interface ProfileSkill {
  name: string;
  source: string;
}

export interface ProfileManifest {
  name: string;
  version: string;
  description?: string;
  agents: string[];
  rules?: { template: string };
  skills?: ProfileSkill[];
}

type Scope = 'user' | 'project';
type ItemKind = 'rules' | 'bridge' | 'skill';
type PlanAction = 'create' | 'update' | 'skip' | 'conflict';

interface LockEntry {
  agent: string;
  kind: ItemKind;
  path: string;
  sha256: string;
  profile: string;
  profileVersion: string;
  installedAt: string;
}

interface Lockfile {
  version: 1;
  entries: Record<string, LockEntry>;
}

interface PlannedFile {
  path: string;
  content: string;
  backup: boolean;
}

interface PlanItem {
  agent: string;
  kind: ItemKind;
  label: string;
  targetPath: string;
  lockKey: string;
  sha256: string;
  action: PlanAction;
  detail: string;
  files: PlannedFile[];
}

export async function runInstall(opts: InstallOptions): Promise<void> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const homeDir = opts.homeDir ?? os.homedir();
  const projectDir = opts.projectDir ?? process.cwd();
  const profilesDir = opts.profilesDir ?? fileURLToPath(new URL('../../profiles/', import.meta.url));
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());
  const scope: Scope = opts.project ? 'project' : 'user';
  const scopeDir = opts.project ? projectDir : homeDir;

  const { dir: profileDir, manifest } = await loadProfile(profilesDir, opts.profile);
  const agents = selectAgents(manifest, opts.agent, homeDir, env);
  const lockPath = path.join(scopeDir, LOCKFILE_NAME);
  const lock = await readLockfile(lockPath);

  const items: PlanItem[] = [];
  for (const agent of agents) {
    items.push(...await planRulesItems(agent, manifest, profileDir, scope, homeDir, projectDir));
    for (const skill of manifest.skills ?? []) {
      items.push(await planSkillItem(agent, skill, profileDir, scope, homeDir, projectDir, lock));
    }
  }

  printPlan(log, manifest, scope, scopeDir, items);

  const conflicts = items.filter((i) => i.action === 'conflict');
  if (conflicts.length > 0) {
    throw new Error(`${conflicts.length} conflict(s) found. Keep or remove the listed files manually and re-run. Nothing was written.`);
  }

  const writes = items.filter((i) => i.action === 'create' || i.action === 'update');
  if (writes.length === 0) {
    log('Everything is up to date; nothing to do.');
    return;
  }
  if (opts.dryRun) {
    log('Dry run: nothing was written. Re-run with --yes to apply.');
    return;
  }
  if (!opts.yes) {
    const confirm = opts.confirm ?? defaultConfirm;
    const ok = await confirm(`Apply ${writes.length} change(s)? [y/N] `);
    if (!ok) {
      log('Aborted; nothing was written.');
      return;
    }
  }

  await executeWrites(writes, log);

  const problems = await validateWrites(writes);
  if (problems.length > 0) {
    throw new Error(`Post-install validation failed:\n  ${problems.join('\n  ')}\nOriginals were backed up with the ${BACKUP_SUFFIX} suffix.`);
  }
  log(`Post-install validation passed (${writes.length} item(s) checked).`);

  recordEntries(lock, items, manifest, now().toISOString());
  // The lockfile is skillfit's own state rather than user content, so its backup is the previous
  // version (the rollback target) and is deliberately overwritten — unlike content backups, which
  // keep the earliest copy. AGENTS.md requires a backup before every write, and this one is a write.
  if (existsSync(lockPath)) await fs.copyFile(lockPath, lockPath + BACKUP_SUFFIX);
  await writeFileAtomic(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  log(`Lockfile updated: ${lockPath}`);
  log('Install complete.');
}

export async function loadProfile(profilesDir: string, name: string): Promise<{ dir: string; manifest: ProfileManifest }> {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid profile name "${name}". Use lowercase letters, digits and dashes.`);
  }
  const dir = path.join(profilesDir, name);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, 'profile.json'), 'utf8');
  } catch {
    throw new Error(`Profile "${name}" not found at ${dir}`);
  }
  const manifest = JSON.parse(raw) as ProfileManifest;
  validateManifest(manifest, name);
  await validateProfileFiles(dir, manifest);
  return { dir, manifest };
}

function validateManifest(manifest: ProfileManifest, expectedName: string): void {
  if (manifest.name !== expectedName) {
    throw new Error(`profile.json name "${manifest.name}" does not match directory "${expectedName}"`);
  }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error('profile.json must declare a version string');
  }
  if (!Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error('profile.json must list at least one target agent');
  }
  for (const id of manifest.agents) getAgent(id);
  if (manifest.rules !== undefined && typeof manifest.rules.template !== 'string') {
    throw new Error('profile.json rules.template must be a relative path');
  }
  for (const skill of manifest.skills ?? []) {
    if (!NAME_PATTERN.test(skill.name)) throw new Error(`Invalid skill name "${skill.name}" in profile.json`);
    if (typeof skill.source !== 'string') throw new Error(`Skill "${skill.name}" must declare a source path`);
  }
}

async function validateProfileFiles(dir: string, manifest: ProfileManifest): Promise<void> {
  if (manifest.rules) await readProfileFile(dir, manifest.rules.template);
  for (const skill of manifest.skills ?? []) {
    const skillMd = await readProfileFile(dir, `${skill.source}/SKILL.md`).catch(() => {
      throw new Error(`Skill "${skill.name}" is missing SKILL.md at ${skill.source}`);
    });
    const fm = parseFrontmatter(skillMd);
    if (!fm?.name || !fm.description) {
      throw new Error(`Skill "${skill.name}" SKILL.md must have name and description frontmatter`);
    }
    if (fm.name !== skill.name) {
      throw new Error(`Skill "${skill.name}" SKILL.md declares name "${fm.name}"`);
    }
  }
}

async function readProfileFile(dir: string, rel: string): Promise<string> {
  return await fs.readFile(safeJoin(dir, rel), 'utf8');
}

function safeJoin(base: string, rel: string): string {
  const abs = path.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(`Profile path "${rel}" escapes the profile directory`);
  }
  return abs;
}

export function parseFrontmatter(content: string): Record<string, string> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match || match[1] === undefined) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m && m[1] !== undefined) fields[m[1]] = (m[2] ?? '').trim();
  }
  return fields;
}

export function renderManagedBlock(body: string, profile: string, version: string): string {
  return [
    MARKER_START,
    `Managed by skillfit (profile: ${profile} v${version}). Edit outside these markers; the block is rewritten on install.`,
    '',
    body.trim(),
    '',
    MARKER_END,
  ].join('\n');
}

export function upsertManagedBlock(existing: string | null, block: string): string {
  if (existing === null || existing.trim().length === 0) return `${block}\n`;
  const starts = indicesOf(existing, MARKER_START);
  const ends = indicesOf(existing, MARKER_END);
  if (starts.length === 0 && ends.length === 0) {
    const glue = existing.endsWith('\n') ? '' : '\n';
    return `${existing}${glue}\n${block}\n`;
  }
  const start = starts[0];
  const end = ends[0];
  if (starts.length !== 1 || ends.length !== 1 || start === undefined || end === undefined || end < start) {
    throw new Error(`Malformed skillfit markers; expected exactly one ${MARKER_START} followed by one ${MARKER_END}`);
  }
  return `${existing.slice(0, start)}${block}${existing.slice(end + MARKER_END.length)}`;
}

function indicesOf(haystack: string, needle: string): number[] {
  const out: number[] = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return out;
}

function extractBlock(content: string, targetPath: string): string | null {
  const starts = indicesOf(content, MARKER_START);
  const ends = indicesOf(content, MARKER_END);
  if (starts.length === 0 && ends.length === 0) return null;
  const start = starts[0];
  const end = ends[0];
  if (starts.length !== 1 || ends.length !== 1 || start === undefined || end === undefined || end < start) {
    throw new Error(`${targetPath}: malformed skillfit markers; fix or remove them manually`);
  }
  return content.slice(start, end + MARKER_END.length);
}

function classifyBlock(existing: string | null, block: string, targetPath: string): { action: PlanAction; detail: string } {
  if (existing === null) return { action: 'create', detail: `create file with managed block (${lineCount(block)} lines)` };
  const current = extractBlock(existing, targetPath);
  if (current === null) return { action: 'update', detail: `append managed block (${lineCount(block)} lines)` };
  if (current === block) return { action: 'skip', detail: 'unchanged' };
  return { action: 'update', detail: `rewrite managed block (${lineCount(current)} -> ${lineCount(block)} lines)` };
}

function lineCount(s: string): number {
  return s.split('\n').length;
}

function selectAgents(manifest: ProfileManifest, agentId: string | undefined, homeDir: string, env: NodeJS.ProcessEnv): AgentDef[] {
  if (agentId) {
    const agent = getAgent(agentId);
    if (!manifest.agents.includes(agent.id)) {
      throw new Error(`Profile "${manifest.name}" does not target ${agent.displayName} (targets: ${manifest.agents.join(', ')})`);
    }
    return [agent];
  }
  const candidates = manifest.agents.map((id) => getAgent(id));
  const detected = candidates.filter((a) => isAgentDetected(a, homeDir, env));
  if (detected.length === 0) {
    throw new Error(`No target agents detected (${candidates.map((a) => a.id).join(', ')}). Re-run with --agent <id> to install anyway.`);
  }
  return detected;
}

function isAgentDetected(agent: AgentDef, homeDir: string, env: NodeJS.ProcessEnv): boolean {
  const markers = [...agent.detect.userDirs, ...agent.detect.userFiles];
  if (markers.some((p) => existsSync(expandHome(p, homeDir)))) return true;
  return agent.detect.binaries.some((bin) => binaryOnPath(bin, env));
}

function expandHome(p: string, homeDir: string): string {
  if (p === '~') return homeDir;
  if (p.startsWith('~/')) return path.join(homeDir, p.slice(2));
  return p;
}

function binaryOnPath(name: string, env: NodeJS.ProcessEnv): boolean {
  const dirs = (env.PATH ?? '').split(path.delimiter).filter((d) => d.length > 0);
  const exts = process.platform === 'win32'
    ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT;.PS1').split(';')]
    : [''];
  return dirs.some((dir) => exts.some((ext) => existsSync(path.join(dir, name + ext))));
}

function resolveScoped(rel: string, scope: Scope, homeDir: string, projectDir: string): string {
  if (rel === '~' || rel.startsWith('~/')) return expandHome(rel, homeDir);
  return path.resolve(projectDir, rel);
}

function rulesTarget(agent: AgentDef, scope: Scope, homeDir: string, projectDir: string): { rulesFile: string; bridgeFile: string | null } {
  const rel = scope === 'user' ? agent.rules.userFiles[0] : agent.rules.projectFiles[0];
  if (!rel) throw new Error(`${agent.displayName} has no ${scope}-level rules file in the matrix`);
  const nativeFile = resolveScoped(rel, scope, homeDir, projectDir);
  if (agent.rules.readsAgentsMd) return { rulesFile: nativeFile, bridgeFile: null };
  return {
    rulesFile: path.join(path.dirname(nativeFile), 'AGENTS.md'),
    bridgeFile: agent.rules.agentsMdBridge === null ? null : nativeFile,
  };
}

function skillsTargetDir(agent: AgentDef, scope: Scope, homeDir: string, projectDir: string): string {
  const shared = scope === 'user' ? '~/.agents/skills' : '.agents/skills';
  if (agent.skills.sharedDirs.includes(shared)) return resolveScoped(shared, scope, homeDir, projectDir);
  const rel = scope === 'user' ? agent.skills.userDirs[0] : agent.skills.projectDirs[0];
  if (!rel) throw new Error(`${agent.displayName} has no ${scope}-level skills directory in the matrix`);
  return resolveScoped(rel, scope, homeDir, projectDir);
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function readLockfile(lockPath: string): Promise<Lockfile> {
  const raw = await readIfExists(lockPath);
  if (raw === null) return { version: 1, entries: {} };
  let parsed: Lockfile;
  try {
    parsed = JSON.parse(raw) as Lockfile;
  } catch {
    throw new Error(`Lockfile at ${lockPath} is not valid JSON; fix or delete it.`);
  }
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.entries !== 'object') {
    throw new Error(`Lockfile at ${lockPath} has an unexpected shape; fix or delete it.`);
  }
  return { version: 1, entries: parsed.entries ?? {} };
}

async function planRulesItems(agent: AgentDef, manifest: ProfileManifest, profileDir: string, scope: Scope, homeDir: string, projectDir: string): Promise<PlanItem[]> {
  if (!manifest.rules) return [];
  const template = await readProfileFile(profileDir, manifest.rules.template);
  const { rulesFile, bridgeFile } = rulesTarget(agent, scope, homeDir, projectDir);
  const block = renderManagedBlock(template, manifest.name, manifest.version);
  const items = [await planBlockItem(agent.id, 'rules', 'rules', rulesFile, block)];
  if (bridgeFile !== null) {
    const bridgeBlock = renderManagedBlock(BRIDGE_LINE, manifest.name, manifest.version);
    const existing = await readIfExists(bridgeFile);
    if (existing !== null && extractBlock(existing, bridgeFile) === null && hasBridgeLine(existing)) {
      items.push(skipItem(agent.id, 'bridge', 'CLAUDE.md bridge', bridgeFile, sha256Hex(bridgeBlock), `${BRIDGE_LINE} import already present (unmanaged)`));
    } else {
      items.push(await planBlockItem(agent.id, 'bridge', 'CLAUDE.md bridge', bridgeFile, bridgeBlock, existing));
    }
  }
  return items;
}

function hasBridgeLine(content: string): boolean {
  return content.split(/\r?\n/).some((line) => line.trim() === BRIDGE_LINE);
}

async function planBlockItem(agentId: string, kind: ItemKind, label: string, targetPath: string, block: string, existingArg?: string | null): Promise<PlanItem> {
  const existing = existingArg !== undefined ? existingArg : await readIfExists(targetPath);
  const { action, detail } = classifyBlock(existing, block, targetPath);
  const files = action === 'skip'
    ? []
    : [{ path: targetPath, content: upsertManagedBlock(existing, block), backup: existing !== null }];
  return {
    agent: agentId, kind, label, targetPath,
    lockKey: `${agentId}:${kind}`,
    sha256: sha256Hex(block),
    action, detail, files,
  };
}

function skipItem(agentId: string, kind: ItemKind, label: string, targetPath: string, hash: string, detail: string): PlanItem {
  return { agent: agentId, kind, label, targetPath, lockKey: `${agentId}:${kind}`, sha256: hash, action: 'skip', detail, files: [] };
}

async function planSkillItem(agent: AgentDef, skill: ProfileSkill, profileDir: string, scope: Scope, homeDir: string, projectDir: string, lock: Lockfile): Promise<PlanItem> {
  const srcDir = safeJoin(profileDir, skill.source);
  const relPaths = await walkFiles(srcDir);
  const desired = new Map<string, string>();
  for (const rel of relPaths) desired.set(rel, await fs.readFile(path.join(srcDir, rel), 'utf8'));
  const desiredHash = hashFiles(desired);
  const targetDir = path.join(skillsTargetDir(agent, scope, homeDir, projectDir), skill.name);
  const current = new Map<string, string>();
  for (const rel of relPaths) {
    const content = await readIfExists(path.join(targetDir, rel));
    if (content !== null) current.set(rel, content);
  }
  const lockKey = `${agent.id}:skill:${skill.name}`;
  const base = { agent: agent.id, kind: 'skill' as ItemKind, label: `skill "${skill.name}"`, targetPath: targetDir, lockKey, sha256: desiredHash };

  const missing = relPaths.filter((rel) => !current.has(rel));
  const differing = relPaths.filter((rel) => current.get(rel) !== undefined && current.get(rel) !== desired.get(rel));
  if (missing.length === 0 && differing.length === 0) {
    return { ...base, action: 'skip', detail: 'unchanged', files: [] };
  }
  if (differing.length > 0) {
    const entry = lock.entries[lockKey];
    const pristine = entry !== undefined && missing.length === 0 && hashFiles(current) === entry.sha256;
    if (!pristine) {
      const list = differing.map((rel) => path.join(targetDir, rel)).join(', ');
      return { ...base, action: 'conflict', detail: `existing content differs: ${list}`, files: [] };
    }
  }
  const writeRels = [...missing, ...differing];
  const files = writeRels.map((rel) => ({
    path: path.join(targetDir, rel),
    content: desired.get(rel) ?? '',
    backup: current.has(rel),
  }));
  const action: PlanAction = missing.length === relPaths.length ? 'create' : 'update';
  const detail = `${action === 'create' ? 'copy' : 'update'} ${writeRels.length} file(s): ${writeRels.join(', ')}`;
  return { ...base, action, detail, files };
}

async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walkFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

function hashFiles(entries: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [rel, content] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(rel, 'utf8');
    hash.update('\0');
    hash.update(content, 'utf8');
    hash.update('\0');
  }
  return hash.digest('hex');
}

function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function printPlan(log: (line: string) => void, manifest: ProfileManifest, scope: Scope, scopeDir: string, items: PlanItem[]): void {
  log(`Profile "${manifest.name}" v${manifest.version} — scope: ${scope} (${scopeDir})`);
  log('');
  for (const item of items) {
    log(`  [${item.agent}] ${item.kind.padEnd(6)} ${item.action.toUpperCase().padEnd(8)} ${item.targetPath}`);
    log(`${' '.repeat(11)}${item.detail}`);
  }
  const counts: Record<PlanAction, number> = { create: 0, update: 0, skip: 0, conflict: 0 };
  for (const item of items) counts[item.action] += 1;
  log('');
  log(`Summary: ${counts.create} create, ${counts.update} update, ${counts.skip} skipped (unchanged), ${counts.conflict} conflict`);
}

async function executeWrites(writes: PlanItem[], log: (line: string) => void): Promise<void> {
  // Two phases. Everything is backed up and staged beside its target first, so a failure while
  // generating content leaves the install untouched; only then does anything become visible.
  // writeFileAtomic is atomic per file, but a sequence of them is not atomic as a whole.
  const staged: { target: string; tmp: string; backedUp: string | null }[] = [];
  try {
    for (const item of writes) {
      for (const file of item.files) {
        const backedUp = file.backup ? await backupOnce(file.path) : null;
        const tmp = `${file.path}.${process.pid}.skillfit-staged`;
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(tmp, file.content, 'utf8');
        staged.push({ target: file.path, tmp, backedUp });
      }
    }
  } catch (error) {
    for (const entry of staged) await fs.rm(entry.tmp, { force: true });
    throw error;
  }
  for (const entry of staged) {
    await fs.rename(entry.tmp, entry.target);
    log(`  wrote ${entry.target}${entry.backedUp ? ` (backup: ${entry.backedUp})` : ''}`);
  }
}

/**
 * Back up a file at most once. `.skillfit-bak` is a single slot, and the copy worth keeping is the
 * user's pre-skillfit original: overwriting it on a later update would destroy the only copy of the
 * content the suffix exists to protect. Returns the backup path when one was created, else null.
 */
async function backupOnce(target: string): Promise<string | null> {
  const backup = target + BACKUP_SUFFIX;
  try {
    await fs.access(backup);
    return null;
  } catch {
    // absent — take the backup
  }
  await fs.copyFile(target, backup);
  return backup;
}

async function writeFileAtomic(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = path.join(path.dirname(target), `${path.basename(target)}.${process.pid}.skillfit-tmp`);
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, target);
}

async function validateWrites(writes: PlanItem[]): Promise<string[]> {
  const problems: string[] = [];
  for (const item of writes) {
    if (item.kind === 'skill') {
      const skillMd = path.join(item.targetPath, 'SKILL.md');
      const content = await readIfExists(skillMd);
      const fm = content === null ? null : parseFrontmatter(content);
      if (!fm?.name || !fm.description) {
        problems.push(`${skillMd}: SKILL.md is missing or its frontmatter lacks name/description`);
      }
    } else {
      const content = await readIfExists(item.targetPath);
      if (content === null || !content.includes(MARKER_START) || !content.includes(MARKER_END)) {
        problems.push(`${item.targetPath}: managed block missing after write`);
      }
    }
  }
  return problems;
}

function recordEntries(lock: Lockfile, items: PlanItem[], manifest: ProfileManifest, installedAt: string): void {
  for (const item of items) {
    if (item.action === 'conflict') continue;
    const prior = lock.entries[item.lockKey];
    // A skip means the file on disk already matches what this profile wants. Refreshing its entry is
    // what lets a run that failed partway — content applied, lockfile not yet written — reconcile on
    // the next success instead of leaving a stale profileVersion behind permanently. Only refresh
    // keys already recorded: a skip on an unmanaged file (a CLAUDE.md bridge import skillfit did not
    // write) must not be claimed as ours.
    if (item.action === 'skip' && prior === undefined) continue;
    lock.entries[item.lockKey] = {
      agent: item.agent,
      kind: item.kind,
      path: item.targetPath,
      sha256: item.sha256,
      profile: manifest.name,
      profileVersion: manifest.version,
      // A refreshed skip was installed earlier; keep the original timestamp.
      installedAt: item.action === 'skip' && prior !== undefined ? prior.installedAt : installedAt,
    };
  }
}

async function defaultConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
