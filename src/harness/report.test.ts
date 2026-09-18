import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildWarnings,
  formatDeltaPp,
  formatPassRate,
  renderSummary,
  verdictFor,
  type RunManifest,
  type TaskSummary,
} from './report.js';

function stats(passes: number, trials: number) {
  return { passes, trials, passRate: passes / trials, tokens: null };
}

function taskSummary(id: string, baselinePasses: number, treatmentPasses: number, trials: number): TaskSummary {
  const baseline = stats(baselinePasses, trials);
  const treatment = stats(treatmentPasses, trials);
  const { verdict, reason } = verdictFor(baseline.passRate, treatment.passRate, trials);
  return {
    id,
    conditions: { baseline, treatment },
    deltaPassRate: treatment.passRate - baseline.passRate,
    tokenDelta: null,
    verdict,
    verdictReason: reason,
    judge: null,
  };
}

function manifestWith(tasks: TaskSummary[], executorKind = 'mock'): Omit<RunManifest, 'warnings'> {
  const trials = tasks[0]?.conditions.baseline.trials ?? 0;
  const totalPasses = (condition: 'baseline' | 'treatment') =>
    tasks.reduce((sum, task) => sum + task.conditions[condition].passes, 0);
  const totalTrials = tasks.reduce((sum, task) => sum + task.conditions.baseline.trials, 0);
  const baseline = stats(totalPasses('baseline'), totalTrials);
  const treatment = stats(totalPasses('treatment'), totalTrials);
  const { verdict, reason } = verdictFor(baseline.passRate, treatment.passRate, trials);
  return {
    schemaVersion: 1,
    runGroup: 'g',
    createdAt: '2026-09-19T00:00:00.000Z',
    skill: { name: 's', sourceDir: '/s', bundleSha256: 'a'.repeat(64), files: ['SKILL.md'] },
    bench: { name: 'b', dir: '/b', contentSha256: 'b'.repeat(64), taskCount: tasks.length },
    executor: { kind: executorKind, model: executorKind },
    judge: null,
    trials,
    tasks,
    overall: {
      conditions: { baseline, treatment },
      deltaPassRate: treatment.passRate - baseline.passRate,
      tokenDelta: null,
      verdict,
      verdictReason: reason,
    },
  };
}

test('verdictFor requires at least 3 trials per condition', () => {
  const outcome = verdictFor(0, 1, 2);
  assert.equal(outcome.verdict, 'inconclusive');
  assert.match(outcome.reason, /insufficient samples/);
});

test('verdictFor maps the pass-rate delta to a verdict', () => {
  assert.equal(verdictFor(0, 1, 3).verdict, 'effective');
  assert.equal(verdictFor(1, 0, 3).verdict, 'ineffective');
  const tie = verdictFor(0.5, 0.5, 3);
  assert.equal(tie.verdict, 'inconclusive');
  assert.match(tie.reason, /no measurable difference/);
});

test('buildWarnings flags a bench the baseline already passes', () => {
  const manifest = manifestWith([taskSummary('easy', 3, 3, 3)], 'api');
  const warnings = buildWarnings(manifest);
  assert.ok(warnings.some((w) => w.includes('"easy"') && w.includes('too easy')));
});

test('buildWarnings stays quiet below the 90% threshold', () => {
  const manifest = manifestWith([taskSummary('ok', 2, 3, 4)], 'api');
  assert.deepEqual(buildWarnings(manifest), []);
});

test('buildWarnings flags mock executors as synthetic', () => {
  const manifest = manifestWith([taskSummary('t', 0, 3, 3)], 'mock');
  assert.ok(buildWarnings(manifest).some((w) => w.includes('synthetic')));
});

test('renderSummary prints the per-task table and warnings', () => {
  const base = manifestWith([taskSummary('review-r1', 0, 3, 3)]);
  const manifest: RunManifest = { ...base, warnings: buildWarnings(base) };
  const output = renderSummary(manifest, 'runs/g/manifest.json');
  assert.match(output, /Skill\s+: s/);
  assert.match(output, /review-r1\s+0\/3 \(0%\)\s+3\/3 \(100%\)\s+\+100pp\s+effective/);
  assert.match(output, /OVERALL/);
  assert.match(output, /Manifest: runs\/g\/manifest\.json/);
  assert.match(output, /Warnings:\n- /);
});

test('format helpers', () => {
  assert.equal(formatPassRate(1, 3), '1/3 (33%)');
  assert.equal(formatDeltaPp(2 / 3), '+67pp');
  assert.equal(formatDeltaPp(-1 / 3), '-33pp');
  assert.equal(formatDeltaPp(0), '0pp');
});
