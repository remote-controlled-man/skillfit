import test from 'node:test';import assert from 'node:assert/strict';import api from './index.js';import {withClock,observe,flush,gate} from './test-clock.mjs';
test('exponent survives custom digit replacement',()=>assert.equal(api(1e24,{units:['s'],digitReplacements:['a','b','c','d','f','g','h','i','j','k']}),'be+cb seconds'));
