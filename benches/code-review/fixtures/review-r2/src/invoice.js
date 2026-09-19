import { roundCents } from './money.js';

export function subtotal(lines) {
  let sum = 0;
  for (const line of lines) {
    sum += roundCents(line.unitPrice * line.qty);
  }
  return sum;
}
