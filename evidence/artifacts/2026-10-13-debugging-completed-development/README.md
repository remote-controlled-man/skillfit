# Completed debugging development: offline package

Two separate completed minipass development cohorts provide no independent
validation or stable improvement claim. See the [dated report](../../2026-10-13-debugging-completed-development.md).

The archive contains all 16 deliveries and installed complete Skills, public
transcripts, native receipts, plans, ledgers, candidate rationale, power records,
a frozen compiled/source runner and the exact pinned bench including licenses.
Private local paths are normalized, reasoning bodies are excluded, and native
original/export hashes are distinguished. The derived export does not claim
an unchanged native seal or upgrade eligibility.

Archive SHA-256: `84c5be909da00037634106e292be9424f435b309f48876859d2f0d63bae2de36`.

With Node >=22, run from this directory:

```bash
SKILLFIT_COMPLETED_PACKAGE=$(mktemp -d)
tar -xzf package.tar.gz -C "$SKILLFIT_COMPLETED_PACKAGE"
node "$SKILLFIT_COMPLETED_PACKAGE/replay/scripts/replay-completed-development.mjs"
node --test "$SKILLFIT_COMPLETED_PACKAGE/replay/dist/harness/stats.test.js" "$SKILLFIT_COMPLETED_PACKAGE/replay/dist/harness/eval-efficiency.test.js" "$SKILLFIT_COMPLETED_PACKAGE/replay/dist/harness/execution-timing.test.js"
```

Expected: 670 export hashes, 16 exact delivery regrades, both separate quality
statistics and every paired/all-invocation cost recomputed, zero new agent/model
calls. Frozen standalone statistical/efficiency/timing tests pass 23/23; the
complete source checkout passed 491/491 at the frozen snapshot.

Cohort 6 compares v2/v3: 3/4 versus 3/4, with higher v3 costs. Cohort 7 compares
v3/v4: 3/4 versus 4/4, one repaired public return value and no observed regression.
Its total uncached input rises 32.5%, while per-success uncached input falls only
0.6%. Neither small development comparison authorizes promotion.

The two complete cohorts consumed 16 CLI executions, 4,641,107 input, 4,161,920
cached input, 479,187 uncached input, 128,396 output and 6111.889 executor seconds.
Every invocation has final recorded usage. These are CLI process counts and
recorded tokens/intervals, not provider-internal requests or complete billing.
Earlier stopped cohorts and readiness costs remain separate. Fresh live runs
reproduce the method, not identical stochastic outcomes or costs.
