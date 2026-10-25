import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectReleaseDocuments, RELEASE_DOCUMENTS, validateReleaseDocuments } from './recipes/release-docs-smoke.mjs';

const version = '0.13.1';
const current = () => new Map(RELEASE_DOCUMENTS.map(path => [path,
  `Run npx skillfit@${version}. [Changelog](CHANGELOG.md). Features since 0.12.0; archives require 0.13.0.`]));

test('release document checks allow historical minimums alongside current commands', () => {
  const docs = current();
  assert.equal(inspectReleaseDocuments(version, path => docs.get(path)).length, RELEASE_DOCUMENTS.length);
});

test('stale commands in any current entry point block release including the packaged Skill', () => {
  for (const path of RELEASE_DOCUMENTS) {
    const docs = current(); docs.set(path, docs.get(path) + '\nRun npx skillfit@0.12.0 --version.');
    assert.throws(() => inspectReleaseDocuments(version, file => docs.get(file)), /Stale package command/);
  }
});

test('removing command pins or the stable changelog link cannot bypass validation', () => {
  const docs = current(); docs.set('skills/skillfit/SKILL.md', 'No package command.');
  assert.throws(() => inspectReleaseDocuments(version, path => docs.get(path)), /command is missing/);
  const stale = current(); stale.set('README.md', `Run npx skillfit@${version}. [Release](docs/releases/0.13.0.md).`);
  assert.throws(() => inspectReleaseDocuments(version, path => stale.get(path)), /Changelog link is missing/);
});

test('current source release documents match the package version', () => {
  validateReleaseDocuments(fileURLToPath(new URL('../..', import.meta.url)));
});

test('document check executes through a directory alias and emits its verification receipt', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-docs-alias-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const alias = join(root, 'package');
  symlinkSync(fileURLToPath(new URL('../..', import.meta.url)), alias, 'junction');
  const result = spawnSync(process.execPath, [join(alias, 'tools/verify/recipes/release-docs-smoke.mjs'), alias], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
  assert.equal(JSON.parse(result.stdout).documents.length, RELEASE_DOCUMENTS.length);
});
