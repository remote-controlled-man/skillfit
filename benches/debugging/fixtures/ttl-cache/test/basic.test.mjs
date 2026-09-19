import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/ttl-cache.mjs';

test('returns a cached object before expiry', () => {
  let now = 10;
  const cache = new TtlCache(() => now);
  cache.set('a', { ok: true }, 5);
  assert.deepEqual(cache.get('a'), { ok: true });
});

