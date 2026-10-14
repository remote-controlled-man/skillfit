# Debugging development stops: offline package

Three stopped development cohorts provide no stable improvement or upgrade claim.
See the [dated report](../../2026-10-13-debugging-development-stops.md).

`package.tar.gz` preserves the complete derived public package: frozen source and
compiled code, licensed benches, a nested delivery archive, original/export file
hashes, native metadata, numeric partial-cost sidecars and detailed evidence limits.
Private paths are normalized; private session bodies and reasoning are excluded.
The export does not assert an unchanged original native seal.

Archive SHA-256: `1ca51e483eb9e71116c0a7519c5334cdd58f13f571e84c723f4502e7b0becef7`.

With Node >=22, run from this directory:

```bash
SKILLFIT_DEVELOPMENT_PACKAGE=$(mktemp -d)
tar -xzf package.tar.gz -C "$SKILLFIT_DEVELOPMENT_PACKAGE"
tar -xzf "$SKILLFIT_DEVELOPMENT_PACKAGE/records.tar.gz" -C "$SKILLFIT_DEVELOPMENT_PACKAGE"
node "$SKILLFIT_DEVELOPMENT_PACKAGE/replay/scripts/replay-development-stops.mjs" "$SKILLFIT_DEVELOPMENT_PACKAGE/records"
node --test "$SKILLFIT_DEVELOPMENT_PACKAGE/replay/dist/harness/stats.test.js" "$SKILLFIT_DEVELOPMENT_PACKAGE/replay/dist/harness/eval-efficiency.test.js" "$SKILLFIT_DEVELOPMENT_PACKAGE/replay/dist/harness/execution-timing.test.js"
```

Expected: 955 export file hashes, seven exact delivery regrades, every cohort's
paired/all-invocation spending, 12 recorded CLI executions including two readiness
checks, three missing final usages, and partial lower bounds of 2,632,108 input,
288,172 uncached input and 71,128 output. Frozen standalone tests pass 23/23.
These commands make zero model/agent calls and install no dependency.

Read the extracted README for experiment settings and evidence boundaries.
The numeric sidecar is a partial lower bound, not complete billing; private source
counters are not independently attestable from this export. Frozen local tests
do not prove Skill improvement. Fresh live runs require a new bounded declaration
and reproduce the method, not identical stochastic usage or outcomes.
