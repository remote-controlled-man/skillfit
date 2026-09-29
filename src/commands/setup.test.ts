import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCodexSetup } from './setup.js';

const body = (name: string) => `---\nname: ${name}\ndescription: ${name} tasks.\n---\nUse this Skill.\n`;
const hash = (content: string) => createHash('sha256').update(content).digest('hex');

test('Codex setup lists choices, downloads only selected Skills, and writes selected routing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-setup-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const profileDir = path.join(root, 'codex-curated');
  const homeDir = path.join(root, 'home');
  await fs.mkdir(path.join(profileDir, 'rules'), { recursive: true });
  await fs.mkdir(path.join(profileDir, 'skills', 'local-skill'), { recursive: true });
  await fs.writeFile(path.join(profileDir, 'rules', 'global.md'), '# Global Codex guidance\n');
  await fs.writeFile(path.join(profileDir, 'skills', 'local-skill', 'SKILL.md'), body('local-skill'));
  await fs.writeFile(path.join(profileDir, 'profile.json'), JSON.stringify({
    name: 'codex-curated', version: '1.0.0', agents: ['codex'], scope: 'user',
    rules: { template: 'rules/global.md' },
    skills: ['remote-one', 'remote-two', 'local-skill'].map((name) => ({ name, source: `skills/${name}` })),
  }));
  await fs.writeFile(path.join(profileDir, 'catalog.json'), JSON.stringify({
    version: 1, starter: ['local-skill'], historical: [],
    retired: [{ name: 'old-skill', reason: 'Removed upstream.' }],
  }));
  const lockPath = path.join(root, 'sources.json');
  await fs.writeFile(lockPath, JSON.stringify({ version: 1, skills: ['remote-one', 'remote-two'].map((name) => ({
    name, repo: 'owner/repo', commit: 'a'.repeat(40), path: `skills/${name}`,
    files: [{ path: 'SKILL.md', sha256: hash(body(name)) }],
  })), localSkills: ['local-skill'] }));
  const logs: string[] = [];
  const requested: string[] = [];
  const fetcher = async (url: string | URL | Request) => {
    requested.push(String(url));
    const name = String(url).includes('remote-one') ? 'remote-one' : 'remote-two';
    return new Response(body(name), { status: 200 });
  };
  const base = { profileDir, lockPath, homeDir, env: {}, fetcher: fetcher as typeof fetch, log: (line: string) => logs.push(line) };

  await runCodexSetup({ ...base, list: true });
  assert.equal(requested.length, 0);
  assert.match(logs.join('\n'), /remote-one/);
  assert.match(logs.join('\n'), /old-skill.*Removed upstream/);

  await runCodexSetup({ ...base, starter: true });
  assert.equal(requested.length, 0);
  assert.match(logs.join('\n'), /local-skill/);
  await runCodexSetup({ ...base, starter: true, yes: true });
  await fs.access(path.join(homeDir, '.agents', 'skills', 'local-skill', 'SKILL.md'));
  assert.equal(requested.length, 0);

  await runCodexSetup({ ...base, skills: ['remote-one'] });
  assert.equal(requested.length, 1);
  await assert.rejects(fs.stat(path.join(homeDir, '.agents', 'skills', 'remote-one', 'SKILL.md')), { code: 'ENOENT' });

  await runCodexSetup({ ...base, skills: ['remote-one'], yes: true });
  assert.equal(requested.length, 2);
  assert.equal(await fs.readFile(path.join(homeDir, '.agents', 'skills', 'remote-one', 'SKILL.md'), 'utf8'), body('remote-one'));
  const rules = await fs.readFile(path.join(homeDir, '.codex', 'AGENTS.md'), 'utf8');
  assert.match(rules, /Global Codex guidance/);
  assert.ok(requested.every((url) => url.includes('remote-one')));

  await runCodexSetup({ ...base, skills: ['local-skill'], noRules: true, yes: true });
  assert.equal(requested.length, 2);
  assert.equal(await fs.readFile(path.join(homeDir, '.agents', 'skills', 'local-skill', 'SKILL.md'), 'utf8'), body('local-skill'));
  assert.equal(await fs.readFile(path.join(homeDir, '.codex', 'AGENTS.md'), 'utf8'), rules);
  await assert.rejects(runCodexSetup({ ...base, skills: ['unknown'], yes: true }), /Unknown Skill/);
  await assert.rejects(runCodexSetup({ ...base, skills: ['old-skill'], yes: true }), /Retired Skill old-skill/);
  await assert.rejects(runCodexSetup({ ...base, all: true, skills: ['local-skill'], yes: true }), /Choose --all/);
  await fs.writeFile(path.join(profileDir, 'profile.json'), JSON.stringify({
    name: 'codex-curated', version: '1.0.0', agents: ['codex'], scope: 'user',
    skills: [{ name: 'local-skill', source: 'skills/local-skill' }],
  }));
  await assert.rejects(runCodexSetup({ ...base, list: true }), /catalog and profile.json disagree/);
});

