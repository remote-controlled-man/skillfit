import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { runInstall } from './install.js';
import { runBundleExport } from './bundle.js';

async function fixture(t: test.TestContext): Promise<{ root: string; home: string; targetHome: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-bundle-'));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  const home = path.join(root, 'source-home');
  const targetHome = path.join(root, 'target-home');
  await fs.mkdir(path.join(home, '.codex'), { recursive: true });
  await fs.mkdir(targetHome, { recursive: true });
  return { root, home, targetHome };
}

test('exports a portable Codex profile and installs it into a fresh home', async (t) => {
  const { root, home, targetHome } = await fixture(t);
  const skill = path.join(home, '.agents', 'skills', 'example');
  await fs.mkdir(skill, { recursive: true });
  await fs.writeFile(path.join(skill, 'SKILL.md'), '---\nname: example\ndescription: Handle example tasks.\n---\nDo the example.\n');
  const icon = Buffer.from([0, 0xff, 0x89, 0x50]);
  await fs.writeFile(path.join(skill, 'icon.png'), icon);
  for (const artifact of ['SKILL.md.skillfit-bak', 'SKILL.md.123.skillfit-staged', 'SKILL.md.123.skillfit-restore']) {
    await fs.writeFile(path.join(skill, artifact), 'Old private instructions');
  }
  await fs.writeFile(path.join(home, '.codex', 'AGENTS.md'), '# My global rules\n\nUse concise answers.\n');
  const outputDir = path.join(root, 'personal-codex');

  await runBundleExport({ outputDir, homeDir: home, skillNames: ['example'], yes: true, log: () => {} });

  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, 'profile.json'), 'utf8')) as {
    agents: string[]; skills: { name: string; source: string }[];
  };
  assert.deepEqual(manifest.agents, ['codex']);
  assert.deepEqual(manifest.skills, [{ name: 'example', source: 'skills/example' }]);
  assert.deepEqual(await fs.readFile(path.join(outputDir, 'skills', 'example', 'icon.png')), icon);
  for (const artifact of ['SKILL.md.skillfit-bak', 'SKILL.md.123.skillfit-staged', 'SKILL.md.123.skillfit-restore']) {
    await assert.rejects(fs.stat(path.join(outputDir, 'skills', 'example', artifact)), { code: 'ENOENT' });
  }
  const rules = await fs.readFile(path.join(outputDir, 'rules', 'global.md'), 'utf8');
  assert.match(rules, /My global rules/);
  assert.match(rules, /example/);

  await runInstall({
    profile: 'ignored', profilePath: outputDir, agent: 'codex', homeDir: targetHome,
    projectDir: root, env: { PATH: '' }, yes: true, log: () => {},
  });
  assert.deepEqual(await fs.readFile(path.join(targetHome, '.agents', 'skills', 'example', 'icon.png')), icon);
  assert.match(await fs.readFile(path.join(targetHome, '.codex', 'AGENTS.md'), 'utf8'), /My global rules/);
  const standaloneHome = path.join(root, 'standalone-home');
  await fs.mkdir(standaloneHome);
  const result = spawnSync(process.execPath, [path.join(outputDir, 'setup.mjs'), '--yes'], {
    cwd: root,
    env: { ...process.env, HOME: standaloneHome, USERPROFILE: standaloneHome, CODEX_HOME: path.join(standaloneHome, 'codex-home') },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readFile(path.join(standaloneHome, '.agents', 'skills', 'example', 'icon.png')), icon);
  assert.match(await fs.readFile(path.join(standaloneHome, 'codex-home', 'AGENTS.md'), 'utf8'), /My global rules/);
  await assert.rejects(runInstall({
    profile: 'ignored', profilePath: outputDir, agent: 'codex', homeDir: targetHome,
    projectDir: root, env: { PATH: '' }, project: true, yes: true, log: () => {},
  }), /user scope/);
});

