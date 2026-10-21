import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACCEPTANCE_STAGES, runAcceptance, summarize, prepareRecovery } from './release-acceptance.mjs';
import { inspectDriver, inspectProvenance, recoverUpload } from './release-checks.mjs';
import { exportRecords, importRecords } from './release-records.mjs';
import { historicalRecipe } from '../docs/releases/release-historical-smoke.mjs';

const fresh = t => { const root = mkdtempSync(join(tmpdir(), 'skillfit-acceptance-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; };
const sourceCommit = 'a'.repeat(40);
const info = { version: '0.14.0', sourceCommit, uploadAccepted: true, runId: '123', runAttempt: '1' };
const stages = calls => ACCEPTANCE_STAGES.map(id => ({ id, run: () => { calls.push(id); return { verified: true }; } }));

test('all eight acceptance checks execute once, checkpoint state and cannot overwrite a previous attempt', async t => {
  const root = fresh(t), calls = []; const result = await runAcceptance(root, info, stages(calls));
  assert.deepEqual(calls, ACCEPTANCE_STAGES); assert.equal(result.status, 'passed');
  assert.equal(result.events.length, 16); assert.ok(result.checks.every(row => row.status === 'passed'));
  assert.equal(JSON.parse(readFileSync(join(root, 'acceptance-state.json'))).status, 'passed');
  await assert.rejects(runAcceptance(root, info, stages(calls)), /Preserve previous/); assert.equal(calls.length, 8);
});
test('failed acceptance retains failed state/log context and never executes dependent checks or emits success', async t => {
  const root = fresh(t), calls = [], checks = stages(calls); checks[1].run = () => { calls.push('documents'); throw Error('fixture document failure'); };
  await assert.rejects(runAcceptance(root, info, checks), /fixture document failure/);
  const state = JSON.parse(readFileSync(join(root, 'acceptance-state.json')));
  assert.equal(state.status, 'failed'); assert.deepEqual(calls, ACCEPTANCE_STAGES.slice(0, 2));
  assert.equal(state.checks[0].status, 'passed'); assert.equal(state.checks[1].status, 'failed'); assert.equal(state.checks[2].status, 'pending');
  assert.equal(existsSync(join(root, 'acceptance-features.json')), false); assert.ok(readFileSync(join(root, 'acceptance-summary.md'), 'utf8').includes('| documents | failed |'));
  assert.throws(() => exportRecords(root, state));
});
test('preparation failure still produces a truthful workflow summary, without inventing accepted upload or tests', t => {
  const root = fresh(t), state = summarize(root, 'failure', false, join(root, 'github-summary.md'));
  assert.equal(state.status, 'preparation-or-upload-failed'); assert.equal(state.uploadAccepted, false); assert.ok(state.checks.every(row => row.status === 'pending'));
});
test('each acceptance failure stops its dependents; interrupted/delivery failures remain visible in summary', async t => {
  for (const [i, id] of ACCEPTANCE_STAGES.entries()) {
    const root = fresh(t), calls = [], checks = stages(calls); checks[i].run = () => { calls.push(id); throw Error(`fixture ${id}`); };
    await assert.rejects(runAcceptance(root, info, checks)); assert.deepEqual(calls, ACCEPTANCE_STAGES.slice(0, i + 1));
    const state = JSON.parse(readFileSync(join(root, 'acceptance-state.json'))); assert.equal(state.status, 'failed');
    assert.ok(state.checks.slice(i + 1).every(row => row.status === 'pending'));
    assert.equal(summarize(root, 'failure', false, join(root, 'summary.md')).status, 'failed');
  }
  for (const [original, expected] of [['running', 'interrupted'], ['passed', 'verification-passed-delivery-failed']]) {
    const root = fresh(t); writeFileSync(join(root, 'acceptance-state.json'), JSON.stringify({ ...info, status: original, checks: [] }));
    assert.equal(summarize(root, 'failure', false, join(root, 'summary.md')).status, expected);
  }
  const broken = fresh(t); writeFileSync(join(broken, 'pack.json'), '{');
  assert.equal(summarize(broken, 'failure', false, join(broken, 'summary.md')).status, 'preparation-or-upload-failed');
});
test('driver and source proof validation reject malformed fields and different source or run', () => {
  assert.equal(inspectDriver('---\nname: skillfit\ndescription: Measure configuration.\n---\nBody').name, 'skillfit');
  for (const text of ['No frontmatter', '---\nname: other\ndescription: x\n---', '---\nname: skillfit\ndescription: x\ndescription: y\n---']) assert.throws(() => inspectDriver(text));
  const integrity = 'sha512-' + Buffer.from('proof').toString('base64'), hex = Buffer.from('proof').toString('hex');
  const predicate = { buildDefinition: { externalParameters: { workflow: { ref: 'refs/heads/main', repository: 'https://github.com/remote-controlled-man/skillfit', path: '.github/workflows/npm-release.yml' } }, resolvedDependencies: [{ digest: { gitCommit: sourceCommit } }] }, runDetails: { metadata: { invocationId: 'https://github.com/remote-controlled-man/skillfit/actions/runs/123/attempts/1' } } };
  const payload = { subject: [{ name: 'pkg:npm/skillfit@0.14.0', digest: { sha512: hex } }], predicateType: 'https://slsa.dev/provenance/v1', predicate };
  const attestations = { attestations: [{ bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(payload)).toString('base64') } } }] };
  const metadata = { version: '0.14.0', dist: { integrity } };
  assert.equal(inspectProvenance(metadata, attestations, { ...info, integrity }).sourceCommit, sourceCommit);
  assert.throws(() => inspectProvenance(metadata, attestations, { ...info, integrity, sourceCommit: 'b'.repeat(40) }));
  assert.throws(() => inspectProvenance(metadata, attestations, { ...info, integrity, runId: '456' }));
});
test('unknown historical recipes fail closed instead of silently excluding an archive', () => {
  assert.throws(() => historicalRecipe({ path: 'evidence/artifacts/unknown/new.tar.gz', id: 'unknown-new' }), /Unknown historical recipe/);
  assert.throws(() => historicalRecipe({ path: 'evidence/artifacts/2026-10-12-diagnosing-revision/other-records.tar.gz', id: '2026-10-12-diagnosing-revision-other-records' }), /Unknown historical phase/);
  assert.throws(() => historicalRecipe({ path: 'evidence/artifacts/2026-10-12-normalize-url-v2-available/other.tar.gz', id: '2026-10-12-normalize-url-v2-available-other' }), /Unknown historical export/);
  const catalog = JSON.parse(readFileSync(new URL('../evidence/archive-catalog.v1.json', import.meta.url)));
  assert.equal(catalog.archives.map(historicalRecipe).length, 19);
});
test('real retained 0.13.1 provenance is compatible without another network request', () => {
  const folder = new URL('../docs/releases/', import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL('0.13.1-registry-metadata.json', folder))), attestations = JSON.parse(readFileSync(new URL('0.13.1-attestations.json', folder)));
  const receipt = JSON.parse(readFileSync(new URL('0.13.1-verification.json', folder)));
  assert.equal(inspectProvenance(metadata, attestations, { version: receipt.version, integrity: receipt.integrity, sourceCommit: receipt.sourceCommit, runId: '39571125220', runAttempt: '1' }).sourceCommit, receipt.sourceCommit);
});
test('read-only recovery copies original inputs and failure observations to a fresh attempt; unknown acceptance cannot become success', async t => {
  const root = fresh(t), original = join(root, 'original'), attempt = join(root, 'attempt'); mkdirSync(original);
  const bytes = Buffer.from('original reviewed bytes'), hash = createHash('sha256').update(bytes).digest('hex');
  const pack = { name: 'skillfit', version: info.version, filename: 'skillfit-0.14.0.tgz', size: bytes.length, integrity: 'sha512-'+createHash('sha512').update(bytes).digest('base64') };
  writeFileSync(join(original, 'pack.json'), JSON.stringify([pack])); writeFileSync(join(original, pack.filename), bytes);
  for (const [name, value] of Object.entries({ preview: { sourceCommit }, 'source-ci': { sourceCommit }, 'publication-intent': { ...info, sha256: hash, uploadAccepted: undefined }, 'acceptance-state': { ...info, status: 'failed', originalError: 'retained' } })) writeFileSync(join(original, name+'.json'), JSON.stringify(value));
  writeFileSync(join(original, 'registry-read-1.json'), '{"versionStatus":404}');
  prepareRecovery(original, attempt); assert.deepEqual(readFileSync(join(attempt, pack.filename)), bytes);
  assert.equal(JSON.parse(readFileSync(join(attempt, 'prior-attempt.json'))).state.originalError, 'retained');
  assert.equal(existsSync(join(attempt, 'acceptance-state.json')), false);
  await assert.rejects(recoverUpload(attempt, async () => ({ status: 404 })), /acceptance remains unknown/);
  assert.equal(existsSync(join(attempt, 'publication.json')), false);
  assert.equal(JSON.parse(readFileSync(join(original, 'acceptance-state.json'))).status, 'failed');
  assert.throws(() => prepareRecovery(original, join(original, 'inside')), /outside the original/);
  assert.throws(() => prepareRecovery(original, attempt));
});
test('generated receipt bundle verifies hashes, previews without writes, imports once and appends bounded status', async t => {
  const root = fresh(t), bytes = Buffer.from('fixture archive'), hash = createHash('sha256').update(bytes).digest('hex');
  const pack = { name: 'skillfit', version: info.version, filename: 'skillfit-0.14.0.tgz', size: bytes.length, unpackedSize: 100, files: [{ path: 'package.json' }], integrity: 'sha512-'+createHash('sha512').update(bytes).digest('base64') };
  writeFileSync(join(root, pack.filename), bytes); writeFileSync(join(root, 'pack.json'), JSON.stringify([pack]));
  const state = await runAcceptance(root, { ...info, sha256: hash }, stages([]));
  for (const name of ['source-ci', 'preview', 'publication', 'publication-intent', 'registry-metadata', 'attestations']) writeFileSync(join(root, name+'.json'), JSON.stringify({ sourceCommit, url: 'https://example.test/source-ci' }));
  writeFileSync(join(root, 'published.json'), JSON.stringify({ version: info.version, latest: info.version, publishedAt: '2026-10-21T10:00:00Z' }));
  mkdirSync(join(root, 'logs')); writeFileSync(join(root, 'logs/signatures.stdout.log'), 'fixture signatures');
  const exported = exportRecords(root, state), repo = join(root, 'repo'); mkdirSync(join(repo, 'docs/releases'), { recursive: true }); mkdirSync(join(repo, 'docs/plans'));
  writeFileSync(join(repo, 'docs/releases/0.14.0.md'), '# Prepared release\n'); writeFileSync(join(repo, 'docs/plans/release.md'), '# Human plan\n');
  assert.equal(importRecords(exported.bundle, repo, { plan: 'docs/plans/release.md' }).status, 'planned');
  assert.equal(existsSync(join(repo, 'docs/releases/0.14.0-verification.json')), false);
  assert.equal(importRecords(exported.bundle, repo, { yes: true, plan: 'docs/plans/release.md' }).status, 'imported');
  assert.ok(readFileSync(join(repo, 'docs/plans/release.md'), 'utf8').startsWith('<!-- skillfit-release:0.14.0:start -->'));
  assert.match(readFileSync(join(repo, 'docs/plans/release.md'), 'utf8'), /# Human plan/);
  assert.match(readFileSync(join(repo, 'docs/plans/release.md'), 'utf8'), /\.\.\/releases\/0\.14\.0-verification\.json/);
  assert.throws(() => importRecords(exported.bundle, repo, { yes: true }), /Preserve existing receipt/);
  const second = join(root, 'second'); mkdirSync(join(second, 'docs/releases'), { recursive: true });
  writeFileSync(join(exported.bundle, 'docs/releases/0.14.0-documents.json'), '{"tampered":true}');
  assert.throws(() => importRecords(exported.bundle, second, { yes: true }), /digest mismatch/);
  assert.equal(existsSync(join(second, 'docs/releases/0.14.0-verification.json')), false);
});
