import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/range-parser.mjs';

test('parses a basic comma-separated list', () => {
  assert.deepEqual(parseRange('3, 1, 2'), [3, 1, 2]);
});

