import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './index.js';
test('ordinary public API remains usable', async () => {const limit = api.default(2); assert.deepEqual(await Promise.all([limit(() => 2), limit(async () => 4)]), [2, 4]);});
