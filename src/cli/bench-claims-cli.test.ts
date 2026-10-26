import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from "../bench/read.js";
import { runBenchAdd, runBenchInit } from "./bench.js";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));

test('schema flags, repeated claims, freeze and JSON edits work through the real offline CLI', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-claims-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), source = join(root, 'source'); mkdirSync(source);
  writeFileSync(join(source, 'input.txt'), 'unsolved');
  const cli = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(cli('bench', 'init', bench, '--schema-version', '2', '--yes').status, 0);
  const add = ['bench', 'add', bench, '--freeze', '--source-dir', source, '--include', 'input.txt', '--task', 'captured', '--prompt', 'Solve', '--expect', 'fixed'];
  assert.notEqual(cli(...add, '--yes').status, 0); assert.equal(existsSync(join(bench, 'tasks/captured/fixture')), false);
  assert.equal(cli(...add, '--claim', 'quality', '--claim', 'efficiency', '--dry-run').status, 0);
  assert.equal(existsSync(join(bench, 'tasks/captured/fixture')), false);
  const applied = cli(...add, '--claim', 'quality', '--claim', 'efficiency', '--yes'); assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(loadBench(bench).tasks[1]!.claims, ['quality', 'efficiency']);
  const edited = cli('bench', 'edit', bench, 'captured', '--set', 'claims=["efficiency"]', '--yes', '--json');
  assert.equal(edited.status, 0, edited.stderr); assert.equal(JSON.parse(edited.stdout).status, 'applied');
  assert.match(cli('bench', 'list', bench).stdout, /captured.*efficiency/);
  assert.notEqual(cli('bench', 'list', bench, '--claim', 'quality', '--json').status, 0);
  assert.equal(loadBench(bench).schemaVersion, 2);
});

test('from-commit schema 2 import retains claims and original source/protection rules', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-claims-commit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), bench = join(root, 'bench'); mkdirSync(source);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 'offline@example.invalid'); git('config', 'user.name', 'Offline fixture');
  writeFileSync(join(source, 'index.js'), 'module.exports = (a,b) => a-b;\n');
  writeFileSync(join(source, 'index.test.js'), "const assert=require('node:assert/strict');assert.equal(require('./index.js')(1,2),-1);\n");
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'initial');
  writeFileSync(join(source, 'index.js'), 'module.exports = (a,b) => a+b;\n');
  writeFileSync(join(source, 'index.test.js'), "const assert=require('node:assert/strict');assert.equal(require('./index.js')(1,2),3);\n");
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fix addition');
  const commit = git('rev-parse', 'HEAD').trim();
  await runBenchInit({ dir: bench, schemaVersion: 2, yes: true, log: () => {} });
  await runBenchAdd({ benchDir: bench, sourceDir: source, fromCommit: commit, task: 'fix', claims: ['quality'], yes: true, log: () => {} });
  assert.deepEqual(loadBench(bench).tasks[1]!.claims, ['quality']);
  assert.equal(readFileSync(join(bench, loadBench(bench).tasks[1]!.fixture, 'index.js'), 'utf8'), 'module.exports = (a,b) => a-b;\n');
});
