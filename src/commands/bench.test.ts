import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from '../harness/bench.js';
import { runVerifier } from '../harness/runner.js';
import type { Executor } from '../harness/types.js';
import { runBenchAdd, runBenchCheck, runBenchInit } from './bench.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');
const BUNDLED_DEBUGGING = join(PACKAGE_ROOT, 'benches', 'debugging');

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

// Exercises the real readline path in a child process, because the defect is about stdin closing
// without ever delivering a line — something an injected `confirm` stub cannot reproduce.
test('bench init fails fast when stdin closes without an answer', (t) => {
  const cwd = tmp(t, 'skillfit-bench-stdin-');
  const result = spawnSync(
    process.execPath,
    [join(PACKAGE_ROOT, 'dist', 'cli.js'), 'bench', 'init', join(cwd, 'stdin-probe')],
    { cwd, encoding: 'utf8', input: '', timeout: 30_000 },
  );
  assert.equal(result.signal, null, 'must not hang until the timeout');
  assert.notEqual(
    result.status,
    0,
    'closed non-TTY stdin must fail, not exit 0 having written nothing',
  );
  assert.match(result.stderr, /--yes/);
  assert.ok(!existsSync(join(cwd, 'stdin-probe')), 'nothing was written');
});

test('runBenchCheck passes on the bundled code-review bench', async () => {
  const { log } = collector();
  const report = await runBenchCheck({ dir: BUNDLED_CODE_REVIEW, log });
  assert.equal(report.failures, 0);
  assert.ok(!report.checks.some((c) => c.message.includes('negative-control')));
  // The teaching material must not trip the gates it is teaching. Warnings are asserted, not just
  // failures, because a bundled bench that warns is a bundled bench modelling the wrong habit.
  assert.equal(report.warnings, 0, report.checks.filter((c) => c.status === 'WARN').map((c) => c.message).join('; '));
  assert.ok(
    report.checks.some(
      (c) => c.status === 'PASS' && c.message.includes('negative controls (40%)'),
    ),
  );
});

test('runBenchCheck gates every bundled debugging task with its oracle', async () => {
  const { log } = collector();
  const report = await runBenchCheck({ dir: BUNDLED_DEBUGGING, log });
  assert.equal(report.failures, 0);
  const oraclePasses = report.checks.filter(
    (c) => c.status === 'PASS' && c.message.includes('oracle solution passes the verifier'),
  );
  assert.equal(oraclePasses.length, 8, 'every task registers an oracle and that oracle solves it');
  assert.ok(
    !report.checks.some((c) => c.message.includes('no oracle')),
    'the bundled bench must not trip its own missing-oracle warning',
  );
  assert.equal(report.warnings, 0, report.checks.filter((c) => c.status === 'WARN').map((c) => c.message).join('; '));
  assert.ok(
    report.checks.some(
      (c) => c.status === 'PASS' && c.message.includes('negative controls (38%)'),
    ),
  );
});

function commandKindBench(t: import('node:test').TestContext, withOracle: boolean): string {
  const dir = tmp(t, 'skillfit-bench-cmdkind-');
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  mkdirSync(join(dir, 'ground-truth'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'Do something.\n');
  writeFileSync(join(dir, 'verifiers', 'v.mjs'), EXACT_VERIFIER);
  writeFileSync(
    join(dir, 'ground-truth', 'o.mjs'),
    `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], '_output.md'), 'right\\n');
`,
  );
  const task: Record<string, unknown> = {
    id: 't1',
    fixture: 'fixtures/t1',
    prompt: 'prompts/t1.md',
    verifier: 'node verifiers/v.mjs',
    verifierKind: 'command',
  };
  if (withOracle) task['oracle'] = 'node ground-truth/o.mjs';
  writeFileSync(join(dir, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks: [task] }));
  return dir;
}

test('runBenchCheck names the offline coverage a command-kind task actually has', async (t) => {
  const gated = await runBenchCheck({ dir: commandKindBench(t, true), log: () => {} });
  assert.equal(gated.failures, 0);
  const gatedInfo = gated.checks.find((c) => c.message.includes('mock-arm probes not applicable'));
  assert.ok(gatedInfo, 'command-kind tasks always report why mock probes were skipped');
  assert.match(gatedInfo.message, /offline coverage comes from the oracle and NOP gates/);

  const ungated = await runBenchCheck({ dir: commandKindBench(t, false), log: () => {} });
  const ungatedInfo = ungated.checks.find((c) => c.message.includes('mock-arm probes not applicable'));
  assert.ok(ungatedInfo);
  assert.match(ungatedInfo.message, /nothing offline shows this task is solvable/);
});

