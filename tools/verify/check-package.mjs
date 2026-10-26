import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compiledModules } from './check-architecture.mjs';

export const PACKAGE_POLICY = JSON.parse(readFileSync(new URL('package-policy.json', import.meta.url), 'utf8'));

export function validatePackageContents(pack, runtimeFiles = []) {
  assert.ok(Array.isArray(pack.files) && pack.files.length, 'An inspected package inventory is required');
  const names = pack.files.map(file => file.path), files = new Set(names);
  assert.equal(files.size, names.length, 'Package paths must be unique');
  const roots = new Set(['dist', 'benches', 'docs', 'profiles', 'skills', 'README.md', 'README.zh-CN.md', 'LICENSE', 'package.json', 'CHANGELOG.md', 'tools']);
  for (const name of names) {
    assert.equal(typeof name, 'string');
    assert.ok(!name.includes('\\') && !name.startsWith('/') && !name.split('/').some(part => part === '..' || part === '.'), `Unsafe package path: ${name}`);
    assert.ok(roots.has(name.split('/')[0]), `Unreviewed package root: ${name}`);
    assert.ok(!PACKAGE_POLICY.sourceOnlyPrefixes.some(prefix => name.startsWith(prefix)) && !PACKAGE_POLICY.sourceOnlyFiles.includes(name) && !/^docs\/releases\/[^/]+\.(json|txt|log)$/.test(name), `Source-only record/artifact in package: ${name}`);
    assert.ok(!/(?:^|\/)(?:workspace4skills|runs|node_modules|\.git)(?:\/|$)/.test(name), `Private/generated path in package: ${name}`);
    assert.ok(!/(?:^|\/)(?:\.env|auth\.json|credentials|id_rsa|id_ed25519)$/.test(name), `Credential path in package: ${name}`);
    if (name.startsWith('tools/')) assert.ok(/^tools\/verify\/recipes\/[^/]+\.mjs$/.test(name) && PACKAGE_POLICY.requiredFiles.includes(name), `Unreviewed shipped tool: ${name}`);
    if (name.startsWith('dist/') && name.endsWith('.test.js')) {
      assert.ok(PACKAGE_POLICY.retainedTests.includes(name), `Unreviewed active test in package: ${name}`);
    }
    if (/\.(?:tar\.gz|tgz|zip)$/.test(name)) {
      assert.ok(PACKAGE_POLICY.archives.includes(name), `Unreviewed archive in package: ${name}`);
    }
  }
  for (const name of [...PACKAGE_POLICY.requiredFiles, ...PACKAGE_POLICY.retainedTests, ...PACKAGE_POLICY.archives, ...runtimeFiles]) {
    assert.ok(files.has(name), `Required package file is missing: ${name}`);
  }
  for (const [field, max] of [['size', PACKAGE_POLICY.maxArchiveBytes], ['unpackedSize', PACKAGE_POLICY.maxUnpackedBytes]]) {
    assert.ok(Number.isSafeInteger(pack[field]) && pack[field] > 0 && pack[field] <= max, `Package ${field} exceeds reviewed limit ${max}`);
  }
  return { files: files.size, archiveBytes: pack.size, unpackedBytes: pack.unpackedSize };
}

export function inspectBuiltPackage(pack) {
  return validatePackageContents(pack, [...compiledModules().keys()].map(path => `dist/${path}`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], 'Provide npm pack --json output');
  const entries = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  assert.equal(entries.length, 1, 'Inspect one package at a time');
  console.log(JSON.stringify(inspectBuiltPackage(entries[0])));
}
