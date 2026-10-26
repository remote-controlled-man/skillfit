import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchCheck, runBenchInit } from "./bench.js";
import { benchCheckJson, benchDiagnostic } from "./bench-check-report.js";
import { MOCK_MARKER_FILE } from '../bench/constants.js';

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI = join(ROOT, 'dist/cli.js');
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'docs/schemas/bench-check.schema.json'), 'utf8'));

async function scaffold(t: TestContext, kind: 'command' | 'output' = 'command') {
  const cwd = mkdtempSync(join(tmpdir(), 'skillfit-check-json-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const dir = join(cwd, 'my bench');
  await runBenchInit({ dir, kind, yes: true, log: () => {} });
  return { cwd, dir };
}

function cli(cwd: string, args: string[], expectedExit: number, env = process.env) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', timeout: 30_000, env });
  assert.equal(result.status, expectedExit, result.stderr || result.stdout);
  assert.equal(result.stderr, '', 'JSON commands must not leak human logs to stderr');
  // Parsing the complete stdout also rejects prefixes, trailers, and multiple JSON documents.
  const data = JSON.parse(result.stdout);
  const expectedKeys = [...SCHEMA.required, ...(data.bench ? ['measurementScope'] : [])];
  assert.deepEqual(Object.keys(data).sort(), expectedKeys.sort(), 'loaded benches include the new optional scope; failures retain the legacy envelope');
  if (data.bench) {
    assert.equal(data.measurementScope.schemaVersion, 1);
    assert.equal(data.measurementScope.requestedClaim, null);
    assert.equal(data.measurementScope.assessment, 'not-applicable');
  }
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.kind, 'skillfit.bench-check');
  assert.equal(data.scope, 'offline-integrity');
  if (data.summary) {
    for (const [field, status] of [['passed', 'PASS'], ['warnings', 'WARN'], ['failures', 'FAIL'], ['info', 'INFO']]) {
      assert.equal(data.summary[field!], data.checks.filter((c: { status: string }) => c.status === status).length);
    }
    assert.equal(data.summary.total, data.checks.length);
    for (const check of data.checks) {
      const item = SCHEMA.properties.checks.items;
      assert.deepEqual(Object.keys(check).sort(), [...item.required].sort());
      assert.ok(item.properties.code.enum.includes(check.code), 'gate code is documented in the schema');
      assert.ok(item.properties.status.enum.includes(check.status));
      if (check.evidence) {
        assert.deepEqual(Object.keys(check.evidence).sort(), [...item.properties.evidence.required].sort());
        assert.ok(check.evidence.output.length <= item.properties.evidence.properties.output.maxLength);
      }
      assert.ok(check.code && check.message && check.location.path);
      if (check.status === 'WARN' || check.status === 'FAIL') assert.ok(check.remediation);
      else assert.equal(check.remediation, null);
    }
  }
  assert.ok(!existsSync(join(cwd, 'runs')), 'offline JSON checks must not create evaluation runs');
  return data;
}

test('bench check JSON preserves human gate outcomes, task identity and input fingerprints', async t => {
  const { cwd, dir } = await scaffold(t);
  const human: string[] = [];
  const report = await runBenchCheck({ dir, log: line => human.push(line) });
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 0);
  assert.equal(data.status, 'passed');
  assert.equal(data.dir, dir);
  assert.equal(data.error, null);
  assert.equal(data.bench.taskCount, 1);
  assert.match(data.bench.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(data.bench, report.bench);
  assert.deepEqual(data.measurementScope, report.measurementScope);
  assert.equal(data.measurementScope.benchSchemaVersion, 1);
  assert.deepEqual(data.measurementScope.taskClaims, [{ taskId: 'example-task', claims: null }]);
  assert.deepEqual(data.checks.map((c: { code: string; status: string; message: string }) => [c.code, c.status, c.message]),
    report.checks.map(c => [c.code, c.status, c.message]));
  assert.equal(human.filter(line => line.startsWith('[')).length, data.summary.total);
  const nop = data.checks.find((c: { code: string }) => c.code === 'UNTOUCHED_FIXTURE');
  assert.equal(nop.taskId, 'example-task');
  assert.deepEqual(nop.location, { path: 'bench.json', field: 'tasks[].verifier' });
  assert.equal(nop.evidence.exitCode, 1, 'a failing untouched fixture is a passing integrity gate');
  assert.equal(nop.status, 'PASS');
  assert.equal(data.checks.find((c: { code: string }) => c.code === 'ORACLE').evidence.exitCode, 0);
});