// The visible suite IS this task's specification, so it is also the thing an agent can edit to win.
// `bench check` covers the NOP and oracle directions but not tampering, so the cheat gets its own test.
test('the bundled feat-slug verifier rejects a rewritten test suite', async (t) => {
  const runDir = tmp(t, 'skillfit-featslug-tamper-');
  cpSync(join(BUNDLED_DEBUGGING, 'fixtures', 'feat-slug'), runDir, { recursive: true });

  const solve = await runVerifier(BUNDLED_DEBUGGING, 'node ground-truth/oracle-feat-slug.mjs', runDir);
  assert.equal(solve.exitCode, 0, 'the oracle must solve the pristine fixture');
  const solved = await runVerifier(BUNDLED_DEBUGGING, 'node verifiers/feat-slug.mjs', runDir);
  assert.equal(solved.exitCode, 0, 'the reference solution must pass');

  // A suite that the correct implementation still satisfies, so only the tamper check can catch it.
  writeFileSync(
    join(runDir, 'test', 'slug.test.mjs'),
    `import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.mjs';

test('trivial', () => {
  assert.equal(typeof slugify('anything'), 'string');
});
`,
    'utf8',
  );
  const tampered = await runVerifier(BUNDLED_DEBUGGING, 'node verifiers/feat-slug.mjs', runDir);
  assert.notEqual(tampered.exitCode, 0, 'editing the specification is not satisfying it');
  assert.match(tampered.output, /visible suite unmodified/);
  assert.match(tampered.output, /differs from the fixture copy/);
});

// The two checks this replaced scanned test source text — four `test(` occurrences and a match on
// /negative|maxItems|invalid|reject/i — so empty tests containing the right words scored full marks.
test('the bundled range-parser verifier rejects a keyword-stuffed empty test suite', async (t) => {
  const runDir = tmp(t, 'skillfit-rangeparser-game-');
  cpSync(join(BUNDLED_DEBUGGING, 'fixtures', 'range-parser'), runDir, { recursive: true });

  const solve = await runVerifier(BUNDLED_DEBUGGING, 'node ground-truth/oracle-range-parser.mjs', runDir);
  assert.equal(solve.exitCode, 0, 'the oracle must solve the pristine fixture');
  const solved = await runVerifier(BUNDLED_DEBUGGING, 'node verifiers/range-parser.mjs', runDir);
  assert.equal(solved.exitCode, 0, 'the reference solution must pass');

  mkdirSync(join(runDir, 'test'), { recursive: true });
  writeFileSync(
    join(runDir, 'test', 'basic.test.mjs'),
    `import test from 'node:test';
import assert from 'node:assert/strict';

test('invalid input handling', () => { assert.ok(true); });
test('negative value handling', () => { assert.ok(true); });
test('maxItems limit', () => { assert.ok(true); });
test('rejects bad segments', () => { assert.ok(true); });
`,
    'utf8',
  );
  const gamed = await runVerifier(BUNDLED_DEBUGGING, 'node verifiers/range-parser.mjs', runDir);
  assert.notEqual(gamed.exitCode, 0, 'a suite that asserts nothing is not a regression test');
  assert.match(gamed.output, /red-to-green regression test/);
  assert.match(gamed.output, /detects none of the seeded bugs/);
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

function oracleBench(
  t: import('node:test').TestContext,
  verifierSrc: string,
  oracleSrc: string,
): string {
  const dir = tmp(t, 'skillfit-bench-oracle-');
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  mkdirSync(join(dir, 'ground-truth'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'Do something.\n');
  writeFileSync(join(dir, 'verifiers', 'v.mjs'), verifierSrc);
  writeFileSync(join(dir, 'ground-truth', 'o.mjs'), oracleSrc);
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      tasks: [
        {
          id: 't1',
          fixture: 'fixtures/t1',
          prompt: 'prompts/t1.md',
          verifier: 'node verifiers/v.mjs',
          oracle: 'node ground-truth/o.mjs',
        },
      ],
    }),
  );
  return dir;
}

