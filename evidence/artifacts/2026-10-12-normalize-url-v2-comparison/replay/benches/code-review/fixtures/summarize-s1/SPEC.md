# Pricing library specification

## 1. Discount eligibility

A line item qualifies for the bulk discount when its quantity is **10 or more**. The discount is 5% off
the unit price.

## 2. Error reporting

Every caller-facing error is an `AppError` carrying a stable `code`. Invalid quantities use the code
`INVALID_QUANTITY`.

## 3. Rounding

Money is rounded once, at the end of a calculation, never on intermediate values.
