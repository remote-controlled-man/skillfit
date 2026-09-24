# Ground truth — feat-slug

**This task is the negative trigger control for this bench (`shouldTrigger: false`).** It is deliberately *not* a debugging task: the fixture contains only tests, and the agent must implement a brand-new module. A debugging skill firing here counts as a false trigger.

Fixture layout: `test/slug.test.mjs` only — `src/slug.mjs` intentionally does not exist, so the pristine fixture fails (the import cannot resolve).

## Correct implementation

```js
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

Verified 2026-09-25 against the hardened verifier: with this `src/slug.mjs` added the verifier exits 0
scoring 6/6; against the pristine fixture it exits 1 (the import cannot resolve).

## What the grader checks

Six checks. The visible suite is the task's specification, so it is also the thing an agent could edit to
win — the earlier version of this verifier ran `node --test` in place and passed whatever the run directory
contained, which meant replacing the assertions with `assert.equal(1, 1)` was a complete solution. The first
check closes that:

1. **visible suite unmodified** — `test/slug.test.mjs` is compared against the canonical fixture copy
   (`../fixtures/feat-slug`) with line endings and trailing whitespace normalized. Deleting it also fails.
2. **visible tests pass** — `node --test` on that suite, via `process.execPath` rather than PATH `node`, with
   `NODE_TEST_CONTEXT` scrubbed so a nested run does not silently execute zero tests.
3. **separator runs collapse** — `a---b`, `a  b`, `a__b`, `a!@#b` all yield `a-b`.
4. **surrounding noise trimmed** — `--hello--`, `  hello  `, `!hello!` all yield `hello`.
5. **empty and symbol-only input** — `''`, `!!!`, `___`, and whitespace-only all yield `''`.
6. **non-ascii stays well-formed** — asserted on *shape* only: a string with no leading or trailing
   separator and no uncollapsed run. The visible suite never specifies accent handling, and folding
   (`cafe-bar`) and dropping (`caf-bar`) are both defensible readings, so pinning either output would grade
   an invented requirement. What is pinned follows from the trim/collapse contract in checks 3–4.

Checks 3–6 import `src/slug.mjs` directly, so they hold even if the suite is left untouched but the
implementation is a stub. Exit code is 1 unless all six pass.

Unlike its four siblings this verifier carries no `evidence.testAssets` collector: the fixture ships no
`src/slug.mjs` at all, so there is no buggy original to restore an agent-added test against, and the
red/green comparison the collector exists to make has nothing to compare to.