const EXACT_VERIFIER = `import fs from 'node:fs';
import path from 'node:path';
let out = '';
try {
  out = fs.readFileSync(path.join(process.argv[2], '_output.md'), 'utf8').trim();
} catch {
  console.log(JSON.stringify({ passed: false, checks: [{ name: 'answer', pass: false }] }));
  process.exit(1);
}
const passed = out === 'right';
console.log(JSON.stringify({ passed, checks: [{ name: 'answer', pass: passed }] }));
process.exit(passed ? 0 : 1);
`;

test('runBenchCheck passes when the oracle aces the verifier', async (t) => {
  const oracle = `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], '_output.md'), 'right\\n');
`;
  const dir = oracleBench(t, EXACT_VERIFIER, oracle);
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.equal(report.failures, 0);
  assert.ok(
    report.checks.some(
      (c) => c.status === 'PASS' && c.message.includes('oracle solution passes the verifier with full checks'),
    ),
  );
});

test('runBenchCheck fails when the oracle does not solve the task', async (t) => {
  const oracle = `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], '_output.md'), 'wrong\\n');
`;
  const dir = oracleBench(t, EXACT_VERIFIER, oracle);
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.ok(
    report.checks.some(
      (c) => c.status === 'FAIL' && c.message.includes('oracle solution does not pass the verifier'),
    ),
  );
});

test('runBenchCheck fails when the oracle passes the exit code but not every check', async (t) => {
  const partialVerifier = `import fs from 'node:fs';
import path from 'node:path';
let out = '';
try {
  out = fs.readFileSync(path.join(process.argv[2], '_output.md'), 'utf8');
} catch {
  console.log(JSON.stringify({ passed: false }));
  process.exit(1);
}
if (out.trim() === '') {
  console.log(JSON.stringify({ passed: false }));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, checks: [{ name: 'a', pass: true }, { name: 'b', pass: false }] }));
process.exit(0);
`;
  const oracle = `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], '_output.md'), 'something\\n');
`;
  const dir = oracleBench(t, partialVerifier, oracle);
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.ok(
    report.checks.some(
      (c) => c.status === 'FAIL' && c.message.includes('scores 0.50 on its checks'),
    ),
  );
});

test('runBenchCheck fails when the oracle command itself errors', async (t) => {
  const dir = oracleBench(t, EXACT_VERIFIER, 'process.exit(1);\n');
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.ok(
    report.checks.some(
      (c) => c.status === 'FAIL' && c.message.includes('oracle command itself failed'),
    ),
  );
});

test('runBenchCheck warns when a task registers no oracle', async (t) => {
  const dir = tmp(t, 'skillfit-bench-nooracle-');
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'Do something.\n');
  writeFileSync(join(dir, 'verifiers', 'v.mjs'), EXACT_VERIFIER);
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      tasks: [
        {
          id: 't1',
          fixture: 'fixtures/t1',
          prompt: 'prompts/t1.md',
          verifier: 'node verifiers/v.mjs',
        },
      ],
    }),
  );
  const report = await runBenchCheck({ dir, log: () => {} });
  const warning = report.checks.find(
    (c) => c.status === 'WARN' && c.message.startsWith('t1: no oracle'),
  );
  assert.ok(warning, 'expected a WARN for the missing oracle');
  assert.match(warning.message, /task winnability is unverified/);
  // A missing oracle warns rather than fails: `bench add --freeze` legitimately
  // produces oracle-less tasks mid-authoring, and a hard fail would block that flow.
  assert.equal(report.failures, 0);
});

test('runBenchCheck does not warn about oracles when every task registers one', async (t) => {
  const oracle = `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], '_output.md'), 'right\\n');
`;
  const dir = oracleBench(t, EXACT_VERIFIER, oracle);
  const report = await runBenchCheck({ dir, log: () => {} });
  assert.equal(report.failures, 0);
  assert.ok(
    !report.checks.some((c) => c.message.includes('no oracle')),
    'a bench with oracles registered must not warn about missing ones',
  );
});

