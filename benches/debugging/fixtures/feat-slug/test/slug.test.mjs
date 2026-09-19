import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.mjs';

test('lowercases and hyphenates words', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('collapses separators and trims surrounding noise', () => {
  assert.equal(slugify('  A  b_c! '), 'a-b-c');
});

test('leaves an already-slug input unchanged', () => {
  assert.equal(slugify('hello'), 'hello');
});
