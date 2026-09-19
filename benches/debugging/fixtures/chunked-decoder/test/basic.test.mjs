import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameDecoder } from '../src/frame-decoder.mjs';

const encode = (text) => new TextEncoder().encode(text);

test('decodes frames delivered in one chunk', () => {
  const decoder = new FrameDecoder();
  decoder.push(encode('5\nhello5\nworld'));
  assert.deepEqual(decoder.drain(), ['hello', 'world']);
});

test('flush returns frames not yet drained', () => {
  const decoder = new FrameDecoder();
  decoder.push(encode('3\nabc'));
  assert.deepEqual(decoder.flush(), ['abc']);
});
