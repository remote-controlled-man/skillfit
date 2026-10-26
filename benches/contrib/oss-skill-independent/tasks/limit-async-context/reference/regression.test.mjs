#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import pLimit from './index.js';
test('queued calls retain distinct async stores', async () => { const limit = pLimit(2), store = new AsyncLocalStorage(); await Promise.all(Array.from({length: 24}, (_, id) => store.run(id, () => limit(async () => { await Promise.resolve(); assert.equal(store.getStore(), id); })))); });
