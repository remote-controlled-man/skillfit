import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { classifyChanges, changedFiles, scopeForEvent, inspectRecordChanges, inspectLegacyRecordChanges, testCounts, ciReceipt } from './ci-scope.mjs';
import { spawnSync } from 'node:child_process';
import { RELEASE_DOCUMENTS } from './recipes/release-docs-smoke.mjs';

const sha = 'a'.repeat(40), row = (path, status = 'A', mode = '100644') => ({ path, status, mode });
function registerDocuments(root, paths, historical = []) {
  const policy = { schemaVersion: 1, documents: [...new Set(paths)].map(path => ({ path, kind: 'record',
    lifecycle: historical.includes(path) ? 'historical' : 'maintained', audience: ['maintainer'], owner: 'development',
    scope: [{ kind: 'source', ref: 'working-tree' }], topics: [], checks: ['docs-links'] })), topics: {}, exclusions: [] };
  mkdirSync(join(root, 'tools/verify'), { recursive: true });
  writeFileSync(join(root, 'tools/verify/documentation-policy.json'), JSON.stringify(policy));
}
test('only regular release bookkeeping enters targeted CI', () => {
  const allowed = [row('docs/plans/2026-10-21-release.md', 'M'), row('docs/releases/0.14.0.md', 'M'), row('docs/releases/0.14.0-verification.json'), row('docs/releases/0.14.0-signatures.txt')];
  assert.equal(classifyChanges(allowed), 'records');
  assert.equal(classifyChanges([row('docs/work/current.md', 'M')]), 'records');
  for (const entry of [row('src/cli/main.ts'), row('package.json'), row('.github/workflows/ci.yml'), row('README.md'), row('skills/skillfit/SKILL.md'), row('docs/releases/0.14.0-feature-smoke.mjs'), row('docs/releases/0.13.1-verification.json', 'M'), row('docs/plans/a.md', 'D'), row('docs/plans/a.md', 'R'), row('docs/plans/a.md', 'M', '120000'), row('docs/plans/a.md', 'M', '100755')]) {
    assert.equal(classifyChanges([...allowed, entry]), 'full', entry.path);
  }
  assert.equal(classifyChanges([]), 'full');
  for (const path of ['tools/verify/documentation-policy.json', 'tools/verify/documentation-registry.mjs', 'docs/decisions/new.md', 'docs/new/guide.md', 'docs/README.md']) assert.equal(classifyChanges([row(path)]), 'full', path);
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
test('CI receipts identify actual runtime/job and retain failed or minimum results honestly', t => {
  const env = { GITHUB_REPOSITORY: 'fixture/repo', GITHUB_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
    SKILLFIT_CI_JOB: 'node-compat', SKILLFIT_CI_OS: 'ubuntu-latest', SKILLFIT_CI_NODE_TARGET: '26', SKILLFIT_JOB_STATUS: 'success' };
  const counts = { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0 };
  const actual = ciReceipt(env, 'full', { exitCode: 0, counts });
  assert.equal(actual.nodeVersion, process.version); assert.equal(actual.nodeTarget, '26');
  assert.equal(actual.job, 'node-compat'); assert.equal(actual.status, 'passed');
  assert.equal(ciReceipt({ ...env, SKILLFIT_JOB_STATUS: 'failure' }, 'full', { exitCode: 0, counts }).status, 'failed');
  assert.equal(ciReceipt(env, 'full', { exitCode: 1, counts }).status, 'failed');
  assert.equal(ciReceipt(env, 'full', { exitCode: 0, counts: { ...counts, cancelled: 1 } }).status, 'failed');
  assert.equal(ciReceipt(env, 'full', null).status, 'failed');
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-ci-runtime-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'scope.json'), JSON.stringify({ scope: 'full' }));
  writeFileSync(join(dir, 'test-result.json'), JSON.stringify({ scope: 'minimum', exitCode: 0, counts }));
  const result = spawnSync(process.execPath, ['tools/verify/ci-scope.mjs', 'record'], { encoding: 'utf8',
    env: { ...process.env, ...env, SKILLFIT_CI_DIR: dir, SKILLFIT_CI_JOB: 'node-minimum', SKILLFIT_CI_NODE_TARGET: '22.0.0', GITHUB_STEP_SUMMARY: '' } });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(readFileSync(join(dir, 'ci-result.json'), 'utf8'));
  assert.equal(receipt.scope, 'minimum'); assert.equal(receipt.nodeVersion, process.version);
  assert.equal(receipt.job, 'node-minimum'); assert.deepEqual(receipt.counts, counts);
});
test('record validation rejects malformed JSON, escaping references and altered digests', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-ci-records-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/releases'), { recursive: true }); mkdirSync(join(root, 'docs/plans'));
  for (const file of ['AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'benches/README.md', 'benches/contrib/README.md', 'tools/README.md', 'evidence/README.md', ...RELEASE_DOCUMENTS]) {
    mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), 'npx skillfit@0.13.1 [Changelog](CHANGELOG.md)');
  }
  // Fixture links use a valid root entry; nested current docs contain no links.
  for (const file of RELEASE_DOCUMENTS.filter(f => f.includes('/'))) writeFileSync(join(root, file), 'npx skillfit@0.13.1');
  for (const file of ['AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'benches/README.md', 'benches/contrib/README.md', 'tools/README.md', 'evidence/README.md']) writeFileSync(join(root, file), 'Fixture.');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'skillfit', version: '0.13.1' }));
  writeFileSync(join(root, 'docs/releases/0.13.1.md'), '# Release');
  registerDocuments(root, ['AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'benches/README.md', 'benches/contrib/README.md', 'tools/README.md', 'evidence/README.md', ...RELEASE_DOCUMENTS, 'docs/releases/0.13.1.md']);
  const file = 'docs/releases/0.14.0-verification.json', target = join(root, file);
  writeFileSync(join(root, 'docs/releases/0.14.0-result.json'), '{}');
  const hash = createHash('sha256').update('{}').digest('hex');
  writeFileSync(target, JSON.stringify({ receipt: { path: '0.14.0-result.json', sha256: hash } }));
  assert.throws(() => inspectRecordChanges(root, [row(file)]), /unowned documentation|not maintained documentation/);
  assert.equal(inspectLegacyRecordChanges(root, [row(file)]).references, 1);
  writeFileSync(target, '{'); assert.throws(() => inspectLegacyRecordChanges(root, [row(file)]));
  writeFileSync(target, JSON.stringify({ receipt: { path: '../outside', sha256: hash } })); assert.throws(() => inspectLegacyRecordChanges(root, [row(file)]), /release directory/);
  writeFileSync(target, JSON.stringify({ receipt: { path: '0.14.0-result.json', sha256: hash } }));
  writeFileSync(join(root, 'docs/releases/0.14.0-result.json'), '{"changed":true}'); assert.throws(() => inspectLegacyRecordChanges(root, [row(file)]), /digest mismatch/);
  const grouped = 'docs/releases/records/0.14.0'; mkdirSync(join(root, grouped), { recursive: true });
  writeFileSync(join(root, grouped, 'features.json'), '{}');
  writeFileSync(join(root, grouped, 'verification.json'), JSON.stringify({ receipt: { path: 'features.json', sha256: hash } }));
  assert.equal(inspectLegacyRecordChanges(root, [row(grouped + '/verification.json')]).references, 1);
  writeFileSync(join(root, grouped, 'features.json'), '{"changed":true}');
  assert.throws(() => inspectLegacyRecordChanges(root, [row(grouped + '/verification.json')]), /digest mismatch/);

});

test('CI documentation precheck retains a failing receipt for an explicitly changed historical record', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-ci-documentation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const docs = [...RELEASE_DOCUMENTS, 'CHANGELOG.md', 'docs/maintainers/releases.md', 'docs/maintainers/history.md'];
  for (const path of docs) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), path.startsWith('README') ? 'npx skillfit@0.13.1 [Changelog](CHANGELOG.md)\n' : 'npx skillfit@0.13.1\n');
  }
  writeFileSync(join(root, 'package.json'), '{"name":"skillfit","version":"0.13.1"}');
  registerDocuments(root, docs, ['docs/maintainers/history.md']);
  writeFileSync(join(root, 'docs/maintainers/history.md'), '# History\n[Bad](missing.md)\n');
  const runGate = (mode, scope, label, scopeRecord) => {
    const dir = join(root, label); mkdirSync(dir);
    writeFileSync(join(dir, 'scope.json'), JSON.stringify(scopeRecord ?? { scope, base: null, changes: [row('docs/maintainers/history.md', 'M')] }));
    const run = spawnSync(process.execPath, [join(import.meta.dirname, 'ci-scope.mjs'), mode], {
      cwd: root, encoding: 'utf8', env: { ...process.env, SKILLFIT_CI_DIR: dir },
    });
    return { run, dir, receipt: JSON.parse(readFileSync(join(dir, 'documentation.json'), 'utf8')) };
  };
  for (const [mode, scope] of [['documentation', 'records'], ['test', 'full'], ['test', 'records']]) {
    const { run, dir, receipt } = runGate(mode, scope, mode + '-' + scope);
    assert.notEqual(run.status, 0);
    assert.match(receipt.errors.join('\n'), /history.md.*missing target/);
    assert.ok(receipt.files.includes('docs/maintainers/history.md'));
    assert.equal(receipt.anchorBaseline, 'unavailable');
    assert.equal(existsSync(join(dir, 'tests.log')), false, 'gate failure prevents either test population from starting');
  }
  writeFileSync(join(root, 'docs/maintainers/history.md'), '# History\n');
  const passed = runGate('documentation', 'records', 'repaired');
  assert.equal(passed.run.status, 0, passed.run.stderr);
  assert.deepEqual(passed.receipt.errors, []);
  const unavailable = scopeForEvent('push', { before: sha }, sha, () => { throw Error('shallow baseline'); });
  const fallback = runGate('documentation', 'full', 'unknown-valid-sha', unavailable);
  assert.equal(fallback.run.status, 0, fallback.run.stderr);
  assert.equal(fallback.receipt.anchorBaseline, 'unavailable');
  assert.deepEqual(fallback.receipt.errors, []);
});


test('version-grouped known receipts use targeted CI while edits and unknown names require full', () => {
  for (const name of ['verification.json', 'features.json', 'source-ci.json', 'signatures.txt', 'registry-install-attempt-2.txt']) {
    const path = 'docs/releases/records/0.14.0/' + name;
    assert.equal(classifyChanges([row(path)]), 'records');
    assert.equal(classifyChanges([row(path, 'M')]), 'full');
  }
  for (const path of ['docs/releases/records/0.14.0/new-script.mjs', 'docs/releases/records/0.14.0/unknown.json', 'docs/releases/records/latest/features.json', 'docs/releases/records/0.14.0/deeper/features.json']) assert.equal(classifyChanges([row(path)]), 'full');
});
