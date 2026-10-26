# Release procedure

Current source contains unpublished changes beyond npm 0.13.1. The package
version alone does not identify a source checkout. See the [changelog](../../CHANGELOG.md)
for versioned product changes and the [fixed 0.13.1 record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md)
for the original publication receipts.

Use one reviewed source/archive/preview and explicit publication intent. Verify
registry installation, current Skill/documents, examples, installed features,
source provenance and registry signatures: exactly six stages. Source tests are
offline; registry installation/provenance/signatures require the network during
an authorized publication. None of these steps calls a model.

Successful acceptance produces a standalone records bundle with one manifest
and hash-linked receipts. Verify it with `node tools/release/release-records.mjs <bundle>`.
Keep the complete bundle with its versioned delivery; expiring workflow logs
are not a durable delivery. Neither receipt generation nor checking writes
repository documentation or adds per-version pages.

The standalone bundle manifest remains schema 3. Verification protocol 3 requires
the current six stages; protocol 2 still verifies complete eight-stage bundles
read-only. Partial, mismatched or unknown protocols fail. Repository-shaped
receipt import is retired; normal acceptance never restores historical studies.
The current plan replaces its status and links proof rather than appending logs.

The npm package contains the runtime, reusable Bench inputs, current user docs,
profiles, driver Skill and the installed feature recipes actually executed by
acceptance. It excludes development tooling/fixtures, the current plan, generated
runs and historical study data. Package inventory and size checks remain in
`tools/verify/check-package.mjs`; no external archive catalog is required.
See [architecture](architecture.md) for artifact ownership and confirmation.
