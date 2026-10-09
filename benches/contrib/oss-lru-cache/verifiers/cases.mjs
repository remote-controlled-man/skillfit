import assert from 'node:assert/strict';

export const turn = () => new Promise(resolve => setImmediate(resolve));
export function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
export function tracked(promise) { const state = { settled: false }; Promise.resolve(promise).then(value => Object.assign(state, { settled: true, value }), error => Object.assign(state, { settled: true, error })); return state; }
function entries(cache) { const it = cache.entries(); const rows = []; for (let i = 0; i < 20; i++) { const row = it.next(); if (row.done) return rows; rows.push(row.value); } throw new Error('iteration did not terminate within bounded cache capacity'); }
function pendingCache(Cache, extra = {}) { const jobs = new Map(); const signals = new Map(); const cache = new Cache({ max: 2, fetchMethod: (key, old, { signal }) => { const job = deferred(); jobs.set(key, job); signals.set(key, signal); return job.promise; }, ...extra }); return { cache, jobs, signals }; }

export function checksFor(id, Cache) {
  const common = [['ordinary LRU and successful async fetch', async () => {
    const c = new Cache({ max: 2, fetchMethod: async key => `${key}!` }); c.set('a', 'A'); c.set('b', 'B');
    assert.equal(c.get('a'), 'A'); c.set('c', 'C'); assert.equal(c.has('b'), false);
    assert.equal(await c.fetch('d'), 'd!'); assert.equal(c.get('d'), 'd!'); assert.equal(c.size, 2);
  }], ['concurrent fetches deduplicate provider work', async () => {
    let calls = 0; const job = deferred(); const c = new Cache({ max: 3, fetchMethod: () => { calls++; return job.promise; } });
    const a = c.fetch('x'); const b = c.fetch('x'); assert.equal(calls, 1); job.resolve('X');
    assert.deepEqual(await Promise.all([a, b]), ['X', 'X']); assert.equal(c.get('x'), 'X');
  }]];
  if (id === 'fetch-size') return [...common,
    ['size accounting and LRU order after out-of-order resolution', async () => {
      const jobs = new Map(); const c = new Cache({ maxSize: 10, sizeCalculation: (v, k) => k,
        fetchMethod: key => { const job = deferred(); jobs.set(key, job); return job.promise; } });
      const ps = [3, 4, 5].map(key => c.fetch(key));
      jobs.get(4).resolve(4); await ps[1]; jobs.get(5).resolve(5); await ps[2]; jobs.get(3).resolve(3); await ps[0];
      const rows = entries(c); assert.equal(c.size, 2); assert.deepEqual(rows, [[3, 3], [5, 5]]);
      assert.equal(c.calculatedSize, rows.reduce((sum, [k]) => sum + k, 0)); assert.equal(c.calculatedSize, 8);
    }], ['size-bound ordinary updates preserve newest entry', async () => {
      const c = new Cache({ maxSize: 6, sizeCalculation: value => value }); c.set('a', 2); c.set('b', 3); c.set('a', 4);
      assert.equal(c.get('a'), 4); assert.equal(c.has('b'), false); assert.equal(c.calculatedSize, 4); assert.equal(c.size, 1);
    }]];
  if (id === 'fetch-abort') return [...common,
    ...['deleted', 'evicted', 'replaced'].map(reason => [`${reason} pending fetch rejects before provider completion`, async () => {
      const { cache: c, jobs, signals } = pendingCache(Cache); const state = tracked(c.fetch('x'));
      if (reason === 'deleted') c.delete('x');
      else if (reason === 'replaced') c.set('x', 'explicit');
      else { c.set('a', 'A'); c.set('b', 'B'); }
      await turn(); const beforeRelease = { ...state }; const signal = signals.get('x');
      jobs.get('x').resolve('late'); await turn();
      assert.equal(signal.aborted, true); assert.equal(beforeRelease.settled, true, 'must settle independently of provider completion');
      assert.ok(beforeRelease.error instanceof Error); assert.equal(beforeRelease.error.message, reason);
      assert.equal(state.error.message, reason);
      if (reason === 'replaced') assert.equal(c.get('x'), 'explicit'); else assert.equal(c.has('x'), false);
    }]), ['stale-on-rejection remains supported', async () => {
      const { cache: c, jobs } = pendingCache(Cache, { allowStaleOnFetchRejection: true }); c.set('x', 'stale');
      const promise = c.fetch('x', { forceRefresh: true }); jobs.get('x').reject(new Error('provider failed'));
      assert.equal(await promise, 'stale'); assert.equal(c.get('x'), 'stale');
    }]];
  if (id === 'fetch-lifecycle') return [...common,
    ['onInsert hides placeholder and classifies resolved application values', async () => {
      const inserted = []; const { cache: c, jobs } = pendingCache(Cache, { max: 5, onInsert: (...args) => inserted.push(args) });
      const fresh = c.fetch('new'); assert.deepEqual(inserted, []); jobs.get('new').resolve('N'); await fresh;
      c.set('same', 'S'); const same = c.fetch('same', { forceRefresh: true }); jobs.get('same').resolve('S'); await same;
      c.set('change', 'old'); const changed = c.fetch('change', { forceRefresh: true }); jobs.get('change').resolve('new'); await changed;
      assert.deepEqual(inserted, [['N', 'new', 'add'], ['S', 'same', 'add'], ['S', 'same', 'update'], ['old', 'change', 'add'], ['new', 'change', 'replace']]);
    }], ['refresh eviction disposes stale value once in both callbacks', async () => {
      const disposed = []; const after = []; const { cache: c, jobs } = pendingCache(Cache, { max: 2,
        dispose: (...args) => disposed.push(args), disposeAfter: (...args) => after.push(args) });
      c.set('x', 'stale'); const state = tracked(c.fetch('x', { forceRefresh: true })); c.set('a', 'A'); c.set('b', 'B');
      await turn(); jobs.get('x').resolve('late'); await turn();
      assert.equal(state.error?.message, 'evicted'); assert.deepEqual(disposed, [['stale', 'x', 'evict']]); assert.deepEqual(after, disposed);
      assert.equal(c.has('x'), false);
    }], ['synchronous fetch result settles and is cached', async () => {
      const c = new Cache({ max: 2, fetchMethod: key => `${key}!` }); const state = tracked(c.fetch('x'));
      await turn(); assert.equal(state.settled, true); assert.equal(state.value, 'x!'); assert.equal(c.get('x'), 'x!');
    }], ['own refresh completion does not abort the provider', async () => {
      const { cache: c, jobs, signals } = pendingCache(Cache); c.set('x', 'old'); const p = c.fetch('x', { forceRefresh: true });
      jobs.get('x').resolve('new'); assert.equal(await p, 'new'); assert.equal(signals.get('x').aborted, false);
    }], ['explicit replacement still aborts refresh and retains replacement', async () => {
      const { cache: c, jobs, signals } = pendingCache(Cache); c.set('x', 'old'); const state = tracked(c.fetch('x', { forceRefresh: true }));
      c.set('x', 'explicit'); await turn(); jobs.get('x').resolve('late'); await turn();
      assert.equal(signals.get('x').aborted, true); assert.equal(state.error?.message, 'replaced'); assert.equal(c.get('x'), 'explicit');
    }]];
  throw new Error(`Unknown case: ${id}`);
}
