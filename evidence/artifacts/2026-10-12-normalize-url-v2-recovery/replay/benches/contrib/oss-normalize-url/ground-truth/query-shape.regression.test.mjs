import test from 'node:test';
import assert from 'node:assert/strict';
import normalize from './index.js';
test('bare query paths retain semantic shape through normalization',()=>{
  assert.equal(normalize('https://example.com/index.php?/catalog/item'),'https://example.com/index.php?/catalog/item');
});
