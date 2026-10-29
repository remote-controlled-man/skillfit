import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from './build.mjs';

const scaffold = (root, bin) => {
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist', types: [] }, include: ['src/*.ts'] }));
  writeFileSync(join(root, 'src/main.ts'), 'export const result: number = 1;');
  if (bin) writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'skillfit', version: '0.0.0', bin }));
};

/**
 * Windows has no exec bit: npm resolves bins by extension through .cmd shims, and
 * chmod 0755 there only clears the read-only flag. Assert what each platform means
 * by "runnable" so the linked-install regression stays covered everywhere.
 */
const runnable = path => (lstatSync(path).mode & (process.platform === 'win32' ? 0o200 : 0o111)) !== 0;

test('build replaces stale output only after successful compilation and refuses symlink output', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-build-test-'));
  try {
    mkdirSync(join(root, 'src')); mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist', types: [] }, include: ['src/*.ts'] }));
    writeFileSync(join(root, 'src/main.ts'), 'export const result: number = 1;');
    writeFileSync(join(root, 'dist/stale.js'), 'obsolete');
    build(root);
    assert.equal(existsSync(join(root, 'dist/stale.js')), false);
    const output = readFileSync(join(root, 'dist/main.js'), 'utf8');
    writeFileSync(join(root, 'src/main.ts'), 'export const result: number = "bad";');
    assert.throws(() => build(root), /compilation failed/);
    assert.equal(readFileSync(join(root, 'dist/main.js'), 'utf8'), output);
    rmSync(join(root, 'dist'), { recursive: true });
    mkdirSync(join(root, 'protected')); symlinkSync(join(root, 'protected'), join(root, 'dist'), 'dir');
    assert.throws(() => build(root), /ordinary directory/);
    assert.equal(existsSync(join(root, 'protected')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('build marks every declared bin runnable for linked and source installs', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-build-bin-'));
  try {
    scaffold(root, { skillfit: 'dist/main.js' });
    build(root);
    assert.equal(runnable(join(root, 'dist/main.js')), true, 'a linked install must not fail with EACCES');
    // A rebuild over an existing dist keeps the bit, since tsc emits 0644.
    build(root);
    assert.equal(runnable(join(root, 'dist/main.js')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('build accepts a string bin', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-build-bin-string-'));
  try {
    scaffold(root, 'dist/main.js');
    build(root);
    assert.equal(runnable(join(root, 'dist/main.js')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('build refuses a declared bin the compiler did not produce', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-build-bin-bad-'));
  try {
    scaffold(root, { skillfit: 'dist/absent.js' });
    assert.throws(() => build(root), /bin "skillfit" -> "dist\/absent\.js" was not produced/);
    assert.equal(existsSync(join(root, 'dist')), false, 'a refused build leaves no partial output');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('build leaves a checkout without package.json alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-build-nomanifest-'));
  try {
    scaffold(root, null);
    build(root);
    assert.equal(existsSync(join(root, 'dist/main.js')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
