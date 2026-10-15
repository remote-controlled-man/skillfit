# Select and manage cases

Available in skillfit 0.10.0. A case is a task entry in `bench.json`, with references
to its fixture, prompts, verifier and optional oracle. These commands manage that
registration; use your editor to change the referenced file contents.

## Inspect and select

```bash
skillfit bench list ./my-bench --json
skillfit bench show ./my-bench fix-cache --json
skillfit eval ./my-skill --bench ./my-bench --agent codex --task fix-cache --task fix-order --trials 1 --max-calls 4 --dry-run
```

List/show read the validated manifest without running verifiers or an agent. Their
version-1 JSON envelopes have `kind: "skillfit.bench-list"` or
`"skillfit.bench-task"`, bench identity/hash and `tasks`. Unspecified verifier kind
is reported as `output`; unlabeled `shouldTrigger` is null.

Repeat `--task` for positional eval, or set `"taskIds": ["fix-cache", "fix-order"]`
inside a JSON request. Omit the selection to evaluate every task. Explicit empty,
duplicate, unsafe or unknown IDs fail before calls or output-directory creation.
The manifest's task order is retained, regardless of flag order. Trigger mode still
requires the existing trigger labels and controls on the chosen tasks.

The preview counts only selected tasks, including enabled judge calls. The native
plan freezes selected IDs and order while retaining the complete bench content
hash. Reports contain exactly that selected population; replay checks it against
the plan. A subset remains a subset: small samples stay indicative, and the
eight-task/five-pair adoption floor is unchanged. Choosing favorable tasks after
seeing outcomes does not create independent validation.

## Edit or unregister

```bash
skillfit bench edit ./my-bench fix-cache --set prompt=prompts/cache-v2.md --set shouldTrigger=true --json
skillfit bench edit ./my-bench fix-cache --set prompt=prompts/cache-v2.md --set shouldTrigger=true --yes --json
skillfit bench edit ./my-bench fix-cache --unset shouldTrigger --yes --json
skillfit bench remove ./my-bench fix-cache --json
skillfit bench remove ./my-bench fix-cache --yes --json
skillfit bench check ./my-bench --json
```

Edits/removals default to a read-only before/after plan. `--yes` applies it;
`--dry-run` takes precedence. The first original manifest is retained in
`bench.json.skillfit-bak`. A pre-existing backup is preserved; symlink backups
are rejected. Manifest writes validate the result and roll back on failure.

Repeat `--set field=value` to edit `fixture`, `prompt`, `promptTrigger`, `verifier`,
`verifierKind`, `oracle`, `rubric` or `shouldTrigger`. Values may contain `=`;
`shouldTrigger` accepts only literal `true` or `false`. Repeat `--unset field` for
`promptTrigger`, `oracle`, `rubric` or `shouldTrigger`. Required fields, task IDs,
unknown fields and duplicate field operations are rejected. Referenced paths and
task structure are validated before writing; run `bench check` afterwards to test
the verifier and oracle behavior. No agent is called by these operations.

Remove unregisters the task and **keeps all files**, including shared fixtures,
prompts and verifiers. Schema 1 requires a nonempty bench: add a real case before
removing the final starter. Unknown manifest/provenance fields are preserved.

JSON changes return `schemaVersion: 1`, `kind: "skillfit.bench-change"`, status
`planned`, `applied` or `unchanged`, action, task ID, before/after entries, backup
path, previous/current hashes and `filesPreserved: true`. Invalid list/show/edit/
remove operations return `kind: "skillfit.bench-error"` and exit 2; successful
inspection or planning exits 0. stdout is one JSON document when `--json` is set.