function facetCountBench(t: import('node:test').TestContext, count: number): string {
  const dir = tmp(t, 'skillfit-bench-facets-');
  mkdirSync(join(dir, 'fixtures', 't1'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 't1', 'index.txt'), 'x\n');
  writeFileSync(join(dir, 'prompts', 't1.md'), 'Do something.\n');
  const names = Array.from({ length: count }, (_, i) => `check-${i + 1}`);
  writeFileSync(
    join(dir, 'verifiers', 'v.mjs'),
    `import fs from 'node:fs';
import path from 'node:path';
let out = '';
try {
  out = fs.readFileSync(path.join(process.argv[2], '_output.md'), 'utf8');
} catch {
  out = '';
}
const passed = out.trim() === 'right';
const checks = ${JSON.stringify(names)}.map((name) => ({ name, pass: passed }));
console.log(JSON.stringify({ passed, checks }));
process.exit(passed ? 0 : 1);
`,
  );
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      tasks: [
        {
          id: 't1',
          fixture: 'fixtures/t1',
          prompt: 'prompts/t1.md',
          verifier: 'node verifiers/v.mjs',
        },
      ],
    }),
  );
  return dir;
}

function facetGate(report: { checks: { status: string; message: string }[] }): {
  status: string;
  message: string;
} | undefined {
  return report.checks.find((c) => c.message.includes('facet check(s)'));
}

test('runBenchCheck warns when the facet-check count falls outside 2–8', async (t) => {
  for (const count of [1, 12]) {
    const report = await runBenchCheck({ dir: facetCountBench(t, count), log: () => {} });
    const gate = facetGate(report);
    assert.ok(gate, `expected a facet-count line for ${count} checks`);
    assert.equal(gate.status, 'WARN', `${count} checks must warn`);
    assert.ok(
      gate.message.startsWith(`t1: ${count} facet check(s)`),
      `message should name the count, got: ${gate.message}`,
    );
  }
});

test('runBenchCheck passes facet counts at both ends of the 2–8 contract', async (t) => {
  for (const count of [2, 8]) {
    const report = await runBenchCheck({ dir: facetCountBench(t, count), log: () => {} });
    const gate = facetGate(report);
    assert.ok(gate, `expected a facet-count line for ${count} checks`);
    assert.equal(gate.status, 'PASS', `${count} checks must pass`);
    assert.equal(report.failures, 0);
  }
});

function triggerLabelBench(
  t: import('node:test').TestContext,
  labeled: number,
  negatives: number,
): string {
  const dir = tmp(t, 'skillfit-bench-negatives-');
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(join(dir, 'verifiers', 'v.mjs'), EXACT_VERIFIER);
  const tasks: Record<string, unknown>[] = [];
  for (let i = 0; i < labeled; i++) {
    const id = `task-${i + 1}`;
    mkdirSync(join(dir, 'fixtures', id), { recursive: true });
    writeFileSync(join(dir, 'fixtures', id, 'index.txt'), 'x\n');
    writeFileSync(join(dir, 'prompts', `${id}.md`), `${id} prompt.\n`);
    tasks.push({
      id,
      fixture: `fixtures/${id}`,
      prompt: `prompts/${id}.md`,
      verifier: 'node verifiers/v.mjs',
      shouldTrigger: i >= negatives,
    });
  }
  writeFileSync(join(dir, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks }));
  return dir;
}

function negativeControlLine(report: { checks: { status: string; message: string }[] }): {
  status: string;
  message: string;
} | undefined {
  return report.checks.find((c) => c.message.includes('negative controls'));
}

test('runBenchCheck warns when negative controls fall below the 30% target', async (t) => {
  const report = await runBenchCheck({ dir: triggerLabelBench(t, 5, 1), log: () => {} });
  const line = negativeControlLine(report);
  assert.ok(line, 'expected a negative-control line');
  assert.equal(line.status, 'WARN', '1/5 = 20% must warn');
  assert.match(line.message, /^1\/5 labeled task\(s\) are negative controls \(20%\)/);
  assert.match(line.message, /below the 30% target/);
});

test('runBenchCheck passes negative controls at exactly the 30% target', async (t) => {
  const report = await runBenchCheck({ dir: triggerLabelBench(t, 10, 3), log: () => {} });
  const line = negativeControlLine(report);
  assert.ok(line, 'expected a negative-control line');
  assert.equal(line.status, 'PASS', '3/10 = 30% is at the target and must not warn');
  assert.match(line.message, /^3\/10 labeled task\(s\) are negative controls \(30%\)/);
});

