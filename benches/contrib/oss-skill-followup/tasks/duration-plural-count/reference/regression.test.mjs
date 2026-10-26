import test from 'node:test';import assert from 'node:assert/strict';import api from './index.js';import {withClock,observe,flush,gate} from './test-clock.mjs';
test('truncated single count uses singular word',()=>assert.equal(api(1500,{maxDecimalPoints:0,units:['s']}),'1 second'));
