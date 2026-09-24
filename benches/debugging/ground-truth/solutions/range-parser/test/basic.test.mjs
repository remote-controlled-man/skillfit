import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/range-parser.mjs';

test('parses a basic comma-separated list', () => {
  assert.deepEqual(parseRange('3, 1, 2'), [1, 2, 3]);
});

test('expands ascending and descending ranges', () => {
  assert.deepEqual(parseRange('1-3'), [1, 2, 3]);
  assert.deepEqual(parseRange('10-8'), [8, 9, 10]);
});

test('handles negative values and negative ranges', () => {
  assert.deepEqual(parseRange('-3--1, 2'), [-3, -2, -1, 2]);
});

test('rejects invalid segments and non-string input', () => {
  assert.throws(() => parseRange('1,,2'), TypeError);
  assert.throws(() => parseRange('1.5'), TypeError);
  assert.throws(() => parseRange(null), TypeError);
});

test('enforces maxItems with RangeError', () => {
  assert.throws(() => parseRange('1-5', { maxItems: 4 }), RangeError);
});
