# npm package contents

The CLI package includes runtime code and the offline inputs needed by its
published examples. Development checks use the source checkout; normal CLI
execution has zero runtime dependencies.

## Retained content

- Active compiled JavaScript and matrix JSON, including native report/export support.
- Bundled cases, profiles, driver Skill, schemas and documentation.
- `evidence/inputs/` used by request examples, and fixed historical archives/replays.
- Six compiled test files required by the unchanged 0.12.0 installed-feature recipe.

Other active `dist/**/*.test.js` files stay in source development and `npm test`.
The package's explicit file patterns exclude them; nested historical replay tests
retain their original bytes and paths.

## Why the archive is still large

The dated artifact READMEs explicitly use their archives, frozen source/runtime
and tests for offline reproduction. Removing them from npm would change that
available offline surface. The cleanup preserves these inputs. Moving large
archives to a separate download needs a reviewed distribution change; this work
does not publish or upload anything.

The first compatible trim removed 60 active development test files, saving about
742 KB unpacked and 101 KB compressed against the same working-tree package
before trimming. These local measurements are not sizes of the published 0.12.0
archive. The cleanup plan records the final inspected archive and checks.

## Package checks

After building, inspect a package without running lifecycle scripts or contacting
a registry:

```bash
npm pack --dry-run --ignore-scripts --offline --json > /tmp/skillfit-pack.json
node scripts/check-package.mjs /tmp/skillfit-pack.json
```

Use a writable npm cache if the default cache is unavailable. The check verifies
required inputs, every active compiled runtime module, the six retained tests and
19 reviewed historical archives. It rejects unknown roots, known credential/private
paths, unexpected archives, extra active tests and missing or duplicate files.
It is a path/inventory check rather than a general secret scanner.

[scripts/package-policy.json](../scripts/package-policy.json) records the reviewed
inventory and ceilings: 23 MiB compressed and 37 MiB unpacked. They were derived
from the measured compatible trim, rounded to whole MiB with one MiB of headroom.
New content beyond the inventory or size ceiling needs an explicit policy review;
the limits must not be increased just to hide accidental contents.

`npm test` includes an actual offline npm-pack inventory check. The release
preparation script applies the same policy before publication. Independent local
installation and moved replay verification remain part of final delivery; they
are not inferred from a successful package preview.
