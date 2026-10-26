import test from 'node:test';
import assert from 'node:assert/strict';
import QuickLRU from './index.js';
test('ordinary key storage and deletion work',()=>{const cache=new QuickLRU({maxSize:3});cache.set('a',1);cache.set('b',2);assert.equal(cache.get('a'),1);assert.equal(cache.delete('a'),true);assert.equal(cache.has('a'),false);assert.equal(cache.get('b'),2);});
test('object keys remain identity based',()=>{const cache=new QuickLRU({maxSize:3});const key={};cache.set(key,'value');assert.equal(cache.get(key),'value');assert.equal(cache.has({}),false);});
