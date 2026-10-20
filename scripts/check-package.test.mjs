import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PACKAGE_POLICY, inspectBuiltPackage, validatePackageContents } from './check-package.mjs';

const fixture = () => ({ size: 100, unpackedSize: 200, files:
  [...new Set([...PACKAGE_POLICY.requiredFiles, ...PACKAGE_POLICY.retainedTests, ...PACKAGE_POLICY.archives])].map(path => ({ path })) });

test('package policy retains installed workflows, six recipe tests and historical archives', () => {
  assert.ok(validatePackageContents(fixture()).files > 0);
  for (const path of [PACKAGE_POLICY.requiredFiles[0], PACKAGE_POLICY.retainedTests[0], PACKAGE_POLICY.archives[0]]) {
    const pack = fixture(); pack.files = pack.files.filter(file => file.path !== path);
    assert.throws(() => validatePackageContents(pack), /Required package file/);
  }
});

test('package policy rejects private paths, unknown archives and active development tests', () => {
  for (const path of ['workspace4skills/private.md', 'docs/runs/output.json', 'docs/auth.json',
    'docs/tmp.tgz', 'dist/cli.test.js', '../escape', 'docs/../escape']) {
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
  const result = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--offline', '--json'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 60_000,
    shell: process.platform === 'win32', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: cache, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
  const entries = JSON.parse(result.stdout);
  assert.equal(entries.length, 1);
  inspectBuiltPackage(entries[0]);
});
