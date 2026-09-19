# Ground truth — range-parser

Fixture layout: `src/range-parser.mjs` holds a naive stub; `test/basic.test.mjs` holds one visible test.

## Bug list (spec violations in the stub)

1. **No range support**: `Number('1-3')` is `NaN`, so ranges are silently filtered out.
2. **No sorting or deduplication**: input order and duplicates pass straight through (`'3, 1, 3, 2'` → `[3, 1, 3, 2]` instead of `[1, 2, 3]`).
3. **Empty segments accepted**: `Number('') === 0`, so `'1,,2'` silently yields a bogus `0` instead of throwing `TypeError`.
4. **Decimals and non-numeric text silently dropped** instead of rejected with `TypeError`.
5. **`maxItems` truncates silently** (`slice`) instead of throwing `RangeError` once the unique-value count would exceed the limit.
6. **Non-string input** crashes on `.split` (a `TypeError` by accident, not by contract) — a correct implementation validates `typeof input` explicitly.

## Verified fixed implementation

```js
const SEGMENT_PATTERN = /^-?\d+$/;
const RANGE_PATTERN = /^(-?\d+)-(-?\d+)$/;

export function parseRange(input, options = {}) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  const maxItems = options.maxItems ?? 1000;
  const values = new Set();
  for (const rawSegment of input.split(',')) {
    const segment = rawSegment.trim();
    const rangeMatch = RANGE_PATTERN.exec(segment);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const step = start <= end ? 1 : -1;
      for (let value = start; ; value += step) {
        values.add(value);
        if (values.size > maxItems) {
          throw new RangeError(`range expands beyond maxItems (${maxItems})`);
        }
        if (value === end) break;
      }
    } else if (SEGMENT_PATTERN.test(segment)) {
      values.add(Number(segment));
      if (values.size > maxItems) {
        throw new RangeError(`input yields more than maxItems (${maxItems})`);
      }
    } else {
      throw new TypeError(`invalid segment: ${JSON.stringify(segment)}`);
    }
  }
  return [...values].sort((left, right) => left - right);
}
```

The key parsing detail: a segment is tried as a range first (`^(-?\d+)-(-?\d+)$`), so `-3--1` parses as start `-3`, end `-1`; a plain negative integer like `-3` falls through to the single-value pattern.

A passing run must also grow the test suite. Verified accompanying suite (replaces `test/basic.test.mjs`; 5 `test(` calls and mentions `negative`/`maxItems`/`invalid`, satisfying both regression-breadth checks):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/range-parser.mjs';

test('parses a basic comma-separated list', () => {
  assert.deepEqual(parseRange('3, 1, 2'), [1, 2, 3]);
});

test('expands ascending and descending ranges', () => {
  assert.deepEqual(parseRange('1-3'), [1, 2, 3]);
  assert.deepEqual(parseRange('10-8'), [8, 9, 10]);
});

test('handles negative values and negative ranges', () => {
  assert.deepEqual(parseRange('-3--1, 2'), [-3, -2, -1, 2]);
});

test('rejects invalid segments and non-string input', () => {
  assert.throws(() => parseRange('1,,2'), TypeError);
  assert.throws(() => parseRange('1.5'), TypeError);
  assert.throws(() => parseRange(null), TypeError);
});

test('enforces maxItems with RangeError', () => {
  assert.throws(() => parseRange('1-5', { maxItems: 4 }), RangeError);
});
```

Verified 2026-09-19: this source + suite scores 12/12 (exit 0); the pristine fixture scores 1/12 (exit 1 — only the accidental `null` `TypeError` passes).

## What the grader checks

10 behavioral checks imported from the run directory's `src/range-parser.mjs`: sorted+unique list, ascending range, descending range, mixed input, negative values/ranges, and `TypeError` for empty segment / decimal / text / non-string, plus `RangeError` when `maxItems` would be exceeded. 2 regression-breadth checks scan `test/*.mjs` source: at least 4 `test(` calls, and the text must mention `negative`, `maxItems`, `invalid`, or `reject`. Exit code is 1 unless all 12 checks pass.
