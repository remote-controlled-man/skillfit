import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getEventListeners } from 'node:events';
import { flush, observe, gate, withClock } from '../test-clock.mjs';

const yes = (state, value) => { assert.equal(state.status, 'fulfilled'); assert.deepEqual(state.value, value); };
const no = (state, reason) => { assert.equal(state.status, 'rejected'); assert.equal(state.reason, reason); };
const names = {
  'limit-async-context': ['Distinct callers retain their own store', 'Queued-to-active transitions retain context', 'Concurrency one and multiple preserve isolation', 'Ordinary fulfillment and rejection remain intact'],
  'timeout-custom-timers': ['Scheduling does not bind this to the customTimers container', 'Clearing does not bind this to that container', 'Timeout and fallback paths keep their results', 'Ordinary fulfillment and rejection keep identity'],
  'throttle-sync-throw': ['Delayed sync throw rejects with the original error', 'Queue state is cleaned after failure', 'Async rejections still propagate', 'Successful calls preserve receiver and arguments'],
  'commander-output-isolation': ['Child configuration applies locally', 'Parent output configuration remains intact', 'Sibling configuration remains intact', 'Unmodified output callbacks remain available'],
  'limit-map-iteration-rejection': ['Iterator error identity reaches the caller', 'Scheduled mapper failures create no unhandled rejection', 'Already queued work still finishes with correct queue counts', 'Ordinary arrays and array-like inputs keep map behavior'],
  'timeout-rejection-listener': ['Original rejection identity is retained', 'No derived promise creates an unhandled rejection', 'Abort listeners are removed on settlement', 'Fulfillment, explicit abort and timeout paths remain intact'],
  'timeout-infinity-abort': ['An already aborted signal rejects', 'An abort after wrapping also rejects', 'Unaborted input fulfillment and rejection pass through', 'Infinity schedules no finite timeout'],
  'commander-async-listener-order': ['Async preAction then action precede the legacy event', 'postAction follows that event', 'parseAsync waits for the action chain', 'Synchronous and no-subcommand cases keep their order'],
};
export const caseNames = task => { assert.ok(names[task], 'unknown task'); return names[task]; };