test('export selects locally installed skills used in multiple sessions by default', async (t) => {
  const { root, home } = await fixture(t);
  for (const name of ['often', 'once']) {
    const dir = path.join(home, '.agents', 'skills', name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} tasks.\n---\nDo it.\n`);
  }
  const outputDir = path.join(root, 'personal-codex');
  await runBundleExport({
    outputDir, homeDir: home, yes: true, log: () => {},
    loadUsage: async () => [
      { name: 'often', sessionCount: 3 },
      { name: 'once', sessionCount: 1 },
      { name: 'plugin-owned', sessionCount: 20 },
    ],
  });
  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, 'profile.json'), 'utf8')) as {
    skills: { name: string }[];
  };
  assert.deepEqual(manifest.skills.map((skill) => skill.name), ['often']);
});

test('exported global guidance preserves user-invoked-only skill routing', async (t) => {
  const { root, home } = await fixture(t);
  const skillDir = path.join(home, '.agents', 'skills', 'explicit-skill');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: explicit-skill\ndescription: Explicit writing help.\n---\nUse when named.\n');
  await fs.mkdir(path.join(skillDir, 'agents'));
  await fs.writeFile(path.join(skillDir, 'agents', 'openai.yaml'), 'interface:\n  display_name: Explicit Skill\npolicy:\n  allow_implicit_invocation: false\n');
  const outputDir = path.join(root, 'portable-codex');
  await runBundleExport({ outputDir, homeDir: home, skillNames: ['explicit-skill'], yes: true, log: () => {} });
  const rules = await fs.readFile(path.join(outputDir, 'rules', 'global.md'), 'utf8');
  assert.match(rules, /Available for implicit routing in this portable profile: none/);
  assert.match(rules, /User-invoked only: `explicit-skill`/);
});

test('export recognizes flow-style and quoted invocation policies', async (t) => {
  const { root, home } = await fixture(t);
  const skillDir = path.join(home, '.agents', 'skills', 'explicit-skill');
  await fs.mkdir(path.join(skillDir, 'agents'), { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: explicit-skill\ndescription: Explicit writing help.\n---\nUse when named.\n');
  for (const [index, metadata] of [
    'policy: { allow_implicit_invocation: false }\n',
    'policy:\n  allow_implicit_invocation: "false"\n',
  ].entries()) {
    await fs.writeFile(path.join(skillDir, 'agents', 'openai.yaml'), metadata);
    const outputDir = path.join(root, `portable-codex-${index}`);
    await runBundleExport({ outputDir, homeDir: home, skillNames: ['explicit-skill'], yes: true, log: () => {} });
    const rules = await fs.readFile(path.join(outputDir, 'rules', 'global.md'), 'utf8');
    assert.match(rules, /User-invoked only: `explicit-skill`/);
  }
});

test('export dry-run writes nothing and refuses an existing destination', async (t) => {
  const { root, home } = await fixture(t);
  const outputDir = path.join(root, 'personal-codex');
  await runBundleExport({ outputDir, homeDir: home, skillNames: [], dryRun: true, log: () => {} });
  await assert.rejects(fs.stat(outputDir), { code: 'ENOENT' });
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(outputDir, 'keep.txt'), 'keep');
  await assert.rejects(
    runBundleExport({ outputDir, homeDir: home, skillNames: [], yes: true, log: () => {} }),
    /already exists/,
  );
  assert.equal(await fs.readFile(path.join(outputDir, 'keep.txt'), 'utf8'), 'keep');
});

test('upstream export pins a GitHub skill and keeps a self-written skill local', async (t) => {
  const { root, home } = await fixture(t);
  for (const name of ['local-skill']) {
    const dir = path.join(home, '.agents', 'skills', name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} tasks.\n---\nUse it.\n`);
  }
  const lockPath = path.join(root, 'sources.json');
  await fs.writeFile(lockPath, JSON.stringify({ version: 1, skills: [{
    name: 'remote-skill', repo: 'owner/repo', commit: 'a'.repeat(40), path: 'skills/remote-skill',
    files: [{ path: 'SKILL.md', sha256: 'b'.repeat(64) }], explicitOnly: true,
  }], localSkills: ['local-skill'] }));
  const outputDir = path.join(root, 'portable-codex');
  await runBundleExport({ outputDir, homeDir: home, upstreamLockPath: lockPath, yes: true, log: () => {}, loadUsage: async () => { throw new Error('usage selection should not run'); } });
  await assert.rejects(fs.stat(path.join(outputDir, 'skills', 'remote-skill')), { code: 'ENOENT' });
  assert.match(await fs.readFile(path.join(outputDir, 'skills', 'local-skill', 'SKILL.md'), 'utf8'), /Use it/);
  const lock = JSON.parse(await fs.readFile(path.join(outputDir, 'upstream.lock.json'), 'utf8')) as { skills: { name: string }[]; localSkills: string[] };
  assert.deepEqual(lock.skills.map((skill) => skill.name), ['remote-skill']);
  assert.deepEqual(lock.localSkills, ['local-skill']);
  assert.match(await fs.readFile(path.join(outputDir, 'setup.mjs'), 'utf8'), /prepareUpstreamProfile/);
  const rules = await fs.readFile(path.join(outputDir, 'rules', 'global.md'), 'utf8');
  assert.match(rules, /User-invoked only: `remote-skill`/);
});
