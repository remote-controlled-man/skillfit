import assert from 'node:assert/strict';
import {flush, gate, observe, withClock} from '../test-clock.mjs';
const yes = (state, value) => assert.deepEqual(state, {status: 'fulfilled', value});
const no = (state, reason) => assert.deepEqual(state, {status: 'rejected', reason});

export function casesFor(api, task) {
  const fn = api?.default;
  const cases = {
    'promise-falsy-rejection': [
      ['shared pending calls preserve every falsy rejection reason', async () => {
        for (const reason of [undefined, null, false, 0, '', Number.NaN]) {
          const d = fn.promise(async () => { throw reason; });
          const a = observe(d()), b = observe(d());
          await flush(); no(a, reason); no(b, reason);
        }
      }],
      ['a falsy initial rejection survives while the queued call succeeds', async () => {
        const ready = gate();
        const d = fn.promise(async value => { if (value === 'first') { await ready.promise; throw null; } return value; }, {after: true});
        const a = observe(d('first')), b = observe(d('queued'));
        ready.release(); await flush(); no(a, null); yes(b, 'queued');
        const c = observe(d('next')); await flush(); yes(c, 'next');
      }],
      ['queued rejections and ordinary Error identity remain intact', async () => {
        const ready = gate(), error = new Error('retained identity');
        const d = fn.promise(async value => { if (value === 'first') { await ready.promise; return 7; } throw false; }, {after: true});
        const a = observe(d('first')), b = observe(d('queued'));
        ready.release(); await flush(); yes(a, 7); no(b, false);
        const other = fn.promise(async () => { throw error; });
        const c = observe(other()); await flush(); no(c, error);
      }],
      ['successful falsy return values and later calls remain successful', async () => {
        const d = fn.promise(async value => value);
        for (const value of [undefined, null, false, 0, '', 42]) {
          const state = observe(d(value)); await flush(); yes(state, value);
        }
      }],
    ],
    'promise-overlap-results': [
      ['overlapping cycles settle with their own latest values', async () => withClock(async clock => {
        const ready = gate(), calls = [];
        const d = fn(async value => { calls.push(value); if (value === 'first') await ready.promise; return value; }, 10);
        const a = observe(d('first')); await clock.advance(10);
        const b = observe(d('middle')), c = observe(d('last')); await clock.advance(10);
        assert.equal(a.status, 'pending'); yes(b, 'last'); yes(c, 'last');
        ready.release(); await flush(); yes(a, 'first'); assert.deepEqual(calls, ['first', 'last']);
      })],
      ['a first-cycle rejection does not reject a later cycle', async () => withClock(async clock => {
        const ready = gate(), error = new Error('first cycle');
        const d = fn(async value => { if (value === 'first') { await ready.promise; throw error; } return value; }, 10);
        const a = observe(d('first')); await clock.advance(10);
        const b = observe(d('second')); ready.release(); await flush(); no(a, error); assert.equal(b.status, 'pending');
        await clock.advance(10); yes(b, 'second');
      })],
      ['a later-cycle rejection does not replace an earlier result', async () => withClock(async clock => {
        const ready = gate(), error = new Error('second cycle');
        const d = fn(async value => { if (value === 'first') { await ready.promise; return value; } throw error; }, 10);
        const a = observe(d('first')); await clock.advance(10);
        const b = observe(d('second')); await clock.advance(10); no(b, error); assert.equal(a.status, 'pending');
        ready.release(); await flush(); yes(a, 'first');
      })],
      ['ordinary same-cycle calls and independent wrappers stay isolated', async () => withClock(async clock => {
        const a = fn(async value => 'a-' + value, 10), b = fn(async value => 'b-' + value, 10);
        const results = [observe(a(1)), observe(a(2)), observe(b(3)), observe(b(4))];
        await clock.advance(10);
        ['a-2', 'a-2', 'b-4', 'b-4'].forEach((value, i) => yes(results[i], value));
        const next = observe(a(5)); await clock.advance(10); yes(next, 'a-5');
      })],
    ],
    'promise-method-context': [
      ['trailing invocation preserves the receiver and arguments', async () => withClock(async clock => {
        const object = {label: 'receiver'};
        object.call = fn(function (...args) { return {context: this, args}; }, 10);
        const state = observe(object.call(3, 'value')); await clock.advance(10);
        yes(state, {context: object, args: [3, 'value']});
      })],
      ['coalesced trailing calls use the last receiver', async () => withClock(async clock => {
        const a = {}, b = {}, d = fn(function (value) { return {context: this, value}; }, 10);
        const x = observe(d.call(a, 'old')), y = observe(d.call(b, 'latest'));
        await clock.advance(10); yes(x, {context: b, value: 'latest'}); yes(y, {context: b, value: 'latest'});
      })],
      ['leading invocation retains its first receiver and cached result', async () => withClock(async clock => {
        const a = {}, b = {}; let calls = 0;
        const d = fn(function (value) { calls++; return {context: this, value}; }, 10, {leading: true});
        const x = observe(d.call(a, 'first')), y = observe(d.call(b, 'ignored'));
        await clock.advance(10); yes(x, {context: a, value: 'first'}); yes(y, {context: a, value: 'first'}); assert.equal(calls, 1);
      })],
      ['promise wrapper preserves the receiver of its shared execution', async () => {
        const ready = gate(), a = {}, b = {}; let calls = 0;
        const d = fn.promise(async function (value) { calls++; await ready.promise; return {context: this, value}; });
        const x = observe(d.call(a, 'first')), y = observe(d.call(b, 'shared'));
        ready.release(); await flush(); yes(x, {context: a, value: 'first'}); yes(y, {context: a, value: 'first'}); assert.equal(calls, 1);
      }],
    ],
    'duration-plural-count': [
      ['English unit forms match the displayed truncated count', async () => {
        for (const value of [1005, 1500, 1999]) assert.equal(fn(value, {units: ['s'], maxDecimalPoints: 0}), '1 second');
        assert.equal(fn(2500, {units: ['s'], maxDecimalPoints: 0}), '2 seconds');
      }],
      ['singular forms in other languages use the displayed count', async () => {
        assert.equal(fn(1500, {language: 'de', units: ['s'], maxDecimalPoints: 0}), '1 Sekunde');
        assert.equal(fn(1500, {language: 'es', units: ['s'], maxDecimalPoints: 0}), '1 segundo');
        assert.equal(fn(1500, {language: 'de', units: ['s'], maxDecimalPoints: 1}), '1,5 Sekunden');
      }],
      ['dual-count languages hide the displayed two consistently', async () => {
        assert.equal(fn(2500, {language: 'ar', units: ['s'], maxDecimalPoints: 0}), 'ثانيتان');
        assert.equal(fn(2999, {language: 'ar', units: ['s'], maxDecimalPoints: 0}), 'ثانيتان');
        assert.equal(fn(2500, {language: 'ar', units: ['s'], maxDecimalPoints: 1}), '٢,٥ ثواني');
      }],
      ['per-call overrides and ordinary fractional output remain supported', async () => {
        const h = fn.humanizer({maxDecimalPoints: 0, units: ['s']});
        assert.equal(h(1500), '1 second'); assert.equal(h(1500, {maxDecimalPoints: 2}), '1.5 seconds');
        assert.equal(fn(12000), '12 seconds'); assert.equal(fn(7999), '7.999 seconds');
      }],
    ],
    'duration-large-digits': [
      ['scientific notation preserves exponent separators with custom digits', async () => {
        const digits = ['a','b','c','d','f','g','h','i','j','k'];
        assert.equal(fn(1e24, {units: ['s'], digitReplacements: digits}), 'be+cb seconds');
        assert.equal(fn(3e24, {units: ['s'], digitReplacements: digits}), 'de+cb seconds');
      }],
      ['small scientific notation preserves its exponent minus sign', async () => {
        const digits = ['a','b','c','d','f','g','h','i','j','k'];
        assert.equal(fn(1e-8, {units: ['ms'], digitReplacements: digits}), 'be-j milliseconds');
        assert.equal(fn(2e-9, {units: ['ms'], digitReplacements: digits}), 'ce-k milliseconds');
      }],
      ['default localized digits preserve scientific notation characters', async () => {
        assert.equal(fn(1e24, {language: 'ar', units: ['s']}), '١e+٢١ ثانية');
        assert.equal(fn(1e-8, {language: 'ar', units: ['ms']}), '١e-٨ جزء من الثانية');
      }],
      ['decimal separators and ordinary digit replacement stay intact', async () => {
        const digits = ['a','b','c','d','f','g','h','i','j','k'];
        assert.equal(fn(1500, {units: ['s'], digitReplacements: digits, decimal: ','}), 'b,g seconds');
        assert.equal(fn(12000, {units: ['s'], digitReplacements: digits}), 'bc seconds');
        assert.equal(fn(1e24, {units: ['s']}), '1e+21 seconds');
      }],
    ],
    'debounce-context-classes': [
      ['different class prototypes can share a trailing wrapper', async () => withClock(async clock => {
        class A {} class B {} const calls = [];
        const d = fn(function (value) { calls.push({context: this, value}); }, 10);
        A.prototype.call = d; B.prototype.call = d;
        const a = new A(), b = new B(); a.call('old'); b.call('latest');
        await clock.advance(10); assert.deepEqual(calls, [{context: b, value: 'latest'}]);
      })],
      ['prototype inheritance does not forbid a different subclass context', async () => withClock(async clock => {
        class A {} class B extends A {} const calls = [];
        const d = fn(function () { calls.push(this); }, 10);
        const a = new A(), b = new B(); d.call(a); d.call(b);
        await clock.advance(10); assert.deepEqual(calls, [b]);
      })],
      ['distinct plain-object prototypes are supported', async () => withClock(async clock => {
        const a = Object.create(null), b = {}; const calls = [];
        const d = fn(function () { calls.push(this); }, 10); d.call(a); d.call(b);
        await clock.advance(10); assert.deepEqual(calls, [b]);
      })],
      ['same-prototype protection remains confined to a pending burst', async () => withClock(async clock => {
        class A {} const calls = [], a = new A(), b = new A();
        const d = fn(function (value) { calls.push([this, value]); }, 10);
        d.call(a, 'first'); assert.throws(() => d.call(b, 'forbidden'), /different contexts/);
        await clock.advance(10); d.call(b, 'later'); await clock.advance(10);
        assert.deepEqual(calls, [[a, 'first'], [b, 'later']]);
      })],
    ],
    'debounce-recursive-args': [
      ['reentrant trailing callbacks retain each scheduled argument', async () => withClock(async clock => {
        const calls = []; const d = fn(value => { calls.push(value); if (value > 1) d(value - 1); }, 10);
        d(3); await clock.advance(30); assert.deepEqual(calls, [3, 2, 1]);
      })],
      ['reentrant method callbacks preserve their receiver', async () => withClock(async clock => {
        const object = {}, calls = [];
        object.call = fn(function (value) { calls.push([this, value]); if (value > 1) object.call(value - 1); }, 10);
        object.call(3); await clock.advance(30); assert.deepEqual(calls, [[object, 3], [object, 2], [object, 1]]);
      })],
      ['reentrant calls preserve multiple argument identities', async () => withClock(async clock => {
        const payload = {}, token = Symbol('token'), calls = [];
        const d = fn((value, data, marker) => { calls.push([value, data, marker]); if (value > 1) d(value - 1, data, marker); }, 10);
        d(3, payload, token); await clock.advance(30);
        assert.deepEqual(calls, [[3, payload, token], [2, payload, token], [1, payload, token]]);
      })],
      ['leading calls and independent ordinary bursts retain return values', async () => withClock(async clock => {
        const calls = []; const d = fn(value => { calls.push(value); if (value === 1) d(2); return value; }, 10, true);
        assert.equal(d(1), 1); await clock.advance(20); assert.equal(d(3), 3); await clock.advance(20);
        assert.deepEqual(calls, [1, 3]);
      })],
    ],
    'debounce-timer-boundary': [
      ['an equal-time renewal keeps the full trailing quiet period', async () => withClock(async clock => {
        const calls = [], d = fn(() => calls.push(clock.now), 100);
        for (const at of [100, 150, 200, 250]) setTimeout(d, at);
        await clock.advance(200); assert.deepEqual(calls, []);
        await clock.advance(150); assert.deepEqual(calls, [1350]);
      })],
      ['leading calls retain their cooldown across equal-time renewals', async () => withClock(async clock => {
        const calls = [], d = fn(() => calls.push(clock.now), 100, true);
        for (const at of [100, 150, 200, 250]) setTimeout(d, at);
        await clock.advance(350); assert.deepEqual(calls, [1100]);
      })],
      ['one trailing callback receives the latest boundary arguments and receiver', async () => withClock(async clock => {
        const calls = [], contexts = [{}, {}, {}, {}], d = fn(function (value) { calls.push([this, value]); }, 100);
        [100, 150, 200, 250].forEach((at, i) => setTimeout(() => d.call(contexts[i], i), at));
        await clock.advance(350); assert.deepEqual(calls, [[contexts[3], 3]]);
      })],
      ['ordinary separated bursts and clear keep their existing behavior', async () => withClock(async clock => {
        const calls = [], d = fn(value => calls.push(value), 100);
        d('cancelled'); d.clear(); await clock.advance(100); assert.deepEqual(calls, []);
        d('first'); await clock.advance(100); d('second'); await clock.advance(100);
        assert.deepEqual(calls, ['first', 'second']);
      })],
    ],
  };
  assert.ok(cases[task], 'unknown task');
  return cases[task];
}
