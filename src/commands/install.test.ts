import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BACKUP_SUFFIX,
  LOCKFILE_NAME,
  MARKER_END,
  MARKER_START,
  loadProfile,
  parseFrontmatter,
  renderManagedBlock,
  runInstall,
  upsertManagedBlock,
  type InstallOptions,
} from './install.js';

const PROFILES_DIR = fileURLToPath(new URL('../../profiles/', import.meta.url));

async function tempDirs(t: test.TestContext): Promise<{ home: string; project: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-install-'));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(project, { recursive: true });
  return { home, project };
}

function makeOpts(home: string, project: string, extra: Partial<InstallOptions> = {}): InstallOptions {
  return {
    profile: 'recommended',
    homeDir: home,
    projectDir: project,
    profilesDir: PROFILES_DIR,
    env: { PATH: '' },
    yes: true,
    log: () => {},
    ...extra,
  };
}

function captureLogs(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = [];
  return { lines, log: (line) => { lines.push(line); } };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out[path.relative(root, full)] = await fs.readFile(full, 'utf8');
    }
  }
  await walk(root);
  return out;
}

interface LockShape {
  version: number;
  entries: Record<string, { sha256: string; profileVersion: string; installedAt: string; kind: string }>;
}

async function readLock(dir: string): Promise<LockShape> {
  return JSON.parse(await fs.readFile(path.join(dir, LOCKFILE_NAME), 'utf8')) as LockShape;
}

test('installs rules and skill for codex at user scope', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));

  const agentsMd = await fs.readFile(path.join(home, '.codex', 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes(MARKER_START));
  assert.ok(agentsMd.includes(MARKER_END));
  assert.match(agentsMd, /red-green-refactor/);

  const skillMd = await fs.readFile(path.join(home, '.agents', 'skills', 'commit-message', 'SKILL.md'), 'utf8');
  const fm = parseFrontmatter(skillMd);
  assert.equal(fm?.name, 'commit-message');
  assert.ok(fm?.description);

  const lock = await readLock(home);
  assert.equal(lock.version, 1);
  assert.deepEqual(Object.keys(lock.entries).sort(), ['codex:rules', 'codex:skill:commit-message']);
  const rulesEntry = lock.entries['codex:rules'];
  assert.ok(rulesEntry);
  assert.equal(rulesEntry.profileVersion, '1.0.0');
  assert.match(rulesEntry.sha256, /^[0-9a-f]{64}$/);
  assert.ok(rulesEntry.installedAt);
});

test('second run skips unchanged items and writes nothing', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));
  const before = await snapshot(home);

  const { lines, log } = captureLogs();
  await runInstall(makeOpts(home, project, { agent: 'codex', log }));

  assert.deepEqual(await snapshot(home), before);
  assert.ok(lines.some((l) => l.includes('SKIP')));
  assert.ok(lines.some((l) => l.includes('up to date')));
});

test('preserves existing content outside markers and backs up the original', async (t) => {
  const { home, project } = await tempDirs(t);
  const target = path.join(home, '.codex', 'AGENTS.md');
  await fs.mkdir(path.dirname(target), { recursive: true });
  const original = '# My own rules\n\nAlways be terse.\n';
  await fs.writeFile(target, original);

  await runInstall(makeOpts(home, project, { agent: 'codex' }));

  const content = await fs.readFile(target, 'utf8');
  assert.ok(content.startsWith(original));
  assert.ok(content.includes(MARKER_START));
  assert.equal(await fs.readFile(target + BACKUP_SUFFIX, 'utf8'), original);
});

test('rewrites a stale managed block while keeping outside edits', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));
  const target = path.join(home, '.codex', 'AGENTS.md');

  const stale = (await fs.readFile(target, 'utf8')).replace(MARKER_END, `stale line\n${MARKER_END}`);
  await fs.writeFile(target, `${stale}\nUser appendix.\n`);

  const { lines, log } = captureLogs();
  await runInstall(makeOpts(home, project, { agent: 'codex', log }));

  const content = await fs.readFile(target, 'utf8');
  assert.ok(!content.includes('stale line'));
  assert.ok(content.includes('User appendix.'));
  assert.ok(lines.some((l) => l.includes('UPDATE')));
  assert.equal(await fs.readFile(target + BACKUP_SUFFIX, 'utf8'), `${stale}\nUser appendix.\n`);
});

