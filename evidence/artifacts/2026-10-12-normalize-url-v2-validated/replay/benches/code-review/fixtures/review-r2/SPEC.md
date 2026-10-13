# Invoice service specification

## §1 Error surface
Every error thrown by an exported function must be an `AppError` (`src/errors.js`) whose `code` appears in the stable-code table below. Codes are part of the public API; introducing or renaming a code requires a spec amendment.

| Code | Meaning |
| --- | --- |
| `INVALID_QUANTITY` | A line quantity is negative or non-numeric. |
| `INVALID_RATE` | A tax or conversion rate is missing or non-positive. |
| `EMPTY_INVOICE` | Totals were requested for an invoice with no lines. |

## §2 Purity
Exported functions must not mutate their arguments or any object reachable from them. Return new objects and arrays instead.

## §3 Money math
A public money amount passes through `roundCents` (`src/money.js`) exactly once, at the point the final amount is produced. Intermediate factors — unit prices, tax rates, quantities — are combined at full precision and rounded only when the final amount is computed. In particular, a per-line unit price is an intermediate value and must stay unrounded, so that `subtotal` rounds each line amount exactly once.

## §4 Tax
`applyLineTax` multiplies each unit price by `1 + taxRate`. A missing or non-positive `taxRate` is rejected with an `AppError` whose code is `INVALID_RATE`.

## §5 Tests
Every new exported function must ship with unit tests under `tests/`.

## §6 Scope
Only defects introduced by the pull request under review count. Pre-existing code outside the diff is out of scope.
