import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { classifyChanges, changedFiles, scopeForEvent, inspectRecordChanges, testCounts } from './ci-scope.mjs';
import { RELEASE_DOCUMENTS } from '../docs/releases/release-docs-smoke.mjs';

const sha = 'a'.repeat(40), row = (path, status = 'A', mode = '100644') => ({ path, status, mode });
test('only regular release bookkeeping enters targeted CI', () => {
  const allowed = [row('docs/plans/2026-10-21-release.md', 'M'), row('docs/releases/0.14.0.md', 'M'), row('docs/releases/0.14.0-verification.json'), row('docs/releases/0.14.0-signatures.txt')];
  assert.equal(classifyChanges(allowed), 'records');
  for (const entry of [row('src/cli.ts'), row('package.json'), row('.github/workflows/ci.yml'), row('README.md'), row('skills/skillfit/SKILL.md'), row('docs/releases/0.14.0-feature-smoke.mjs'), row('docs/releases/0.13.1-verification.json', 'M'), row('docs/plans/a.md', 'D'), row('docs/plans/a.md', 'R'), row('docs/plans/a.md', 'M', '120000'), row('docs/plans/a.md', 'M', '100755')]) {
    assert.equal(classifyChanges([...allowed, entry]), 'full', entry.path);
  }
  assert.equal(classifyChanges([]), 'full');
});
test('unknown, incomplete and unavailable diff bases fail closed to full CI', () => {
  for (const [event, body] of [['push', { before: '0'.repeat(40) }], ['pull_request', {}], ['workflow_dispatch', {}]]) assert.equal(scopeForEvent(event, body, sha).scope, 'full');
  assert.equal(scopeForEvent('push', { before: sha }, sha, () => { throw Error('shallow history'); }).scope, 'full');
  assert.equal(scopeForEvent('push', { before: sha }, sha, () => 'malformed\0path\0').scope, 'full');
  const raw = `:000000 100644 ${'0'.repeat(40)} ${sha} A\0docs/plans/a.md\0`;
  assert.deepEqual(changedFiles(sha, sha, () => raw), [row('docs/plans/a.md')]);
  assert.equal(scopeForEvent('pull_request', { pull_request: { base: { sha } } }, sha, () => raw).scope, 'records');
});
test('test counts must be actual TAP or Node spec output, never fabricated on missing output', () => {
  for (const marker of ['#', 'ℹ']) assert.deepEqual(testCounts(['tests 3', 'pass 2', 'fail 0', 'cancelled 0', 'skipped 1'].map(x => marker+' '+x).join('\n')), { tests: 3, pass: 2, fail: 0, cancelled: 0, skipped: 1 });
  assert.throws(() => testCounts('passed'), /Missing actual/);
});
test('record validation rejects malformed JSON, escaping references and altered digests', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-ci-records-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/releases'), { recursive: true }); mkdirSync(join(root, 'docs/plans'));
  for (const file of ['AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'benches/README.md', 'benches/contrib/README.md', 'scripts/README.md', 'evidence/README.md', ...RELEASE_DOCUMENTS]) {
    mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), 'npx skillfit@0.13.1 [release](docs/releases/0.13.1.md)');
  }
  // Fixture links use a valid root entry; nested current docs contain no links.
  for (const file of RELEASE_DOCUMENTS.filter(f => f.includes('/'))) writeFileSync(join(root, file), 'npx skillfit@0.13.1');
  for (const file of ['AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'benches/README.md', 'benches/contrib/README.md', 'scripts/README.md', 'evidence/README.md']) writeFileSync(join(root, file), 'Fixture.');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'skillfit', version: '0.13.1' }));
  writeFileSync(join(root, 'docs/releases/0.13.1.md'), '# Release');
  const file = 'docs/releases/0.14.0-verification.json', target = join(root, file);
  writeFileSync(join(root, 'docs/releases/0.14.0-result.json'), '{}');
  const hash = createHash('sha256').update('{}').digest('hex');
  writeFileSync(target, JSON.stringify({ receipt: { path: '0.14.0-result.json', sha256: hash } }));
  assert.equal(inspectRecordChanges(root, [row(file)]).references, 1);
  writeFileSync(target, '{'); assert.throws(() => inspectRecordChanges(root, [row(file)]));
  writeFileSync(target, JSON.stringify({ receipt: { path: '../outside', sha256: hash } })); assert.throws(() => inspectRecordChanges(root, [row(file)]), /release directory/);
  writeFileSync(target, JSON.stringify({ receipt: { path: '0.14.0-result.json', sha256: hash } }));
  writeFileSync(join(root, 'docs/releases/0.14.0-result.json'), '{"changed":true}'); assert.throws(() => inspectRecordChanges(root, [row(file)]), /digest mismatch/);
});
