// Offline replay of saved deliverables. No model, agent CLI or network calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBench } from '../dist/harness/bench.js';
import { runVerifier } from '../dist/harness/runner.js';
import { verdictFromOutput } from '../dist/harness/verifier-summary.js';

if (!process.argv[2]) throw new Error('Pass the saved calibration or validation run-group directory.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runRoot = resolve(process.argv[2]);
const declaration = JSON.parse(readFileSync(join(root, 'evidence/plans/2026-10-12-diagnosing-revision.json'), 'utf8'));
const bench = loadBench(join(root, declaration.bench.path));
assert.equal(bench.contentSha256, declaration.bench.sha256, 'Pinned benchmark changed.');
const plan = JSON.parse(readFileSync(join(runRoot, '_plan.json'), 'utf8'));
const mode = plan.details.mode;
assert.ok(mode === 'calibration' || mode === 'installed', 'Unsupported saved run mode.');
const arms = mode === 'calibration' ? ['baseline'] : ['baseline', 'treatment'];
const trials = mode === 'calibration' ? declaration.calibration.trials : declaration.validation.trials;
const rows = [];
for (const task of bench.tasks) {
  for (let trial = 1; trial <= trials; trial++) {
    for (const arm of arms) {
      const dir = join(runRoot, task.id, arm, `trial-${trial}`);
      const receipt = JSON.parse(readFileSync(join(dir, '_result.json'), 'utf8'));
      if (receipt.error !== null) {
        rows.push({ task: task.id, arm, trial, excluded: true, error: receipt.error });
        continue;
      }
      const result = await runVerifier(bench.dir, task.verifier, dir);
      const verdict = verdictFromOutput(result.output);
      assert.notEqual(result.exitCode, null, `Verifier unavailable: ${task.id}/${arm}/${trial}: ${result.error}`);
      assert.ok(verdict, 'Verifier did not emit scored checks.');
      assert.equal(result.exitCode, receipt.verifierExitCode, 'Saved exit code differs from offline replay.');
      assert.equal(result.exitCode === 0, receipt.passed, 'Saved pass/fail differs from offline replay.');
      assert.equal(verdict.score, receipt.score, 'Saved score differs from offline replay.');
      assert.deepEqual(verdict.checks?.map(({ name, pass }) => ({ name, pass })),
        receipt.checks?.map(({ name, pass }) => ({ name, pass })), 'Saved facets differ from offline replay.');
      rows.push({ task: task.id, arm, trial, excluded: false, matched: true,
        passed: result.exitCode === 0, score: verdict.score });
    }
  }
}
console.log(JSON.stringify({ schemaVersion: 1, mode, benchSha256: bench.contentSha256,
  matched: rows.filter(row => row.matched).length,
  excluded: rows.filter(row => row.excluded).length, rows }, null, 2));
