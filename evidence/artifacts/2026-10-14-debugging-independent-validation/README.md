# Independent debugging validation offline package

The [dated report](../../2026-10-14-debugging-independent-validation.md) retains
80 completed real executions, 40/40 passes in each arm, aggregate cost savings
and individual cost increases. The predeclared result remains `inconclusive`:
the primary interval does not establish at least 10% uncached-input savings.
Neither upgrade eligibility nor an automatic upgrade is authorized.

Archive SHA-256: `1a4b136b87b2f3288896b6a48416710551bd149529f118b0e02e7740fd5286f1`.

With Node >=22, run from this directory:

```bash
SKILLFIT_VALIDATION_PACKAGE=$(mktemp -d)
tar -xzf package.tar.gz -C "$SKILLFIT_VALIDATION_PACKAGE"
node "$SKILLFIT_VALIDATION_PACKAGE/replay-validation.mjs"
node --test "$SKILLFIT_VALIDATION_PACKAGE/validation-2/replay/dist/harness/stats.test.js" "$SKILLFIT_VALIDATION_PACKAGE/validation-2/replay/dist/harness/eval-efficiency.test.js" "$SKILLFIT_VALIDATION_PACKAGE/validation-2/replay/dist/harness/execution-timing.test.js"
```

Expected: 1,620 package hashes, 80 exact regrades, separate paired/all-invocation
costs and quality statistics, the exact efficiency interval and study-spending
arithmetic, zero model calls and 23/23 frozen checks. The native originals were
audited and copied byte-for-byte before this derived export was made.

The archive includes all deliveries, complete installed Skills, public events,
native receipts, pinned bench and licenses, complete frozen source/compiled
runtime, declaration, request and terminal assessment. Paths are normalized and
reasoning items filtered. Original and exported hashes are distinct; this
derived package does not assert an unchanged native seal or provider attestation.
It retains the original ineligible decision rather than promoting an export.

The earlier 45-call lower bound is retained arithmetic from the three linked
prior archives; replay those archives to regrade their separate observations.
The study totals 125 actual CLI invocations with four missing final usages.
Authoring and orchestration cost remain incompletely metered. Separate platform
snapshots have unknown counter partitions and overlap, so they cannot be summed
into CLI tokens or dollar billing. Fresh live calls reproduce the procedure
rather than identical stochastic results.
