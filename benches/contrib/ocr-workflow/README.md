# OpenCodeReview workflow acceptance

Use this command bench to check whether final review took place and covered the actual delivery. The example comes from an OCR 1.14.4 evaluation where the implementation passed its tests and no OCR command was observed. After the project rules explicitly allowed local OCR delegation, a follow-up covered the final code and untracked tests. These smaller fixtures and fixed command records are teaching inputs created for this example. They contain no original session logs.

| Scenario | Functional expectation | Review expectation |
| --- | --- | --- |
| `refresh-review` | Cancel a reservation once, allow the ID again, and add a regression test | The prior receipt is stale. Observe one successful `delegate preview` followed by one successful `delegate rule`. Cover `inventory.mjs` and the untracked test with their final digests. |
| `reuse-review` | Verify the existing cancellation behavior and summarize the check | Verify the previous receipt against final file digests, the original requirements, project rules, and OCR version. Observe zero new rounds in a complete transcript. |

The protected functional verifier runs independently. The review scope is `inventory.mjs` and `.mjs` files under `tests/`. The verifier reads on-disk files, so untracked tests count. Process records live outside those paths. The seeded prior receipt is read from the bench and compared with the trial copy. Setup used to prepare the receipt is outside the model transcript.

## Generate and inspect the offline example

Run from the source checkout after building. Choose an empty output directory outside the repository.

```bash
npm run build
node dist/cli.js bench check benches/contrib/ocr-workflow
example=$(mktemp -d)
node benches/contrib/ocr-workflow/demo.mjs "$example"
```

Open `dry-run.txt` for the two-scenario plan with four task calls. Open `report.md` for a larger set of fixed controls rendered through `report eval`. Evidence links are relative to `runs/ocr-example` inside the output directory. The example runs offline and its report is labeled synthetic. The controls cover all of the following:

| Control | Report |
| --- | --- |
| Passing functions, complete transcript, no OCR | Workflow failed. Expected one round and observed zero. |
| One round with current source and untracked test digests | Workflow passed. Coverage 2/2, zero duplicates. |
| Matching prior review, no new calls | Workflow passed. Verified prior receipt, zero new rounds. |
| Missing or truncated transcript | Workflow unknown. Function result remains visible. |
| Successful OCR calls skip the untracked test | Coverage failed. Missing path and observed transcript lines are shown. |
| Same final inputs reviewed twice | Duplicate review failed. Two complete rounds and one duplicate. |

## Preview with your own tool and Skill versions

Use two complete versions of the same Skill. The Codex CLI must support command event capture, and the local OCR command must be on `PATH`. Use JSON output for both delegate commands. Supply a workspace preview that records SHA-256 digests for all files delivered for review, including untracked tests. The verifier checks the actual `ocr --version` result and the observed preview and rule returns, so a plain path list leaves coverage unknown. See the tool event shape in `verifiers/controls.mjs` and the required local setup in the fixture's `AGENTS.md`.

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --bench benches/contrib/ocr-workflow --mode installed --input workspace --agent codex --trials 1 --max-calls 4 --runs-root "$example/live-runs" --dry-run
```

The plan checks availability from local paths, shows the required OCR version and rule and receipt inputs, and states the planned model surface and call ceiling. Version output, file coverage, and functional success are checked after execution. To preview just one scenario set `--task refresh-review --max-calls 2`. `--mode trigger` observes Skill reads, with the functional check separate from review acceptance. The two task labels are both positive, so the example has no false-trigger estimate.

For a different local tool, keep the command verifier interface and replace the application assertions, command-event reader, and prior receipt matching. Use direct tool commands with distinct results. Successful preview and rule retrieval and final digest agreement establish coverage of this workflow; evaluating review findings needs a separate check. For the supported result fields and reporting behavior, see [the verifier contract](../../README.md#verifier-contract) and [the report reference](../../../docs/reference/evaluation-reports.md#workflow-acceptance).
