import test from 'node:test';
import assert from 'node:assert/strict';
import api from './index.js';
import {withClock,observe,flush} from './test-clock.mjs';
import {readFileSync} from 'node:fs';
const kind=JSON.parse(readFileSync(new URL('./package.json',import.meta.url))).fixtureKind;
test('ordinary public API remains usable',async()=>{
 assert.equal(typeof api,'function');
 if(kind==='duration'){assert.equal(api(12000),'12 seconds');assert.equal(api(1000),'1 second');assert.equal(api(1500,{units:['s']}),'1.5 seconds');return;}
 await withClock(async clock=>{
  const values=[];const d=api(value=>{values.push(value);return value*2;},10);
  const a=kind==='promise'?observe(d(1)):d(1),b=kind==='promise'?observe(d(2)):d(2);
  assert.deepEqual(values,[]);await clock.advance(10);assert.deepEqual(values,[2]);
  if(kind==='promise'){assert.deepEqual(a,{status:'fulfilled',value:4});assert.deepEqual(b,{status:'fulfilled',value:4});}
  else {d(3);d.clear();await clock.advance(10);assert.deepEqual(values,[2]);}
 });
});
test('ordinary sequential calls and wrapper factories remain supported',async()=>{
 if(kind==='duration'){const h=api.humanizer({units:['s']});assert.equal(h(3000),'3 seconds');assert.equal(h(2250),'2.25 seconds');return;}
 if(kind==='promise'){const d=api.promise(async value=>value);for(const value of [3,7]){const state=observe(d(value));await flush();assert.deepEqual(state,{status:'fulfilled',value});}return;}
 await withClock(async clock=>{const values=[],d=api(value=>values.push(value),10);d('a');await clock.advance(10);d('b');await clock.advance(10);assert.deepEqual(values,['a','b']);});
});
