import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactObject, countDropped } from '../src/compact.js';

test('compactObject removes null, undefined, and empty-string values', () => {
  assert.deepEqual(compactObject({ a: 1, b: null, c: undefined, d: '' }), { a: 1 });
});

test('compactObject keeps falsy values that are not empty', () => {
  assert.deepEqual(compactObject({ a: 0, b: false }), { a: 0, b: false });
});

test('compactObject does not mutate its input; countDropped counts removed keys', () => {
  const input = { a: null, b: 'x' };
  compactObject(input);
  assert.deepEqual(input, { a: null, b: 'x' });
  assert.equal(countDropped(input), 1);
});
