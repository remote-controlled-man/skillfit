import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCache } from './runtime.mjs';
test('application history determines insert reasons after deferred fetch resolution', async () => {
  const { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), true);
  try {
    const jobs=new Map(), events=[];
    const cache=new Cache({max:5,onInsert:(...row)=>events.push(row),fetchMethod:key=>new Promise(resolve=>jobs.set(key,resolve))});
    const fresh=cache.fetch('fresh');assert.deepEqual(events,[]);jobs.get('fresh')('first');await fresh;
    cache.set('same','retained');const same=cache.fetch('same',{forceRefresh:true});jobs.get('same')('retained');await same;
    cache.set('changed','old');const changed=cache.fetch('changed',{forceRefresh:true});jobs.get('changed')('new');await changed;
    assert.deepEqual(events,[['first','fresh','add'],['retained','same','add'],['retained','same','update'],['old','changed','add'],['new','changed','replace']]);
  } finally { cleanup(); }
});
