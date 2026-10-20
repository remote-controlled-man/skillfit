# Historical archive inventory

This inventory pins the 19 compressed files at source commit
`56b4dc68e115475e197c6510c9cb2235a5ad2c62`. The Git originals stay in place.
It describes recorded offline procedures, not permission to run historical live
entry points. No model calls are needed for the procedures below.

## Supporting files and compatibility

The existing full npm package includes all 19 archives and the public
`evidence/` tree: artifact READMEs/indexes, frozen source/runtime/scripts,
licenses, declarations, reports and inputs. Restoration will copy an explicit
file-level allowlist of that pinned public evidence tree (excluding the 19
archives), retaining the original relative paths. This also keeps sibling
spending ledgers and the receiver-correction replay available. It does not
scan the checkout, copy user configuration, or substitute the active runtime
for frozen code. A single archive selection still includes this shared support
set; choose all archives for aggregate/cross-archive procedures.

The first nine archives use the neighboring frozen `replay/` tree. The later
10 packages embed their executable replay payloads; the neighboring README,
index and report are still needed to interpret them. Extract manually into a
fresh directory before invoking the documented offline entry. The restoration
tool itself must neither extract nor execute code.

These were already npm-distributed bytes. Paths shown as repository-root
commands work from the restored workspace root; artifact-local commands run
from the linked README's directory. Historical `npm ci`/`npm test` references
to a complete source checkout remain source-development checks: partial frozen
source trees are not complete checkouts. Root `scripts/replay-*.mjs` are source
helpers; use the frozen `replay/scripts/` commands specified in the artifact
READMEs. No new Node 22 or Windows claim follows from copying the files.

Four tracked `.DS_Store` files are excluded automatically by npm even from the
full package, but are listed by frozen indexes. The catalog carries their exact
public bytes as base64 support payloads (with the same size/hash checks). This
preserves those indexes in restored workspaces without modifying the historical
files or depending on extra downloads.

## Original offline entry points

| Artifact directory | Original offline procedure after extraction | Recorded requirements / npm surface |
| --- | --- | --- |
| [2026-10-12-diagnosing-revision](../evidence/artifacts/2026-10-12-diagnosing-revision/README.md) | `replay/scripts/regrade-diagnosing-revision.mjs <phase>`; analyzer; frozen report | Node 24.21.0 recorded; bench >=22.13; frozen sibling replay shipped |
| [2026-10-12-diagnosing-v2](../evidence/artifacts/2026-10-12-diagnosing-v2/README.md) | `replay/scripts/replay-diagnosing-v2.mjs <phase>`; analyzer; oninsert control | Node 24.21.0 recorded; built-in TypeScript transform >=22.13; both archives and sibling replay shipped |
| [2026-10-12-normalize-url-v2-available](../evidence/artifacts/2026-10-12-normalize-url-v2-available/README.md) | Extract readiness records; compare exported files with `export-index.json` | No paired grading; frozen inputs and export index shipped; do not invoke live entry |
| [2026-10-12-normalize-url-v2-comparison](../evidence/artifacts/2026-10-12-normalize-url-v2-comparison/README.md) | `replay/scripts/replay-normalize-url-v2-comparison.mjs <phase>`; analyzer; frozen report | Node 24.21.0 recorded; frozen sibling runtime/tests shipped |
| [2026-10-12-normalize-url-v2-recovery](../evidence/artifacts/2026-10-12-normalize-url-v2-recovery/README.md) | `replay/scripts/replay-normalize-url-v2-recovery.mjs <phase>`; analyzer; frozen report | Node 24.21.0 recorded; frozen sibling runtime shipped |
| [2026-10-12-normalize-url-v2-validated](../evidence/artifacts/2026-10-12-normalize-url-v2-validated/README.md) | `replay/scripts/replay-normalize-url-v2-validated.mjs <phase>`; analyzer; frozen report | Node 24.21.0 recorded; aggregate spending also needs three stopped sibling archives |
| [2026-10-13-debugging-completed-development](../evidence/artifacts/2026-10-13-debugging-completed-development/README.md) | `replay/scripts/replay-completed-development.mjs` inside extracted package | Node >=22 documented; embedded runtime; 23 frozen checks |
| [2026-10-13-debugging-controls-and-sleep-stop](../evidence/artifacts/2026-10-13-debugging-controls-and-sleep-stop/README.md) | `replay-all.mjs` inside extracted package | Node >=22 documented; embedded runtimes; 23 frozen checks |
| [2026-10-13-debugging-development-stops](../evidence/artifacts/2026-10-13-debugging-development-stops/README.md) | Extract nested `records.tar.gz`; `replay/scripts/replay-development-stops.mjs <records>` | Node >=22 documented; embedded runtime; 23 frozen checks |
| [2026-10-14-debugging-followup-routing-stop](../evidence/artifacts/2026-10-14-debugging-followup-routing-stop/README.md) | `replay-routing-stop.mjs` inside extracted package | Node >=22 documented; embedded runtime; 23 frozen checks |
| [2026-10-14-debugging-independent-validation](../evidence/artifacts/2026-10-14-debugging-independent-validation/README.md) | `replay-validation.mjs` inside extracted package | Node >=22 documented; embedded runtime; 23 frozen checks |
| [2026-10-14-debugging-reading-pilot-and-cost-review](../evidence/artifacts/2026-10-14-debugging-reading-pilot-and-cost-review/README.md) | `replay.mjs` inside extracted package | Node >=22 documented; 24.21.0 recorded; embedded frozen code |
| [2026-10-14-debugging-spending-stop](../evidence/artifacts/2026-10-14-debugging-spending-stop/README.md) | `replay-spending-stop.mjs` inside extracted package | Node 24.21.0 recorded; embedded runtime; optional 23 frozen checks |
| [2026-10-15-independent-comparison-regression-stop](../evidence/artifacts/2026-10-15-independent-comparison-regression-stop/README.md) | `replay.mjs` inside extracted package | Node 24.21.0 verified; correction replay additionally consumes this archive |
| [2026-10-15-native-diff-mechanism](../evidence/artifacts/2026-10-15-native-diff-mechanism/README.md) | `replay.mjs` inside extracted package | Node 24.21.0 specified; embedded frozen code |
| [2026-10-15-receiver-mechanism-stop](../evidence/artifacts/2026-10-15-receiver-mechanism-stop/README.md) | `replay.mjs` inside extracted package | Node 24.21.0 verified; embedded verifier/controller tests |

