import assert from 'node:assert/strict';

export async function flush() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}

export function observe(promise) {
  const state = {status: 'pending'};
  Promise.resolve(promise).then(
    value => Object.assign(state, {status: 'fulfilled', value}),
    reason => Object.assign(state, {status: 'rejected', reason}),
  );
  return state;
}

export function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return {promise, release};
}

// Only test processes replace their clock; fixtures and the eval runner stay unchanged.
export async function withClock(run) {
  const original = {setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now};
  let now = 1000, serial = 0;
  const timers = new Map(), errors = [];
  globalThis.setTimeout = (fn, delay = 0, ...args) => {
    const id = ++serial;
    timers.set(id, {at: now + Math.max(0, Number(delay)), fn, args});
    return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  Date.now = () => now;
  const clock = {
    get now() { return now; },
    async advance(amount) {
      const end = now + amount;
      for (let steps = 0; ; steps++) {
        assert.ok(steps < 1000, 'timer queue must make bounded progress');
        const next = [...timers.entries()].filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id); now = timer.at;
        try {
          const result = timer.fn(...timer.args);
          if (result?.then) Promise.resolve(result).catch(error => errors.push(error));
        } catch (error) { errors.push(error); }
        await flush();
      }
      now = end;
      await flush();
    },
  };
  try {
    await run(clock);
    await flush();
    assert.deepEqual(errors, [], 'scheduled callbacks must not throw outside their public promises');
  } finally {
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    Date.now = original.now;
  }
}
