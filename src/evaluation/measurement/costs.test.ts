import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { renderCostLines, summarizeCosts, type CostObservation } from "./costs.js";
import { parseEvalReport, renderEvalMarkdown } from "../../cli/eval-report.js";

function run(input: number, passed = true, extra: Partial<CostObservation> = {}): CostObservation {
  return { executorInvoked: true, passed, error: null, durationSeconds: 5,
    tokens: { input, cachedInput: input / 2, output: 2 }, usageStatus: 'final', ...extra };
}

test('lower total tokens can cost more per success because graded failures consume usage', () => {
  const rows = { baseline: [run(10), run(10)], treatment: [run(8), run(8, false)] };
  const costs = summarizeCosts(rows, rows);
  const output = renderCostLines(costs).join('\n');
  assert.match(output, /Input tokens \| 20 \| 16 \| -20.0% \| 10.000 \/ 16.000 \| \+60.0%/);
  assert.equal(costs.attempts.treatment.passes, 1);
});

test('attempts retain timeout spending and the excluded successful partner; quality remains paired', () => {
  const b1 = run(10), t1 = run(8);
  const timeout = run(3, false, { error: 'timeout', durationSeconds: 600, usageStatus: 'partial' });
  const refused = run(0, false, { executorInvoked: false, error: 'guard refusal', tokens: null, usageStatus: 'unknown' });
  const costs = summarizeCosts({ baseline: [b1, run(10), refused], treatment: [t1, timeout, refused] }, { baseline: [b1], treatment: [t1] });
  assert.equal(costs.paired.baseline.runs, 1);
  assert.equal(costs.attempts.baseline.passes, 2);
  assert.equal(costs.attempts.treatment.metrics.input.knownTotal, 11);
  assert.deepEqual(costs.attempts.treatment.metrics.input.coverage, { final: 1, partial: 1, unknown: 0 });
  assert.equal(costs.attempts.treatment.metrics.durationSeconds.knownTotal, 605);
  assert.equal(costs.notInvoked.treatment, 1);
  const output = renderCostLines(costs).join('\n');
  assert.match(output, /Input tokens \| 20 \| >= 11 \| n\/a \| 10.000 \/ >= 11.000 \| n\/a/);
  assert.match(output, /Elapsed seconds \| 10.000 \| 605.000 \| \+5950.0%/);
});

test('zero cache counts are known, missing or invalid partitions remain unknown', () => {
  const rows = { baseline: [run(10, true, { tokens: { input: 10, cachedInput: 0 } })],
    treatment: [run(10, true, { tokens: { input: 10, cachedInput: 11 } })] };
  const costs = summarizeCosts(rows, rows);
  assert.equal(costs.paired.baseline.metrics.uncachedInput.knownTotal, 10);
  assert.equal(costs.paired.baseline.metrics.cachedInput.coverage.final, 1);
  assert.equal(costs.paired.treatment.metrics.cachedInput.coverage.unknown, 1);
  assert.equal(costs.paired.treatment.metrics.uncachedInput.coverage.unknown, 1);
  assert.match(renderCostLines(costs).join('\n'), /Cached input tokens \| 0 \| unrecorded \| n\/a/);
});

test('missing timeout usage and no successes suppress cost ratios without inventing zero cost', () => {
  const timeout = run(0, false, { error: 'timeout', tokens: null, usageStatus: 'unknown', durationSeconds: 600 });
  const costs = summarizeCosts({ baseline: [run(0)], treatment: [timeout] }, { baseline: [], treatment: [] });
  const output = renderCostLines(costs).join('\n');
  assert.match(output, /Input tokens \| 0 \| unrecorded \| n\/a \| 0.000 \/ n\/a \(no successes\)/);
  assert.equal(costs.attempts.treatment.metrics.input.coverage.unknown, 1);
  assert.equal(costs.attempts.treatment.metrics.durationSeconds.coverage.final, 1);
});

test('published real Skill revision receipts reproduce cost regressions and unknown timeout usage offline', () => {
  const root = join(fileURLToPath(new URL("../../..", import.meta.url)), 'tools/verify/fixtures/history');
  const analysis = JSON.parse(readFileSync(join(root, 'cost-analysis.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.experiment.callsStarted, 30);
  const originalQuality = JSON.stringify(manifest.overall);
  type RecordedArm = { passed: boolean; error: string | null; seconds: number; input: number | null; output: number | null; cachedInput: number | null };
  type Pair = { task: string; graded: boolean; baseline: RecordedArm; treatment: RecordedArm };
  const observation = (row: Pair['baseline']): CostObservation => ({
    executorInvoked: true, passed: row['passed'], error: row['error'], durationSeconds: row['seconds'],
    usageStatus: row['input'] === null && row['output'] === null ? 'unknown' : 'final',
    tokens: {
      ...(row['input'] === null ? {} : { input: row['input'] }),
      ...(row['output'] === null ? {} : { output: row['output'] }),
      ...(row['cachedInput'] === null ? {} : { cachedInput: row['cachedInput'] }),
    },
  });
  const summarize = (pairs: Pair[]) => {
    const arms = (rows: Pair[]) => ({ baseline: rows.map(r => observation(r.baseline)), treatment: rows.map(r => observation(r.treatment)) });
    return summarizeCosts(arms(pairs), arms(pairs.filter(r => r.graded)));
  };
  const costs = summarize(analysis.observations);
  for (const metric of ['input', 'cachedInput', 'uncachedInput', 'output'] as const) {
    for (const arm of ['baseline', 'treatment'] as const) assert.equal(costs.paired[arm].metrics[metric].knownTotal, analysis.metrics[metric].totals[arm]);
  }
  assert.equal(costs.attempts.baseline.passes, 15);
  assert.equal(costs.attempts.treatment.passes, 12);
  assert.equal(costs.attempts.treatment.metrics.input.coverage.unknown, 1);
  assert.equal(costs.attempts.treatment.metrics.durationSeconds.coverage.final, 15);
  for (const task of manifest.tasks) task.costs = summarize(analysis.observations.filter((row: Pair) => row.task === task.id));
  manifest.overall.costs = costs;
  const output = renderEvalMarkdown(parseEvalReport(manifest));
  assert.match(output, /Input tokens \| 5257320 \| 3890644 \| -26.0%/);
  assert.match(output, /Uncached input tokens.*\+6.5%/);
  assert.match(output, /Output tokens.*\+5.4%/);
  assert.match(output, /Elapsed seconds.*\+4.5%/);
  assert.match(output, /Elapsed seconds.*\+17.5%/);
  assert.match(output, /15\/0\/0 \/ 14\/0\/1/);
  delete manifest.overall.costs;
  assert.equal(JSON.stringify(manifest.overall), originalQuality, 'descriptive accounting leaves quality untouched');
});