export async function runCase(api, task, index) {
  const fn = api.default, Command = api.Command ?? api.default?.Command;
  const run = {
    'limit-async-context': [
      async () => {
        const store = new AsyncLocalStorage(), limit = fn(2);
        await Promise.all(Array.from({ length: 32 }, (_, id) => store.run({ id }, () => limit(async () => {
          await Promise.resolve(); assert.equal(store.getStore()?.id, id);
        }))));
      },
      async () => {
        const store = new AsyncLocalStorage(), limit = fn(1), ready = gate();
        const first = store.run('first', () => limit(async () => { await ready.promise; return store.getStore(); }));
        const later = ['second', 'third'].map(id => store.run(id, () => limit(() => store.getStore())));
        await flush(); ready.release(); assert.deepEqual(await Promise.all([first, ...later]), ['first', 'second', 'third']);
      },
      async () => {
        for (const concurrency of [1, 3, 7]) {
          const limit = fn(concurrency), store = new AsyncLocalStorage();
          const result = await Promise.all(Array.from({ length: 20 }, (_, id) => store.run(id, () => limit(async () => {
            await Promise.resolve(); return store.getStore();
          }))));
          assert.deepEqual(result, Array.from({ length: 20 }, (_, id) => id));
          assert.equal(limit.activeCount, 0); assert.equal(limit.pendingCount, 0);
        }
      },
      async () => {
        const limit = fn(2), error = new Error('preserved');
        assert.deepEqual(await Promise.all([limit(() => 2), limit(async () => 4)]), [2, 4]);
        await assert.rejects(limit(() => { throw error; }), value => value === error);
        assert.equal(await limit(() => 8), 8);
      },
    ],
    'timeout-custom-timers': [
      () => withClock(async () => {
        const customTimers = { setTimeout: function (...args) { assert.equal(this, undefined); return setTimeout(...args); }, clearTimeout: (...args) => clearTimeout(...args) };
        const state = observe(fn(Promise.resolve(7), { milliseconds: 20, customTimers })); await flush(); yes(state, 7);
      }),
      () => withClock(async () => {
        let clears = 0;
        const customTimers = { setTimeout: (...args) => setTimeout(...args), clearTimeout: function (...args) { assert.equal(this, undefined); clears++; return clearTimeout(...args); } };
        const state = observe(fn(Promise.resolve(9), { milliseconds: 20, customTimers })); await flush(); yes(state, 9); assert.equal(clears, 1);
      }),
      () => withClock(async clock => {
        const a = observe(fn(new Promise(() => {}), { milliseconds: 10, fallback: () => 42 }));
        await clock.advance(10); yes(a, 42);
        const error = new Error('fallback'); const b = observe(fn(new Promise(() => {}), { milliseconds: 10, fallback: () => { throw error; } }));
        await clock.advance(10); no(b, error);
      }),
      () => withClock(async () => {
        const error = new Error('source'), a = observe(fn(Promise.resolve(false), { milliseconds: 20 })), b = observe(fn(Promise.reject(error), { milliseconds: 20 }));
        await flush(); yes(a, false); no(b, error);
      }),
    ],
    'throttle-sync-throw': [
      () => withClock(async clock => {
        const throttle = fn({ limit: 1, interval: 10 }), error = new Error('delayed');
        await throttle(() => 1)(); const state = observe(throttle(() => { throw error; })());
        await clock.advance(10); no(state, error);
      }),
      () => withClock(async clock => {
        const throttle = fn({ limit: 1, interval: 10 }), controller = new AbortController(), error = new Error('failure');
        await throttle(() => 1)(); const wrapped = throttle(() => { throw error; }), state = observe(wrapped());
        assert.equal(wrapped.queueSize, 1); await clock.advance(10); assert.equal(wrapped.queueSize, 0); no(state, error);
        const next = observe(throttle(() => 3)()); await clock.advance(10); yes(next, 3);
      }),
      () => withClock(async clock => {
        const throttle = fn({ limit: 1, interval: 10 }), error = new Error('async');
        await throttle(() => 1)(); const state = observe(throttle(async () => { throw error; })()); await clock.advance(10); no(state, error);
      }),
      () => withClock(async clock => {
        const wrapped = fn({ limit: 1, interval: 10 })(function (...args) { return [this.name, ...args]; });
        const a = observe(wrapped.call({ name: 'a' }, 1)), b = observe(wrapped.call({ name: 'b' }, 2, 3));
        await clock.advance(10); yes(a, ['a', 1]); yes(b, ['b', 2, 3]);
      }),
    ],
    'commander-output-isolation': [0, 1, 2, 3].map(which => async () => {
      const parent = new Command(), writeOut = () => {}, writeErr = () => {};
      parent.configureOutput({ getOutHelpWidth: () => 80, writeOut, writeErr });
      const child = parent.createCommand('child').copyInheritedSettings(parent);
      const sibling = parent.createCommand('sibling').copyInheritedSettings(parent);
      child.configureOutput({ getOutHelpWidth: () => 40 });
      if (which === 0) assert.equal(child.configureOutput().getOutHelpWidth(), 40);
      if (which === 1) assert.equal(parent.configureOutput().getOutHelpWidth(), 80);
      if (which === 2) assert.equal(sibling.configureOutput().getOutHelpWidth(), 80);
      if (which === 3) { assert.equal(child.configureOutput().writeOut, writeOut); assert.equal(child.configureOutput().writeErr, writeErr); }
    }),
    'limit-map-iteration-rejection': [
      async () => {
        const limit = fn(1), error = new Error('iterator'); function* values() { yield 1; yield 2; throw error; }
        await assert.rejects(limit.map(values(), value => value * 2), value => value === error); await limit(() => {});
      },
      async () => {
        const limit = fn(1), error = new Error('iterator'); function* values() { yield 1; yield 2; yield 3; throw error; }
        await assert.rejects(limit.map(values(), async value => { throw new Error('mapper-' + value); }), value => value === error);
        await limit(() => {}); assert.equal(limit.activeCount, 0); assert.equal(limit.pendingCount, 0);
        // The isolated probe checks unhandledRejection events after queued work settles.
      },
      async () => {
        const limit = fn(1), error = new Error('iterator'), ready = gate(), finished = [];
        function* values() { yield 1; yield 2; throw error; }
        const state = observe(limit.map(values(), async value => { await ready.promise; finished.push(value); }));
        await flush(); no(state, error); assert.deepEqual(finished, []);
        ready.release(); await limit(() => {}); assert.deepEqual(finished, [1, 2]); assert.equal(limit.activeCount, 0); assert.equal(limit.pendingCount, 0);
      },
      async () => {
        const limit = fn(2);
        assert.deepEqual(await limit.map([2, 4], (value, index) => [index, value]), [[0, 2], [1, 4]]);
        assert.deepEqual(await limit.map({ 0: 'a', 1: 'b', length: 2 }, (value, index) => `${index}:${value}`), ['0:a', '1:b']);
        assert.deepEqual(await limit.map([], () => assert.fail()), []);
      },
    ],
    'timeout-rejection-listener': [
      () => withClock(async () => {
        const error = new Error('original'), state = observe(fn(Promise.reject(error), { milliseconds: 10 })); await flush(); no(state, error);
      }),
      () => withClock(async () => {
        const controller = new AbortController(), error = new Error('source');
        const state = observe(fn(Promise.reject(error), { milliseconds: 10, signal: controller.signal })); await flush(); no(state, error);
      }),
      () => withClock(async () => {
        const controller = new AbortController(), ready = gate();
        const state = observe(fn(ready.promise, { milliseconds: 10, signal: controller.signal }));
        assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
        ready.release(4); await flush(); yes(state, 4); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      }),
      () => withClock(async clock => {
        const controller = new AbortController(), error = new Error('abort');
        const a = observe(fn(new Promise(() => {}), { milliseconds: 10, signal: controller.signal })); controller.abort(error); await flush(); no(a, error);
        const b = observe(fn(new Promise(() => {}), { milliseconds: 10 })); await clock.advance(10);
        assert.equal(b.status, 'rejected'); assert.equal(b.reason.name, 'TimeoutError');
      }),
    ],
    'timeout-infinity-abort': [
      () => withClock(async () => {
        const controller = new AbortController(), error = new Error('already'); controller.abort(error);
        const state = observe(fn(new Promise(() => {}), { milliseconds: Infinity, signal: controller.signal })); await flush(); no(state, error);
      }),
      () => withClock(async () => {
        const controller = new AbortController(), error = new Error('later');
        const state = observe(fn(new Promise(() => {}), { milliseconds: Infinity, signal: controller.signal })); controller.abort(error); await flush(); no(state, error);
      }),
      () => withClock(async () => {
        const error = new Error('source'), a = observe(fn(Promise.resolve(5), { milliseconds: Infinity })), b = observe(fn(Promise.reject(error), { milliseconds: Infinity }));
        await flush(); yes(a, 5); no(b, error);
      }),
      () => withClock(async clock => {
        const state = observe(fn(Promise.resolve(7), { milliseconds: Infinity })); await flush(); yes(state, 7); assert.equal(clock.pending, 0);
      }),
    ],
    'commander-async-listener-order': [
      async () => {
        const events = [], parent = new Command();
        parent.hook('preAction', async () => { events.push('pre-start'); await Promise.resolve(); events.push('pre-end'); });
        parent.command('child').action(async () => { events.push('action-start'); await Promise.resolve(); events.push('action-end'); });
        parent.on('command:child', () => events.push('legacy'));
        await parent.parseAsync(['child'], { from: 'user' }); assert.deepEqual(events, ['pre-start', 'pre-end', 'action-start', 'action-end', 'legacy']);
      },
      async () => {
        const events = [], parent = new Command();
        parent.command('child').action(async () => { await Promise.resolve(); events.push('action'); }).hook('postAction', () => events.push('post'));
        parent.on('command:child', () => events.push('legacy')); await parent.parseAsync(['child'], { from: 'user' }); assert.deepEqual(events, ['action', 'legacy', 'post']);
      },
      async () => {
        const parent = new Command(), ready = gate(), events = [];
        parent.command('child').action(async () => { await ready.promise; events.push('action'); }); parent.on('command:child', () => events.push('legacy'));
        const parsed = observe(parent.parseAsync(['child'], { from: 'user' })); await flush(); assert.equal(parsed.status, 'pending'); assert.deepEqual(events, []);
        ready.release(); await flush(); assert.deepEqual(events, ['action', 'legacy']); assert.equal(parsed.status, 'fulfilled');
      },
      async () => {
        const events = [], parent = new Command(); parent.command('child').action(() => events.push('action')); parent.on('command:child', () => events.push('legacy'));
        parent.parse(['child'], { from: 'user' }); assert.deepEqual(events, ['action', 'legacy']);
        const top = new Command(); top.action(() => events.push('top')); top.parse([], { from: 'user' }); assert.deepEqual(events, ['action', 'legacy', 'top']);
      },
    ],
  };
  assert.ok(run[task]?.[index], 'unknown probe'); await run[task][index]();
}