test('warnings, output probes, mock arms and negative controls remain distinct in JSON', async t => {
  const { cwd, dir } = await scaffold(t, 'output');
  const path = join(dir, 'bench.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.tasks[0].shouldTrigger = true;
  manifest.tasks.push({ ...manifest.tasks[0], id: 'negative-task', shouldTrigger: false });
  writeFileSync(path, JSON.stringify(manifest));
  const data = cli(cwd, ['--json', 'bench', 'check', dir], 0);
  assert.equal(data.status, 'passed');
  assert.ok(data.summary.warnings > 0, 'facet-count warnings must not disappear or become failures');
  for (const id of ['example-task', 'negative-task']) {
    for (const code of ['MISSING_OUTPUT', 'EMPTY_OUTPUT', 'FACET_COUNT', 'ORACLE', 'MOCK_BASELINE', 'MOCK_TREATMENT', 'FIXTURE_SIZE']) {
      assert.ok(data.checks.some((c: { code: string; taskId: string }) => c.code === code && c.taskId === id), `${id}: ${code}`);
    }
  }
  const negative = data.checks.find((c: { code: string }) => c.code === 'NEGATIVE_CONTROLS');
  assert.equal(negative.status, 'PASS');
  assert.equal(negative.taskId, null);
});

test('missing, malformed and missing-reference benches produce structured validation failures', async t => {
  const { cwd, dir } = await scaffold(t);
  for (const [name, contents] of [['missing', null], ['malformed', '{'], ['missing-reference', '{"schemaVersion":1,"tasks":[{"id":"bad","fixture":"absent","prompt":"p.md","verifier":"node v.mjs"}]}']] as const) {
    await t.test(name, () => {
      if (contents === null) rmSync(join(dir, 'bench.json'));
      else writeFileSync(join(dir, 'bench.json'), contents);
      const data = cli(cwd, ['bench', 'check', dir, '--json'], 1);
      assert.equal(data.status, 'failed');
      assert.equal(data.bench, null);
      assert.equal(data.summary.failures, 1);
      assert.equal(data.checks[0].code, 'BENCH_LOAD');
      assert.equal(data.checks[0].location.path, 'bench.json');
      assert.match(data.checks[0].message, /bench does not load/);
    });
  }
});

test('JSON warnings and marker failures identify the affected bench fields and fixture paths', async t => {
  const { cwd, dir } = await scaffold(t, 'output');
  const path = join(dir, 'bench.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  delete manifest.tasks[0].oracle;
  manifest.tasks[0].shouldTrigger = true;
  writeFileSync(path, JSON.stringify(manifest));
  writeFileSync(join(dir, 'fixtures/example-task/large.txt'), 'x'.repeat(66 * 1024));
  const warnings = cli(cwd, ['bench', 'check', dir, '--json'], 0);
  const oracle = warnings.checks.find((c: { code: string }) => c.code === 'ORACLE');
  assert.equal(oracle.status, 'WARN');
  assert.equal(oracle.location.field, 'tasks[].oracle');
  assert.equal(oracle.evidence, null);
  const size = warnings.checks.find((c: { code: string }) => c.code === 'FIXTURE_SIZE');
  assert.equal(size.status, 'WARN');
  assert.equal(size.location.path, 'fixtures/example-task');
  assert.equal(warnings.checks.find((c: { code: string }) => c.code === 'NEGATIVE_CONTROLS').status, 'WARN');
  writeFileSync(join(dir, 'fixtures/example-task', MOCK_MARKER_FILE), '{');
  const failed = cli(cwd, ['bench', 'check', dir, '--json'], 1);
  const marker = failed.checks.find((c: { code: string }) => c.code === 'MOCK_MARKER');
  assert.equal(marker.status, 'FAIL');
  assert.equal(marker.taskId, 'example-task');
  assert.equal(marker.location.path, `fixtures/example-task/${MOCK_MARKER_FILE}`);
});

test('JSON identifies a failed oracle process and retains its real command, exit and stderr', async t => {
  const { cwd, dir } = await scaffold(t);
  writeFileSync(join(dir, 'ground-truth/oracle-example-task.mjs'), "console.error('reference unavailable'); process.exit(7);");
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 1);
  const gate = data.checks.find((c: { code: string }) => c.code === 'ORACLE');
  assert.equal(gate.status, 'FAIL');
  assert.equal(gate.taskId, 'example-task');
  assert.equal(gate.evidence.command, 'node ground-truth/oracle-example-task.mjs');
  assert.equal(gate.evidence.exitCode, 7);
  assert.match(gate.evidence.output, /reference unavailable/);
});

test('JSON exposes the actual failing verifier facets after the reference repair', async t => {
  const { cwd, dir } = await scaffold(t);
  writeFileSync(join(dir, 'ground-truth/oracle-example-task.mjs'),
    "import {writeFileSync} from 'node:fs';import {join} from 'node:path';writeFileSync(join(process.argv[2],'index.js'),'export const add=(a,b)=>Math.abs(a+b);');");
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 1);
  const gate = data.checks.find((c: { code: string }) => c.code === 'ORACLE');
  assert.equal(gate.status, 'FAIL');
  assert.equal(gate.evidence.command, 'node verifiers/example-task.mjs');
  assert.ok(gate.evidence.checks.some((c: { name: string; pass: boolean }) => c.name === 'negative-numbers' && !c.pass));
  assert.ok(gate.evidence.checks.some((c: { name: string; pass: boolean }) => c.name === 'positive-and-zero' && c.pass));
  const verifier = join(dir, 'verifiers/example-task.mjs');
  writeFileSync(verifier, readFileSync(verifier, 'utf8').replace('process.exitCode = passed ? 0 : 1', 'process.exitCode = 0'));
  const inconsistent = cli(cwd, ['bench', 'check', dir, '--json'], 1);
  const lowScore = inconsistent.checks.find((c: { code: string }) => c.code === 'ORACLE');
  assert.equal(lowScore.status, 'FAIL', 'an oracle must pass every named check even when exit code is zero');
  assert.equal(lowScore.evidence.exitCode, 0);
  assert.match(lowScore.message, /checks are stricter/);
});

