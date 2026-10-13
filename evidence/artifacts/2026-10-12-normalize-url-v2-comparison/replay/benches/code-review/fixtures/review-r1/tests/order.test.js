import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineTotal, orderTotal } from '../src/order.js';

test('lineTotal multiplies price by quantity', () => {
  assert.equal(lineTotal({ price: 10, qty: 3 }), 30);
});

test('orderTotal sums line totals', () => {
  assert.equal(
    orderTotal([
      { price: 10, qty: 1 },
      { price: 5, qty: 2 },
    ]),
    20,
  );
});
