import { AppError } from './errors.js';
import { roundCents } from './money.js';

export const BULK_QTY = 10;
export const BULK_RATE = 0.05;

export function unitPrice(item) {
  if (!Number.isInteger(item.qty) || item.qty < 1) {
    throw new AppError('INVALID_QUANTITY', 'quantity must be a positive integer');
  }
  const base = item.price;
  if (item.qty >= BULK_QTY) {
    return roundCents(base * (1 - BULK_RATE));
  }
  return base;
}

export function lineTotal(item) {
  return roundCents(unitPrice(item) * item.qty);
}
