# npm package contents

The CLI package includes runtime code and the offline inputs needed by its
published CLI examples. Development checks use the source checkout; normal CLI
execution has zero runtime dependencies.

## Retained content

- Active compiled JavaScript and matrix JSON, including native report/export support.
- Bundled cases, profiles, driver Skill, schemas and documentation.
- `evidence/inputs/` used by request examples and pinned historical replay support.
- The [versioned archive catalog](../evidence/archive-catalog.v1.json), independent
  `evidence/fetch-archives.mjs` and [restoration guide](archive-delivery.md).
- Six compiled test files required by the 0.12.0, 0.13.0 and 0.13.1 installed-feature recipes.

Other active `dist/**/*.test.js` files stay in source development and `npm test`.
The package's explicit file patterns exclude them; nested historical replay tests
retain their original bytes and paths. Four historical metadata files normally
excluded by npm are encoded in the catalog so restored frozen indexes stay exact.

## Explicit historical archive restoration

The 19 compressed files in [the inventory](archive-inventory.md) are excluded
precisely by `evidence/artifacts/.npmignore`; their Git originals remain unchanged.
The package keeps their READMEs, reports, declarations, licensed inputs and frozen
source/runtime/scripts. Historical archive recipes need an explicit
[restore step](archive-delivery.md) before extracting or replaying saved records.
Normal npm installation and CLI commands never fetch them automatically.

Downloads use a full fixed source commit and verify size/SHA-256. A local source
supports entirely offline restoration. Both modes write a fresh workspace at
original relative paths, preserving existing outputs. All 19 archives and their
1,583 supporting files were verified after detached installation, and the 19
original offline replay/export procedures passed on the recorded Node 24.21.0
macOS environment. Their original runtime/platform requirements remain.

A same-snapshot full/candidate comparison removed exactly the 19 archives and
nothing else: 22,473,981 to 2,811,158 compressed bytes (87.49% less), before final
documentation additions. These are development measurements, not sizes of the
published 0.12.0 tarball. Published releases and their receipts/recipes are
unchanged. This distribution starts with 0.13.0; its
[current release record](releases/0.13.1.md) tracks actual publication and verification.

## Package checks

After building, create and inspect an actual package without lifecycle scripts
or registry access (POSIX shell example):

```bash
npm run build
pack_dir=$(mktemp -d)
npm pack --ignore-scripts --offline --json --pack-destination "$pack_dir" > "$pack_dir/pack.json"
node scripts/check-package.mjs "$pack_dir/pack.json"
node scripts/npm-release.mjs check "$pack_dir/pack.json"
```

Use a writable npm cache if the default cache is unavailable. The check verifies
required runtime, inputs, six retained tests, catalog/tool and every directly
shipped catalog support path. It rejects external or unknown archives, unknown
roots, known credential/private paths, extra active tests and duplicate/missing
files. It is an inventory check rather than a general secret scanner.

[scripts/package-policy.json](../scripts/package-policy.json) limits the package
to 4 MiB compressed and 19 MiB unpacked. These ceilings leave room above the
measured lean package while retaining over 80% compressed reduction from the
same-snapshot full baseline. Do not raise them to hide accidental contents.

`npm test` checks the catalog against retained source bytes, creates an actual
offline npm package, extracts it and runs its shipped
[archive-delivery smoke](releases/archive-delivery-smoke.mjs). This verifies all
restored bytes, preview purity and collision protection with zero network/model
calls. The release preparation check applies the same inventory policy; the
versioned installed-feature recipe remains the separate CLI workflow check.

Current fixed-version commands in both READMEs, the driver Skill, first-run guide
and archive guide must match the package version. The shipped
[document check](releases/release-docs-smoke.mjs) runs against extracted/installed
files, while historical feature minimums and frozen release records remain valid.
Source release preparation applies the same check; the 0.13.1 installed feature
recipe records each checked document digest and its fixed-version references.
