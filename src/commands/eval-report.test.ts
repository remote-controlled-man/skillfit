import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseEvalReport, renderEvalMarkdown, runEvalReport } from './eval-report.js';

function manifest(): Record<string, unknown> {
  const conditions = {
    baseline: { passes: 0, trials: 2, errors: 0 },
    treatment: { passes: 2, trials: 2, errors: 0 },
  };
  return {
    schemaVersion: 4,
    runGroup: 'eval-20261001-123000',
    createdAt: '2026-10-01T12:30:00.000Z',
    target: { kind: 'skill', name: 'test | Skill', bundleSha256: 'a'.repeat(64) },
    bench: { name: 'one-task', contentSha256: 'b'.repeat(64), taskCount: 1 },
    executor: { kind: 'mock', model: 'mock' },
    trials: 2,
    tasks: [{ id: 'task-1', conditions, deltaPassRate: 1, verdict: 'inconclusive' }],
    overall: {
      conditions,
      deltaPassRate: 1,
      verdict: 'inconclusive',
      verdictReason: 'only 2 discordant pairs',
      stats: {
        discordant: { improved: 2, regressed: 0 },
        mcnemarP: 0.5,
        deltaCi: { lo: 0.2, hi: 1, resamples: 1000 },
      },
    },
    warnings: ['Only two pairs: indicative.', 'Avoid <private> details.'],
  };
}

test('report eval renders a v4 manifest without executing an agent or writing a file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-eval-report-'));
  try {
    const path = join(dir, 'manifest.json');
    const original = `${JSON.stringify(manifest(), null, 2)}\n`;
    writeFileSync(path, original);
    const output: string[] = [];
    runEvalReport(path, (line) => output.push(line));
    assert.equal(readFileSync(path, 'utf8'), original);
    assert.equal(output.length, 1);
    const markdown = output[0] ?? '';
    assert.match(markdown, /# skillfit evaluation: test \\\| Skill/);
    assert.match(markdown, /Synthetic harness run/);
    assert.match(markdown, /\| task-1 \| 0\/2 \(0%\) \| 2\/2 \(100%\) \| 0\/0 \| \+100\.0pp \| inconclusive \|/);
    assert.match(markdown, /McNemar exact p=0\.5000/);
    assert.match(markdown, /\[\+20\.0pp, \+100\.0pp\]/);
    assert.match(markdown, /below the conclusive bar \(8 tasks × 5 trials\)/);
    assert.match(markdown, /&lt;private&gt;/);
    assert.ok(!markdown.includes(dir), 'the portable report must not include the local manifest directory');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('report eval refuses old and incomplete manifests instead of guessing metrics', () => {
  assert.throws(() => parseEvalReport({ ...manifest(), schemaVersion: 3 }), /Only evaluation manifest schemaVersion 4/);
  const missing = manifest();
  delete missing['overall'];
  assert.throws(() => parseEvalReport(missing), /overall must be an object/);
  const wrongCount = manifest();
  wrongCount['bench'] = { name: 'one-task', contentSha256: 'b'.repeat(64), taskCount: 2 };
  assert.throws(() => parseEvalReport(wrongCount), /taskCount must match/);
  const wrongVerdict = manifest();
  (wrongVerdict['overall'] as Record<string, unknown>)['verdict'] = 'effective';
  assert.throws(() => parseEvalReport(wrongVerdict), /disagrees with the metrics protocol/);
  const impossiblePairs = manifest();
  const impossibleStats = (impossiblePairs['overall'] as Record<string, unknown>)['stats'] as Record<string, unknown>;
  impossibleStats['discordant'] = { improved: 3, regressed: 0 };
  assert.throws(() => parseEvalReport(impossiblePairs), /exceeds the number of paired trials/);
});

test('report eval renders missing CI and zero graded trials explicitly', () => {
  const value = manifest();
  const overall = value['overall'] as Record<string, unknown>;
  const stats = overall['stats'] as Record<string, unknown>;
  stats['deltaCi'] = null;
  stats['discordant'] = { improved: 0, regressed: 0 };
  stats['mcnemarP'] = 1;
  const conditions = {
    baseline: { passes: 0, trials: 0, errors: 2 },
    treatment: { passes: 0, trials: 0, errors: 2 },
  };
  overall['conditions'] = conditions;
  overall['deltaPassRate'] = 0;
  (value['tasks'] as Record<string, unknown>[])[0]!['conditions'] = conditions;
  (value['tasks'] as Record<string, unknown>[])[0]!['deltaPassRate'] = 0;
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /0\/0 \(n\/a\)/);
  assert.match(markdown, /Δpass 95% CI: n\/a \(no graded pairs\)/);
});

test('report eval escapes Markdown links supplied by manifest fields', () => {
  const value = manifest();
  (value['target'] as Record<string, unknown>)['name'] = '[click](https://example.com)';
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /# skillfit evaluation: \\\[click\\\]\(https:\/\/example\.com\)/);
  assert.ok(!markdown.includes('# skillfit evaluation: [click]('));
});

test('real reports show facets, bounded decisions and partial token coverage', () => {
  const value = manifest();
  value['executor'] = { kind: 'cli', model: 'cli-configured' };
  value['inputMode'] = 'workspace';
  const task = (value['tasks'] as Record<string, unknown>[])[0]!;
  const conditions = task['conditions'] as Record<string, Record<string, unknown>>;
  Object.assign(conditions['baseline']!, { meanScore: 0.5, tokens: { input: 40, output: 2 }, tokenCoverage: { input: 1, output: 1 } });
  Object.assign(conditions['treatment']!, { meanScore: 1, tokens: { input: 80, output: 4 }, tokenCoverage: { input: 2, output: 2 } });
  task['scoreDelta'] = 0.5;
  (value['overall'] as Record<string, unknown>)['scoreDelta'] = 0.5;
  task['facets'] = [{ name: 'Unicode | regression', baselinePassRate: 0.5, treatmentPassRate: 1, baselineTrials: 2, treatmentTrials: 2 }];
  const stats = (value['overall'] as Record<string, unknown>)['stats'] as Record<string, unknown>;
  stats['scoreDeltaCi'] = { lo: 0.1, hi: 0.9, resamples: 1000 };
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /Input: workspace/);
  assert.match(markdown, /\| task-1 \| 50\.0% \| 100\.0% \| \+50\.0pp \|/);
  assert.match(markdown, /Unicode \\\| regression \| 50\.0% \(n=2\) \| 100\.0% \(n=2\)/);
  assert.match(markdown, /Δscore 95% paired-bootstrap CI/);
  assert.match(markdown, /Inconclusive means insufficient evidence/);
  assert.match(markdown, /Activation is unmeasured/);
  assert.match(markdown, /Token coverage is partial or unrecorded/);
  assert.match(markdown, /40 \(1\/2 runs\)/);
  assert.ok(!markdown.includes('Mean recorded tokens'));
});