test('runBenchCheck still warns hardest when a labelled bench has no negative controls', async (t) => {
  const report = await runBenchCheck({ dir: triggerLabelBench(t, 3, 0), log: () => {} });
  assert.ok(
    report.checks.some(
      (c) => c.status === 'WARN' && c.message.includes('cannot measure false-trigger rate'),
    ),
  );
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

function stubDrafter(verifierSrc: string, oracleSrc: string): Executor {
  return {
    describe: () => ({ kind: 'mock', model: 'stub-drafter' }),
    run: (_prompt: string, workdir: string) => {
      writeFileSync(join(workdir, 'verifier.mjs'), verifierSrc);
      writeFileSync(join(workdir, 'oracle.mjs'), oracleSrc);
      return Promise.resolve({ output: '' });
    },
  };
}

const DRAFTED_COMMAND_VERIFIER = `import { spawnSync } from 'node:child_process';
const result = spawnSync('node --test', { cwd: process.argv[2], shell: true, encoding: 'utf8' });
const passed = result.status === 0;
console.log(JSON.stringify({ passed, checks: [{ name: 'tests-pass', pass: passed }] }));
process.exit(passed ? 0 : 1);
`;

const DRAFTED_ORACLE = `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[2], 'add.js'), 'export function add(a, b) {\\n  return a + b;\\n}\\n');
`;

test('runBenchAdd --freeze --decompose installs a gated draft with its oracle', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const result = await runBenchAdd({
    benchDir,
    task: 'add-bug-drafted',
    prompt: 'The add function is broken. Fix it so the tests pass.',
    freeze: true,
    sourceDir: source,
    decompose: true,
    verifierKind: 'command',
    executor: stubDrafter(DRAFTED_COMMAND_VERIFIER, DRAFTED_ORACLE),
    yes: true,
    log: () => {},
  });
  assert.ok(result);
  const bench = loadBench(benchDir);
  const task = bench.tasks.find((entry) => entry.id === 'add-bug-drafted');
  assert.equal(task?.verifierKind, 'command');
  assert.equal(task?.oracle, 'node ground-truth/oracle-add-bug-drafted.mjs');
  assert.ok(existsSync(join(benchDir, 'ground-truth', 'oracle-add-bug-drafted.mjs')));
  assert.match(
    readFileSync(join(benchDir, 'verifiers', 'add-bug-drafted.mjs'), 'utf8'),
    /tests-pass/,
  );
  const report = await runBenchCheck({ dir: benchDir, log: () => {} });
  assert.equal(report.failures, 0);
});

test('runBenchAdd --decompose needs an agent or injected executor', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  await assert.rejects(
    () =>
      runBenchAdd({
        benchDir,
        task: 'x1',
        prompt: 'p',
        freeze: true,
        sourceDir: source,
        decompose: true,
        yes: true,
        log: () => {},
      }),
    /needs an agent/,
  );
});

test('runBenchAdd --decompose rejects a draft that passes the untouched fixture', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const laxVerifier = 'console.log(JSON.stringify({ passed: true }));\nprocess.exit(0);\n';
  await assert.rejects(
    () =>
      runBenchAdd({
        benchDir,
        task: 'x1',
        prompt: 'p',
        freeze: true,
        sourceDir: source,
        decompose: true,
        executor: stubDrafter(laxVerifier, DRAFTED_ORACLE),
        yes: true,
        log: () => {},
      }),
    /NOP gate/,
  );
  const bench = loadBench(benchDir);
  assert.ok(!bench.tasks.some((entry) => entry.id === 'x1'), 'nothing was registered');
});

test('runBenchAdd --decompose rejects a draft whose oracle does not solve the task', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  const idleOracle = '// does nothing\n';
  await assert.rejects(
    () =>
      runBenchAdd({
        benchDir,
        task: 'x1',
        prompt: 'p',
        freeze: true,
        sourceDir: source,
        decompose: true,
        verifierKind: 'command',
        executor: stubDrafter(DRAFTED_COMMAND_VERIFIER, idleOracle),
        yes: true,
        log: () => {},
      }),
    /oracle gate/,
  );
});

test('runBenchAdd --decompose validates flag combinations', async (t) => {
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
  await assert.rejects(
    () => runBenchAdd({ ...base, decompose: true, verifierCmd: 'node --test' }),
    /drafts the verifier/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, decompose: true, oracle: 'node ground-truth/o.mjs' }),
    /own oracle/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, freeze: false, fromCommit: 'HEAD', decompose: true }),
    /only with --freeze/,
  );
});

