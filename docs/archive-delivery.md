# Restore historical evidence archives

Starting with 0.13.0, the npm package keeps the frozen replay support files and a versioned catalog,
while the 19 compressed archives are fetched explicitly from a fixed Git
commit. Git checkouts still retain the original archives. Ordinary npm install,
CLI commands and evaluations never download them automatically.

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
Every selection also copies the catalog's 1,583 shared support files (12,973,972 bytes): READMEs, indexes, reports, declarations, licensed inputs and frozen
source/runtime/scripts. Four historical macOS metadata files excluded by npm
are carried as hash-checked base64 support entries, preserving frozen indexes.
Aggregate procedures can require sibling archives;
choose `--all` to reproduce those procedures.

## Once online, then offline

The default HTTPS source is the public repository at full commit
`56b4dc68e115475e197c6510c9cb2235a5ad2c62`. Each archive's exact byte count and
SHA-256 are checked against [the versioned catalog](../evidence/archive-catalog.v1.json).
Downloads reject redirects, have a 30-second deadline per archive and cannot
exceed the catalog size. Support files are also hash-checked. All selected
bytes are staged before publishing the new directory, with exclusive creation
and collision checks. Failed operations attempt to remove their temporary files;
cleanup preserves other files and reports any files it cannot remove.
It does not promise a crash-atomic multi-file publication.

When complete, the workspace contains the original repository-relative paths.
Keep it for later offline use; the tool never extracts or executes its archives.
Read each restored artifact's README, manually extract into a fresh directory,
and run only its documented offline replay. Historical live entry points are
retained records, not instructions to start new paid experiments.

To restore from a previous complete workspace or Git checkout without a network:

```bash
node ./node_modules/skillfit/evidence/fetch-archives.mjs --all --output ./historical-evidence-copy --from ./historical-evidence --offline --yes
```

The local root must contain the original `evidence/artifacts/...` paths. Local
files receive the same size/hash checks; missing or corrupt files fail without
network fallback. `--offline` requires `--from` and guarantees no network access.
Keep the installed package available for the frozen support allowlist.

If the fixed remote is unavailable, restoration fails and cleans up its staging
directory, reporting any cleanup failure. Retry explicitly after connectivity returns, or supply a previously
verified workspace/checkout via `--from`. There is no fallback to `main`, another
version or an unverified mirror. A catalog hash detects corruption; it does not
independently authenticate a modified npm package or replace normal source trust.

## Historical compatibility and distribution

[The inventory](archive-inventory.md) records every original path, full digest,
replay entry and runtime requirement. The restoration tool needs Node >=22.
Historical recipes keep their recorded requirements: several require Node
24.21.0 or built-in TypeScript support, and their POSIX shell commands/verifiers
are not a new Windows compatibility claim. Saved failures must reproduce their
original grades; restoration does not promote a rejected or inconclusive Skill.

This distribution change starts with 0.13.0. Published 0.12.0 archives, dated
reports, release receipts and recipes are unchanged. See the
[current release record](releases/0.13.1.md) for publication and verification status.

The independent installed-package check is
[archive-delivery-smoke.mjs](releases/archive-delivery-smoke.mjs). Run it with
the installed package path, a local archive source root and a fresh output
parent. It checks all restored bytes, preview purity and destination collision
protection, without network or model calls. It supplements each version's
feature recipe; it does not establish registry publication.
