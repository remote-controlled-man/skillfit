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
import { mcnemarExactP, pairedDeltaBootstrapCI } from './stats.js';

function flags(passes: number, trials: number): boolean[] {
  return Array.from({ length: trials }, (_, i) => i < passes);
}

function discordants(outcomes: { baseline: boolean[]; treatment: boolean[] }): {
  improved: number;
  regressed: number;
} {
  let improved = 0;
  let regressed = 0;
  for (let i = 0; i < outcomes.baseline.length; i++) {
    if (outcomes.treatment[i] && !outcomes.baseline[i]) improved++;
    else if (outcomes.baseline[i] && !outcomes.treatment[i]) regressed++;
  }
  return { improved, regressed };
}

function stats(passes: number, trials: number, meanScore: number | null = null, errors = 0) {
  return { passes, trials, errors, passRate: passes / trials, meanScore, tokens: null };
}

function taskSummary(
  id: string,
  baselinePasses: number,
  treatmentPasses: number,
  trials: number,
  extras: Partial<TaskSummary> = {},
): TaskSummary {
  const baseline = stats(baselinePasses, trials);
  const treatment = stats(treatmentPasses, trials);
  const outcomes = { baseline: flags(baselinePasses, trials), treatment: flags(treatmentPasses, trials) };
  const deltaPassRate = treatment.passRate - baseline.passRate;
  const { verdict, reason } = verdictFor({ ...discordants(outcomes), deltaPassRate });
  return {
    id,
    conditions: { baseline, treatment },
    outcomes,
    scores: {
      baseline: Array<number | null>(trials).fill(null),
      treatment: Array<number | null>(trials).fill(null),
    },
    deltaPassRate,
    scoreDelta: null,
    facets: [],
    verifierNotes: [],
    tokenDelta: null,
    verdict,
    verdictReason: reason,
    judge: null,
    ...extras,
  };
}

function manifestWith(tasks: TaskSummary[], executorKind = 'mock'): Omit<RunManifest, 'warnings'> {
  const trials = tasks[0]?.conditions.baseline.trials ?? 0;
  const totalPasses = (condition: 'baseline' | 'treatment') =>
    tasks.reduce((sum, task) => sum + task.conditions[condition].passes, 0);
  const totalTrials = tasks.reduce((sum, task) => sum + task.conditions.baseline.trials, 0);
  const baseline = stats(totalPasses('baseline'), totalTrials);
  const treatment = stats(totalPasses('treatment'), totalTrials);
  const deltaPassRate = treatment.passRate - baseline.passRate;
  const discordant = tasks.reduce(
    (acc, task) => {
      const d = discordants(task.outcomes);
      return { improved: acc.improved + d.improved, regressed: acc.regressed + d.regressed };
    },
    { improved: 0, regressed: 0 },
  );
  const { verdict, reason } = verdictFor({ ...discordant, deltaPassRate });
  return {
    schemaVersion: 3,
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
      deltaPassRate,
      scoreDelta: null,
      tokenDelta: null,
      verdict,
      verdictReason: reason,
      stats: {
        discordant,
        mcnemarP: mcnemarExactP(discordant.improved, discordant.regressed),
        deltaCi: pairedDeltaBootstrapCI(tasks.map((task) => task.outcomes)),
        scoreDeltaCi: null,
      },
    },
  };
}

test('verdictFor is inconclusive below 6 discordant pairs, however large the delta', () => {
  const outcome = verdictFor({ improved: 5, regressed: 0, deltaPassRate: 1 });
  assert.equal(outcome.verdict, 'inconclusive');
  assert.match(outcome.reason, /only 5 discordant pair/);
});

test('verdictFor reaches significance at 6 one-sided discordant pairs', () => {
  assert.equal(verdictFor({ improved: 6, regressed: 0, deltaPassRate: 1 }).verdict, 'effective');
  assert.equal(verdictFor({ improved: 0, regressed: 6, deltaPassRate: -1 }).verdict, 'ineffective');
});

test('verdictFor rejects balanced discordance and zero delta', () => {
  const balanced = verdictFor({ improved: 3, regressed: 3, deltaPassRate: 0 });
  assert.equal(balanced.verdict, 'inconclusive');
  assert.match(balanced.reason, /not significant/);
  const lopsidedButWeak = verdictFor({ improved: 5, regressed: 2, deltaPassRate: 0.43 });
  assert.equal(lopsidedButWeak.verdict, 'inconclusive');
});

test('buildWarnings flags a bench the baseline already passes', () => {
  const manifest = manifestWith([taskSummary('easy', 3, 3, 3)], 'api');
  const warnings = buildWarnings(manifest);
  assert.ok(warnings.some((w) => w.includes('"easy"') && w.includes('too easy')));
});

test('buildWarnings stays quiet about difficulty below the 90% threshold', () => {
  const manifest = manifestWith([taskSummary('ok', 2, 2, 4)], 'api');
  assert.ok(!buildWarnings(manifest).some((w) => w.includes('too easy')));
});

test('buildWarnings flags mock executors as synthetic', () => {
  const manifest = manifestWith([taskSummary('t', 0, 3, 3)], 'mock');
  assert.ok(buildWarnings(manifest).some((w) => w.includes('synthetic')));
});

test('buildWarnings warns when discordant pairs cannot certify anything but huge effects', () => {
  const manifest = manifestWith([taskSummary('t', 1, 3, 3)], 'api');
  assert.ok(buildWarnings(manifest).some((w) => w.includes('Only 2 discordant pair')));
});

