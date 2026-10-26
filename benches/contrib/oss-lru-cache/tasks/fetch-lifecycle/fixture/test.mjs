import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCache } from './runtime.mjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), true);
test('ordinary LRU get/set and eviction', () => {
  const c = new Cache({ max: 2 }); c.set('a', 1); c.set('b', 2);
  assert.equal(c.get('a'), 1); c.set('c', 3);
  assert.equal(c.has('b'), false); assert.equal(c.get('c'), 3); cleanup();
});
