import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const M = createRequire(import.meta.url)('./runtime.cjs');
test('completion preserves handlers for all three end events', () => {
  const stream = new M(); const events=[];
  for (const event of ['end','prefinish','finish']) stream.on(event,()=>events.push(event));
  stream.resume(); stream.end(); assert.deepEqual(events,['end','prefinish','finish']);
});
