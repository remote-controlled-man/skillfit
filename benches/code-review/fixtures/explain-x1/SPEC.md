# compact-object specification

## §1 Purpose
`compactObject(obj)` returns a new object with every `null`, `undefined`, or empty-string value removed.

## §2 Empty values
Only `null`, `undefined`, and `''` count as empty. Falsy values such as `0` and `false` are meaningful and must be kept.

## §3 Purity
Exported functions never mutate their input; `compactObject` returns a new object.

## §4 Helpers
`countDropped(obj)` reports how many keys `compactObject` would remove.

## §5 Tests
Behavior is covered by the unit tests in `tests/compact.test.js`.
