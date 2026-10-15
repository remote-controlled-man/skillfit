#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import pThrottle from './index.js';
import {withClock, observe} from './test-clock.mjs';
test('a delayed synchronous throw rejects its public promise', async () => withClock(async clock => {const throttle = pThrottle({limit: 1, interval: 10}), error = new Error('delayed'); await throttle(() => 1)(); const state = observe(throttle(() => {throw error;})()); await clock.advance(10); assert.equal(state.status, 'rejected'); assert.equal(state.reason, error);}));
