# Restore historical evidence archives

Released npm 0.13.0 and 0.13.1 keep frozen replay support files while fetching
19 compressed archives explicitly from a fixed Git commit. The current source
adds on-demand support restoration: future packages also omit the frozen
`evidence/artifacts/` tree. This addition is not part of published npm 0.13.1.
The default Git tree also omits historical originals; their fixed Git source remains available. Ordinary install, CLI commands and evaluations
never download archives or support automatically.

These commands apply to 0.13.0 and newer. Published 0.12.0 still carries its archives
and does not include the new restore entry. From your project, install the
versioned package and invoke its restore tool:

```bash
npm install --save-exact skillfit@0.13.1
node ./node_modules/skillfit/evidence/fetch-archives.mjs --list
node ./node_modules/skillfit/evidence/fetch-archives.mjs --all --output ./historical-evidence
node ./node_modules/skillfit/evidence/fetch-archives.mjs --all --output ./historical-evidence --yes
```

`--list` shows stable IDs. Without `--yes`, restoration only prints its plan:
no network requests or filesystem writes. The output parent must already exist;
the output itself must be new and outside both the installed package and any
local archive source. An existing destination is always refused, even if empty.
Use one or more `--id <id>` options instead of `--all` for selected archives.
Every selection also restores the catalog's 1,583 shared support files (12,973,972 bytes): READMEs, indexes, reports, declarations, licensed inputs and frozen
source/runtime/scripts. Four historical macOS metadata files excluded by npm
are carried as hash-checked base64 support entries, preserving frozen indexes.
Aggregate procedures can require sibling archives;
choose `--all` to reproduce those procedures.

## Once online, then offline

The default HTTPS source is the public repository at full commit
`56b4dc68e115475e197c6510c9cb2235a5ad2c62`. Each archive's exact byte count and
SHA-256 are checked against [the versioned catalog](../../evidence/archive-catalog.v1.json).
Downloads reject redirects, have a 30-second deadline per downloaded file and cannot
exceed the catalog size. Support files are also hash-checked. In the current source, genuinely absent
package support is read from `--from` when provided, otherwise from the same fixed
HTTPS source. Existing corrupt or aliased package files are errors, not reasons
to download a replacement. At most six support workers run together; identical
content is downloaded once per restoration and verified at each original path. All selected
bytes are staged before publishing the new directory, with exclusive creation
and collision checks. Failed operations attempt to remove their temporary files;
cleanup preserves other files and reports any files it cannot remove.
It does not promise a crash-atomic multi-file publication.

When complete, the workspace contains the original repository-relative paths.
Keep it for later offline use; the tool never extracts or executes its archives.
Read each restored artifact's README, manually extract into a fresh directory,
and run only its documented offline replay. Historical live entry points are
retained records, not instructions to start new paid experiments.

To restore from a previous complete workspace or a fixed historical Git checkout without a network:

```bash
node ./node_modules/skillfit/evidence/fetch-archives.mjs --all --output ./historical-evidence-copy --from ./historical-evidence --offline --yes
```

The local root must contain the original `evidence/artifacts/...` paths. Local
files receive the same size/hash checks; missing or corrupt files fail without
network fallback. `--offline` requires `--from` and guarantees no network access.
Keep the installed package available for its catalog and restore tool. A lean
package needs a complete restored workspace or the original Git tree as its
`--from` source. Older packages that already contain support files can still
combine their support with a local archive-only source. Explicit `--from` never
falls back to the network; missing or corrupt required files fail clearly.

If the fixed remote is unavailable, restoration fails and cleans up its staging
directory, reporting any cleanup failure. Retry explicitly after connectivity returns, or supply a previously
verified workspace/checkout via `--from`. There is no fallback to `main`, another
version or an unverified mirror. A catalog hash detects corruption; it does not
independently authenticate a modified npm package or replace normal source trust.

## Historical compatibility and distribution

[The original inventory](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/archive-inventory.md) records every original path, full digest,
replay entry and runtime requirement. The restoration tool needs Node >=22.
Historical recipes keep their recorded requirements: several require Node
24.21.0 or built-in TypeScript support, and their POSIX shell commands/verifiers
are not a new Windows compatibility claim. Saved failures must reproduce their
original grades; restoration does not promote a rejected or inconclusive Skill.

This distribution change starts with 0.13.0. Published 0.12.0 archives, dated
reports, release receipts and recipes are unchanged. See the
[current release record](releases.md) for publication and verification status.

The independent installed-package check is
[archive-delivery-smoke.mjs](../../tools/verify/recipes/archive-delivery-smoke.mjs). Run it with
the installed package path, a local archive source root and a fresh output
parent. It checks all restored bytes, preview purity and destination collision
protection, without network or model calls. It supplements each version's
feature recipe; it does not establish registry publication.


## Source history and inventory

The catalog is the exact inventory: 19 archives and 1,583 support files, each with
its original path, size and SHA-256. The main evidence directory contains only
its current index, catalog and restorer. The live evidence index is not used as
the historical index during restoration.

A full Git clone retains the pinned objects even after main removes the files.
Source verification can read those objects offline with
`node tools/history/check-archives.mjs`. In a shallow clone, explicitly fetch the exact
catalog commit before this optional historical check:

```bash
git fetch --no-tags --depth=1 origin 56b4dc68e115475e197c6510c9cb2235a5ad2c62
```

For an old complete filesystem snapshot, use the existing --from / --offline
restore options. The CLI itself never fetches Git objects or starts a replay.
Historical recipes retain their original Node/POSIX requirements. Several
require Node 24.21.0; inspect each restored README. A successful replay can
faithfully reproduce a rejected/failed experiment, rather than promote it.

[All previous documentation](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs) and
[original evidence](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/evidence) remain at a fixed snapshot.
Old audits, completed plans, dated reports and release receipts are historical
records; they are not active maintenance pages. Removing them from main does not
shrink old Git history or change existing npm releases.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/archive-delivery.md).

The consolidated source guides and references retain earlier paths/anchors at
[this fixed documentation snapshot](https://github.com/remote-controlled-man/skillfit/tree/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs).
