# Portable offline evaluation packages

skillfit 0.10.0 exports paired native runs without a judge to a fresh directory.
The package contains unchanged receipts, original pinned inputs, the compiled
implementation used by the experiment and a dependency-free replay entry point.
Export and replay make zero model calls. Replay executes trusted local verifiers.

## Preview, export and move

```bash
skillfit report eval ./runs/my-run --export ./exports/my-run --json
skillfit report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs --verify-only
node ./exports/my-run/reproduce.mjs
skillfit report eval ./exports/my-run --json --replay
```

Without `--yes`, export only checks inputs and prints the plan. `--dry-run` always
prevents writing. Apply stages and checks the files, claims an unused destination
and verifies the resulting package. Existing destinations, including empty ones,
are rejected. The output must be outside the source run and pinned input roots.
If a transfer fails after claiming its destination, inspect that incomplete output
and use a fresh destination; it is never reported as a successful export.

Move the complete directory to another machine, then run its `reproduce.mjs`.
Node.js 22+ and any external toolchains required by your verifier are necessary;
the package does not install system dependencies. `--verify-only` checks inventory,
hashes and source-plan binding without executing verifiers. Default replay uses
the copied compiled CLI, grades temporary delivery copies and returns JSON. The
last command above uses the currently installed CLI and the packaged bench.

The source must have sealed native evidence. A completed manifest must pass the
native evidence audit. Missing, changed or linked native artifacts reject export.
The current source after npm 0.10.0 [seals inputs before dispatch](evaluation-input-snapshots.md)
and exports those copies even after original bench/Skill/request directories change
or disappear. A declared but damaged snapshot is an error, never a silent fallback.
Older runs without snapshots still need matching original or recovered bench,
complete candidate/baseline resources, compiled implementation and original request.

Recover original files elsewhere and provide matching paths when necessary:

```bash
skillfit report eval ./runs/my-run --export ./exports/my-run --input-root bench=./recovered/bench --input-root target=./recovered/new-skill --input-root baseline-skill=./recovered/old-skill --input-root implementation=./recovered/dist --input-root request=./recovered/request.json --json
```

Only labels present in that run may be supplied; fingerprints must match exactly.
`request` names a file, all other labels name directories. `--bench <path>` is a
shortcut for the export's bench root; do not combine it with `--input-root bench`.
This recovers paths, not missing evidence or permission to change a cohort. Explicit
overrides do not bypass validation of a new run's declared input archive.

## Contents and machine contract

- `run/`: original native receipts, indices, plan, session and optional manifest.
- `inputs/bench`, `inputs/target`, optional `inputs/baseline-skill` and
  `inputs/request.json`: matching frozen inputs.
- `runtime/dist/`: unchanged compiled implementation. Minimal ESM package metadata
  is reconstructed from the native recorded version in `runtime/package.json`.
- `reproduce.mjs`, `README.md`, `replay-package.json`: replay and integrity index.

The descriptor uses `schemaVersion: 1`, `kind: "skillfit.replay-package"`,
`sourcePlanSha256`, `nativeStatus`, `hasManifest` and a relative-path-to-SHA-256
`files` map. It inventories every payload file except itself and Git internals.
Extra, changed, missing and unsafe paths fail verification. Checksums establish
consistency with this index, not publisher identity; retain a trusted external
copy of the descriptor or its hash for provenance.

Export JSON uses `kind: "skillfit.eval-export"`, status `planned` or `exported`,
source/destination, native plan/status, inputs, payload-file count, source-byte
count (excluding generated metadata), `modelCalls: 0` and
`sharingReviewRequired: true`. `--json` stdout is one document; errors use the
evaluation error envelope and exit 2. Export cannot be mixed with `--replay`,
`--records` or `--policy`.

Current source also returns `inputSource: "sealed-snapshot"` for archived inputs
or `"original-or-recovered"` for historical runs. Native archives remain unchanged
inside `run/`; portable layout inputs/runtime are extra copies counted by the
export preview. Per-run snapshot copy time and storage are recorded separately
in the native plan and JSON assessment's `inputSnapshot.cost`.

## Evidence and sharing boundaries

Stopped or incomplete native runs can be exported with their partial/unknown
spending and remain stopped/incomplete and ineligible. An offline replay reproduces
saved outcomes and accounting; it creates no new observations, independent holdout
or upgrade authorization. Statistical and acceptance policies are unchanged.

Trigger runs and runs with a judge are currently excluded: their separate
accounting is not covered by this paired native contract. Legacy/redacted public
archives retain their dated replay recipes and cannot be relabeled as complete
native exports.

Export only writes locally. It includes project files, prompts, outputs and paths;
review those contents before sharing. Global configuration/Skill trees are not
copied automatically, but paths and fingerprints already recorded in native plans
remain visible. Redaction changes the indexed package; keep the original evidence
and publish any reviewed redacted derivative with its own explicit recipe.
