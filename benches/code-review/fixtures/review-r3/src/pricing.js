import { roundCents } from './money.js';
import { AppError } from './errors.js';

export function lineAmount(line) {
  if (line.qty < 0) {
    throw new AppError('INVALID_QUANTITY', 'negative quantity');
  }
  return line.price * line.qty;
}

export function orderTotal(lines) {
  if (lines.length === 0) {
    throw new AppError('EMPTY_ORDER', 'cannot price an empty order');
  }
  let total = 0;
  for (const line of lines) {
    total += lineAmount(line);
  }
  return roundCents(total);
}
