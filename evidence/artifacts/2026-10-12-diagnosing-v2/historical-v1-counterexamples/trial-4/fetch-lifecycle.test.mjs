#!/usr/bin/env node
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { loadCache } from './runtime.mjs';

const { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), true);
after(cleanup);

function deferred() {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
}

async function settled(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('fetch result did not settle')), 500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('fetch lifecycle: pending miss hides the internal promise from onInsert', async () => {
  const provider = deferred();
  const value = { fetched: true };
  const inserts = [];
  let calls = 0;
  const cache = new Cache({
    max: 2,
    fetchMethod: () => { calls++; return provider.promise; },
    onInsert: (...args) => inserts.push(args),
  });
  const first = cache.fetch('missing');
  const second = cache.fetch('missing');
  try {
    assert.deepEqual(inserts, []);
    assert.equal(calls, 1);
    assert.equal(cache.has('missing'), false);
    provider.resolve(value);
    assert.deepEqual(await Promise.all([first, second]), [value, value]);
    assert.equal(cache.get('missing'), value);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0][0], value);
    assert.equal(inserts[0][1], 'missing');
  } finally {
    provider.resolve(value);
    await Promise.allSettled([first, second]);
  }
});

test('fetch lifecycle: ordinary inserts retain add update replace and application promises', () => {
  const inserts = [];
  const cache = new Cache({
    max: 3,
    fetchMethod: async () => 'unused',
    onInsert: (...args) => inserts.push(args),
  });
  const initial = { version: 1 };
  const replacement = { version: 2 };
  const applicationPromise = Promise.resolve('application value');
  cache.set('key', initial);
  cache.set('key', initial);
  cache.set('key', replacement);
  cache.set('promise', applicationPromise);
  assert.deepEqual(inserts, [
    [initial, 'key', 'add'],
    [initial, 'key', 'update'],
    [replacement, 'key', 'replace'],
    [applicationPromise, 'promise', 'add'],
  ]);
  assert.equal(cache.get('promise'), applicationPromise);
});

test('fetch lifecycle: successful refresh stores the value without aborting its provider', async () => {
  const provider = deferred();
  const stale = { version: 1 };
  const fresh = { version: 2 };
  const inserts = [];
  const disposed = [];
  const disposedAfter = [];
  const aborts = [];
  let signal;
  let calls = 0;
  const cache = new Cache({
    max: 2,
    fetchMethod: (key, oldValue, options) => {
      calls++;
      assert.equal(key, 'key');
      assert.equal(oldValue, stale);
      signal = options.signal;
      signal.addEventListener('abort', () => aborts.push(signal.reason));
      return provider.promise;
    },
    onInsert: (...args) => inserts.push(args),
    dispose: (...args) => disposed.push(args),
    disposeAfter: (...args) => disposedAfter.push(args),
  });
  cache.set('key', stale);
  inserts.length = 0;
  const refreshing = cache.fetch('key', { forceRefresh: true });
  const joined = cache.fetch('key');
  assert.equal(await cache.fetch('key', { allowStale: true }), stale);
  assert.deepEqual(inserts, []);
  assert.deepEqual(disposed, []);
  provider.resolve(fresh);
  assert.deepEqual(await Promise.all([refreshing, joined]), [fresh, fresh]);
  assert.equal(calls, 1);
  assert.equal(cache.get('key'), fresh);
  assert.deepEqual(inserts, [[fresh, 'key', 'replace']]);
  assert.deepEqual(disposed, [[stale, 'key', 'set']]);
  assert.deepEqual(disposedAfter, [[stale, 'key', 'set']]);
  assert.equal(signal.aborted, false);
  assert.deepEqual(aborts, []);
  assert.equal(await cache.fetch('key'), fresh);
  assert.equal(calls, 1);
});

test('fetch lifecycle: noDisposeOnSet still suppresses disposal on successful refresh', async () => {
  const disposed = [];
  const disposedAfter = [];
  let signal;
  const cache = new Cache({
    max: 1,
    fetchMethod: async (key, oldValue, options) => {
      signal = options.signal;
      return 'fresh';
    },
    dispose: (...args) => disposed.push(args),
    disposeAfter: (...args) => disposedAfter.push(args),
  });
  cache.set('key', 'stale');
  assert.equal(await cache.fetch('key', { forceRefresh: true, noDisposeOnSet: true }), 'fresh');
  assert.equal(cache.get('key'), 'fresh');
  assert.deepEqual(disposed, []);
  assert.deepEqual(disposedAfter, []);
  assert.equal(signal.aborted, false);
});

