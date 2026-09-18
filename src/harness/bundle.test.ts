import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectSkillBundle } from './bundle.js';

function makeSkillDir(t: import('node:test').TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-bundle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'refs'), { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '# My Skill\nDo the thing.\n');
  writeFileSync(join(dir, 'refs', 'rules.yaml'), 'rule: one\n');
  writeFileSync(join(dir, 'data.json'), '{"a":1}\n');
  writeFileSync(join(dir, 'ignore.txt'), 'not injectable\n');
  writeFileSync(join(dir, 'run.js'), 'console.log(1)\n');
  return dir;
}

test('collectSkillBundle collects only md/yaml/json files, sorted', (t) => {
  const dir = makeSkillDir(t);
  const bundle = collectSkillBundle(dir, 'my-skill');
  assert.deepEqual(bundle.files, ['SKILL.md', 'data.json', 'refs/rules.yaml']);
  assert.equal(bundle.name, 'my-skill');
});

test('collectSkillBundle hash is deterministic and content-sensitive', (t) => {
  const dir = makeSkillDir(t);
  const first = collectSkillBundle(dir, 'my-skill');
  const second = collectSkillBundle(dir, 'my-skill');
  assert.equal(first.sha256, second.sha256);
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  writeFileSync(join(dir, 'SKILL.md'), '# Changed\n');
  const third = collectSkillBundle(dir, 'my-skill');
  assert.notEqual(first.sha256, third.sha256);
});

test('collectSkillBundle payload wraps files in a <skill> block', (t) => {
  const dir = makeSkillDir(t);
  const bundle = collectSkillBundle(dir, 'my-skill');
  assert.match(bundle.payload, /<skill name="my-skill">/);
  assert.match(bundle.payload, /--- skill file: SKILL\.md ---/);
  assert.match(bundle.payload, /# My Skill/);
  assert.match(bundle.payload, /<\/skill>/);
  assert.ok(!bundle.payload.includes('not injectable'));
});

test('collectSkillBundle defaults the name to the directory basename', (t) => {
  const dir = makeSkillDir(t);
  const bundle = collectSkillBundle(dir);
  assert.equal(bundle.name, dir.split(/[\\/]/).pop());
});

test('collectSkillBundle rejects missing dirs and empty skills', (t) => {
  assert.throws(() => collectSkillBundle(join(tmpdir(), 'skillfit-does-not-exist')), /not a directory/);
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-bundle-empty-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'only.txt'), 'x\n');
  assert.throws(() => collectSkillBundle(dir), /No injectable skill files/);
});
