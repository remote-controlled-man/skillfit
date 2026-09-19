# Ground truth — ttl-cache

Fixture layout: `src/ttl-cache.mjs` holds the buggy cache; `test/basic.test.mjs` is the single visible test (it passes even against the buggy code — the real grading is the verifier's behavioral checks).

## Bug list (4, all in `src/ttl-cache.mjs`)

1. **Falsy values treated as missing**: `get()` does `if (!entry || !entry.value) return undefined;`, so cached `false`, `0`, and `''` all read as absent. The entry check must be `!entry` only.
2. **Expiry boundary is inclusive**: `if (entry.expiresAt < this.now())` still returns the value when `now === expiresAt`. Expiry must be exclusive: `entry.expiresAt <= this.now()`.
3. **Sliding TTL on read**: `get()` refreshes `entry.expiresAt = this.now() + entry.ttlMs`, so repeated reads keep an entry alive forever. The cache promises fixed, non-sliding TTL — `get()` must not mutate `expiresAt`.
4. **No TTL validation**: `set()` accepts any `ttlMs`. Per the task, TTL must be a finite non-negative number; invalid values must throw `TypeError`.

Lazy deletion (removing an entry from `this.entries` when a read finds it expired) must be preserved — the verifier checks `entries.has('x') === false` after an expired read.

## Verified fixed implementation

```js
export class TtlCache {
  constructor(now = Date.now) {
    this.now = now;
    this.entries = new Map();
  }

  set(key, value, ttlMs) {
    if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new TypeError('ttlMs must be a finite non-negative number');
    }
    this.entries.set(key, {
      value,
      ttlMs,
      expiresAt: this.now() + ttlMs,
    });
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}
```

Verified 2026-09-19: this exact source scores 8/8 (exit 0) against `verifiers/ttl-cache.mjs`; the pristine fixture scores 1/8 (exit 1, only "expired entry deleted" passes).

## What the grader checks

8 behavioral checks with an injected fake clock, imported directly from the run directory's `src/ttl-cache.mjs`:

1. `false` retained, 2. `0` retained, 3. `''` retained — the falsy-value bug.
4. Expiry boundary excluded — value set at t=10 with ttl=5 must be gone at t=15.
5. Fixed TTL — readable at t=4, gone at t=5 (no sliding).
6. Expired entry deleted — lazy deletion preserved.
7. `ttl: -1` throws `TypeError`, 8. `ttl: Infinity` throws `TypeError`.

The JSON summary also carries an `evidence.testAssets` collector (informational only, does not affect the score): any test file the agent added is re-run against the final code and against the pristine fixture implementation to show whether it is a real red→green regression test. A porting note: the upstream grader exited 0 even on failure; this verifier exits 1 unless all 8 checks pass.
