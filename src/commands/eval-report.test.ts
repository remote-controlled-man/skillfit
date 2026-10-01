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
});

test('report eval renders missing CI and zero graded trials explicitly', () => {
  const value = manifest();
  const overall = value['overall'] as Record<string, unknown>;
  const stats = overall['stats'] as Record<string, unknown>;
  stats['deltaCi'] = null;
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
