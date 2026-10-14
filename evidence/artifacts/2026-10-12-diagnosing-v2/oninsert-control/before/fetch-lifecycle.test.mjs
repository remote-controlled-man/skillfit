#!/usr/bin/env node
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { dirname } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { loadCache } from './runtime.mjs';

const { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), true);
after(cleanup);

// A synchronous provider must settle its callers before the next event-loop turn.
const beforeNextTurn = promise => Promise.race([
  promise,
  nextTurn().then(() => assert.fail('fetch did not settle before the next turn')),
]);

test('fetch lifecycle: ordinary onInsert reasons and application Promises remain intact', () => {
  const inserts = [];
  const c = new Cache({ max: 2, fetchMethod: async () => 'fetched',
    onInsert: (...args) => inserts.push(args) });
  const first = { value: 1 };
  const second = { value: 2 };
  const applicationPromise = Promise.resolve('application value');
  c.set('key', first);
  c.set('key', first);
  c.set('key', second);
  c.set('promise', applicationPromise);
  assert.deepEqual(inserts, [
    [first, 'key', 'add'], [first, 'key', 'update'],
    [second, 'key', 'replace'], [applicationPromise, 'promise', 'add'],
  ]);
  assert.equal(c.get('promise'), applicationPromise);
});

test('fetch lifecycle: onInsert never exposes a pending miss and coalesced callers succeed', async () => {
  const provider = Promise.withResolvers();
  const value = { fetched: true };
  const inserts = [];
  let calls = 0;
  const c = new Cache({ max: 2, onInsert: (...args) => inserts.push(args),
    fetchMethod: () => { calls++; return provider.promise; } });
  const first = c.fetch('key');
  const second = c.fetch('key');
  assert.deepEqual(inserts, []);
  assert.equal(calls, 1);
  provider.resolve(value);
  assert.deepEqual(await Promise.all([first, second]), [value, value]);
  // The result replaces the pending entry already occupying this key.
  assert.deepEqual(inserts, [[value, 'key', 'replace']]);
  assert.equal(c.get('key'), value);
  assert.equal(await c.fetch('key'), value);
  assert.equal(calls, 1);
});

test('fetch lifecycle: refresh inserts only its completed application value', async () => {
  const provider = Promise.withResolvers();
  const inserts = [];
  const c = new Cache({ max: 2, onInsert: (...args) => inserts.push(args),
    fetchMethod: () => provider.promise });
  c.set('key', 'old');
  const pending = c.fetch('key', { forceRefresh: true });
  assert.equal(c.get('key'), 'old');
  assert.deepEqual(inserts, [['old', 'key', 'add']]);
  provider.resolve('new');
  assert.equal(await pending, 'new');
  assert.deepEqual(inserts, [['old', 'key', 'add'], ['new', 'key', 'replace']]);
  assert.equal(c.get('key'), 'new');
});

test('fetch lifecycle: successful fills and refreshes do not abort their providers', async () => {
  const signals = [];
  const aborts = [];
  const c = new Cache({ max: 2, fetchMethod: async (key, old, { signal }) => {
    signals.push(signal);
    signal.addEventListener('abort', () => aborts.push(signal.reason));
    return old === undefined ? 'first' : 'refreshed';
  } });
  assert.equal(await c.fetch('key'), 'first');
  assert.equal(await c.fetch('key', { forceRefresh: true }), 'refreshed');
  assert.equal(c.get('key'), 'refreshed');
  assert.equal(signals.length, 2);
  assert.deepEqual(signals.map(signal => signal.aborted), [false, false]);
  assert.deepEqual(aborts, []);
});

for (const mode of ['count', 'size', 'pop']) {
  test(`fetch lifecycle: ${mode} eviction disposes a refreshing stale value exactly once`, async () => {
    const provider = Promise.withResolvers();
    const disposals = [];
    let signal;
    const c = new Cache({
      ...(mode === 'size' ? { maxSize: 1, sizeCalculation: () => 1 } : { max: 1 }),
      dispose: (...args) => disposals.push(['dispose', ...args]),
      disposeAfter: (...args) => {
        disposals.push(['disposeAfter', ...args]);
        assert.equal(c.has('old'), false);
      },
      fetchMethod: (key, old, options) => { signal = options.signal; return provider.promise; },
    });
    c.set('old', 0);
    const pending = c.fetch('old', { forceRefresh: true });
    const rejected = assert.rejects(pending, { message: 'evicted' });
    if (mode === 'pop') c.pop();
    else c.set('keep', 1);
    assert.equal(signal.aborted, true);
    const expected = [['dispose', 0, 'old', 'evict'], ['disposeAfter', 0, 'old', 'evict']];
    assert.deepEqual(disposals, expected);
    await rejected;
    provider.resolve(2);
    await nextTurn();
    assert.deepEqual(disposals, expected);
    assert.equal(c.has('old'), false);
    assert.equal(c.size, mode === 'pop' ? 0 : 1);
    if (mode !== 'pop') assert.equal(c.get('keep'), 1);
  });
}

