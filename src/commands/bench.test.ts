import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from '../harness/bench.js';
import { runBenchAdd, runBenchCheck, runBenchInit } from './bench.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');

function tmp(t: import('node:test').TestContext, prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function collector(): { lines: string[]; log: (msg: string) => void } {
  const lines: string[] = [];
  return { lines, log: (msg: string) => lines.push(msg) };
}

test('runBenchInit dry-run prints the plan and writes nothing', async (t) => {
  const cwd = tmp(t, 'skillfit-bench-init-');
  const { lines, log } = collector();
  const result = await runBenchInit({ cwd, dryRun: true, log });
  assert.equal(result, null);
  assert.ok(!existsSync(join(cwd, 'skillfit-bench')));
  const output = lines.join('\n');
  assert.match(output, /Bench scaffold plan \(dry run\)/);
  assert.match(output, /\+ bench\.json/);
  assert.match(output, /\+ verifiers\/example-task\.mjs/);
});

test('runBenchInit scaffolds a bench that loads and passes bench check', async (t) => {
  const cwd = tmp(t, 'skillfit-bench-init-');
  const { log } = collector();
  const result = await runBenchInit({ cwd, yes: true, log });
  assert.ok(result);
  assert.equal(result.dir, join(cwd, 'skillfit-bench'));
  const bench = loadBench(result.dir);
  assert.equal(bench.name, 'skillfit-bench');
  assert.equal(bench.tasks.length, 1);
  const report = await runBenchCheck({ dir: result.dir, log: () => {} });
  assert.equal(report.failures, 0);
  assert.ok(
    report.checks.some(
      (c) => c.status === 'INFO' && c.message.includes('no shouldTrigger label'),
    ),
  );
});

test('runBenchInit refuses a non-empty target directory', async (t) => {
  const cwd = tmp(t, 'skillfit-bench-init-');
  const dir = join(cwd, 'skillfit-bench');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'occupied.txt'), 'x');
  await assert.rejects(() => runBenchInit({ cwd, yes: true, log: () => {} }), /not empty/);
});

test('runBenchInit aborts when the user declines', async (t) => {
  const cwd = tmp(t, 'skillfit-bench-init-');
  const result = await runBenchInit({ cwd, confirm: () => Promise.resolve(false), log: () => {} });
  assert.equal(result, null);
  assert.ok(!existsSync(join(cwd, 'skillfit-bench')));
});

test('runBenchCheck passes on the bundled code-review bench', async () => {
  const { log } = collector();
  const report = await runBenchCheck({ dir: BUNDLED_CODE_REVIEW, log });
  assert.equal(report.failures, 0);
  assert.ok(!report.checks.some((c) => c.message.includes('negative-control')));
});

test('runBenchCheck fails a bench whose verifier accepts empty output', async (t) => {
  const dir = tmp(t, 'skillfit-bench-broken-');
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'Do something.\n');
  writeFileSync(join(dir, 'verifiers', 'always.mjs'), 'process.exit(0);\n');
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'broken',
      tasks: [{ id: 't1', fixture: 'fixtures/t1', prompt: 'prompts/t1.md', verifier: 'node verifiers/always.mjs' }],
    }),
  );
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.ok(report.failures >= 2);
  assert.ok(
    report.checks.some((c) => c.status === 'FAIL' && c.message.includes('empty output')),
  );
});

test('runBenchCheck fails cleanly on a non-bench directory', async (t) => {
  const dir = tmp(t, 'skillfit-bench-none-');
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.equal(report.failures, 1);
  assert.match(report.checks[0]?.message ?? '', /does not load/);
});

function gitRepoWithBug(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-freeze-src-');
  writeFileSync(join(dir, 'add.js'), 'export function add(a, b) {\n  return a - b;\n}\n');
  writeFileSync(
    join(dir, 'add.test.js'),
    `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './add.js';\ntest('add works', () => { assert.equal(add(1, 2), 3); });\n`,
  );
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  mkdirSync(join(dir, 'node_modules', 'junk'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'junk', 'big.js'), 'x'.repeat(4096));
  writeFileSync(join(dir, 'untracked.txt'), 'not tracked\n');
  return dir;
}

function freezeBench(t: import('node:test').TestContext): Promise<string> {
  const cwd = tmp(t, 'skillfit-freeze-bench-');
  const dir = join(cwd, 'my-bench');
  return runBenchInit({ cwd, dir, yes: true, log: () => {} }).then(() => dir);
}

