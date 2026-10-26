import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCEPTANCE_STAGES, acceptanceMarkdown } from './release-acceptance.mjs';
import { reviewedArchive, REPOSITORY } from './release-source.mjs';

const json = file => JSON.parse(readFileSync(file, 'utf8'));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const below = (root, target) => { const rel = relative(realpathSync(root), realpathSync(target)); return rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\'); };

export function exportRecords(root, state) {
  assert.equal(state.status, 'passed'); assert.equal(state.uploadAccepted, true);
  assert.deepEqual(state.checks.map(row => row.id), ACCEPTANCE_STAGES);
  assert.ok(state.checks.every(row => row.status === 'passed'));
  const archive = reviewedArchive(root), version = archive.pack.version;
  assert.equal(state.version, version); assert.equal(state.sha256, archive.sha256);
  const bundle = join(root, 'records'), recordDirectory = 'receipts', output = join(bundle, recordDirectory); mkdirSync(bundle); mkdirSync(output, { recursive: true });
  const files = [], receipts = {};
  const copy = (suffix, source) => {
    assert.ok(lstatSync(source).isFile()); const name = suffix;
    copyFileSync(source, join(output, name), constants.COPYFILE_EXCL);
    const row = { path: name, sha256: digest(source) }; receipts[suffix] = row;
    files.push({ path: `${recordDirectory}/${name}`, sha256: row.sha256 });
  };
  for (const stage of state.checks) copy(stage.id + '.json', join(root, stage.receipt));
  for (const name of ['source-ci', 'preview', 'publication', 'publication-intent', 'registry-metadata', 'attestations', 'published']) copy(name + '.json', join(root, name + '.json'));
  if (existsSync(join(root, 'prior-attempt.json'))) copy('prior-attempt.json', join(root, 'prior-attempt.json'));
  copy('signatures.txt', join(root, 'logs/signatures.stdout.log'));
  const observations = readdirSync(root).filter(name => /^registry-(read|install-attempt)-\d+\.json$/.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(name => ({ name, observation: json(join(root, name)) }));
  save(join(root, 'registry-observations.json'), { version, observations }); copy('registry-observations.json', join(root, 'registry-observations.json'));
  for (const name of readdirSync(root).filter(name => /^registry-install-attempt-\d+\.log$/.test(name))) copy(name.replace(/\.log$/, '.txt'), join(root, name));
  const published = json(join(root, 'published.json')), ci = json(join(root, 'source-ci.json'));
  assert.equal(published.version, version); assert.equal(published.latest, version); assert.equal(ci.sourceCommit, state.sourceCommit);
  const verification = { schemaVersion: 3, kind: 'skillfit.release-verification', version, latest: published.latest, publishedAt: published.publishedAt,
    verifiedAt: state.finishedAt, sourceCommit: state.sourceCommit, sourceCi: ci.url,
    publicationRun: `https://github.com/${REPOSITORY}/actions/runs/${state.runId}/attempts/${state.runAttempt}`,
    artifact: { filename: archive.pack.filename, sha256: archive.sha256, integrity: archive.pack.integrity, packageBytes: archive.pack.size,
      unpackedBytes: archive.pack.unpackedSize, installedFilesVerified: archive.pack.files.length },
    checks: state.checks.map(({ id, status }) => ({ id, status })), receipts,
    uploadCount: 1, modelCalls: 0, agentCliCalls: 0, realUserConfigurationWrites: 0, automaticUpgrade: false,
    scope: 'Package availability, installed behavior, documentation and reproducibility; no new Skill efficacy evidence.' };
  const file = join(output, 'verification.json'); save(file, verification);
  files.push({ path: `${recordDirectory}/verification.json`, sha256: digest(file) });
  const markdown = acceptanceMarkdown(state) + `\n[Complete receipt](receipts/verification.json). Published: ${published.publishedAt}.\n`;
  save(join(bundle, 'manifest.json'), { schemaVersion: 3, version, sourceCommit: state.sourceCommit, files, summary: markdown });
  return { bundle, files: files.length };
}

/** Standalone delivery verification; never imports or writes repository content. */
export function verifyRecords(bundle) {
  bundle = realpathSync(bundle);
  const manifest = json(join(bundle, 'manifest.json'));
  assert.equal(manifest.schemaVersion, 3, 'Only standalone receipt bundles are supported');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/); assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.ok(Array.isArray(manifest.files) && manifest.files.length && typeof manifest.summary === 'string');
  const seen = new Set();
  for (const row of manifest.files) {
    assert.ok(/^receipts\/[a-z0-9][a-z0-9-]*\.(json|txt)$/.test(row.path) && !seen.has(row.path), 'Unsupported or duplicate receipt path');
    seen.add(row.path); assert.match(row.sha256, /^[a-f0-9]{64}$/);
    const file = join(bundle, row.path);
    assert.ok(lstatSync(file).isFile() && below(bundle, file), 'Receipt must be an ordinary bundle member');
    assert.equal(digest(file), row.sha256, `Receipt digest mismatch: ${row.path}`);
    if (row.path.endsWith('.json')) json(file);
  }
  assert.ok(seen.has('receipts/verification.json'), 'Complete verification receipt is required');
  const proof = json(join(bundle, 'receipts/verification.json'));
  assert.equal(proof.version, manifest.version); assert.equal(proof.sourceCommit, manifest.sourceCommit);
  // Verification v2 describes the retired eight-stage protocol; v3 removes
  // repository history checks. Never infer a protocol from a partial check list.
  assert.ok([2, 3].includes(proof.schemaVersion), 'Unsupported release verification protocol');
  const stages = proof.schemaVersion === 2
    ? ['registry-install', 'documents', 'examples', 'features', 'archives', 'history', 'provenance', 'signatures']
    : ACCEPTANCE_STAGES;
  assert.deepEqual(proof.checks.map(row => row.id), stages);
  assert.ok(proof.checks.every(row => row.status === 'passed'));
  for (const row of Object.values(proof.receipts)) {
    assert.equal(row.path, basename(row.path));
    assert.ok(seen.has('receipts/' + row.path), 'Every proof reference must be in the manifest');
    assert.equal(digest(join(bundle, 'receipts', row.path)), row.sha256, 'Proof digest mismatch');
  }
  return { status: 'verified', version: manifest.version, receipts: manifest.files.length, writes: 0, publishes: 0 };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [bundle, ...args] = process.argv.slice(2);
  assert.ok(bundle, 'Provide records bundle');
  assert.equal(args.length, 0, 'Provide only a standalone records bundle');
  console.log(JSON.stringify(verifyRecords(resolve(bundle))));
}
