# Development tools

After installing development dependencies, `npm test` builds the CLI and runs
all offline regressions. Tests use injected executors and temporary directories;
they do not call a live agent or change personal configuration.

| Task | Entry point |
| --- | --- |
| Documentation links, anchors, layout and bilingual entry points | `node tools/verify/check-docs.mjs` (`--json`) |
| Module roles and runtime dependencies | `node tools/verify/check-architecture.mjs` |
| Contributed bench integrity | `node tools/verify/check-contrib-benches.mjs` |
| npm inventory, retained recipes and size bounds | `node tools/verify/check-package.mjs <pack.json>` |
| Node capability/minimum checks after building | `node --test tools/verify/node-minimum.test.mjs` |

[Architecture and maintenance](../docs/maintainers/architecture.md) explains current
module, documentation and release contracts. `verify/fixtures/` contains only
inputs consumed by current offline regressions, grouped by test owner; it is
excluded from npm. One-off source copies, package extractions and check logs belong
in OS temporary directories, not the experiment `runs/` tree. Ordinary `dist/`
and `node_modules/` keep their existing project locations. Keep a result only
while its review or delivery consumes it; release receipts use an explicit
external destination. Experiment retention follows the
[workflow](../docs/guides/experiment-workflow.md#retain-and-clean-up).

## Release tools

`npm-release.mjs`, `release-source.mjs`, `release-acceptance.mjs`,
`release-checks.mjs` and `release-records.mjs` prepare, verify and summarize an
explicitly authorized release. Source gates bind exact main CI, preview attempt,
package bytes and publication intent. Recovery preserves failed observations;
records verification is read-only and never imports receipts into source. No script authorizes a
publication merely by producing a plan. Follow the existing
[release procedure](../docs/maintainers/releases.md) for preview, publication,
acceptance and recovery order.

## Retired procedures

Old study procedures remain at their [fixed source](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/scripts).
Current tools have no historical-study restore or rerun dependency. Product
report/export/replay remains under Evaluation Records and its current tests.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/scripts/README.md).

<a id="historical-experiments"></a>
