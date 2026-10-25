# Development tools

After installing development dependencies, `npm test` builds the CLI and runs
all offline regressions. Tests use injected executors and temporary directories;
they do not call a live agent or change personal configuration.

| Task | Entry point |
| --- | --- |
| Documentation registry, links and bilingual entry points | `node tools/verify/check-docs.mjs` (`--json`, `--base <exact-commit-SHA>`) |
| Module roles and runtime dependencies | `node tools/verify/check-architecture.mjs` |
| Contributed bench integrity | `node tools/verify/check-contrib-benches.mjs` |
| Pinned historical Git objects and hashes | `node tools/history/check-archives.mjs` |
| npm inventory, retained recipes and size bounds | `node tools/verify/check-package.mjs <pack.json>` |
| Node capability/minimum checks after building | `node --test tools/verify/node-minimum.test.mjs` |

[Architecture and maintenance](../docs/maintainers/architecture.md) explains current module,
documentation and release contracts. [Archive delivery](../docs/maintainers/archive-delivery.md)
explains how to obtain the exact pinned Git objects for offline source checks.
`historical-source.mjs` reads those local objects; it never fetches automatically.
The small `verify/fixtures/history/` directory contains only bytes consumed by current
regression tests. It is development data and is excluded from npm.

## Release tools

`npm-release.mjs`, `release-source.mjs`, `release-acceptance.mjs`,
`release-checks.mjs` and `release-records.mjs` prepare, verify and summarize an
explicitly authorized release. Source gates bind exact main CI, preview attempt,
package bytes and publication intent. Recovery preserves failed observations;
normal records verification is read-only; explicit legacy receipt import previews
changes and refuses collisions. No script authorizes a
publication merely by producing a plan.

## Historical experiments

Dated `run-`, `replay-`, `regrade-` and `analyze-` scripts are historical procedures,
not the current getting-started path. Their original declarations, inputs,
conditions and recipes are in the [fixed source snapshot](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/scripts).
Use the restored package's own frozen replay recipe. Main no longer carries all
of their old relative inputs. Live `run-` procedures can incur spending and need
separate authorization; cleanup and offline verification grant none.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/scripts/README.md).
