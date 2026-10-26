import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './index.js';
test('ordinary public API remains usable', async () => {assert.equal(await api.default({limit: 2, interval: 10})(value => value * 2)(3), 6);});
