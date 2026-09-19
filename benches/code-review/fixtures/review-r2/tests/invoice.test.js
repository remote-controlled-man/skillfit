import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subtotal } from '../src/invoice.js';

test('subtotal sums line amounts', () => {
  assert.equal(
    subtotal([
      { unitPrice: 10, qty: 1 },
      { unitPrice: 5, qty: 2 },
    ]),
    20,
  );
});
