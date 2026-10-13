import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const M = createRequire(import.meta.url)('./runtime.cjs');
test('repeated asynchronous end closes its pipe destination once', async () => {
  const source = new M({async:true}); const destination = new M(); let ends = 0;
  const end = destination.end; destination.end = function (...args) {ends++; return end.apply(this,args);};
  source.pipe(destination); source.end(); source.end(); source.end();
  await new Promise(setImmediate); assert.equal(ends,1);
});
