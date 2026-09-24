import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/ttl-cache.mjs';

test('returns a cached value before expiry', () => {
  let now = 10;
  const cache = new TtlCache(() => now);
  cache.set('a', { ok: true }, 5);
  assert.deepEqual(cache.get('a'), { ok: true });
});

test('drops a cached value at its deadline', () => {
  let now = 10;
  const cache = new TtlCache(() => now);
  cache.set('a', 1, 5);
  now = 15;
  assert.equal(cache.get('a'), undefined);
});

test('reading does not extend the deadline', () => {
  let now = 0;
  const cache = new TtlCache(() => now);
  cache.set('a', 1, 5);
  now = 4;
  assert.equal(cache.get('a'), 1);
  now = 5;
  assert.equal(cache.get('a'), undefined);
});
