import assert from 'node:assert/strict';
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadBench } from '../../dist/bench/read.js';
import { runVerifier } from '../../dist/evaluation/execution/paired.js';
import { hashFileSet, listFilesRecursive, sha256File } from '../../dist/shared/hash.js';
const root = fileURLToPath(new URL('../../', import.meta.url)), args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--out'), 'Use no arguments or --out <new-json-file>');
const output = args.length ? resolve(args[1]) : null;
if (output) assert.equal(existsSync(output), false, 'Never replace a published verification record');
console.error(JSON.stringify({ kind: 'offline-readiness-plan', modelCalls: 0, tasks: 8, budgetExecutors: 'injected mock only', temporaryCopiesOnly: true, output }));
const benchPath = join(root, 'benches/contrib/oss-skill-independent'), bench = loadBench(benchPath);
const proposal = JSON.parse(readFileSync(join(root, 'tools/verify/fixtures/history/independent-inputs.json'), 'utf8'));
assert.deepEqual(bench.tasks.map(task => task.id), proposal.tasks.map(task => task.id));
const scratch = mkdtempSync(join(tmpdir(), 'skillfit-independent-readiness-')), tasks = [];
try {
  for (const task of bench.tasks) {
    const original = join(scratch, task.id, 'original'), fixed = join(scratch, task.id, 'fixed');
    cpSync(join(benchPath, task.fixture), original, { recursive: true }); cpSync(join(benchPath, task.fixture), fixed, { recursive: true });
    copyFileSync(join(benchPath, 'ground-truth', task.id, 'regression.test.mjs'), join(original, 'regression.test.mjs'));
    const oracle = spawnSync(process.execPath, [join(benchPath, 'ground-truth/oracle-' + task.id + '.mjs'), fixed], { encoding: 'utf8', timeout: 5000 });
    assert.equal(oracle.status, 0, oracle.stderr);
    const grades = [];
    for (const directory of [original, fixed]) {
      const result = await runVerifier(benchPath, task.verifier, directory);
      assert.notEqual(result.exitCode, null, result.output);
      const grade = JSON.parse(result.output.trim().split('\n').at(-1));
      assert.equal(grade.checks.length, 6); assert.equal(grade.passed, result.exitCode === 0);
      grades.push({ exitCode: result.exitCode, ...grade });
    }
    const [before, reference] = grades;
    assert.equal(before.exitCode, 1); assert.equal(before.checks[0].pass, true);
    assert.ok(before.checks.slice(1, 5).some(row => !row.pass), 'Original must reproduce a behavior failure even with the same regression supplied');
    assert.equal(reference.exitCode, 0); assert.ok(reference.checks.every(row => row.pass));
    assert.ok(reference.evidence.some(row => row.caseWitnesses.length));
    const selected = proposal.tasks.find(row => row.id === task.id);
    tasks.push({ id: task.id, repository: selected.repository, beforeCommit: selected.before, fixCommit: selected.upstreamFix,
      fixtureBytes: listFilesRecursive(join(benchPath, task.fixture)).reduce((sum, path) => sum + statSync(join(benchPath, task.fixture, path)).size, 0),
      sameRegressionSha256: sha256File(join(original, 'regression.test.mjs')), original: before, maintainer: reference });
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
const reporter = pathToFileURL(join(benchPath, 'verifiers/test-reporter.mjs')).href;
const suites = [];
for (const file of ['dist/evaluation/execution/budget.test.js', 'tools/verify/independent-offline.test.mjs']) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=' + reporter, file], { cwd: root, encoding: 'utf8', timeout: 120000, env });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const evidence = JSON.parse(result.stdout.trim()); assert.equal(evidence.summary.success, true);
  assert.equal(evidence.summary.counts.failed, 0); assert.equal(evidence.summary.counts.skipped, 0); assert.equal(evidence.summary.counts.cancelled, 0);
  suites.push({ file, counts: evidence.summary.counts, checks: evidence.records.filter(row => row.registered && row.leaf).map(row => ({ name: row.path.join(' > '), pass: row.pass })) });
}
const sources = ['src/evaluation/execution/budget.ts', 'src/evaluation/execution/budget.test.ts', 'src/evaluation/application/request.ts', 'src/evaluation/execution/paired.ts', 'src/evaluation/records/audit.ts',
  'src/cli/eval.ts', 'src/cli/eval-component.ts', 'docs/schemas/eval-request.schema.json', 'tools/history/check-independent-readiness.mjs', 'tools/verify/independent-offline.test.mjs'];
const proof = { schemaVersion: 1, kind: 'skillfit.independent-offline-readiness', at: new Date().toISOString(), nodeVersion: process.version,
  realModelCalls: 0, authorizedFutureModelCalls: 0, actualStudyLedgerCalls: 182, previousMissingFinalUsages: 7,
  status: 'offline-gates-passed-awaiting-user-decision', benchSha256: bench.contentSha256,
  compiledRuntimeSha256: hashFileSet(join(root, 'dist'), listFilesRecursive(join(root, 'dist'))),
  sources: sources.map(path => ({ path, sha256: sha256File(join(root, path)) })), tasks, suites,
  budgetLimits: JSON.parse(readFileSync(join(root, 'tools/verify/fixtures/history/independent-budget.json'), 'utf8')).proposedStopLines,
  budgetScope: 'Synthetic injected executors only; before/after events and exact supplied counters. No new model quality, monetary bill or timing improvement.',
  pending: ['User decision and fresh real-call authorization', 'Execution-specific environment/power checks and frozen preview after any source/configuration change'],
  automaticExpansion: false, eligibleForUpgrade: false, automaticUpgrade: false };
if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' }); }
console.log(JSON.stringify(proof, null, 2));