test('public profile can install one local Skill without asking for other uninstalled Skills', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-public-setup-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await runCodexSetup({
    skills: ['vibe-coding'], yes: true, homeDir: root, env: {},
    fetcher: async () => { throw new Error('No upstream download expected'); },
    log: () => {},
  });
  const rules = await fs.readFile(path.join(root, '.codex', 'AGENTS.md'), 'utf8');
  for (const line of rules.split('\n').filter((line) => /`(?:autonomous-iteration|diagnosing-bugs|tdd|api-and-interface-design|codebase-design)`/.test(line))) {
    assert.match(line, /^- If installed, /);
  }
  await fs.access(path.join(root, '.agents', 'skills', 'vibe-coding', 'SKILL.md'));
  await assert.rejects(fs.stat(path.join(root, '.agents', 'skills', 'diagnosing-bugs')), { code: 'ENOENT' });
});

test('public catalog accounts for the full local inventory without installing retired Skills', async () => {
  const logs: string[] = [];
  await runCodexSetup({ list: true, log: (line) => logs.push(line) });
  const output = logs.join('\n');
  assert.match(output, /67 installable, 7 retired/);
  assert.match(output, /lark-doc.*requires lark-cli/);
  assert.match(output, /obsidian-vault.*not portable/);
  assert.match(output, /edit-article.*historical source/);
  const catalogPath = fileURLToPath(new URL('../../profiles/codex-curated/catalog.json', import.meta.url));
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8')) as { starter: string[] };
  assert.deepEqual(catalog.starter, [
    'api-and-interface-design', 'code-review', 'codebase-design', 'diagnosing-bugs',
    'doubt-driven-development', 'edit-article', 'frontend-design',
    'security-and-hardening', 'source-driven-development', 'tdd', 'writing-shape',
    'autonomous-iteration', 'vibe-coding',
  ]);
});

test('selecting a Lark Skill includes its shared Skill and no other downloads', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-lark-setup-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const profileDir = path.join(root, 'codex-curated');
  await fs.mkdir(path.join(profileDir, 'rules'), { recursive: true });
  await fs.writeFile(path.join(profileDir, 'rules', 'global.md'), '# Global guidance\n');
  await fs.writeFile(path.join(profileDir, 'catalog.json'), JSON.stringify({
    version: 1, starter: [], historical: [], retired: [],
  }));
  const names = ['lark-doc', 'lark-shared', 'other-skill'];
  await fs.writeFile(path.join(profileDir, 'profile.json'), JSON.stringify({
    name: 'codex-curated', version: '1.0.0', agents: ['codex'], scope: 'user',
    rules: { template: 'rules/global.md' },
    skills: names.map((name) => ({ name, source: `skills/${name}` })),
  }));
  const lockPath = path.join(root, 'sources.json');
  await fs.writeFile(lockPath, JSON.stringify({ version: 1, skills: names.map((name) => ({
    name, repo: 'owner/repo', commit: 'a'.repeat(40), path: `skills/${name}`,
    files: [{ path: 'SKILL.md', sha256: hash(body(name)) }],
  })) }));
  const requested: string[] = [];
  const logs: string[] = [];
  await runCodexSetup({
    profileDir, lockPath, skills: ['lark-doc'], yes: true,
    homeDir: path.join(root, 'home'), env: {}, log: (line) => logs.push(line),
    fetcher: (async (url: string | URL | Request) => {
      const value = String(url);
      requested.push(value);
      const name = names.find((item) => value.includes(`/skills/${item}/`));
      assert.ok(name);
      return new Response(body(name), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(requested.length, 2);
  assert.ok(requested.some((url) => url.includes('/lark-shared/')));
  assert.ok(requested.every((url) => !url.includes('/other-skill/')));
  assert.match(logs.join('\n'), /Added lark-shared dependency/);
  await fs.access(path.join(root, 'home', '.agents', 'skills', 'lark-shared', 'SKILL.md'));
});
