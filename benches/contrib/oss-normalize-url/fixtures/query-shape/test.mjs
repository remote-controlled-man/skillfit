import test from 'node:test';
import assert from 'node:assert/strict';
import normalizeUrl from './index.js';
test('ordinary URL normalization and sorting',()=>{assert.equal(normalizeUrl('https://www.example.com:443/path?b=2&a=1'),'https://example.com/path?a=1&b=2');});
