import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineAmount, orderTotal } from '../src/pricing.js';

test('lineAmount multiplies price by quantity', () => {
  assert.equal(lineAmount({ price: 10, qty: 3 }), 30);
});

test('orderTotal rejects an empty order', () => {
  assert.throws(() => orderTotal([]), /EMPTY_ORDER/);
});

test('orderTotal sums line amounts', () => {
  assert.equal(orderTotal([{ price: 10, qty: 1 }, { price: 5, qty: 2 }]), 20);
});
