# Read an evaluation report

Version 0.10.1 uses the same saved-evidence assessment for Markdown and JSON.
Both formats accept a manifest file, native run directory or portable replay
package directory. Neither starts an agent or changes the saved run.

```bash
skillfit report eval ./runs/my-run
skillfit report eval ./runs/my-run --json
skillfit report eval ./runs/my-run/manifest.json
skillfit report eval ./exports/my-run --replay
```

`--json` changes the format, not which evidence is checked. `--replay`,
`--records <run-dir>` and `--policy <policy.json>` work with either format.
Replay grades disposable delivery copies using trusted local verifiers; it
does not call a model. An overridden policy is post-hoc and cannot authorize
adoption unless it matches the policy frozen before execution. Portable packages
already pin their run/bench and reject external records/bench overrides.

## Completed, stopped and incomplete inputs

- A completed manifest retains the existing quality/facet/cost tables. Markdown
  also shows the native audit status, separate acceptance decision, upgrade
  eligibility and reasons. A statistical quality verdict is not an adoption
  decision. `automaticUpgrade` remains false.
- A native directory without a final manifest shows `stopped` when a saved
  session exists, otherwise `incomplete`. It displays the stop reason when
  available, retained costs, missing/invalid receipt counts and unknown coverage.
  It does not fabricate a paired quality verdict or overwrite the run.
- A standalone historical manifest stays readable. Missing native evidence
  remains `unverified`; rendering it cannot authenticate the source or qualify
  it for adoption. Available current preflight and input-snapshot metadata are
  displayed separately; their presence alone does not validate a stopped run.
- Corrupt native evidence is reported as unverified with audit/acceptance
  reasons. A changed portable package fails its inventory/hash verification
  before rendering. An empty directory, missing path or malformed/unsupported
  manifest is an input error.

Successful rendering keeps exit 0 even if acceptance is `reject` or
`inconclusive`; callers must inspect `acceptance` and `evidence` rather than
interpret the exit code as approval to upgrade. Invalid inputs fail nonzero.
JSON keeps its version 1 contract. Human reports abbreviate the local run root
as `[run]` in diagnostic text; JSON retains precise paths for investigation.

Saved costs stay in their original final/partial/unknown populations. Reports do
not replace missing cache counts with zero or estimate unrecorded billing.
See [cost accounting](eval-costs.md), [input snapshots](evaluation-input-snapshots.md)
and [portable packages](replay-packages.md). Review project data before sharing.
