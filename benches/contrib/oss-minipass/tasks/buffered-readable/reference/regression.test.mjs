import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const M = createRequire(import.meta.url)('./runtime.cjs');
test('a readable subscriber sees already buffered data', () => {
  const stream = new M({encoding:'utf8'}); stream.write('hello'); let notification = false; let output='';
  stream.on('readable', () => {notification=true; stream.on('data',chunk=>{output+=chunk;});});
  assert.equal(notification,true); assert.equal(output,'hello');
});
