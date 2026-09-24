# Ground truth — range-parser

**Task class: spec implementation, deliberately.** This is the one task in the bench that states its
acceptance criteria outright instead of asking the agent to infer them, and it is kept that way on
purpose. The fixture ships a stub whose single visible test asserts the *wrong* behaviour
(`parseRange('3, 1, 2')` → `[3, 1, 2]`, unsorted), so there is no buggy-but-working implementation to
diagnose — the task is to write the thing to a written contract and replace the test that encoded the
stub's behaviour. Enumerating the contract is the task, not a leak: the eight checks assert specific
`TypeError` and `RangeError` behaviour that an agent could not otherwise know to implement, so
withholding the list would make the task unwinnable rather than harder.

The other five tasks in this bench are diagnosis tasks and their prompts must not enumerate defects the
way this one legitimately enumerates requirements. When porting a task of your own, decide which of the
two you are writing before you write the prompt — a spec task measures "can this agent follow a precise
contract", a diagnosis task measures "can this agent find what is wrong", and a prompt that mixes them
measures neither cleanly and tends to saturate.

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

Verified 2026-09-25 against the hardened verifier: this source + suite scores 8/8 (exit 0); the
pristine fixture scores 0/8 (exit 1 — the stub cannot even be imported as a working `parseRange` for the
behavioural checks, and its single visible test does not detect the seeded bugs).

## What the grader checks

Seven behavioural checks, imported directly from the run directory's `src/range-parser.mjs`: sorted and
unique list, ascending range, descending range, mixed input, negative values and negative ranges,
`TypeError` for invalid input (one check asserting all four forms — empty segment, decimal, bare text,
non-string — since they are a single rejection contract and scoring them separately inflated the facet
count without adding a distinction anyone would act on), and `RangeError` when `maxItems` would be
exceeded.

The eighth grades the test suite **behaviourally**: it must pass against the final implementation *and*
fail against the original buggy one, restored into a temporary copy of the workspace. That replaces two
checks which scanned `test/*.mjs` source text — at least 4 `test(` occurrences, and a match on
`/negative|maxItems|invalid|reject/i`. Both were satisfiable without writing a single assertion: four
empty `test('invalid …', () => assert.ok(true))` blocks passed the old verifier for full marks. Verified
closed — that exact suite now scores 7/8 and exits 1.

Exit code is 1 unless all eight checks pass.
