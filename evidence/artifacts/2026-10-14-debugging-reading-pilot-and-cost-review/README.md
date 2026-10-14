# Reading pilot and cost-review offline replay

Read the [dated report](../../2026-10-14-debugging-reading-pilot-and-cost-review.md)
for the rejected candidate, diagnostic correction and cost-coverage limits.

Archive: [package.tar.gz](package.tar.gz)

SHA-256: `61c48885f2b91d79f55fb0bc6edd5dc8302ad32465ddf0d3ca7ccf164a4e8aa6`

From this directory, extract into a new directory and replay:

```bash
mkdir offline-reading-review
tar -xzf package.tar.gz -C offline-reading-review
node offline-reading-review/replay.mjs
```

Node v24.21.0 was used; Node 22 or newer is required. No dependency installation,
network or agent CLI is needed. The 985,095-byte archive verifies 390 indexed
files, four complete delivery regrades, exact quality/cost/acceptance equality,
all three full Skill hashes, 130 numeric-final alignments and the separate
80/46/4-call summaries. It corrects the 50 literal-empty traces to 19 missing
patches plus 31 legitimate check-only traces, reproduces 12 dedicated and seven
mixed recovery responses, phase arithmetic and the 178-call cost ledger.
Its output remains `reject`, `automaticUpgrade=false`; v5.1 is unvalidated.

Source hashes and local audit attestations accompany the normalized derivative.
Original raw native records and private local-session bodies are not distributed.
The package does not claim their unchanged native seal or independently
re-attest private source matching. Byte counts describe original outputs before
normalization. Numeric reasoning usage is a component of output; hidden reasoning
text is excluded. Historical unknown costs stay unknown, and observed recovery
usage is not a measured net saving.
