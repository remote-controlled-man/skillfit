#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import pTimeout from './index.js';
test('Infinity keeps abort handling', async () => {const controller = new AbortController(), error = new Error('abort'); controller.abort(error); const state = {status:'pending'}; pTimeout(new Promise(()=>{}), {milliseconds:Infinity,signal:controller.signal}).then(value=>Object.assign(state,{status:'fulfilled',value}), reason=>Object.assign(state,{status:'rejected',reason})); for(let i=0;i<32;i++) await Promise.resolve(); assert.equal(state.status,'rejected'); assert.equal(state.reason,error);});
