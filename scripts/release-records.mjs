import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
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
  const bundle = join(root, 'records'), recordDirectory = `docs/releases/records/${version}`, output = join(bundle, recordDirectory); mkdirSync(bundle); mkdirSync(output, { recursive: true });
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
  const verification = { schemaVersion: 2, kind: 'skillfit.release-verification', version, latest: published.latest, publishedAt: published.publishedAt,
    verifiedAt: state.finishedAt, sourceCommit: state.sourceCommit, sourceCi: ci.url,
    publicationRun: `https://github.com/${REPOSITORY}/actions/runs/${state.runId}/attempts/${state.runAttempt}`,
    artifact: { filename: archive.pack.filename, sha256: archive.sha256, integrity: archive.pack.integrity, packageBytes: archive.pack.size,
      unpackedBytes: archive.pack.unpackedSize, installedFilesVerified: archive.pack.files.length },
    checks: state.checks.map(({ id, status }) => ({ id, status })), receipts,
    uploadCount: 1, modelCalls: 0, agentCliCalls: 0, realUserConfigurationWrites: 0, automaticUpgrade: false,
    scope: 'Package availability, installed behavior, documentation and reproducibility; no new Skill efficacy evidence.' };
  const file = join(output, 'verification.json'); save(file, verification);
  files.push({ path: `${recordDirectory}/verification.json`, sha256: digest(file) });
  const markdown = acceptanceMarkdown(state) + `\n[Complete receipt](records/${version}/verification.json). Published: ${published.publishedAt}.\n`;
  // Plan links are relative to docs/plans rather than docs/releases.
  const planMarkdown = markdown.replace(`](records/${version}/verification.json)`, `](../releases/records/${version}/verification.json)`);
  save(join(bundle, 'manifest.json'), { schemaVersion: 2, version, sourceCommit: state.sourceCommit, files, releaseMarkdown: markdown, planMarkdown });
  return { bundle, files: files.length };
}

export function importRecords(bundle, repo, { yes = false, plan } = {}) {
  const manifest = json(join(bundle, 'manifest.json')); assert.ok([1, 2].includes(manifest.schemaVersion), 'Unsupported records manifest'); assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/); assert.ok(manifest.files.length > 0);
  repo = realpathSync(repo); bundle = realpathSync(bundle);
  for (const dir of ['docs', 'docs/releases', ...(plan ? ['docs/plans'] : [])]) assert.ok(lstatSync(join(repo, dir)).isDirectory() && !lstatSync(join(repo, dir)).isSymbolicLink(), 'Import directories must be ordinary directories');
  assert.ok(below(repo, join(repo, 'docs/releases')), 'Keep imported records inside the repository');
  const version = manifest.version, nested = manifest.schemaVersion === 2, recordDirectory = nested ? `docs/releases/records/${version}` : 'docs/releases';
  const prefix = `${recordDirectory}/${nested ? '' : version + '-'}`, verificationPath = `${prefix}verification.json`, seen = new Set();
  for (const directory of nested ? ['docs/releases/records', recordDirectory] : []) {
    const target = join(repo, directory);
    if (existsSync(target)) assert.ok(lstatSync(target).isDirectory() && !lstatSync(target).isSymbolicLink() && below(repo, target), 'Import directories must be ordinary directories');
  }
  for (const file of manifest.files) {
    assert.ok(file.path.startsWith(prefix) && /^[a-z0-9][a-z0-9-]*\.(json|txt)$/.test(file.path.slice(prefix.length)) && !seen.has(file.path), 'Unsupported or duplicate record path');
    seen.add(file.path); const source = join(bundle, file.path);
    assert.ok(lstatSync(source).isFile() && below(bundle, source)); assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(digest(source), file.sha256, `Import digest mismatch: ${file.path}`);
    if (file.path.endsWith('.json')) json(source);
    assert.ok(!existsSync(join(repo, file.path)), `Preserve existing receipt: ${file.path}`);
  }
  const verification = json(join(bundle, verificationPath));
  assert.ok(seen.has(verificationPath), 'Complete receipt must be included in the manifest');
  assert.equal(verification.version, version); assert.equal(verification.sourceCommit, manifest.sourceCommit);
  assert.deepEqual(verification.checks.map(row => row.id), ACCEPTANCE_STAGES); assert.ok(verification.checks.every(row => row.status === 'passed'));
  for (const row of Object.values(verification.receipts)) {
    assert.ok(seen.has(`${recordDirectory}/${row.path}`), 'Every receipt reference must be included in the manifest');
    assert.equal(row.path, basename(row.path)); const file = join(bundle, recordDirectory, row.path);
    assert.ok(lstatSync(file).isFile() && below(bundle, file)); assert.equal(digest(file), row.sha256);
  }
  const marker = `<!-- skillfit-release:${version}:start -->`, documents = [{ path: `docs/releases/${version}.md`, body: manifest.releaseMarkdown }];
  if (plan) { assert.match(plan, /^docs\/plans\/[a-zA-Z0-9._-]+\.md$/); assert.ok(existsSync(join(repo, plan))); documents.push({ path: plan, body: manifest.planMarkdown }); }
  for (const doc of documents) {
    assert.equal(typeof doc.body, 'string'); assert.ok(below(repo, dirname(join(repo, doc.path))));
    if (existsSync(join(repo, doc.path))) {
      assert.ok(lstatSync(join(repo, doc.path)).isFile() && below(repo, join(repo, doc.path)));
      assert.ok(!readFileSync(join(repo, doc.path), 'utf8').includes(marker), 'Preserve existing release status');
    }
  }
  if (yes) {
    mkdirSync(join(repo, recordDirectory), { recursive: true });
    for (const file of manifest.files) copyFileSync(join(bundle, file.path), join(repo, file.path), constants.COPYFILE_EXCL);
    for (const doc of documents) {
      const file = join(repo, doc.path), block = `${marker}\n${doc.body}\n<!-- skillfit-release:${version}:end -->\n`;
      if (doc.path === plan) writeFileSync(file, block + '\n' + readFileSync(file, 'utf8'));
      else appendFileSync(file, '\n' + block);
    }
  }
  return { status: yes ? 'imported' : 'planned', version, receipts: manifest.files.length, documents: documents.map(doc => doc.path), publishes: 0 };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [bundle, repo, ...flags] = process.argv.slice(2); assert.ok(bundle && repo, 'Provide records bundle and repository');
  const options = {};
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--yes') { assert.ok(!options.yes, 'Duplicate --yes'); options.yes = true;
    } else if (flags[i] === '--plan') { assert.ok(!options.plan && flags[i + 1] && !flags[i + 1].startsWith('--'), 'Provide one --plan path'); options.plan = flags[++i];
    } else throw new Error('Use --yes and optional --plan <path>');
  }
  console.log(JSON.stringify(importRecords(resolve(bundle), resolve(repo), options)));
}
