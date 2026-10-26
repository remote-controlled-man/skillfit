import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const Minipass = createRequire(import.meta.url)('./runtime.cjs');
test('ordinary string delivery preserves content', async () => {
  const stream = new Minipass({encoding:'utf8'});
  const result = stream.concat();
  stream.write('a'); stream.end('b');
  assert.equal(await result, 'ab');
});
test('object mode retains values', async () => {
  const stream = new Minipass({objectMode:true});
  const result = stream.collect();
  stream.write({x:1}); stream.end({x:2});
  assert.deepEqual(await result, [{x:1},{x:2}]);
});