test('runBenchAdd --decompose dry-run skips the agent and writes nothing', async (t) => {
  const source = gitRepoWithBug(t);
  const benchDir = await freezeBench(t);
  let invoked = false;
  const spy: Executor = {
    describe: () => ({ kind: 'mock', model: 'spy' }),
    run: () => {
      invoked = true;
      return Promise.resolve({ output: '' });
    },
  };
  const result = await runBenchAdd({
    benchDir,
    task: 'x1',
    prompt: 'p',
    freeze: true,
    sourceDir: source,
    decompose: true,
    executor: spy,
    dryRun: true,
    log: () => {},
  });
  assert.equal(result, null);
  assert.equal(invoked, false);
  assert.ok(!existsSync(join(benchDir, 'verifiers', 'x1.mjs')));
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
    /needs an importer/,
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

function gitRepoWithFixHistory(t: import('node:test').TestContext): {
  repo: string;
  buggyCommit: string;
  testOnlyCommit: string;
  fixCommit: string;
} {
  const repo = tmp(t, 'skillfit-mine-repo-');
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'add.js'), 'export function add(a, b) {\n  return a - b;\n}\n');
  writeFileSync(join(repo, 'package.json'), '{ "type": "module" }\n');
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git(['init', '-q']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);
  git(['add', '-A']);
  git(['commit', '-qm', 'initial: buggy add']);
  const buggyCommit = git(['rev-parse', 'HEAD']);

  mkdirSync(join(repo, 'test'), { recursive: true });
  writeFileSync(
    join(repo, 'test', 'sanity.test.js'),
    `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/add.js';\ntest('add returns a number', () => { assert.equal(typeof add(1, 2), 'number'); });\n`,
  );
  git(['add', '-A']);
  git(['commit', '-qm', 'test: add sanity check']);
  const testOnlyCommit = git(['rev-parse', 'HEAD']);

  writeFileSync(join(repo, 'src', 'add.js'), 'export function add(a, b) {\n  return a + b;\n}\n');
  writeFileSync(
    join(repo, 'test', 'add-fix.test.js'),
    `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/add.js';\ntest('add sums two numbers', () => { assert.equal(add(1, 2), 3); });\ntest('add handles zero', () => { assert.equal(add(0, 0), 0); });\n`,
  );
  git(['add', '-A']);
  git(['commit', '-qm', 'fix: add was subtracting instead of adding']);
  const fixCommit = git(['rev-parse', 'HEAD']);
  return { repo, buggyCommit, testOnlyCommit, fixCommit };
}

test('runBenchAdd --from-commit mines parent fixture + embedded FAIL_TO_PASS verifier', async (t) => {
  const { repo, fixCommit } = gitRepoWithFixHistory(t);
  const benchDir = await freezeBench(t);
  const result = await runBenchAdd({
    benchDir,
    fromCommit: fixCommit,
    sourceDir: repo,
    shouldTrigger: true,
    yes: true,
    log: () => {},
  });
  assert.ok(result);
  assert.match(result.taskId, /^fix-[0-9a-f]{7}$/);
  const fixture = join(benchDir, 'fixtures', result.taskId);
  assert.match(readFileSync(join(fixture, 'src', 'add.js'), 'utf8'), /return a - b/, 'fixture is the parent (buggy) state');
  assert.ok(existsSync(join(fixture, 'package.json')));
  assert.ok(existsSync(join(fixture, 'test', 'sanity.test.js')), 'parent tests come along');
  assert.ok(!existsSync(join(fixture, 'test', 'add-fix.test.js')), 'the fix tests stay hidden in the verifier');
  const bench = loadBench(benchDir);
  const task = bench.tasks.find((entry) => entry.id === result.taskId);
  assert.equal(task?.verifierKind, 'command');
  assert.equal(task?.shouldTrigger, true);

  const runDir = mkdtempSync(join(tmpdir(), 'skillfit-mine-run-'));
  t.after(() => rmSync(runDir, { recursive: true, force: true }));
  writeFileSync(join(runDir, 'package.json'), readFileSync(join(fixture, 'package.json')));
  mkdirSync(join(runDir, 'src'), { recursive: true });
  writeFileSync(join(runDir, 'src', 'add.js'), readFileSync(join(fixture, 'src', 'add.js')));
  const pristine = spawnSync('node', [join(benchDir, 'verifiers', `${result.taskId}.mjs`), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.notEqual(pristine.status, 0, 'embedded fix tests fail on the parent state');
  writeFileSync(join(runDir, 'src', 'add.js'), 'export function add(a, b) {\n  return a + b;\n}\n');
  const fixed = spawnSync('node', [join(benchDir, 'verifiers', `${result.taskId}.mjs`), runDir], {
    cwd: benchDir,
    encoding: 'utf8',
  });
  assert.equal(fixed.status, 0, 'embedded fix tests pass once the fix is implemented');

  const report = await runBenchCheck({ dir: benchDir, log: () => {} });
  assert.equal(report.failures, 0);
});

test('runBenchAdd --from-commit rejects test-only and test-less commits', async (t) => {
  const { repo, buggyCommit, testOnlyCommit, fixCommit } = gitRepoWithFixHistory(t);
  const benchDir = await freezeBench(t);
  const base = { benchDir, sourceDir: repo, yes: true, log: () => {} };
  await assert.rejects(
    () => runBenchAdd({ ...base, fromCommit: testOnlyCommit }),
    /only test files/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, fromCommit: buggyCommit }),
    /no test files/,
  );
  await assert.rejects(
    () => runBenchAdd({ ...base, fromCommit: fixCommit, freeze: true, prompt: 'x', verifierCmd: 'y' }),
    /not both/,
  );
});