for (const mode of ['capacity', 'pop', 'size', 'capacity with noDisposeOnSet']) {
  test(`fetch lifecycle: ${mode} eviction disposes the refreshing stale value exactly once`, async () => {
    const provider = deferred();
    const stale = mode === 'capacity with noDisposeOnSet' ? 0 : { version: 1 };
    const fresh = { version: 2 };
    const disposed = [];
    const disposedAfter = [];
    let signal;
    const cache = new Cache({
      max: mode === 'size' ? 3 : 1,
      ...(mode === 'size' ? { maxSize: 2, sizeCalculation: () => 2 } : {}),
      fetchMethod: (key, oldValue, options) => {
        assert.equal(oldValue, stale);
        signal = options.signal;
        return provider.promise;
      },
      dispose: (...args) => disposed.push(args),
      disposeAfter: (...args) => disposedAfter.push(args),
    });
    cache.set('key', stale);
    const refreshing = cache.fetch('key', { forceRefresh: true });
    const rejected = assert.rejects(refreshing, { message: 'evicted' });
    if (mode === 'pop') {
      assert.equal(cache.pop(), stale);
      assert.equal(cache.size, 0);
    } else {
      cache.set('other', { other: true }, {
        noDisposeOnSet: mode === 'capacity with noDisposeOnSet',
      });
      assert.equal(cache.has('other'), true);
    }
    await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(signal.reason.message, 'evicted');
    provider.resolve(fresh);
    await nextTurn();
    assert.equal(cache.has('key'), false);
    assert.deepEqual(disposed, [[stale, 'key', 'evict']]);
    assert.deepEqual(disposedAfter, [[stale, 'key', 'evict']]);
  });
}

test('fetch lifecycle: eviction of a pending miss never disposes an internal promise', async () => {
  const provider = deferred();
  const disposed = [];
  const disposedAfter = [];
  const inserts = [];
  const cache = new Cache({
    max: 1,
    fetchMethod: () => provider.promise,
    onInsert: (...args) => inserts.push(args),
    dispose: (...args) => disposed.push(args),
    disposeAfter: (...args) => disposedAfter.push(args),
  });
  const fetching = cache.fetch('missing');
  const rejected = assert.rejects(fetching, { message: 'evicted' });
  cache.set('other', 'retained');
  await rejected;
  provider.resolve('too late');
  await nextTurn();
  assert.deepEqual(inserts, [['retained', 'other', 'add']]);
  assert.deepEqual(disposed, []);
  assert.deepEqual(disposedAfter, []);
  assert.equal(cache.get('other'), 'retained');
  assert.equal(cache.has('missing'), false);
});

for (const [label, value] of [
  ['object', { synchronous: true }],
  ['zero', 0],
  ['false', false],
  ['empty string', ''],
]) {
  test(`fetch lifecycle: synchronous ${label} results settle and remain cached`, async () => {
    let calls = 0;
    let signal;
    const cache = new Cache({
      max: 2,
      fetchMethod: (key, oldValue, options) => {
        calls++;
        signal = options.signal;
        return value;
      },
    });
    const first = cache.fetch('key');
    const joined = cache.fetch('key');
    assert.deepEqual(await settled(Promise.all([first, joined])), [value, value]);
    assert.equal(cache.get('key'), value);
    assert.equal(await settled(cache.fetch('key')), value);
    assert.equal(calls, 1);
    assert.equal(await settled(cache.fetch('key', { forceRefresh: true })), value);
    assert.equal(calls, 2);
    assert.equal(signal.aborted, false);
  });
}

test('fetch lifecycle: synchronous undefined settles a miss and preserves a refresh stale value', async () => {
  const inserts = [];
  const disposed = [];
  const cache = new Cache({
    max: 2,
    fetchMethod: () => undefined,
    onInsert: (...args) => inserts.push(args),
    dispose: (...args) => disposed.push(args),
  });
  assert.equal(await settled(cache.fetch('missing')), undefined);
  assert.equal(cache.size, 0);
  assert.deepEqual(inserts, []);
  cache.set('key', 'stale');
  inserts.length = 0;
  assert.equal(await settled(cache.fetch('key', { forceRefresh: true })), undefined);
  assert.equal(cache.get('key'), 'stale');
  assert.deepEqual(inserts, []);
  assert.deepEqual(disposed, []);
});

test('fetch lifecycle: explicit replacement still aborts the refresh and wins over a late result', async () => {
  const provider = deferred();
  const stale = { version: 1 };
  const replacement = { manual: true };
  const disposed = [];
  const disposedAfter = [];
  let signal;
  const cache = new Cache({
    max: 2,
    fetchMethod: (key, oldValue, options) => {
      signal = options.signal;
      return provider.promise;
    },
    dispose: (...args) => disposed.push(args),
    disposeAfter: (...args) => disposedAfter.push(args),
  });
  cache.set('key', stale);
  const refreshing = cache.fetch('key', { forceRefresh: true });
  const rejected = assert.rejects(refreshing, { message: 'replaced' });
  cache.set('key', replacement);
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.message, 'replaced');
  provider.resolve({ late: true });
  await nextTurn();
  assert.equal(cache.get('key'), replacement);
  assert.deepEqual(disposed, [[stale, 'key', 'set']]);
  assert.deepEqual(disposedAfter, [[stale, 'key', 'set']]);
});

test('fetch lifecycle: completed fetches keep ordinary LRU recency and eviction', async () => {
  const calls = [];
  const cache = new Cache({
    max: 2,
    fetchMethod: async key => { calls.push(key); return key.toUpperCase(); },
  });
  assert.equal(await cache.fetch('a'), 'A');
  assert.equal(await cache.fetch('b'), 'B');
  assert.equal(await cache.fetch('a'), 'A');
  assert.equal(await cache.fetch('c'), 'C');
  assert.deepEqual(calls, ['a', 'b', 'c']);
  assert.deepEqual([...cache.entries()], [['c', 'C'], ['a', 'A']]);
  assert.equal(cache.has('b'), false);
});
