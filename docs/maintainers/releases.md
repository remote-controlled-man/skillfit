# Release procedure

Current source contains unpublished changes beyond npm 0.13.1. The package
version alone does not identify a source checkout. See the [changelog](../../CHANGELOG.md)
for versioned product changes and the [fixed 0.13.1 record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md)
for the original publication receipts.

Use one reviewed source/archive/preview and explicit publication intent. Verify
registry installation, current Skill/examples, installed features, restored
archives, frozen history, source provenance and registry signatures. Normal
checks are offline; actual publication and model calls need their own scope.

Successful acceptance produces a standalone records bundle with one manifest
and hash-linked receipts. Verify it with `node tools/release/release-records.mjs <bundle>`.
Keep the complete bundle with its versioned delivery; expiring workflow logs
are not its permanent archive. Neither receipt generation nor checking writes
repository documentation or adds per-version pages.

Old repository-shaped bundles remain recoverable only through explicit
`--legacy-import`; this is recovery, not the normal release path. The current
plan replaces its status and links proof rather than appending release logs.
See [architecture](architecture.md) for source/confirmation and archive policy.
