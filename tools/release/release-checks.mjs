import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleaseDocuments } from '../verify/recipes/release-docs-smoke.mjs';
import { reviewedArchive, REPOSITORY } from './release-source.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const registry = 'https://registry.npmjs.org';
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function inspectDriver(text) {
  const frontmatter = /^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/.exec(text);
  assert.ok(frontmatter, 'Bundled driver frontmatter is required');
  const fields = new Map();
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const entry = /^([a-z-]+): (.+)$/.exec(line);
    assert.ok(entry && ['name', 'description'].includes(entry[1]) && !fields.has(entry[1]), 'Review unsupported or duplicate bundled driver fields');
    fields.set(entry[1], entry[2]);
  }
  assert.equal(fields.get('name'), 'skillfit');
  assert.ok(fields.get('description')?.trim() && fields.get('description').length <= 1024 && !/[<>]/.test(fields.get('description')));
  return { kind: 'bundled-driver-frontmatter', name: 'skillfit', descriptionValid: true };
}

export function inspectProvenance(metadata, attestations, expected) {
  assert.equal(metadata.version, expected.version); assert.equal(metadata.dist.integrity, expected.integrity);
  const sha512 = Buffer.from(expected.integrity.slice('sha512-'.length), 'base64').toString('hex');
  let proof;
  for (const item of attestations.attestations) {
    const envelope = item.bundle.dsseEnvelope ?? item.bundle.content?.dsseEnvelope;
    const payload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString());
    assert.ok(payload.subject.some(subject => subject.name === `pkg:npm/skillfit@${expected.version}` && subject.digest.sha512 === sha512));
    if (payload.predicateType === 'https://slsa.dev/provenance/v1') proof = payload.predicate;
  }
  assert.ok(proof, 'SLSA source proof required');
  assert.deepEqual(proof.buildDefinition.externalParameters.workflow, { ref: 'refs/heads/main', repository: `https://github.com/${REPOSITORY}`, path: '.github/workflows/npm-release.yml' });
  assert.ok(proof.buildDefinition.resolvedDependencies.some(item => item.digest.gitCommit === expected.sourceCommit));
  const invocationId = `https://github.com/${REPOSITORY}/actions/runs/${expected.runId}/attempts/${expected.runAttempt}`;
  assert.equal(proof.runDetails.metadata.invocationId, invocationId);
  return { sourceCommit: expected.sourceCommit, invocationId, subjectSha512: sha512 };
}

export async function recoverUpload(root, fetchImpl = fetch) {
  const archive = reviewedArchive(root), intent = json(join(root, 'publication-intent.json'));
  assert.equal(intent.sha256, archive.sha256); assert.equal(intent.version, archive.pack.version);
  const read = async (url, name) => {
    assert.equal(new URL(url).origin, registry);
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }); assert.equal(response.status, 200, 'Upload acceptance remains unknown; do not republish');
    const value = await response.json(); save(join(root, name + '.json'), value); return value;
  };
  const metadata = await read(`${registry}/skillfit/${archive.pack.version}`, 'registry-metadata');
  const attestations = await read(metadata.dist.attestations.url, 'attestations');
  inspectProvenance(metadata, attestations, { ...intent, integrity: archive.pack.integrity });
  const result = { ...intent, uploadAccepted: true, uploadCount: 1, recoveredFromIntent: true, verificationOnly: true };
  save(join(root, 'publication.json'), result); return result;
}

