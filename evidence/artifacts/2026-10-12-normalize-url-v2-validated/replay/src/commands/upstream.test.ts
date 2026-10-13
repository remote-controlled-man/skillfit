import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { prepareUpstreamProfile, readUpstreamLock } from './upstream.js';

const body = '---\nname: remote-skill\ndescription: Remote tasks.\n---\nUse this skill.\n';
const hash = createHash('sha256').update(body).digest('hex');
const metadata = 'policy:\n  allow_implicit_invocation: false\n';
const metadataHash = createHash('sha256').update(metadata).digest('hex');
const commit = 'a'.repeat(40);

test('prepares a mixed portable profile from pinned GitHub files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-upstream-test-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'personal-codex');
  await fs.mkdir(path.join(bundle, 'rules'), { recursive: true });
  await fs.mkdir(path.join(bundle, 'skills', 'local-skill'), { recursive: true });
  await fs.writeFile(path.join(bundle, 'rules', 'global.md'), 'Use relevant Skills.\n');
  await fs.writeFile(path.join(bundle, 'skills', 'local-skill', 'SKILL.md'), '---\nname: local-skill\ndescription: Local tasks.\n---\nUse locally.\n');
  await fs.writeFile(path.join(bundle, 'profile.json'), JSON.stringify({
    name: 'personal-codex', version: '1.0.0', agents: ['codex'], scope: 'user',
    rules: { template: 'rules/global.md' },
    skills: [{ name: 'local-skill', source: 'skills/local-skill' }, { name: 'remote-skill', source: 'skills/remote-skill' }],
  }));
  await fs.writeFile(path.join(bundle, 'upstream.lock.json'), JSON.stringify({ version: 1, skills: [{
    name: 'remote-skill', repo: 'owner/repo', commit, path: 'skills/remote-skill',
    files: [{ path: 'SKILL.md', sha256: hash }, { path: 'agents/openai.yaml', sha256: metadataHash }], explicitOnly: true,
  }] }));
  const requested: string[] = [];
  const prepared = await prepareUpstreamProfile(bundle, {
    fetcher: async (url) => {
      requested.push(String(url));
      return new Response(String(url).endsWith('/SKILL.md') ? body : metadata, { status: 200 });
    },
  });
  try {
    assert.deepEqual(requested, [
      `https://raw.githubusercontent.com/owner/repo/${commit}/skills/remote-skill/SKILL.md`,
      `https://raw.githubusercontent.com/owner/repo/${commit}/skills/remote-skill/agents/openai.yaml`,
    ]);
    assert.equal(await fs.readFile(path.join(prepared.profileDir, 'skills', 'remote-skill', 'SKILL.md'), 'utf8'), body);
    assert.match(await fs.readFile(path.join(prepared.profileDir, 'skills', 'local-skill', 'SKILL.md'), 'utf8'), /Use locally/);
  } finally {
    await prepared.cleanup();
  }
  await assert.rejects(fs.stat(prepared.profileDir), { code: 'ENOENT' });
  const lockPath = path.join(bundle, 'upstream.lock.json');
  const inconsistent = JSON.parse(await fs.readFile(lockPath, 'utf8')) as { skills: { explicitOnly?: boolean }[] };
  delete inconsistent.skills[0]?.explicitOnly;
  await fs.writeFile(lockPath, JSON.stringify(inconsistent));
  await assert.rejects(prepareUpstreamProfile(bundle, {
    fetcher: async (url) => new Response(String(url).endsWith('/SKILL.md') ? body : metadata, { status: 200 }),
  }), /Invocation policy mismatch/);
});

