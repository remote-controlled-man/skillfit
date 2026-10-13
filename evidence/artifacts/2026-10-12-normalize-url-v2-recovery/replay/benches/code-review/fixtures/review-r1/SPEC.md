# Pricing service specification

## §1 Error surface
Every error thrown by an exported function must be an `AppError` (`src/errors.js`) carrying a stable `code` string. Never throw a bare `Error` or `TypeError` at the caller-facing surface.

## §2 Tests
Every new exported function must ship with unit tests under `tests/` that cover its new branches.

## §3 Money math
Public money values pass through `roundCents` (`src/money.js`) exactly once before being returned.

## §4 Bulk discount
Order lines with quantity **>= 10** receive a 5% unit-price discount. Quantities below 10 pay full price. Lines with quantity 0 are free.

## §5 Invalid quantities
A negative quantity is rejected with an `AppError` whose code is `INVALID_QUANTITY`.