test('renderSummary prints the table, significance block, and indicative scale note', () => {
  const base = manifestWith([taskSummary('review-r1', 0, 3, 3)]);
  const manifest: RunManifest = { ...base, warnings: buildWarnings(base) };
  const output = renderSummary(manifest, 'runs/g/manifest.json');
  assert.match(output, /Skill\s+: s/);
  assert.match(output, /review-r1\s+0\/3 \(0%\)\s+3\/3 \(100%\)\s+\+100pp\s+inconclusive/);
  assert.match(output, /OVERALL/);
  assert.match(output, /Significance \(overall\): 3 improved vs 0 regressed discordant pair\(s\), McNemar exact p=0\.2500/);
  assert.match(output, /Δpass 95% CI \(paired bootstrap, 2000 resamples\): \[\+100pp, \+100pp\]/);
  assert.match(output, /Scale: 1 task\(s\) × 3 trials per condition — below the conclusive bar/);
  assert.match(output, /Manifest: runs\/g\/manifest\.json/);
});

test('renderSummary shows a significant overall verdict when discordance suffices', () => {
  const base = manifestWith([
    taskSummary('a', 0, 3, 3),
    taskSummary('b', 0, 3, 3),
    taskSummary('c', 0, 3, 3),
  ]);
  const manifest: RunManifest = { ...base, warnings: buildWarnings(base) };
  assert.equal(manifest.overall.verdict, 'effective');
  const output = renderSummary(manifest, 'runs/g/manifest.json');
  assert.match(output, /OVERALL\s+0\/9 \(0%\)\s+9\/9 \(100%\)\s+\+100pp\s+effective/);
  assert.match(output, /9 improved vs 0 regressed discordant pair\(s\), McNemar exact p=0\.0039/);
});

test('format helpers', () => {
  assert.equal(formatPassRate(1, 3), '1/3 (33%)');
  assert.equal(formatDeltaPp(2 / 3), '+67pp');
  assert.equal(formatDeltaPp(-1 / 3), '-33pp');
  assert.equal(formatDeltaPp(0), '0pp');
});

test('buildWarnings flags a task the baseline never passes (floor)', () => {
  const manifest = manifestWith([taskSummary('hard', 0, 3, 3)], 'api');
  assert.ok(
    buildWarnings(manifest).some((w) => w.includes('"hard"') && w.includes('too hard or broken')),
  );
});

test('buildWarnings flags a saturated facet', () => {
  const manifest = manifestWith(
    [
      taskSummary('t', 2, 2, 4, {
        facets: [
          {
            name: 'style',
            baselinePassRate: 1,
            treatmentPassRate: 1,
            baselineTrials: 4,
            treatmentTrials: 4,
          },
          {
            name: 'correctness',
            baselinePassRate: 0.5,
            treatmentPassRate: 0.75,
            baselineTrials: 4,
            treatmentTrials: 4,
          },
        ],
      }),
    ],
    'api',
  );
  const warnings = buildWarnings(manifest);
  assert.ok(warnings.some((w) => w.includes('facet "style"') && w.includes('saturated')));
  assert.ok(!warnings.some((w) => w.includes('facet "correctness"')));
});

test('buildWarnings surfaces verifier consistency notes', () => {
  const manifest = manifestWith(
    [taskSummary('t', 2, 2, 4, { verifierNotes: ['Task "t": exit code and checks disagree.'] })],
    'api',
  );
  assert.ok(buildWarnings(manifest).some((w) => w.includes('exit code and checks disagree')));
});

test('renderSummary adds facet score lines only when scores exist', () => {
  const withoutScores = manifestWith([taskSummary('plain', 1, 3, 3)]);
  const plainOutput = renderSummary(
    { ...withoutScores, warnings: buildWarnings(withoutScores) },
    'runs/g/manifest.json',
  );
  assert.ok(!plainOutput.includes('Facet scores'));
  assert.ok(!plainOutput.includes('Δscore 95% CI'));

  const scored = taskSummary('scored', 1, 3, 3, {
    conditions: {
      baseline: stats(1, 3, 0.5),
      treatment: stats(3, 3, 1),
    },
    scoreDelta: 0.5,
    facets: [
      {
        name: 'finds-bug',
        baselinePassRate: 0.5,
        treatmentPassRate: 1,
        baselineTrials: 3,
        treatmentTrials: 3,
      },
    ],
  });
  const withScores = manifestWith([scored]);
  withScores.overall.stats.scoreDeltaCi = { point: 0.5, lo: 0.5, hi: 0.5, resamples: 2000 };
  const output = renderSummary(
    { ...withScores, warnings: buildWarnings(withScores) },
    'runs/g/manifest.json',
  );
  assert.match(output, /Δscore 95% CI \(paired bootstrap, 2000 resamples\): \[\+0\.50, \+0\.50\]/);
  assert.match(output, /Facet scores \(mean checks passed, baseline → treatment\):/);
  assert.match(output, /- scored: score 0\.50 → 1\.00 \(Δ \+0\.50\)/);
  assert.match(output, /- finds-bug: 50% → 100%/);
});

test('buildWarnings surfaces excluded executor errors per arm', () => {
  const summary = taskSummary('flaky', 1, 2, 2);
  const manifest = manifestWith(
    [
      {
        ...summary,
        conditions: {
          ...summary.conditions,
          baseline: { ...summary.conditions.baseline, errors: 1 },
        },
      },
    ],
    'api',
  );
  const warnings = buildWarnings(manifest);
  assert.ok(
    warnings.some(
      (w) => w.includes('"flaky" (baseline)') && w.includes('1 trial(s) hit an executor error'),
    ),
  );
  assert.ok(warnings.some((w) => w.includes('together with their paired treatment trial(s)')));
  assert.ok(
    !warnings.some((w) => w.includes('"flaky" (treatment)')),
    'an arm with no errors stays quiet',
  );
});