test('fetch lifecycle: evicting a pending miss does not dispose an internal Promise', async () => {
  const provider = Promise.withResolvers();
  const disposals = [];
  const c = new Cache({ max: 1, fetchMethod: () => provider.promise,
    dispose: (...args) => disposals.push(args),
    disposeAfter: (...args) => disposals.push(args) });
  const pending = c.fetch('missing');
  const rejected = assert.rejects(pending, { message: 'evicted' });
  c.set('keep', 'value');
  await rejected;
  provider.resolve('late');
  await nextTurn();
  assert.deepEqual(disposals, []);
  assert.equal(c.get('keep'), 'value');
  assert.equal(c.has('missing'), false);
});

test('fetch lifecycle: synchronous values settle both miss and refresh callers including falsy values', async () => {
  for (const value of ['value', 0, false, null, { value: 'object' }]) {
    let calls = 0;
    const c = new Cache({ max: 1, fetchMethod: () => { calls++; return value; } });
    const first = c.fetch('key');
    const second = c.fetch('key');
    assert.deepEqual(await beforeNextTurn(Promise.all([first, second])), [value, value]);
    assert.equal(c.get('key'), value);
    assert.equal(calls, 1);
    assert.equal(await beforeNextTurn(c.fetch('key', { forceRefresh: true })), value);
    assert.equal(c.get('key'), value);
    assert.equal(calls, 2);
  }
});

test('fetch lifecycle: synchronous undefined settles misses and preserves refresh stale values', async () => {
  const inserts = [];
  const c = new Cache({ max: 1, fetchMethod: () => undefined,
    onInsert: (...args) => inserts.push(args) });
  assert.equal(await beforeNextTurn(c.fetch('missing')), undefined);
  assert.equal(c.size, 0);
  assert.deepEqual(inserts, []);
  c.set('key', 'old');
  assert.equal(await beforeNextTurn(c.fetch('key', { forceRefresh: true })), undefined);
  assert.equal(c.get('key'), 'old');
  assert.deepEqual(inserts, [['old', 'key', 'add']]);
});

test('fetch lifecycle: explicit replacement still cancels refresh and keeps the replacement', async () => {
  const provider = Promise.withResolvers();
  const disposals = [];
  const inserts = [];
  let signal;
  const c = new Cache({ max: 2,
    fetchMethod: (key, old, options) => { signal = options.signal; return provider.promise; },
    dispose: (...args) => disposals.push(['dispose', ...args]),
    disposeAfter: (...args) => disposals.push(['disposeAfter', ...args]),
    onInsert: (...args) => inserts.push(args) });
  c.set('key', 'old');
  const pending = c.fetch('key', { forceRefresh: true });
  const rejected = assert.rejects(pending, { message: 'replaced' });
  c.set('key', 'manual');
  assert.equal(signal.aborted, true);
  await rejected;
  provider.resolve('late');
  await nextTurn();
  assert.equal(c.get('key'), 'manual');
  assert.deepEqual(inserts, [['old', 'key', 'add'], ['manual', 'key', 'replace']]);
  assert.deepEqual(disposals, [
    ['dispose', 'old', 'key', 'set'], ['disposeAfter', 'old', 'key', 'set'],
  ]);
});

test('fetch lifecycle: a stale fallback after rejection does not insert a Promise', async () => {
  const provider = Promise.withResolvers();
  const inserts = [];
  const c = new Cache({ max: 1, fetchMethod: () => provider.promise,
    onInsert: (...args) => inserts.push(args) });
  c.set('key', 'old');
  const pending = c.fetch('key', { forceRefresh: true, allowStaleOnFetchRejection: true });
  provider.reject(new Error('provider failed'));
  assert.equal(await pending, 'old');
  assert.equal(c.get('key'), 'old');
  assert.deepEqual(inserts, [['old', 'key', 'add']]);
});

test('fetch lifecycle: successful fetch hits retain normal LRU recency and eviction', async () => {
  const c = new Cache({ max: 2, fetchMethod: async key => key.toUpperCase() });
  assert.equal(await c.fetch('a'), 'A');
  assert.equal(await c.fetch('b'), 'B');
  assert.equal(await c.fetch('a'), 'A');
  c.set('c', 'C');
  assert.deepEqual([...c.entries()], [['c', 'C'], ['a', 'A']]);
  assert.equal(c.has('b'), false);
});