Historical shell examples use POSIX tools (`tar`, `mktemp`, sometimes `shasum`)
and several frozen verifiers invoke platform-specific shell commands. The
restorer is portable; these historical recipes retain their original platform
requirements. A recipe reporting recorded failed deliveries is successful when
its assertions reproduce those failures, not when every delivery passes.

## Exact compressed bytes

| Original path | Bytes | SHA-256 |
| --- | ---: | --- |
| `evidence/artifacts/2026-10-12-diagnosing-revision/calibration-records.tar.gz` | 197,977 | `dcb85c9f345e73c8e3777d8ce7421a17d974806e0ebe770400a93b262fce6d47` |
| `evidence/artifacts/2026-10-12-diagnosing-revision/interrupted-records.tar.gz` | 646,293 | `15d53b45e2ef814767e56aa755ad7ecf64617af80e00d5ab3e4c17f8d9126078` |
| `evidence/artifacts/2026-10-12-diagnosing-revision/validation-records.tar.gz` | 1,129,096 | `031efa9d44293f4b70b8c9d3c1f363d7529585e4639c4c464285f22e5f53d9a5` |
| `evidence/artifacts/2026-10-12-diagnosing-v2/regression-records.tar.gz` | 253,786 | `e2fc25da07dad3dbabf34d8067ce659972615353665f61208fbc8c34b755acba` |
| `evidence/artifacts/2026-10-12-diagnosing-v2/transfer-records.tar.gz` | 111,515 | `508ffd7b9ac8b9bcc438202a4c352f3bb7a31df91a9f27867568a31d42d10158` |
| `evidence/artifacts/2026-10-12-normalize-url-v2-available/readiness-records.tar.gz` | 1,082 | `74fc0f675ddb111fef493a52cc7f4971bc12e7f5d5ffa2053d705f7afb71a57c` |
| `evidence/artifacts/2026-10-12-normalize-url-v2-comparison/records.tar.gz` | 69,855 | `29ce6dc3f14da6b4bfe7a1ac65c1965d38bae9e40dc83352fab685c510363e43` |
| `evidence/artifacts/2026-10-12-normalize-url-v2-recovery/records.tar.gz` | 86,844 | `e27b441c4605134076bb6674b1712bbb23c46bd4d28b643120be950a0c50543e` |
| `evidence/artifacts/2026-10-12-normalize-url-v2-validated/records.tar.gz` | 129,523 | `86ed1f03513e4e7342d3e1e5849cb5007344d16ff11e2d612ae4073c8e5ba907` |
| `evidence/artifacts/2026-10-13-debugging-completed-development/package.tar.gz` | 1,282,702 | `84c5be909da00037634106e292be9424f435b309f48876859d2f0d63bae2de36` |
| `evidence/artifacts/2026-10-13-debugging-controls-and-sleep-stop/package.tar.gz` | 3,563,737 | `8d2939ee8f1c25a5d8230e54a9faf024e71a5918e1e507144a82426bb15340c7` |
| `evidence/artifacts/2026-10-13-debugging-development-stops/package.tar.gz` | 1,538,623 | `1ca51e483eb9e71116c0a7519c5334cdd58f13f571e84c723f4502e7b0becef7` |
| `evidence/artifacts/2026-10-14-debugging-followup-routing-stop/package.tar.gz` | 2,495,332 | `f03479742b5a86738ea8dc470a911d5392c7893bf15aa2b4c33ae6de78970343` |
| `evidence/artifacts/2026-10-14-debugging-independent-validation/package.tar.gz` | 2,900,849 | `1a4b136b87b2f3288896b6a48416710551bd149529f118b0e02e7740fd5286f1` |
| `evidence/artifacts/2026-10-14-debugging-reading-pilot-and-cost-review/package.tar.gz` | 985,095 | `61c48885f2b91d79f55fb0bc6edd5dc8302ad32465ddf0d3ca7ccf164a4e8aa6` |
| `evidence/artifacts/2026-10-14-debugging-spending-stop/package.tar.gz` | 1,815,660 | `3665e15042c3df6f94ca5554f8a63120f943d97028ac4965d2e175d969d3b2a2` |
| `evidence/artifacts/2026-10-15-independent-comparison-regression-stop/package.tar.gz` | 1,214,300 | `6a4d29e55a1b48b7e8cd4e790eb057341b08e92ede7e6fe903a015a6edfe3ed6` |
| `evidence/artifacts/2026-10-15-native-diff-mechanism/package.tar.gz` | 830,563 | `0662db8ba95ab7a440098a10a48d6ba95a7cf900ee98cc7733aab2d3192c201f` |
| `evidence/artifacts/2026-10-15-receiver-mechanism-stop/package.tar.gz` | 630,986 | `b520022e2c6250bfa2b20c864e2f63d9436647a05d69b16b312ec636d36a0a43` |

Total: 19 archives, 19,883,818 bytes.
