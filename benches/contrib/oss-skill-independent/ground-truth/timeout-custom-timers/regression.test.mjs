#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import pTimeout from './index.js';
test('native-compatible custom timer receivers', async () => { const customTimers = {setTimeout: function(...args) { assert.equal(this, undefined); return setTimeout(...args); }, clearTimeout: function(...args) { assert.equal(this, undefined); return clearTimeout(...args); }}; assert.equal(await pTimeout(Promise.resolve(7), {milliseconds: 50, customTimers}), 7); });