test('runBenchAdd --from-commit honors --include and dry-run', async (t) => {
  const { repo, fixCommit } = gitRepoWithFixHistory(t);
  const benchDir = await freezeBench(t);
  const { lines, log } = collector();
  const dry = await runBenchAdd({
    benchDir,
    fromCommit: fixCommit,
    sourceDir: repo,
    include: ['src'],
    dryRun: true,
    log,
  });
  assert.equal(dry, null);
  assert.ok(!existsSync(join(benchDir, 'fixtures', `fix-${fixCommit.slice(0, 7)}`)));
  const result = await runBenchAdd({
    benchDir,
    fromCommit: fixCommit,
    sourceDir: repo,
    include: ['src'],
    yes: true,
    log: () => {},
  });
  assert.ok(result);
  assert.ok(existsSync(join(benchDir, 'fixtures', result.taskId, 'src', 'add.js')));
  assert.ok(!existsSync(join(benchDir, 'fixtures', result.taskId, 'package.json')), 'include filters the fixture');
});

function makeCalibBench(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-calib-bench-');
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(
    join(dir, 'verifiers', 'ok.mjs'),
    `import fs from 'node:fs';\nconst out = fs.readFileSync(process.argv[2] + '/_output.md', 'utf8');\nprocess.exit(out.includes('ok') ? 0 : 1);\n`,
  );
  for (const id of ['easy-task', 'hard-task']) {
    mkdirSync(join(dir, 'fixtures', id), { recursive: true });
    writeFileSync(join(dir, 'fixtures', id, 'index.txt'), 'x\n');
    writeFileSync(join(dir, 'prompts', `${id}.md`), `${id} prompt: reply.\n`);
  }
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'calib',
      tasks: [
        { id: 'easy-task', fixture: 'fixtures/easy-task', prompt: 'prompts/easy-task.md', verifier: 'node verifiers/ok.mjs', shouldTrigger: true },
        { id: 'hard-task', fixture: 'fixtures/hard-task', prompt: 'prompts/hard-task.md', verifier: 'node verifiers/ok.mjs', shouldTrigger: true },
      ],
    }),
  );
  return dir;
}

test('runBenchCheck --calibrate bands tasks by real baseline pass rate', async (t) => {
  const dir = makeCalibBench(t);
  const executor = {
    describe: () => ({ kind: 'stub', model: 'stub' }),
    run: (prompt: string) => Promise.resolve({ output: prompt.includes('easy') ? 'ok done' : 'nope' }),
  };
  const report = await runBenchCheck({
    dir,
    calibrate: {
      executor,
      trials: 2,
      runsRoot: join(tmp(t, 'skillfit-calib-runs-'), 'runs'),
      runGroup: 'calib-group',
    },
    log: () => {},
  });
  assert.equal(report.failures, 0);
  assert.ok(
    report.checks.some(
      (c) => c.message.includes('easy-task: baseline 2/2') && c.message.includes('too easy'),
    ),
  );
  assert.ok(
    report.checks.some(
      (c) => c.message.includes('hard-task: baseline 0/2') && c.message.includes('too hard or broken'),
    ),
  );
  assert.ok(report.checks.some((c) => c.message.includes('0/2 task(s) in the discriminative band')));
});

