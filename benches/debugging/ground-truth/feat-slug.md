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

Verified 2026-09-19: with this `src/slug.mjs` added, the verifier exits 0; against the pristine fixture it exits 1.

## What the grader checks

The verifier is a thin command wrapper (freeze-generated style): it runs `node --test` inside the run directory with `NODE_TEST_CONTEXT` scrubbed from the environment and passes the exit code through. The visible tests assert `slugify('Hello World') === 'hello-world'`, `slugify('  A  b_c! ') === 'a-b-c'`, and `slugify('hello') === 'hello'`.
