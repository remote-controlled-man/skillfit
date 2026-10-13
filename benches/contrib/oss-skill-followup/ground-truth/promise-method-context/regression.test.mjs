import test from 'node:test';import assert from 'node:assert/strict';import api from './index.js';import {withClock,observe,flush,gate} from './test-clock.mjs';
test('promise wrapper retains method receiver',async()=>{const object={};const d=api.promise(async function(){return this;});const state=observe(d.call(object));await flush();assert.deepEqual(state,{status:'fulfilled',value:object});});
