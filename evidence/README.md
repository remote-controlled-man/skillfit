# Evidence

This directory keeps the current index, immutable hash catalog and explicit
restore tool. Historical reports, manifests, logs and frozen source/runtime
copies are stored at their pinned Git commits and restored only when needed.

- [Dated reports and all original study records](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/evidence).
- [Exact original data source](https://github.com/remote-controlled-man/skillfit/tree/56b4dc68e115475e197c6510c9cb2235a5ad2c62/evidence).
- [Restore instructions](../docs/maintainers/archive-delivery.md).
- [Measurement and adoption contract](../docs/reference/metrics.md).

## What the studies establish

Published cohorts include negative, stopped and exploratory results. They do not
establish a general Skill installation recommendation. Preserve each report's
model/agent, bench, harness, costs, identity coverage and limitations; do not pool
incompatible cohorts. The selectable catalog is an inventory, not proof of gain.

The original receipts and every failed/interrupted attempt remain unchanged.
Offline replay establishes integrity under the recorded environment; it does
not prove current-model efficacy or independent third-party live reproduction.
Several original recipes require Node 24.21.0/POSIX. Do not run archived live
entry points just to verify a download.

## Restore explicitly

```bash
node evidence/fetch-archives.mjs --list
node evidence/fetch-archives.mjs --all --output ../skillfit-history
node evidence/fetch-archives.mjs --all --output ../skillfit-history --yes
```

Preview writes/downloads nothing. Restoration verifies fixed paths, sizes and
SHA-256 and refuses existing destinations. See the catalog for all 19 archive IDs
and 1,583 support files. Ordinary install/evaluation never downloads history.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/evidence/README.md).
