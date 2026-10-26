#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('iterator failure leaves no unhandled mapper rejection', () => {const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import pLimit from './index.js'; const unhandled=[]; process.on('unhandledRejection', e=>unhandled.push(e.message)); const limit=pLimit(1), error=new Error('iterator'); function* values(){yield 1;yield 2;throw error;} let same=false; try{await limit.map(values(),async v=>{throw new Error('mapper-'+v);});}catch(e){same=e===error;} await limit(()=>{}); await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r)); console.log(JSON.stringify({same,unhandled,active:limit.activeCount,pending:limit.pendingCount}));"], {encoding:'utf8', timeout:3000}); assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout.trim()), {same:true,unhandled:[],active:0,pending:0});});
