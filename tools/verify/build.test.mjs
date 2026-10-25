import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from './build.mjs';

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