test('report warns when only the graded-score interval collapses', () => {
  const value = manifest();
  const task = (value['tasks'] as Record<string, unknown>[])[0]!;
  const conditions = task['conditions'] as Record<string, Record<string, unknown>>;
  conditions['baseline']!['meanScore'] = 0.5;
  conditions['treatment']!['meanScore'] = 1;
  task['scoreDelta'] = 0.5;
  const overall = value['overall'] as Record<string, unknown>;
  overall['scoreDelta'] = 0.5;
  (overall['stats'] as Record<string, unknown>)['scoreDeltaCi'] = { point: 0.5, lo: 0.5, hi: 0.5, resamples: 1000 };
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /Δpass 95% paired-bootstrap CI.*\[\+20\.0pp, \+100\.0pp\]/);
  assert.match(markdown, /Δscore 95% paired-bootstrap CI.*\[\+50\.0pp, \+50\.0pp\]/);
  assert.match(markdown, /interval collapsed.*does not establish zero uncertainty/);
});

test('report rejects invalid score, facet denominators, coverage and unpaired counts', () => {
  for (const mutate of [
    (task: Record<string, unknown>) => { task['facets'] = [{ name: 'a', baselinePassRate: 1, treatmentPassRate: 1, baselineTrials: 3, treatmentTrials: 2 }]; },
    (task: Record<string, unknown>) => { task['facets'] = [{ name: 'a', baselinePassRate: 0.5, treatmentPassRate: 1, baselineTrials: 1, treatmentTrials: 2 }]; },
    (task: Record<string, unknown>) => { ((task['conditions'] as Record<string, Record<string, unknown>>)['baseline']!)['meanScore'] = 2; },
    (task: Record<string, unknown>) => { ((task['conditions'] as Record<string, Record<string, unknown>>)['baseline']!)['tokenCoverage'] = { input: 3, output: 0 }; },
    (task: Record<string, unknown>) => { ((task['conditions'] as Record<string, Record<string, unknown>>)['baseline']!)['trials'] = 1; },
  ]) {
    const value = manifest();
    mutate((value['tasks'] as Record<string, unknown>[])[0]!);
    assert.throws(() => parseEvalReport(value), /denominator|finite number|coverage cannot|tokenCoverage cannot|equal numbers/);
  }
  const value = manifest();
  value['inputMode'] = 'invented';
  assert.throws(() => parseEvalReport(value), /inputMode must/);
});