test('claude-code project scope installs AGENTS.md plus an @AGENTS.md bridge in CLAUDE.md', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'claude-code', project: true }));

  const agentsMd = await fs.readFile(path.join(project, 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes(MARKER_START));
  assert.match(agentsMd, /red-green-refactor/);

  const claudeMd = await fs.readFile(path.join(project, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeMd.includes(MARKER_START));
  assert.ok(claudeMd.split('\n').some((line) => line.trim() === '@AGENTS.md'));

  assert.ok(await exists(path.join(project, '.claude', 'skills', 'commit-message', 'SKILL.md')));
  const lock = await readLock(project);
  assert.deepEqual(
    Object.keys(lock.entries).sort(),
    ['claude-code:bridge', 'claude-code:rules', 'claude-code:skill:commit-message'],
  );
});

test('does not add a managed bridge when CLAUDE.md already imports AGENTS.md', async (t) => {
  const { home, project } = await tempDirs(t);
  const claudePath = path.join(project, 'CLAUDE.md');
  const original = '# Project notes\n\n@AGENTS.md\n';
  await fs.writeFile(claudePath, original);

  const { lines, log } = captureLogs();
  await runInstall(makeOpts(home, project, { agent: 'claude-code', project: true, log }));

  assert.equal(await fs.readFile(claudePath, 'utf8'), original);
  assert.ok(lines.some((l) => l.includes('already present')));
});

test('kimi-code project scope uses the shared .agents/skills directory', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'kimi-code', project: true }));
  assert.ok(await exists(path.join(project, '.agents', 'skills', 'commit-message', 'SKILL.md')));
  assert.ok(await exists(path.join(project, 'AGENTS.md')));
});

test('conflicting foreign skill content aborts the whole install without writes', async (t) => {
  const { home, project } = await tempDirs(t);
  const skillTarget = path.join(home, '.agents', 'skills', 'commit-message', 'SKILL.md');
  await fs.mkdir(path.dirname(skillTarget), { recursive: true });
  const foreign = '---\nname: commit-message\ndescription: hand-written\n---\nmine\n';
  await fs.writeFile(skillTarget, foreign);

  await assert.rejects(runInstall(makeOpts(home, project, { agent: 'codex' })), /conflict/i);

  assert.equal(await fs.readFile(skillTarget, 'utf8'), foreign);
  assert.ok(!(await exists(path.join(home, '.codex', 'AGENTS.md'))));
  assert.ok(!(await exists(path.join(home, LOCKFILE_NAME))));
});

test('modifying an installed skill turns the next run into a conflict', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));
  const skillTarget = path.join(home, '.agents', 'skills', 'commit-message', 'SKILL.md');
  await fs.writeFile(skillTarget, 'user edits\n');

  await assert.rejects(runInstall(makeOpts(home, project, { agent: 'codex' })), /conflict/i);
  assert.equal(await fs.readFile(skillTarget, 'utf8'), 'user edits\n');
});

test('a skill update from the same profile overwrites a pristine install', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));

  const profilesCopy = path.join(project, 'profiles-copy');
  await fs.cp(PROFILES_DIR, profilesCopy, { recursive: true });
  const skillSrc = path.join(profilesCopy, 'recommended', 'skills', 'commit-message', 'SKILL.md');
  await fs.writeFile(skillSrc, '---\nname: commit-message\ndescription: v2 improved\n---\nnew body\n');
  const manifestPath = path.join(profilesCopy, 'recommended', 'profile.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { version: string };
  manifest.version = '1.1.0';
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await runInstall(makeOpts(home, project, { agent: 'codex', profilesDir: profilesCopy }));

  const installed = await fs.readFile(path.join(home, '.agents', 'skills', 'commit-message', 'SKILL.md'), 'utf8');
  assert.match(installed, /v2 improved/);
  const lock = await readLock(home);
  assert.equal(lock.entries['codex:skill:commit-message']?.profileVersion, '1.1.0');
});

test('dry-run prints the plan and writes nothing', async (t) => {
  const { home, project } = await tempDirs(t);
  const { lines, log } = captureLogs();
  await runInstall(makeOpts(home, project, { agent: 'codex', dryRun: true, yes: false, log }));

  assert.ok(lines.some((l) => l.includes('CREATE')));
  assert.ok(lines.some((l) => /dry run/i.test(l)));
  assert.deepEqual(await fs.readdir(home), []);
});

test('interactive install asks for confirmation and honors a no', async (t) => {
  const { home, project } = await tempDirs(t);
  let asked = 0;
  const confirm = async (): Promise<boolean> => { asked += 1; return false; };
  await runInstall(makeOpts(home, project, { agent: 'codex', yes: false, confirm }));

  assert.equal(asked, 1);
  assert.deepEqual(await fs.readdir(home), []);
});

