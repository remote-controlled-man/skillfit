import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { captureSourceFiles, freezeSourceFiles } from "../cli/bench-source.js";
import { runBenchAdd, runBenchInit } from "../cli/bench.js";

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-freeze-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), bench = join(root, 'bench');
  mkdirSync(source);
  return { root, source, bench };
}
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

test('empty Git index never falls back to ignored or untracked files, including dry runs', async t => {
  const f = fixture(t); git(f.source, 'init', '-q');
  writeFileSync(join(f.source, '.gitignore'), '.env\nbuild/\n');
  writeFileSync(join(f.source, '.env'), 'SYNTHETIC_ONLY=not-a-secret');
  mkdirSync(join(f.source, 'build')); writeFileSync(join(f.source, 'build', 'out'), 'artifact');
  await runBenchInit({ dir: f.bench, yes: true, log: () => {} });
  for (const dryRun of [true, false]) await assert.rejects(runBenchAdd({ benchDir: f.bench, sourceDir: f.source,
    task: 'freeze', freeze: true, prompt: 'Solve', expect: 'done', dryRun, yes: true, log: () => {} }), /No git-tracked files/);
  assert.equal(existsSync(join(f.bench, 'tasks', 'freeze')), false);
});

test('non-Git sources require explicit includes; Git sources support the same narrowing', t => {
  const f = fixture(t);
  mkdirSync(join(f.source, 'src')); writeFileSync(join(f.source, 'src', 'app.js'), 'app');
  writeFileSync(join(f.source, '.env'), 'synthetic');
  assert.throws(() => captureSourceFiles(f.source), /requires --include/);
  assert.deepEqual(captureSourceFiles(f.source, ['src']), ['src/app.js']);
  git(f.source, 'init', '-q'); git(f.source, 'add', '.');
  assert.deepEqual(captureSourceFiles(f.source, ['src/app.js']), ['src/app.js']);
  for (const rel of ['../outside', '/absolute', '.', '.git', 'node_modules', 'src/../.env', 'missing']) {
    assert.throws(() => captureSourceFiles(f.source, [rel]), /--include/);
  }
});

test('tracked file and directory links cannot be dereferenced into frozen inputs', t => {
  const f = fixture(t); git(f.source, 'init', '-q');
  writeFileSync(join(f.root, 'outside.txt'), 'SYNTHETIC_OUTSIDE');
  // Git does not support tracked symlinks on every Windows checkout; the ordinary
  // directory-junction check below still covers Windows parent traversal.
  if (process.platform !== 'win32') {
    symlinkSync('../outside.txt', join(f.source, 'link.txt')); git(f.source, 'add', 'link.txt');
    assert.throws(() => freezeSourceFiles(f.source, f.bench), /symbolic link/);
  }
  const target = join(f.root, 'directory'); mkdirSync(target); writeFileSync(join(target, 'outside.txt'), 'synthetic');
  symlinkSync(target, join(f.source, 'linked-dir'), process.platform === 'win32' ? 'junction' : 'dir');
  // Explicit non-Git capture must also reject a linked parent, before reading it.
  const plain = join(f.root, 'plain'); mkdirSync(plain);
  symlinkSync(target, join(plain, 'linked-dir'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => captureSourceFiles(plain, ['linked-dir/outside.txt']), /symbolic link/);
});

test('broken Git metadata never widens selection to the working directory', t => {
  const f = fixture(t); mkdirSync(join(f.source, '.git')); writeFileSync(join(f.source, 'safe.txt'), 'fixture');
  assert.throws(() => captureSourceFiles(f.source, ['safe.txt']), /Cannot read the Git index/);
});

test('destination bench and oversized inputs are rejected before copying, with explicit narrowing available', async t => {
  const f = fixture(t); const bench = join(f.source, 'my-bench');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  writeFileSync(join(f.source, 'app.js'), 'app');
  git(f.source, 'init', '-q'); git(f.source, 'add', '.');
  assert.throws(() => freezeSourceFiles(f.source, bench), /destination bench/);
  assert.equal(freezeSourceFiles(f.source, bench, ['app.js'])[0]!.content.toString(), 'app');
  writeFileSync(join(f.source, 'large.bin'), Buffer.alloc(1024 * 1024 + 1)); git(f.source, 'add', 'large.bin');
  assert.throws(() => freezeSourceFiles(f.source, f.bench, ['large.bin']), /exceeds/);
  assert.equal(readFileSync(join(bench, 'bench.json'), 'utf8').includes('example-task'), true);
});
