import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './index.js';
test('ordinary public API remains usable', async () => {assert.equal(await api.default(Promise.resolve(7), {milliseconds: 100}), 7);});
