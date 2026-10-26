import test from 'node:test';import assert from 'node:assert/strict';import api from './index.js';import {withClock,observe,flush,gate} from './test-clock.mjs';
test('trailing recursion retains next argument',async()=>withClock(async clock=>{const calls=[];const d=api(value=>{calls.push(value);if(value>1)d(value-1);},10);d(3);await clock.advance(30);assert.deepEqual(calls,[3,2,1]);}));