test('rejects unpinned, unsafe, or tampered upstream records before installation', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-upstream-invalid-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'upstream.lock.json');
  const record = { name: 'remote-skill', repo: 'owner/repo', commit, path: 'skills/remote-skill', files: [{ path: 'SKILL.md', sha256: hash }] };
  for (const bad of [
    { ...record, commit: 'main' },
    { ...record, path: '../escape' },
    { ...record, files: [{ path: '../outside', sha256: hash }] },
    { ...record, files: [{ path: 'SKILL.md', sha256: 'bad' }] },
    { ...record, files: [{ path: 'SKILL.md', sha256: hash }, { path: 'old.skillfit-bak', sha256: hash }] },
  ]) {
    await fs.writeFile(file, JSON.stringify({ version: 1, skills: [bad] }));
    await assert.rejects(readUpstreamLock(file));
  }
});

test('cleans partial downloads when a later upstream file is unavailable', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-upstream-partial-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'portable');
  const tempRoot = path.join(root, 'scratch');
  await fs.mkdir(bundle);
  await fs.mkdir(tempRoot);
  await fs.writeFile(path.join(bundle, 'profile.json'), JSON.stringify({
    name: 'portable', version: '1.0.0', agents: ['codex'], scope: 'user',
    skills: [{ name: 'remote-skill', source: 'skills/remote-skill' }],
  }));
  await fs.writeFile(path.join(bundle, 'upstream.lock.json'), JSON.stringify({ version: 1, skills: [{
    name: 'remote-skill', repo: 'owner/repo', commit, path: 'skills/remote-skill',
    files: [{ path: 'SKILL.md', sha256: hash }, { path: 'references/missing.md', sha256: hash }],
  }] }));
  await assert.rejects(prepareUpstreamProfile(bundle, {
    tempRoot,
    fetcher: async (url) => String(url).endsWith('/SKILL.md')
      ? new Response(body, { status: 200 })
      : new Response('not found', { status: 404 }),
  }), /download failed/);
  assert.deepEqual(await fs.readdir(tempRoot), []);
});

test('refuses a changed upstream file before creating any installable profile', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-upstream-tampered-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'portable');
  await fs.mkdir(bundle);
  await fs.writeFile(path.join(bundle, 'profile.json'), JSON.stringify({
    name: 'portable', version: '1.0.0', agents: ['codex'], scope: 'user',
    skills: [{ name: 'remote-skill', source: 'skills/remote-skill' }],
  }));
  await fs.writeFile(path.join(bundle, 'upstream.lock.json'), JSON.stringify({ version: 1, skills: [{
    name: 'remote-skill', repo: 'owner/repo', commit, path: 'skills/remote-skill',
    files: [{ path: 'SKILL.md', sha256: hash }],
  }] }));
  await assert.rejects(
    prepareUpstreamProfile(bundle, { fetcher: async () => new Response('changed', { status: 200 }) }),
    /SHA-256 mismatch/,
  );
  await assert.rejects(fs.stat(path.join(root, 'skills')), { code: 'ENOENT' });
});

test('retries transient upstream connection failures', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-upstream-retry-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'portable');
  await fs.mkdir(bundle);
  await fs.writeFile(path.join(bundle, 'profile.json'), JSON.stringify({
    name: 'portable', version: '1.0.0', agents: ['codex'], scope: 'user',
    skills: [{ name: 'remote-skill', source: 'skills/remote-skill' }],
  }));
  await fs.writeFile(path.join(bundle, 'upstream.lock.json'), JSON.stringify({ version: 1, skills: [{
    name: 'remote-skill', repo: 'owner/repo', commit, path: 'skills/remote-skill',
    files: [{ path: 'SKILL.md', sha256: hash }],
  }] }));
  let attempts = 0;
  const prepared = await prepareUpstreamProfile(bundle, { fetcher: async () => {
    attempts++;
    if (attempts === 1) throw new Error('transient network failure');
    return new Response(body, { status: 200 });
  } });
  try {
    assert.equal(attempts, 2);
    assert.equal(await fs.readFile(path.join(prepared.profileDir, 'skills', 'remote-skill', 'SKILL.md'), 'utf8'), body);
  } finally {
    await prepared.cleanup();
  }
});
