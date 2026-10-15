// Read-only proposal audit: saved usage arithmetic; optionally verify public archives.
// No agent CLI, model API, dependency install or network access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--verify-archives'), 'Use no arguments or --verify-archives');
const load = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = load('docs/plans/2026-10-15-independent-comparison-inputs.json');
const budget = load('docs/plans/2026-10-15-independent-comparison-budget.json');
assert.equal(inputs.authorizedModelCalls, 0);
assert.equal(inputs.tasks.length, 8);
assert.equal(new Set(inputs.tasks.map(task => task.id)).size, 8);
assert.ok(inputs.tasks.every(task => !inputs.independence.previouslyScheduledTaskIds.includes(task.id)));
assert.equal(inputs.plannedCalls, 2 * inputs.tasks.length * inputs.trialsPerArm);
assert.equal(inputs.plannedCalls, 80);
assert.equal(budget.samples.length, 130);
assert.equal(budget.samples.filter(row => row.arm === 'baseline').length, 65);
assert.equal(budget.samples.filter(row => row.arm === 'treatment').length, 65);
const metrics = ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds'];
for (const row of budget.samples) {
  assert.equal(row.input, row.cachedInput + row.uncachedInput);
  for (const metric of metrics) assert.ok(Number.isFinite(row[metric]) && row[metric] >= 0);
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const base = {}, marginalStress = {};
for (const metric of metrics) {
  const groups = ['baseline', 'treatment'].map(arm => budget.samples.filter(row => row.arm === arm).map(row => row[metric]).sort((a, b) => a - b));
  base[metric] = groups.reduce((sum, values) => sum + 40 * values.reduce((a, b) => a + b, 0) / values.length, 0);
  marginalStress[metric] = 40 * 1.25 * groups.reduce((sum, values) => sum + values[Math.ceil(0.9 * values.length) - 1], 0);
  close(base[metric], budget.projection.base80[metric]);
  close(marginalStress[metric], budget.projection.marginalStress80[metric]);
}
const stress = { ...marginalStress, input: marginalStress.cachedInput + marginalStress.uncachedInput };
for (const metric of metrics) close(stress[metric], budget.projection.partitionConsistentStress80[metric]);
close(base.input, base.cachedInput + base.uncachedInput);
assert.equal(stress.input, stress.cachedInput + stress.uncachedInput);
let sourceRecordsVerified = 0;
if (process.argv[2] === '--verify-archives') {
  // Plan: check archive hashes first, extract into a new owned temporary directory,
  // read only result JSON, verify counters, and remove only that temporary copy.
  for (const source of budget.sources) assert.equal(sha256(join(root, source.path)), source.sha256, source.path);
  const temporary = mkdtempSync(join(tmpdir(), 'skillfit-proposal-cost-'));
  try {
    for (const source of budget.sources) {
      const destination = join(temporary, source.id);
      mkdirSync(destination);
      execFileSync('tar', ['-xzf', join(root, source.path), '-C', destination]);
      for (const row of budget.samples.filter(row => row.cohort === source.id)) {
        const recordPath = resolve(destination, row.recordPath);
        assert.ok(recordPath.startsWith(destination + sep));
        assert.equal(sha256(recordPath), row.recordSha256);
        const record = JSON.parse(readFileSync(recordPath, 'utf8'));
        assert.equal(record.executorInvoked, true);
        assert.equal(record.error, null);
        assert.equal(record.usageStatus, 'final');
        for (const metric of ['input', 'cachedInput', 'output']) assert.equal(record.tokens[metric], row[metric]);
        assert.equal(record.durationSeconds, row.durationSeconds);
        sourceRecordsVerified++;
      }
    }
    assert.equal(sourceRecordsVerified, 130);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ modelCalls: 0, authorizedModelCalls: 0, proposedCalls: inputs.plannedCalls, tasks: inputs.tasks.length, forecastSamples: budget.samples.length, sourceRecordsVerified, base80: base, stress80: stress, status: 'proposal-not-executed' }, null, 2));