test('an unspawnable verifier is a JSON failure with an unknown exit, never a passing NOP gate', async t => {
  const { cwd, dir } = await scaffold(t);
  const path = join(dir, 'bench.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.tasks[0].verifier = 'skillfit-no-such-verifier';
  writeFileSync(path, JSON.stringify(manifest));
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 1);
  const gate = data.checks.find((c: { code: string }) => c.code === 'UNTOUCHED_FIXTURE');
  assert.equal(gate.status, 'FAIL');
  assert.equal(gate.evidence.exitCode, null);
  assert.ok(gate.evidence.error);
  assert.match(gate.message, /could not be started/);
});

test('noisy verifier output stays inside bounded JSON evidence while named facets are retained', async t => {
  const { cwd, dir } = await scaffold(t);
  const path = join(dir, 'verifiers/example-task.mjs');
  writeFileSync(path, "console.log('x'.repeat(10_000));console.error('verifier diagnostic');\n" + readFileSync(path, 'utf8'));
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 0);
  const evidence = data.checks.find((c: { code: string }) => c.code === 'ORACLE').evidence;
  assert.equal(evidence.outputTruncated, true);
  assert.ok(evidence.output.length <= 8192);
  assert.equal(evidence.checks.length, 4);
  assert.ok(evidence.checks.every((c: { pass: boolean }) => c.pass));
});

test('argument errors return offline bench JSON before any verifier or agent starts', async t => {
  const { cwd, dir } = await scaffold(t);
  const sentinel = join(cwd, 'verifier-started');
  writeFileSync(join(dir, 'verifiers/example-task.mjs'),
    `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)},'unexpected'); process.exit(1);`);
  const cases = [
    ['--json', 'bench', 'check', dir, '--trials', 'nope'],
    ['bench', '--json', 'check', dir, '--unknown-option'],
    ['bench', 'check', dir, '--json', '--trials'],
    ['bench', 'check', dir, '--json=true'],
  ];
  for (const args of cases) {
    const data = cli(cwd, args, 2);
    assert.equal(data.status, 'error');
    assert.equal(data.summary, null);
    assert.equal(data.error.code, 'INVALID_OR_FAILED_CHECK');
    assert.ok(data.error.message);
    assert.deepEqual(data.checks, []);
    assert.ok(!existsSync(sentinel));
  }
});

test('JSON calibration has a distinct planned/error contract and never runs probes without confirmation', async t => {
  const { cwd, dir } = await scaffold(t);
  const sentinel = join(cwd, 'verifier-started');
  writeFileSync(join(dir, 'verifiers/example-task.mjs'),
    `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'unexpected');process.exit(1);`);
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH')),
    PATH: '', HOME: join(cwd, 'home'), USERPROFILE: join(cwd, 'home'), CODEX_HOME: join(cwd, 'home/codex') };
  for (const dryRun of [false, true]) {
    const result = spawnSync(process.execPath, [CLI, 'bench', 'check', dir, '--json', '--calibrate', '--agent', 'codex',
      ...(dryRun ? ['--dry-run'] : [])], { cwd, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, dryRun ? 0 : 2, result.stderr || result.stdout);
    assert.equal(result.stderr, '');
    const data = JSON.parse(result.stdout);
    assert.equal(data.kind, dryRun ? 'skillfit.calibration-result' : 'skillfit.eval-error');
    assert.equal(data.status, dryRun ? 'planned' : 'error');
    assert.equal(data.acceptance.eligibleForUpgrade, false);
    if (dryRun) assert.equal(data.plan.agentPreflight.status, 'blocked');
    else assert.match(data.error.message, /requires --plan-sha/);
    assert.ok(!existsSync(sentinel)); assert.ok(!existsSync(join(cwd, 'runs')));
  }
});

test('unexpected local execution errors cannot be mistaken for a completed JSON validation', async t => {
  const { cwd, dir } = await scaffold(t);
  const absent = join(cwd, 'missing-temp-root');
  const data = cli(cwd, ['bench', 'check', dir, '--json'], 2,
    { ...process.env, TMPDIR: absent, TEMP: absent, TMP: absent });
  assert.equal(data.status, 'error');
  assert.equal(data.summary, null);
  assert.ok(data.error.message);
});

test('offline JSON formatter refuses calibration records', () => {
  assert.throws(() => benchCheckJson({ dir: '.', bench: null, failures: 0, warnings: 0,
    checks: [benchDiagnostic('CALIBRATION', 'INFO', 'calibration record')] }), /must be offline/);
});