export function acceptanceChecks(root, publication) {
  const archive = reviewedArchive(root), work = join(root, 'acceptance'), logs = join(root, 'logs');
  mkdirSync(work); mkdirSync(logs);
  let installed, prefix, archiveWorkspace;
  const run = (command, args, label, cwd = work, env = {}) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 25 * 60_000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, npm_config_update_notifier: 'false', ...env } });
    writeFileSync(join(logs, label + '.stdout.log'), result.stdout ?? '', { flag: 'wx' });
    writeFileSync(join(logs, label + '.stderr.log'), result.stderr ?? '', { flag: 'wx' });
    assert.equal(result.status, 0, `${label} failed; see logs/${label}.stderr.log`); return result.stdout;
  };
  const node = (args, label, cwd, env) => run(process.execPath, args, label, cwd, env);
  const cli = (args, label) => node([join(installed, 'dist/cli.js'), ...args], label);
  const fetchJson = async (url, name) => {
    assert.equal(new URL(url).origin, registry);
    if (existsSync(join(root, name + '.json'))) return json(join(root, name + '.json'));
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' } });
    assert.equal(response.status, 200, `Required registry proof unavailable: ${name}`);
    const result = await response.json(); save(join(root, name + '.json'), result); return result;
  };
  return [
    { id: 'registry-install', run: () => {
      // Compare the registry install with the original reviewed bytes, not a local rebuild.
      const comparison = mkdtempSync(join(work, 'comparison-'));
      const names = run('tar', ['-tzf', join(root, archive.pack.filename)], 'archive-list').trim().split(/\r?\n/);
      assert.deepEqual(names.sort(), archive.pack.files.map(file => 'package/' + file.path).sort());
      assert.ok(names.every(file => file.startsWith('package/') && !file.includes('\\') && !file.split('/').includes('..')));
      const details = run('tar', ['-tvzf', join(root, archive.pack.filename)], 'archive-types').trim().split(/\r?\n/);
      assert.ok(details.every(line => line.startsWith('-')), 'Reviewed archive must contain ordinary files only');
      run('tar', ['-xzf', join(root, archive.pack.filename), '-C', comparison], 'archive-extract');
      node([join(ROOT, 'tools/release/npm-release.mjs'), 'verify', join(root, 'pack.json')], 'registry-install', ROOT,
        { GITHUB_SHA: publication.sourceCommit, SKILLFIT_RELEASE_COMPARE_ROOT: join(comparison, 'package') });
      const receipt = json(join(root, 'verified-registry-install.json'));
      assert.equal(receipt.sourceCommit, publication.sourceCommit); assert.equal(receipt.integrity, archive.pack.integrity);
      installed = receipt.installedPackage; prefix = receipt.installPrefix;
      assert.ok(installed && prefix && lstatSync(join(installed, 'package.json')).isFile(), 'Use the actual successful installation receipt');
      return receipt;
    } },
    { id: 'documents', run: () => ({ ...validateReleaseDocuments(installed), driver: inspectDriver(readFileSync(join(installed, 'skills/skillfit/SKILL.md'), 'utf8')) }) },
    { id: 'examples', run: () => {
      const dir = join(work, 'examples'); mkdirSync(dir);
      assert.equal(run(join(prefix, 'node_modules/.bin/skillfit'), ['--version'], 'npm-bin', dir).trim(), archive.pack.version);
      cli(['bench', 'init', join(dir, 'my-bench'), '--kind', 'command', '--dry-run'], 'bench-preview'); assert.ok(!existsSync(join(dir, 'my-bench')));
      cli(['bench', 'init', join(dir, 'my-bench'), '--kind', 'command', '--yes'], 'bench-create');
      cli(['bench', 'check', join(dir, 'my-bench'), '--json'], 'bench-check');
      const skill = join(dir, 'my-skill'); mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '---\nname: fixture-skill\ndescription: Offline preview fixture.\n---\nInspect the provided task.\n', { flag: 'wx' });
      cli(['eval', skill, '--bench', join(dir, 'my-bench'), '--mode', 'installed', '--agent', 'codex', '--trials', '1', '--max-calls', '2', '--runs-root', join(dir, 'runs'), '--run-group', 'first-eval', '--json', '--dry-run'], 'eval-preview');
      assert.ok(!existsSync(join(dir, 'runs')));
      return { version: archive.pack.version, npmBinExecutable: true, teachingBench: true, evalPreviewWrites: 0, modelCalls: 0, agentCliCalls: 0 };
    } },
    { id: 'features', run: () => {
      node([join(installed, 'tools/verify/recipes/release-feature-smoke.mjs'), installed, join(work, 'features')], 'features');
      return { ...json(join(work, 'features/feature-smoke.json')), foundations: json(join(work, 'features/foundations/feature-smoke.json')) };
    } },
    { id: 'archives', run: () => {
      const catalog = json(join(installed, 'evidence/archive-catalog.v1.json')); archiveWorkspace = join(work, 'online');
      const restore = join(installed, 'evidence/fetch-archives.mjs');
      const listed = node([restore, '--list'], 'archive-catalog'); assert.equal(listed.trim().split(/\r?\n/).length, catalog.archives.length);
      node([restore, '--all', '--output', archiveWorkspace], 'archive-preview'); assert.ok(!existsSync(archiveWorkspace));
      node([restore, '--all', '--output', archiveWorkspace, '--yes'], 'archive-online');
      for (const row of [...catalog.archives, ...catalog.supportFiles]) {
        const bytes = readFileSync(join(archiveWorkspace, row.path)); assert.equal(bytes.length, row.bytes); assert.equal(digest(bytes), row.sha256, row.path);
      }
      node([join(installed, 'tools/verify/recipes/archive-delivery-smoke.mjs'), installed, archiveWorkspace, join(work, 'offline')], 'archive-offline');
      const offline = json(join(work, 'offline/archive-delivery-smoke.json')); assert.equal(offline.networkAttempts, 0); assert.equal(offline.collisionPreserved, true);
      return { archivesRestored: catalog.archives.length, supportFilesRestored: catalog.supportFiles.length,
        archiveSource: catalog.source, archiveBytes: catalog.archives.reduce((n, row) => n + row.bytes, 0),
        archives: catalog.archives.map(row => ({ ...row, verified: true })), previewWrites: 0, defaultFixedHttps: true, offline };
    } },
    { id: 'history', run: () => {
      node([join(installed, 'tools/verify/recipes/release-historical-smoke.mjs'), installed, archiveWorkspace, join(logs, 'history')], 'history');
      const receipt = json(join(logs, 'history/historical-smoke.json'));
      assert.equal(receipt.results.length, json(join(installed, 'evidence/archive-catalog.v1.json')).archives.length);
      assert.ok(receipt.results.every(row => row.verified)); return receipt;
    } },
    { id: 'provenance', run: async () => {
      const metadata = await fetchJson(`${registry}/skillfit/${archive.pack.version}`, 'registry-metadata');
      const all = await fetchJson(`${registry}/skillfit`, 'registry-package');
      assert.equal(all['dist-tags'].latest, archive.pack.version); assert.equal(typeof all.time[archive.pack.version], 'string');
      save(join(root, 'published.json'), { version: archive.pack.version, publishedAt: all.time[archive.pack.version], latest: all['dist-tags'].latest });
      const attestations = await fetchJson(metadata.dist.attestations.url, 'attestations');
      return inspectProvenance(metadata, attestations, { ...publication, integrity: archive.pack.integrity });
    } },
    { id: 'signatures', run: () => {
      const output = run('npm', ['audit', 'signatures', '--omit=dev', '--registry', registry, '--cache', join(work, 'signature-cache')], 'signatures', prefix);
      assert.match(output, /1 package has a verified registry signature/); assert.match(output, /1 package has a verified attestation/);
      return { packages: 1, verifiedRegistrySignatures: 1, verifiedAttestations: 1, exitCode: 0 };
    } },
  ];
}
