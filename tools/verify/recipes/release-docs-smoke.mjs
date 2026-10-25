import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only current calling instructions: never scan frozen releases or evidence.
export const RELEASE_DOCUMENTS = [
  'README.md', 'README.zh-CN.md', 'skills/skillfit/SKILL.md',
  'docs/guides/first-real-eval.md', 'docs/maintainers/archive-delivery.md',
];

export function inspectReleaseDocuments(version, read) {
  assert.match(version, /^\d+\.\d+\.\d+$/, 'A stable package version is required');
  return RELEASE_DOCUMENTS.map(path => {
    const text = read(path), pins = [...text.matchAll(/\bskillfit@(\d+\.\d+\.\d+(?:-[\w.-]+)?)/g)];
    assert.ok(pins.length > 0, `Current package command is missing: ${path}`);
    for (const pin of pins) assert.equal(pin[1], version, `Stale package command in ${path}: ${pin[0]}`);
    if (path === 'README.md' || path === 'README.zh-CN.md') {
      assert.ok(text.includes('(CHANGELOG.md)'), `Changelog link is missing: ${path}`);
    }
    return { path, sha256: createHash('sha256').update(text).digest('hex'), pinnedReferences: pins.length };
  });
}

export function validateReleaseDocuments(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'skillfit');
  return { kind: 'skillfit.release-documents-smoke', version: pkg.version,
    documents: inspectReleaseDocuments(pkg.version, path => readFileSync(join(root, path), 'utf8')),
    modelCalls: 0 };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Provide the source or installed package directory.');
  console.log(JSON.stringify(validateReleaseDocuments(resolve(process.argv[2]))));
}
