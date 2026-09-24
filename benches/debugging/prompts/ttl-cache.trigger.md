# Task: diagnose and fix the TTL cache

The repository in your current working directory contains `src/ttl-cache.mjs`, which backs a per-request memo layer. On-call filed three incidents against it last week. None reproduces on demand, and the visible test suite passes against the current code, so it covers none of them.

1. *"Feature flags intermittently read back as unset. We cache `false` and `0` with a 30s TTL and the next request sometimes gets `undefined`. Retrying immediately after works."*
2. *"Session lifetimes run one tick long. A token cached at 12:00:00 with a 60s TTL was still being served at 12:01:00 sharp."*
3. *"Hot keys never expire. Anything read at least once every few minutes stays cached indefinitely on a 5-minute TTL. Cold keys expire on schedule."*

Find the causes and fix them. Do not change the public class API.

The contract these incidents violate — unchanged by this task, and what your fix must satisfy:

- `get(key)` returns the value that was set, for any value: `false`, `0` and `''` are cached values, not absences.
- An entry expires exactly `ttlMs` after the `set()` that created it. At `t = set + ttlMs` it is gone, and reading an entry never moves that deadline.
- The read that observes an expired entry removes it from the internal map (lazy deletion stays).
- `ttlMs` must be a finite non-negative number; anything else throws `TypeError`.

Add a regression test that fails against the current implementation and passes against your fix. Run the suite with `node --test test/*.test.mjs`.
