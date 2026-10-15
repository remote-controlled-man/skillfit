// Post-result development probes. Not an independent task or a Skill efficacy test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext, runInContext} from 'node:vm';
import pTimeout, {TimeoutError} from './index.js';

function createTimers(kind) {
	const scheduled = [];
	const cleared = [];
	const pending = new Set();
	const schedule = (callback, milliseconds) => {
		const handle = {callback, milliseconds};
		scheduled.push(handle);
		pending.add(handle);
		return handle;
	};
	const cancel = handle => {
		cleared.push(handle);
		pending.delete(handle);
	};
	let customTimers;
	if (kind === 'strict-unbound') {
		customTimers = {
			setTimeout: function (...args) {
				assert.equal(this, undefined);
				return schedule(...args);
			},
			clearTimeout: function (...args) {
				assert.equal(this, undefined);
				return cancel(...args);
			},
		};
	} else if (kind === 'foreign-realm') {
		// These ordinary non-strict functions establish their own default receiver.
		customTimers = runInContext(`({
			setTimeout: function (...args) {
				if (this !== globalThis) throw new TypeError('incompatible scheduling receiver');
				return schedule(...args);
			},
			clearTimeout: function (...args) {
				if (this !== globalThis) throw new TypeError('incompatible clearing receiver');
				return cancel(...args);
			}
		})`, createContext({schedule, cancel}));
	} else {
		assert.equal(kind, 'prebound-owner');
		const owner = {};
		customTimers = {
			setTimeout: function (...args) {
				assert.equal(this, owner);
				return schedule(...args);
			}.bind(owner),
			clearTimeout: function (...args) {
				assert.equal(this, owner);
				return cancel(...args);
			}.bind(owner),
		};
	}
	return {
		customTimers, scheduled, cleared,
		fire() {
			const handles = [...pending];
			for (const handle of handles) {
				pending.delete(handle);
				handle.callback();
			}
			return handles.length;
		},
	};
}

for (const kind of ['strict-unbound', 'foreign-realm', 'prebound-owner']) {
	test(`${kind}: supplied functions work independently of pTimeout`, () => {
		const timers = createTimers(kind);
		const {setTimeout, clearTimeout} = timers.customTimers;
		const handle = setTimeout(() => assert.fail('cancelled'), 25);
		clearTimeout(handle);
		assert.deepEqual(timers.cleared, [handle]);
		assert.equal(timers.fire(), 0);
	});
	for (const outcome of ['resolve', 'reject']) {
		test(`${kind}: input ${outcome} and cleanup`, {timeout: 1000}, async () => {
			const timers = createTimers(kind);
			const value = {answer: 42};
			const source = outcome === 'resolve' ? Promise.resolve(value) : Promise.reject(value);
			const wrapped = pTimeout(source, {milliseconds: 25, customTimers: timers.customTimers});
			if (outcome === 'resolve') assert.equal(await wrapped, value);
			else await assert.rejects(wrapped, error => error === value);
			assert.equal(timers.scheduled.length, 1);
			assert.equal(timers.scheduled[0].milliseconds, 25);
			assert.deepEqual(timers.cleared, [timers.scheduled[0]]);
			assert.equal(timers.fire(), 0);
		});
	}
	test(`${kind}: timeout and input cancellation`, {timeout: 1000}, async () => {
		const timers = createTimers(kind);
		const source = new Promise(() => {});
		let cancellations = 0;
		source.cancel = function () { assert.equal(this, source); cancellations++; };
		const wrapped = pTimeout(source, {milliseconds: 25, customTimers: timers.customTimers});
		const rejected = assert.rejects(wrapped, error => {
			assert.ok(error instanceof TimeoutError);
			assert.equal(error.message, 'Promise timed out after 25 milliseconds');
			return true;
		});
		const fired = timers.fire();
		await rejected;
		assert.equal(fired, 1);
		assert.equal(cancellations, 1);
		assert.deepEqual(timers.cleared, [timers.scheduled[0]]);
	});
	test(`${kind}: explicit clear preserves later input`, {timeout: 1000}, async () => {
		const timers = createTimers(kind);
		let release;
		const source = new Promise(resolve => { release = resolve; });
		const wrapped = pTimeout(source, {milliseconds: 25, customTimers: timers.customTimers});
		const result = wrapped.then(value => ({value}), error => ({error}));
		assert.equal(wrapped.clear(), undefined);
		assert.deepEqual(timers.cleared, [timers.scheduled[0]]);
		assert.equal(timers.fire(), 0);
		const value = {answer: 42};
		release(value);
		assert.deepEqual(await result, {value});
	});
	test(`${kind}: abort reason and cleanup`, {timeout: 1000}, async () => {
		const timers = createTimers(kind);
		const controller = new AbortController();
		const reason = new Error('stop');
		const wrapped = pTimeout(new Promise(() => {}), {
			milliseconds: 25, customTimers: timers.customTimers, signal: controller.signal,
		});
		const rejected = assert.rejects(wrapped, error => error === reason);
		controller.abort(reason);
		await rejected;
		assert.deepEqual(timers.cleared, [timers.scheduled[0]]);
		assert.equal(timers.fire(), 0);
	});
}
