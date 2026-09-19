import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from '../harness/bench.js';
import { runBenchCheck, runBenchInit } from './bench.js';

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
