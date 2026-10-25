import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { resolveBenchDir } from "../bench/location.js";

test('bench references prefer local inputs, preserve explicit-path errors and choose bundled names consistently', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-bench-reference-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'user'), bundledRoot = join(root, 'package', 'benches');
  mkdirSync(cwd); mkdirSync(bundledRoot, { recursive: true }); const options = { cwd, bundledRoot };
  assert.throws(() => resolveBenchDir(undefined, options), /No bundled benches/);
  const bundled = join(bundledRoot, 'example'); mkdirSync(bundled); writeFileSync(join(bundled, 'bench.json'), '{}');
  assert.equal(resolveBenchDir('example', options), bundled); assert.equal(resolveBenchDir(undefined, options), bundled);
  assert.throws(() => resolveBenchDir('./example', options), /Not a bench directory/);
  assert.throws(() => resolveBenchDir('absent', options), /missing bench.json/);
  const local = join(cwd, 'example'); mkdirSync(local);
  assert.throws(() => resolveBenchDir('example', options), /Not a bench directory/, 'An existing local directory must not silently use a bundled case.');
  writeFileSync(join(local, 'bench.json'), '{malformed-but-local');
  assert.equal(resolveBenchDir('example', options), local); assert.equal(resolveBenchDir('./example', options), local);
  assert.equal(resolveBenchDir('.', { ...options, cwd: local }), local);
  const other = join(bundledRoot, 'other'); mkdirSync(other); writeFileSync(join(other, 'bench.json'), '{}');
  assert.throws(() => resolveBenchDir(undefined, options), /pick one explicitly/);
});
