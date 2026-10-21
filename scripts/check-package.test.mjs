import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ARCHIVE_CATALOG, PACKAGE_POLICY, inspectBuiltPackage, validatePackageContents } from './check-package.mjs';

const fixture = () => ({ size: 100, unpackedSize: 200, files:
  [...new Set([...PACKAGE_POLICY.requiredFiles, ...PACKAGE_POLICY.retainedTests, ...PACKAGE_POLICY.archives, ...ARCHIVE_CATALOG.supportFiles.filter(row => row.inlineBase64 === undefined).map(row => row.path)])].map(path => ({ path })) });

test('package policy retains installed workflows, six recipe tests and frozen archive support', () => {
  assert.ok(validatePackageContents(fixture()).files > 0);
  for (const path of [PACKAGE_POLICY.requiredFiles[0], PACKAGE_POLICY.retainedTests[0], ARCHIVE_CATALOG.supportFiles[0].path]) {
    const pack = fixture(); pack.files = pack.files.filter(file => file.path !== path);
    assert.throws(() => validatePackageContents(pack), /Required package file/);
  }
});

test('package policy rejects private paths, unknown archives and active development tests', () => {
  for (const path of ['workspace4skills/private.md', 'docs/runs/output.json', 'docs/auth.json',
    'docs/tmp.tgz', PACKAGE_POLICY.externalArchives[0], 'dist/cli.test.js', '../escape', 'docs/../escape']) {
    const pack = fixture(); pack.files.push({ path });
    assert.throws(() => validatePackageContents(pack), undefined, path);
  }
});

test('package policy rejects duplicate paths, growth beyond review and missing runtime modules', () => {
  const duplicate = fixture(); duplicate.files.push(duplicate.files[0]);
  assert.throws(() => validatePackageContents(duplicate), /unique/);
  for (const [field, limit] of [['size', PACKAGE_POLICY.maxArchiveBytes], ['unpackedSize', PACKAGE_POLICY.maxUnpackedBytes]]) {
    const pack = fixture(); pack[field] = limit + 1;
    assert.throws(() => validatePackageContents(pack), /reviewed limit/);
  }
  assert.throws(() => validatePackageContents(fixture(), ['dist/harness/new-runtime.js']), /Required package file/);
});

test('actual offline npm package matches the reviewed inventory and active runtime', t => {
  const cache = mkdtempSync(join(tmpdir(), 'skillfit-pack-cache-'));
  t.after(() => rmSync(cache, { recursive: true, force: true }));
  const result = spawnSync('npm', ['pack', '--ignore-scripts', '--offline', '--json'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 60_000,
    shell: process.platform === 'win32', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: cache, npm_config_pack_destination: cache, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
  const entries = JSON.parse(result.stdout);
  assert.equal(entries.length, 1);
  inspectBuiltPackage(entries[0]);
  const extracted = spawnSync('tar', ['-xzf', join(cache, entries[0].filename), '-C', cache], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(extracted.status, 0, `${extracted.error ?? ''}\n${extracted.stderr}`);
  const installed = join(cache, 'package');
  const documents = spawnSync(process.execPath, [join(installed, 'docs/releases/release-docs-smoke.mjs'), installed], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(documents.status, 0, `${documents.error ?? ''}\n${documents.stderr}`);
  assert.equal(JSON.parse(documents.stdout).documents.length, 5);
  const alias = join(cache, 'package-alias');
  symlinkSync(installed, alias, 'junction');
  const blocked = spawnSync(process.execPath, [join(installed, 'docs/releases/archive-delivery-smoke.mjs'), installed,
    fileURLToPath(new URL('..', import.meta.url)), join(alias, 'in-place-output')], { encoding: 'utf8', timeout: 30_000 });
  assert.notEqual(blocked.status, 0);
  assert.equal(existsSync(join(installed, 'in-place-output')), false, 'Invalid aliased output must not modify the package');
  const restored = spawnSync(process.execPath, [join(installed, 'docs/releases/archive-delivery-smoke.mjs'), installed,
    fileURLToPath(new URL('..', import.meta.url)), join(cache, 'archive-smoke')], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(restored.status, 0, `${restored.error ?? ''}\n${restored.stderr}`);
  const receipt = JSON.parse(restored.stdout);
  assert.equal(receipt.archivesRestored, 19);
  assert.equal(receipt.supportFilesRestored, 1583);
  assert.equal(receipt.inlineSupportFiles, 4);
  assert.equal(receipt.networkAttempts, 0);
});
