# Stopped debugging followup offline package

The [dated report](../../2026-10-14-debugging-followup-routing-stop.md) retains
47 invoked CLI executions: 46 complete deliveries, one routing-discovery
failure with unknown token cost, and 33 uninvoked entries. Both arms pass all
23 completed pairs, but the fixed study remains inconclusive and ineligible.

Archive SHA-256: `f03479742b5a86738ea8dc470a911d5392c7893bf15aa2b4c33ae6de78970343`.

With Node >=22, run from this directory:

```bash
SKILLFIT_ROUTING_PACKAGE=$(mktemp -d)
tar -xzf package.tar.gz -C "$SKILLFIT_ROUTING_PACKAGE"
node "$SKILLFIT_ROUTING_PACKAGE/replay-routing-stop.mjs"
node --test "$SKILLFIT_ROUTING_PACKAGE/followup/replay/dist/harness/stats.test.js" "$SKILLFIT_ROUTING_PACKAGE/followup/replay/dist/harness/eval-efficiency.test.js" "$SKILLFIT_ROUTING_PACKAGE/followup/replay/dist/harness/execution-timing.test.js"
```

Expected: 1,595 package hashes, 46 exact complete-delivery regrades, 23 paired
outcomes, all-invocation spending with one unknown token usage, the unavailable
efficiency interval, cumulative spending of 172 executor calls with five
missing finals, zero model calls and 23/23 frozen checks. Earlier spending is
retained arithmetic from linked previous archives; quality is never pooled.

Complete delivered workspaces, installed Skills, public events, receipts, error
and uninvoked records, pinned source/compiled evaluator, outcome bench and
licenses are included. The public diagnosis records routing errors, normal
timing and power observations. Authentication status is retained only as its
method, without credentials or private account details.

Native originals were verified and copied byte-for-byte. Public paths are
normalized and reasoning items filtered; original/derived hashes are distinct,
so this export does not assert an unchanged native seal. Failed work receives
no grade and unknown usage receives no zero. Provider billing and complete
authoring cost are not inferred from these counters. The original ineligible
decision remains unchanged, and nothing upgrades automatically.
