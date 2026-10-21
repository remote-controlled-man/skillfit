import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCiEvidence, validatePreview, reviewedArchive, recordPreview, promotePreview, claimPublication, collectSourceCi, SYSTEMS, REPOSITORY } from './release-source.mjs';

const source = 'a'.repeat(40);
const run = (workflow, event = 'push') => ({ repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY }, path: `.github/workflows/${workflow}`, head_branch: 'main', head_sha: source, status: 'completed', conclusion: 'success', id: 123, run_attempt: 1, event });
const jobs = () => SYSTEMS.map(os => ({ name: `test (${os})`, status: 'completed', conclusion: 'success' }));
const receipts = () => SYSTEMS.map(os => ({ schemaVersion: 1, kind: 'skillfit.ci-result', repository: REPOSITORY, sourceCommit: source, runId: '123', runAttempt: '1', os, scope: 'full', status: 'passed', counts: { tests: 10, pass: os === 'windows-latest' ? 9 : 10, skipped: os === 'windows-latest' ? 1 : 0, fail: 0, cancelled: 0 } }));
test('release requires exact main source and actual full successful counts for all three systems', () => {
  assert.equal(validateCiEvidence(run('ci.yml'), jobs(), receipts(), source).systems.length, 3);
  for (const changed of [{ head_sha: 'b'.repeat(40) }, { status: 'in_progress' }, { conclusion: 'failure' }, { event: 'pull_request' }, { head_branch: 'other' }, { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fork/skillfit' } }]) assert.throws(() => validateCiEvidence({ ...run('ci.yml'), ...changed }, jobs(), receipts(), source));
  for (const change of [{ scope: 'records' }, { runAttempt: '2' }, { status: 'failed' }, { counts: null }, { counts: { tests: 10, pass: 10, fail: 1, cancelled: 0, skipped: 0 } }]) {
    const rows = receipts(); Object.assign(rows[0], change); assert.throws(() => validateCiEvidence(run('ci.yml'), jobs(), rows, source));
  }
  assert.throws(() => validateCiEvidence(run('ci.yml'), jobs().slice(1), receipts(), source));
  const rows = receipts(); rows[1] = rows[0]; assert.throws(() => validateCiEvidence(run('ci.yml'), jobs(), rows, source));
});
test('promotion binds the approved preview attempt, bytes, version, source and CI without repacking', () => {
  const bytes = Buffer.from('reviewed');
  const archive = { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), pack: { name: 'skillfit', version: '0.14.0', size: bytes.length, integrity: 'sha512-reviewed' } };
  const ci = { runId: '123', runAttempt: '1', sourceCommit: source };
  const preview = { schemaVersion: 2, dryRun: true, runId: '123', runAttempt: '1', sourceCommit: source, name: 'skillfit', version: '0.14.0', integrity: archive.pack.integrity, sha256: archive.sha256, size: bytes.length, ci };
  assert.equal(validatePreview(run('npm-release.yml', 'workflow_dispatch'), preview, archive, source, '0.14.0', ci), preview);
  for (const change of [{ dryRun: false }, { runAttempt: '2' }, { sourceCommit: 'b'.repeat(40) }, { version: '0.13.0' }, { sha256: 'changed' }, { size: 1 }, { ci: { ...ci, runId: 'other' } }]) assert.throws(() => validatePreview(run('npm-release.yml', 'workflow_dispatch'), { ...preview, ...change }, archive, source, '0.14.0', ci));
  assert.throws(() => validatePreview({ ...run('npm-release.yml', 'workflow_dispatch'), conclusion: 'failure' }, preview, archive, source, '0.14.0', ci));
});

test('artifact promotion preserves exact reviewed bytes, rejects missing/tampered artifacts and blocks second upload intent', t => {
  const parent = mkdtempSync(join(tmpdir(), 'skillfit-preview-promotion-')); t.after(() => rmSync(parent, { recursive: true, force: true }));
  const prepared = join(parent, 'preview'); mkdirSync(prepared);
  const bytes = Buffer.from('reviewed fixture archive');
  const pack = { name: 'skillfit', version: '0.14.0', size: bytes.length, filename: 'skillfit-0.14.0.tgz', integrity: 'sha512-'+createHash('sha512').update(bytes).digest('base64') };
  const ci = { runId: '123', runAttempt: '1', sourceCommit: source };
  writeFileSync(join(prepared, 'pack.json'), JSON.stringify([pack])); writeFileSync(join(prepared, pack.filename), bytes); writeFileSync(join(prepared, 'source-ci.json'), JSON.stringify(ci));
  recordPreview(prepared, { GITHUB_SHA: source, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' });
  let downloads = 0;
  const command = args => {
    if (args[0] === 'api') return JSON.stringify(run('npm-release.yml', 'workflow_dispatch'));
    assert.deepEqual(args.slice(0, 2), ['run', 'download']); downloads++;
    for (const name of ['pack.json', pack.filename, 'preview.json']) copyFileSync(join(prepared, name), join(args.at(-1), name));
    return '';
  };
  const promoted = join(parent, 'publication'); mkdirSync(promoted); writeFileSync(join(promoted, 'source-ci.json'), JSON.stringify(ci));
  promotePreview(promoted, '123', source, '0.14.0', command); assert.equal(downloads, 1);
  assert.deepEqual(readFileSync(join(promoted, pack.filename)), bytes);
  const env = { GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: source, GITHUB_RUN_ID: '999' };
  assert.equal(claimPublication(promoted, env, () => '{"total_count":0}').uploadCountLimit, 1);
  assert.throws(() => claimPublication(promoted, { ...env, GITHUB_RUN_ATTEMPT: '2' }, () => { throw Error('must not query'); }), /reruns are forbidden/);
  assert.throws(() => claimPublication(promoted, env, () => '{"total_count":1}'), /already has a publication intent/);
  writeFileSync(join(prepared, pack.filename), 'tampered'); assert.throws(() => reviewedArchive(prepared));
  const missing = join(parent, 'missing'); mkdirSync(missing); writeFileSync(join(missing, 'pack.json'), JSON.stringify([pack])); assert.throws(() => reviewedArchive(missing));
});
test('unfinished source CI fails before artifact downloads or any preparation/publication', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-ci-gate-')); t.after(() => rmSync(root, { recursive: true, force: true })); let requests = 0;
  assert.throws(() => collectSourceCi(join(root, 'attempt'), source, args => { requests++; assert.equal(args[0], 'api'); return JSON.stringify({ workflow_runs: [{ ...run('ci.yml'), status: 'in_progress' }] }); }), /not complete/);
  assert.equal(requests, 1);
});
