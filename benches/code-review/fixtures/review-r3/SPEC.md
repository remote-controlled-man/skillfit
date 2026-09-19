# Pricing service specification

## §1 Error surface
Every error thrown by an exported function must be an `AppError` (`src/errors.js`) whose `code` appears in the stable-code table below. Codes are part of the public API; introducing or renaming a code requires a spec amendment.

| Code | Meaning |
| --- | --- |
| `INVALID_QUANTITY` | A line quantity is negative or non-numeric. |
| `EMPTY_ORDER` | Totals were requested for an order with no lines. |

## §2 Money math
A public money amount passes through `roundCents` (`src/money.js`) exactly once, at the point the final amount is produced. Intermediate factors — unit prices, discount rates, quantities — are combined at full precision and rounded only when the final amount is computed.

## §3 Promotions
A line with a `promoPrice` is priced at `min(promoPrice, price)`: the promotional price *replaces* the list price and is never itself discounted. Lines without a promotional price receive a 5% bulk discount at quantity >= 10.

## §4 Empty orders
`orderTotal` rejects an empty order with an `AppError` whose code is `EMPTY_ORDER`.

## §5 Tests
Every exported function must ship with unit tests under `tests/`.

## §6 Scope
Only defects introduced by the pull request under review count. Pre-existing code outside the diff is out of scope.
