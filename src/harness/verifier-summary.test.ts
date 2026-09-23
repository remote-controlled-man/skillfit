import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseVerifierSummary, scoreFromChecks, verdictFromOutput } from './verifier-summary.js';

describe('parseVerifierSummary', () => {
  it('parses a clean one-line summary', () => {
    const summary = parseVerifierSummary('{"passed":true,"checks":[{"name":"a","pass":true}]}');
    assert.deepEqual(summary, { passed: true, checks: [{ name: 'a', pass: true }] });
  });

  it('finds the summary amid surrounding noise', () => {
    const output = [
      'running tests...',
      '{"passed":false,"checks":[{"name":"a","pass":false},{"name":"b","pass":true}]}',
      'done',
    ].join('\n');
    const summary = parseVerifierSummary(output);
    assert.equal(summary?.passed, false);
    assert.equal(summary?.checks.length, 2);
  });

  it('prefers the last parseable summary line', () => {
    const output = [
      '{"passed":false}',
      '{"passed":true,"checks":[{"name":"a","pass":true}]}',
    ].join('\n');
    const summary = parseVerifierSummary(output);
    assert.equal(summary?.passed, true);
    assert.equal(summary?.checks.length, 1);
  });

  it('accepts a legacy summary without checks', () => {
    const summary = parseVerifierSummary('{"passed":true,"hits":["a"],"missed":[]}');
    assert.deepEqual(summary, { passed: true, checks: [] });
  });

  it('drops malformed check entries but keeps valid ones', () => {
    const output = JSON.stringify({
      passed: false,
      checks: [
        { name: 'ok', pass: true },
        { name: '', pass: true },
        { name: 'no-pass-flag' },
        { pass: true },
        'garbage',
        { name: 'also-ok', pass: false },
      ],
    });
    const summary = parseVerifierSummary(output);
    assert.deepEqual(summary?.checks, [
      { name: 'ok', pass: true },
      { name: 'also-ok', pass: false },
    ]);
  });

  it('skips non-summary JSON objects and keeps scanning upward', () => {
    const output = ['{"passed":true}', '{"unrelated":1}'].join('\n');
    const summary = parseVerifierSummary(output);
    assert.equal(summary?.passed, true);
  });

  it('returns null when there is no JSON summary', () => {
    assert.equal(parseVerifierSummary('plain text\nnothing here'), null);
    assert.equal(parseVerifierSummary(''), null);
  });

  it('returns null for JSON arrays and non-object lines', () => {
    assert.equal(parseVerifierSummary('[1,2,3]'), null);
    assert.equal(parseVerifierSummary('{not json}'), null);
  });
});

describe('scoreFromChecks', () => {
  it('returns null for an empty check list', () => {
    assert.equal(scoreFromChecks([]), null);
  });

  it('computes the fraction of passing checks', () => {
    assert.equal(
      scoreFromChecks([
        { name: 'a', pass: true },
        { name: 'b', pass: false },
        { name: 'c', pass: true },
        { name: 'd', pass: true },
      ]),
      0.75,
    );
  });
});

describe('verdictFromOutput', () => {
  it('combines passed, checks, and score from the summary', () => {
    const verdict = verdictFromOutput(
      'noise\n{"passed":false,"checks":[{"name":"a","pass":true},{"name":"b","pass":false}]}',
    );
    assert.deepEqual(verdict, {
      passed: false,
      checks: [
        { name: 'a', pass: true },
        { name: 'b', pass: false },
      ],
      score: 0.5,
    });
  });

  it('normalizes a checks-less summary to null checks and score', () => {
    assert.deepEqual(verdictFromOutput('{"passed":true}'), {
      passed: true,
      checks: null,
      score: null,
    });
  });

  it('returns null when there is no summary', () => {
    assert.equal(verdictFromOutput('not json'), null);
  });
});
