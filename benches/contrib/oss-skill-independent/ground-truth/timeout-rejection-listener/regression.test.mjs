#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('input rejection has no unhandled cleanup promise', () => {const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import pTimeout from './index.js'; import {getEventListeners} from 'node:events'; const unhandled=[]; process.on('unhandledRejection',e=>unhandled.push(e.message)); const controller=new AbortController(), error=new Error('source'); let same=false; try{await pTimeout(Promise.reject(error),{milliseconds:100,signal:controller.signal});}catch(e){same=e===error;} await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r)); console.log(JSON.stringify({same,unhandled,listeners:getEventListeners(controller.signal,'abort').length}));"], {encoding:'utf8',timeout:3000}); assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout.trim()), {same:true,unhandled:[],listeners:0});});