test('runBenchCheck --calibrate requires an agent or executor', async (t) => {
  const dir = makeCalibBench(t);
  const report = await runBenchCheck({ dir, calibrate: {}, log: () => {} });
  assert.ok(report.checks.some((c) => c.status === 'FAIL' && c.message.includes('needs --agent')));
});

// Same shape as makeCalibBench but with no shouldTrigger labels. Calibration used to route
// through trigger mode, whose label filter dropped every task here and then reported PASS 0/0.
function makeUnlabelledCalibBench(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-calib-unlabelled-');
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  mkdirSync(join(dir, 'verifiers'), { recursive: true });
  writeFileSync(
    join(dir, 'verifiers', 'ok.mjs'),
    `import fs from 'node:fs';\nconst out = fs.readFileSync(process.argv[2] + '/_output.md', 'utf8');\nprocess.exit(out.includes('ok') ? 0 : 1);\n`,
  );
  for (const id of ['easy-task', 'hard-task']) {
    mkdirSync(join(dir, 'fixtures', id), { recursive: true });
    writeFileSync(join(dir, 'fixtures', id, 'index.txt'), 'x\n');
    writeFileSync(join(dir, 'prompts', `${id}.md`), `${id} prompt: reply.\n`);
  }
  writeFileSync(
    join(dir, 'bench.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'calib-unlabelled',
      tasks: [
        { id: 'easy-task', fixture: 'fixtures/easy-task', prompt: 'prompts/easy-task.md', verifier: 'node verifiers/ok.mjs' },
        { id: 'hard-task', fixture: 'fixtures/hard-task', prompt: 'prompts/hard-task.md', verifier: 'node verifiers/ok.mjs' },
      ],
    }),
  );
  return dir;
}

test('runBenchCheck --calibrate measures a bench with no shouldTrigger labels', async (t) => {
  const dir = makeUnlabelledCalibBench(t);
  const executor = {
    describe: () => ({ kind: 'stub', model: 'stub' }),
    run: (prompt: string) => Promise.resolve({ output: prompt.includes('easy') ? 'ok done' : 'nope' }),
  };
  const report = await runBenchCheck({
    dir,
    calibrate: {
      executor,
      trials: 2,
      runsRoot: join(tmp(t, 'skillfit-calib-runs-unlabelled-'), 'runs'),
      runGroup: 'calib-unlabelled-group',
    },
    log: () => {},
  });
  assert.equal(report.failures, 0);
  assert.ok(
    !report.checks.some((c) => c.message.includes('0/0 task(s) in the discriminative band')),
    'calibration must never report a 0/0 band summary',
  );
  assert.ok(
    report.checks.some(
      (c) => c.message.includes('easy-task: baseline 2/2') && c.message.includes('too easy'),
    ),
  );
  assert.ok(
    report.checks.some(
      (c) => c.message.includes('hard-task: baseline 0/2') && c.message.includes('too hard or broken'),
    ),
  );
  assert.ok(report.checks.some((c) => c.message.includes('0/2 task(s) in the discriminative band')));
});

test('runBenchCheck --calibrate fails loudly when no task produced a completed run', async (t) => {
  const dir = makeUnlabelledCalibBench(t);
  const executor = {
    describe: () => ({ kind: 'stub', model: 'stub' }),
    run: (): Promise<{ output: string }> =>
      Promise.reject(new Error('simulated executor failure')),
  };
  const report = await runBenchCheck({
    dir,
    calibrate: {
      executor,
      trials: 2,
      runsRoot: join(tmp(t, 'skillfit-calib-runs-allerr-'), 'runs'),
      runGroup: 'calib-allerr-group',
    },
    log: () => {},
  });
  // Errored runs are excluded from the rate, not counted as failures — and when that leaves
  // nothing measured, the summary must fail rather than claim a band it never observed.
  assert.ok(
    report.checks.some(
      (c) => c.status === 'WARN' && c.message.includes('no completed runs') && c.message.includes('2 executor error(s)'),
    ),
  );
  assert.ok(
    report.checks.some(
      (c) => c.status === 'FAIL' && c.message.includes('calibration ran 0 task(s)'),
    ),
  );
  assert.ok(
    !report.checks.some((c) => c.status === 'PASS' && c.message.includes('discriminative band')),
  );
});
