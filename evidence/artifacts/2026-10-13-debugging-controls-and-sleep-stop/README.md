# Known debugging controls and sleep interruption: offline package

The [dated report](../../2026-10-13-debugging-controls-and-sleep-stop.md) retains
mixed costs: LRU point savings and a normalize-url cost regression, with no
observed control correctness regression. Independent validation 1 stops after
one original-arm invocation due to clamshell sleep on battery. There is no
graded validation outcome, stable improvement claim or authorized promotion.

Archive SHA-256: `8d2939ee8f1c25a5d8230e54a9faf024e71a5918e1e507144a82426bb15340c7`.

With Node >=22, run from this directory:

```bash
SKILLFIT_CONTROLS_PACKAGE=$(mktemp -d)
tar -xzf package.tar.gz -C "$SKILLFIT_CONTROLS_PACKAGE"
node "$SKILLFIT_CONTROLS_PACKAGE/replay-all.mjs"
node --test "$SKILLFIT_CONTROLS_PACKAGE/control-lru/replay/dist/harness/stats.test.js" "$SKILLFIT_CONTROLS_PACKAGE/control-lru/replay/dist/harness/eval-efficiency.test.js" "$SKILLFIT_CONTROLS_PACKAGE/control-lru/replay/dist/harness/execution-timing.test.js"
```

Expected: 2,211 package hashes; 12 LRU and four normalize-url exact regrades;
zero regrades for the interrupted invocation; separate quality statistics and
paired/all-invocation spending recomputed; study-spending arithmetic reproduced;
zero agent/model calls. Frozen standalone checks pass 23/23. The source checkout
passes 497/497; tests use offline executors, never real model calls.

The archive keeps complete deliveries, installed Skills, public events, native
receipts, error and uninvoked records, three frozen source/compiled runtimes,
exact outcome benches and upstream licenses. Selected system events explain the
sleep gap. Private paths are normalized, reasoning items filtered and unrelated
personal wake/alarm/network events excluded. Original and exported hashes are
distinct; these derived exports do not assert unchanged native seals.

Recorded additional spending covers 17 invoked CLI processes: 16 final usages
and one partial lower bound. It totals 5,666,600 input, 5,003,776 cached input,
662,824 uncached input, 165,283 output and 7017.192 executor seconds. Readiness
and development spending stay in their earlier ledgers, included only in
explicit study-spending arithmetic. No quality cohorts are pooled. No dollar,
provider-internal retry or complete authoring cost is inferred from tokens.

The original stopped batch remains unchanged. A fresh fixed 80-call cohort,
declared after continuous AC/open-lid confirmation, keeps the candidate and
protocol frozen; its eventual outcome belongs in a new evidence page.