test('interactive install proceeds on yes', async (t) => {
  const { home, project } = await tempDirs(t);
  const confirm = async (): Promise<boolean> => true;
  await runInstall(makeOpts(home, project, { agent: 'codex', yes: false, confirm }));
  assert.ok(await exists(path.join(home, '.codex', 'AGENTS.md')));
});

test('rejects unknown agents, bad profile names and missing profiles', async (t) => {
  const { home, project } = await tempDirs(t);
  await assert.rejects(runInstall(makeOpts(home, project, { agent: 'nope' })), /Unknown agent/);
  await assert.rejects(runInstall(makeOpts(home, project, { profile: '../evil' })), /Invalid profile name/);
  await assert.rejects(runInstall(makeOpts(home, project, { profile: 'missing' })), /not found/);
});

test('rejects an agent the profile does not target', async (t) => {
  const { home, project } = await tempDirs(t);
  const profilesCopy = path.join(project, 'profiles-copy');
  await fs.cp(PROFILES_DIR, profilesCopy, { recursive: true });
  const manifestPath = path.join(profilesCopy, 'recommended', 'profile.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { agents: string[] };
  manifest.agents = ['codex'];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await assert.rejects(
    runInstall(makeOpts(home, project, { agent: 'kimi-code', profilesDir: profilesCopy })),
    /does not target/,
  );
});

test('without --agent installs only for detected agents', async (t) => {
  const { home, project } = await tempDirs(t);
  await fs.mkdir(path.join(home, '.codex'), { recursive: true });
  await fs.mkdir(path.join(home, '.claude'), { recursive: true });

  await runInstall(makeOpts(home, project));

  assert.ok(await exists(path.join(home, '.codex', 'AGENTS.md')));
  assert.ok(await exists(path.join(home, '.claude', 'AGENTS.md')));
  assert.ok(await exists(path.join(home, '.claude', 'CLAUDE.md')));
  assert.ok(!(await exists(path.join(home, '.kimi-code'))));
});

test('without --agent and nothing detected, fails with guidance', async (t) => {
  const { home, project } = await tempDirs(t);
  await assert.rejects(runInstall(makeOpts(home, project)), /No target agents detected/);
});

test('refuses to touch a file with malformed markers', async (t) => {
  const { home, project } = await tempDirs(t);
  const target = path.join(home, '.codex', 'AGENTS.md');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `broken ${MARKER_START} only\n`);

  await assert.rejects(runInstall(makeOpts(home, project, { agent: 'codex' })), /malformed/i);
  assert.equal(await fs.readFile(target, 'utf8'), `broken ${MARKER_START} only\n`);
});

test('a corrupt lockfile fails loudly', async (t) => {
  const { home, project } = await tempDirs(t);
  await runInstall(makeOpts(home, project, { agent: 'codex' }));
  await fs.writeFile(path.join(home, LOCKFILE_NAME), '{oops');

  await assert.rejects(runInstall(makeOpts(home, project, { agent: 'codex' })), /not valid JSON/);
});

test('the bundled recommended profile passes validation', async () => {
  const { manifest } = await loadProfile(PROFILES_DIR, 'recommended');
  assert.equal(manifest.name, 'recommended');
  assert.deepEqual([...manifest.agents].sort(), ['claude-code', 'codex', 'kimi-code']);
});

test('parseFrontmatter parses simple YAML frontmatter', () => {
  const fm = parseFrontmatter('---\nname: x\ndescription: hello world\n---\nbody\n');
  assert.equal(fm?.name, 'x');
  assert.equal(fm?.description, 'hello world');
  assert.equal(parseFrontmatter('no frontmatter'), null);
  assert.equal(parseFrontmatter('---\nname: x\n'), null);
  assert.equal(parseFrontmatter('---\r\nname: x\r\n---\r\n')?.name, 'x');
});

test('upsertManagedBlock creates, appends and replaces', () => {
  const block = renderManagedBlock('body', 'p', '1.0.0');
  assert.equal(upsertManagedBlock(null, block), `${block}\n`);
  assert.equal(upsertManagedBlock('   \n', block), `${block}\n`);

  const appended = upsertManagedBlock('user text\n', block);
  assert.ok(appended.startsWith('user text\n'));
  assert.ok(appended.includes(block));

  const replaced = upsertManagedBlock(`pre ${MARKER_START}\nold\n${MARKER_END} post`, block);
  assert.equal(replaced, `pre ${block} post`);

  assert.throws(() => upsertManagedBlock(`x ${MARKER_START} y`, block), /malformed/i);
});