test('runBenchAdd --freeze captures only git-tracked files and registers the task', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const result = await runBenchAdd({
    benchDir,
    task: 'add-bug',
    prompt: 'The add function is broken. Fix it so the tests pass.',
    freeze: true,
    sourceDir: source,
    verifierCmd: 'node --test',
    shouldTrigger: true,
    yes: true,
    log: () => {},
  });
  assert.ok(result);
  const fixture = join(benchDir, 'fixtures', 'add-bug');
  assert.ok(existsSync(join(fixture, 'add.js')), 'tracked file captured');
  assert.ok(!existsSync(join(fixture, 'untracked.txt')), 'untracked file excluded');
  assert.ok(!existsSync(join(fixture, 'node_modules')), 'node_modules excluded');
  const bench = loadBench(benchDir);
  const task = bench.tasks.find((entry) => entry.id === 'add-bug');
  assert.equal(task?.verifierKind, 'command');
  assert.equal(task?.shouldTrigger, true);
  assert.equal(task?.promptTrigger, 'prompts/add-bug.trigger.md');
  assert.ok(existsSync(join(benchDir, 'prompts', 'add-bug.trigger.md')));
  assert.ok(existsSync(join(benchDir, 'ground-truth', 'add-bug.md')));

  const runDir = mkdtempSync(join(tmpdir(), 'skillfit-freeze-run-'));
  t.after(() => rmSync(runDir, { recursive: true, force: true }));
  for (const file of ['add.js', 'add.test.js', 'package.json']) {
    writeFileSync(join(runDir, file), readFileSync(join(fixture, file)));
  }
  const failing = spawnSync('node', [join(benchDir, 'verifiers', 'add-bug.mjs'), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.notEqual(failing.status, 0, 'verifier fails while the bug is present');
  writeFileSync(join(runDir, 'add.js'), 'export function add(a, b) {\n  return a + b;\n}\n');
  const passing = spawnSync('node', [join(benchDir, 'verifiers', 'add-bug.mjs'), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.equal(passing.status, 0, 'verifier passes once the fix is in place');

  const report = await runBenchCheck({ dir: benchDir, log: () => {} });
  assert.equal(report.failures, 0);
});

test('runBenchAdd --freeze supports --expect output verifiers', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  await runBenchAdd({
    benchDir,
    task: 'explain-bug',
    prompt: 'Explain why add.test.js fails.',
    freeze: true,
    sourceDir: source,
    expect: 'subtracts instead of adds',
    yes: true,
    log: () => {},
  });
  const bench = loadBench(benchDir);
  const task = bench.tasks.find((entry) => entry.id === 'explain-bug');
  assert.equal(task?.verifierKind, 'output');
  const runDir = mkdtempSync(join(tmpdir(), 'skillfit-freeze-run-'));
  t.after(() => rmSync(runDir, { recursive: true, force: true }));
  writeFileSync(join(runDir, '_output.md'), 'The implementation subtracts instead of adds.');
  const ok = spawnSync('node', [join(benchDir, 'verifiers', 'explain-bug.mjs'), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0);
  writeFileSync(join(runDir, '_output.md'), 'no idea');
  const bad = spawnSync('node', [join(benchDir, 'verifiers', 'explain-bug.mjs'), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.equal(bad.status, 1);
});

test('runBenchAdd validates flags and rejects duplicates', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const base = {
    benchDir,
    task: 'x1',
    prompt: 'p',
    freeze: true,
    sourceDir: source,
    yes: true,
    log: () => {},
  };
  await assert.rejects(() => runBenchAdd({ ...base, verifierCmd: 'a', expect: 'b' }), /not both/);
  await assert.rejects(() => runBenchAdd({ ...base }), /needs a verifier/);
  await assert.rejects(
    () => runBenchAdd({ ...base, verifierCmd: 'true', task: 'example-task' }),
    /already exists/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, verifierCmd: 'true', task: 'bad id!' }),
    /Invalid --task id/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, verifierCmd: 'true', prompt: '' }),
    /needs a task prompt/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, verifierCmd: 'true', freeze: false }),
    /only --freeze/,
  );
});

test('runBenchAdd --freeze dry-run writes nothing', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const { lines, log } = collector();
  const result = await runBenchAdd({
    benchDir,
    task: 'add-bug',
    prompt: 'Fix add.',
    freeze: true,
    sourceDir: source,
    verifierCmd: 'node --test',
    dryRun: true,
    log,
  });
  assert.equal(result, null);
  assert.ok(!existsSync(join(benchDir, 'fixtures', 'add-bug')));
  assert.match(lines.join('\n'), /dry run/);
});

test('runBenchAdd works in a non-git source directory (filtered copy)', async (t) => {
  const source = tmp(t, 'skillfit-freeze-plain-');
  writeFileSync(join(source, 'main.js'), 'console.log(1);\n');
  mkdirSync(join(source, 'node_modules', 'junk'), { recursive: true });
  writeFileSync(join(source, 'node_modules', 'junk', 'x.js'), 'x');
  mkdirSync(join(source, '.git'));
  writeFileSync(join(source, '.git', 'config'), 'x');
  const benchDir = await freezeBench(t);
  await runBenchAdd({
    benchDir,
    task: 'plain',
    prompt: 'p',
    freeze: true,
    sourceDir: source,
    verifierCmd: 'node main.js',
    yes: true,
    log: () => {},
  });
  const fixture = join(benchDir, 'fixtures', 'plain');
  assert.ok(existsSync(join(fixture, 'main.js')));
  assert.ok(!existsSync(join(fixture, 'node_modules')));
  assert.ok(!existsSync(join(fixture, '.git')));
});
