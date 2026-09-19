# Task: complete the integer range parser

Implement `parseRange(input, options?)` in `src/range-parser.mjs`.

Required behavior:

- Accept comma-separated integers and inclusive ranges, for example `1-3, 7, 10-8`.
- Ignore surrounding whitespace and return unique integers in ascending order.
- Descending ranges are valid and normalize to ascending values.
- Negative integers are valid, including negative ranges such as `-3--1`.
- Reject empty segments, decimals, non-numeric text, and non-string input with `TypeError`.
- `options.maxItems` defaults to `1000`; throw `RangeError` before returning more unique values than that limit.
- Do not change the public export name.

Run the visible tests with `node --test test/*.test.mjs`.
