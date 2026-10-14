import { roundCents } from './money.js';

export function lineTotal(item) {
  return roundCents(item.price * item.qty);
}

export function orderTotal(items) {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item);
  }
  return total;
}
