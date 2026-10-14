// Read-only analysis of a completed real experiment; no agent or verifier calls.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseEvalReport } from '../dist/commands/eval-report.js';
import { pairedScoreBootstrapCI } from '../dist/harness/stats.js';

const manifestPath = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass a completed revision manifest path.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
parseEvalReport(manifest);
if (!manifest.baselineTarget || manifest.experiment?.status !== 'completed') throw new Error('A completed Skill revision study is required.');
const root = dirname(manifestPath);
const records = [];
for (const task of manifest.tasks) {
  for (let trial = 1; trial <= manifest.trials; trial++) {
    const pair = {};
    for (const arm of ['baseline', 'treatment']) {
      const dir = join(root, task.id, arm, `trial-${trial}`);
      const receipt = JSON.parse(readFileSync(join(dir, '_result.json'), 'utf8'));
      const usage = readFileSync(join(dir, '_transcript.jsonl'), 'utf8').split('\n').filter(Boolean)
        .map(line => JSON.parse(line)).filter(event => event.type === 'turn.completed').map(event => event.usage);
      const cached = usage.length && usage.every(value => Number.isFinite(value?.cached_input_tokens))
        ? usage.reduce((total, value) => total + value.cached_input_tokens, 0) : null;
      if (cached !== null && cached > receipt.tokens?.input) throw new Error('Cached input contradicts recorded total input.');
      pair[arm] = { passed: receipt.passed, score: receipt.score, error: receipt.error,
        input: receipt.tokens?.input ?? null, output: receipt.tokens?.output ?? null,
        cachedInput: cached, uncachedInput: cached === null || receipt.tokens?.input === undefined ? null : receipt.tokens.input - cached,
        seconds: receipt.durationSeconds, readObserved: receipt.skillTriggered ?? null };
    }
    records.push({ task: task.id, trial, ...pair, graded: pair.baseline.error === null && pair.treatment.error === null });
  }
}
const graded = records.filter(record => record.graded);
const metrics = {};
for (const field of ['input', 'output', 'cachedInput', 'uncachedInput', 'seconds']) {
  const available = graded.filter(record => record.baseline[field] !== null && record.treatment[field] !== null);
  const sums = Object.fromEntries(['baseline', 'treatment'].map(arm => [arm, available.reduce((sum, record) => sum + record[arm][field], 0)]));
  const tasks = manifest.tasks.map(task => {
    const rows = available.filter(record => record.task === task.id);
    return Object.fromEntries(['baseline', 'treatment'].map(arm => [arm, rows.map(record => record[arm][field])]));
  });
  metrics[field] = { pairs: available.length, totals: sums,
    meanDelta: available.length ? (sums.treatment - sums.baseline) / available.length : null,
    percentDelta: sums.baseline ? 100 * (sums.treatment - sums.baseline) / sums.baseline : null,
    exploratoryTaskBootstrapCi: pairedScoreBootstrapCI(tasks, { seed: 20261012, resamples: 2000 }) };
}
console.log(JSON.stringify({ schemaVersion: 1, runGroup: manifest.runGroup,
  taskCount: manifest.tasks.length, gradedPairs: graded.length, declaredPairs: records.length,
  method: 'Paired costs on surviving graded pairs, task resampling unit, seed 20261012, 2000 resamples. Three related tasks give limited uncertainty coverage. No monetary or billing inference.',
  metrics, observations: records }, null, 2));