test('legacy real manifests expose missing provenance and token coverage', () => {
  const value = manifest();
  value['executor'] = { kind: 'cli', model: 'cli-configured' };
  const conditions = (value['overall'] as Record<string, unknown>)['conditions'] as Record<string, Record<string, unknown>>;
  for (const c of Object.values(conditions)) c['tokens'] = { input: 40, output: 2 };
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /legacy manifest; not recorded/);
  assert.match(markdown, /coverage unrecorded/);
  assert.match(markdown, /Token coverage is partial or unrecorded/);
});

test('report cross-checks usage coverage/totals and rejects contradictory usage', () => {
  for (const mutation of ['coverage-total', 'token-total', 'missing-task', 'null-tokens', 'zero-coverage']) {
    const value = JSON.parse(JSON.stringify(manifest())) as Record<string, unknown>;
    const task = (value['tasks'] as Record<string, unknown>[])[0]!;
    const taskConditions = task['conditions'] as Record<string, Record<string, unknown>>;
    const overallConditions = (value['overall'] as Record<string, unknown>)['conditions'] as Record<string, Record<string, unknown>>;
    for (const conditions of [taskConditions, overallConditions]) {
      for (const c of Object.values(conditions)) Object.assign(c, {
        tokens: { input: 10, output: 2 }, tokenCoverage: { input: 1, output: 1 },
      });
    }
    const aggregate = overallConditions['baseline']!;
    if (mutation === 'coverage-total') aggregate['tokenCoverage'] = { input: 2, output: 2 };
    if (mutation === 'token-total') aggregate['tokens'] = { input: 10000, output: 1000 };
    if (mutation === 'missing-task') delete taskConditions['baseline']!['tokenCoverage'];
    if (mutation === 'null-tokens') aggregate['tokens'] = null;
    if (mutation === 'zero-coverage') aggregate['tokenCoverage'] = { input: 0, output: 0 };
    assert.throws(() => parseEvalReport(value), /disagrees with task totals|requires recorded coverage|contradicts/);
  }
});

test('report refuses a score interval without paired score observations', () => {
  const value = manifest();
  const overall = value['overall'] as Record<string, unknown>;
  (overall['stats'] as Record<string, unknown>)['scoreDeltaCi'] = { lo: 0.5, hi: 1, resamples: 1000 };
  assert.throws(() => parseEvalReport(value), /scoreDeltaCi requires paired graded score observations/);
});

test('report uses completed scale after exclusions and warns about collapsed intervals', () => {
  const value = manifest();
  value['executor'] = { kind: 'cli', model: 'offline' };
  value['trials'] = 5;
  (value['bench'] as Record<string, unknown>)['taskCount'] = 8;
  const conditions = { baseline: { passes: 0, trials: 4, errors: 1 }, treatment: { passes: 4, trials: 4, errors: 0 } };
  value['tasks'] = Array.from({ length: 8 }, (_, i) => ({ id: `task-${i}`, conditions, deltaPassRate: 1, verdict: 'inconclusive' }));
  Object.assign(value['overall'] as Record<string, unknown>, {
    conditions: { baseline: { passes: 0, trials: 32, errors: 8 }, treatment: { passes: 32, trials: 32, errors: 0 } },
    verdict: 'effective', stats: { discordant: { improved: 32, regressed: 0 }, mcnemarP: 2 * 0.5 ** 32,
      deltaCi: { lo: 1, hi: 1, resamples: 1000 } },
  });
  const markdown = renderEvalMarkdown(parseEvalReport(value));
  assert.match(markdown, /Completed scale: 0 task\(s\) have at least 5 graded pairs/);
  assert.match(markdown, /interval collapsed.*does not establish zero uncertainty/);
  assert.match(markdown, /The run is indicative/);
});
