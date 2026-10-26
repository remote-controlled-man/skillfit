# Bench format

This reference owns task files, claims, verifier and fixture contracts. Follow
[bench authoring](../docs/guides/bench-authoring.md) to prepare/check cases and
[evaluation workflow](../docs/guides/experiment-workflow.md) to run or recover them.
Use the [bench catalog](contrib/README.md) to find retained cases. Built-in cases
teach the format; `_self-test` contains synthetic controls, not efficacy evidence.

## Input and output lifecycle

| Artifact | Location / consumer | Retention rule |
| --- | --- | --- |
| Bench definition | This tree or a user-owned bench; loaded through `bench.json` | Reusable tasks, grader/reference, upstream pin and license. One manifest indexes executable tasks. |
| Diagnostic controls | `_self-test/` and explicitly labelled catalog entries | Exercise harness behavior; never promote them as independent efficacy evidence. |
| Evaluation run | Explicit `--runs-root` / `--run-group`; ignored `runs/` by default | Preserve observations, sealed inputs, failures and unknown usage for current report/export/replay. |
| Shared replay | Explicit export destination | Self-contained delivery for a recipient; never copy it back into Bench inputs. |
| Release receipt | External release workflow bundle | Package-delivery proof, not task data or evidence of Skill benefit. |

Keep one short dataset card per contributed bench: purpose, task IDs, upstream
revision/license, offline command and interpretation limits. Keep task instructions
in prompt files and executable membership in `bench.json`; do not duplicate task
lists in a new registry. Study timelines, budgets, run ledgers, reports, replay
copies and release receipts do not belong here. A new dataset needs a recurring
user task or current regression consumer; a one-off study stays in its workspace.
Remove an unused dataset rather than adding an archive lifecycle. Preserve
licenses and references used by retained tasks. The
[workflow](../docs/guides/experiment-workflow.md#store-process-data-and-analysis)
owns process-data placement and whole-batch retention/cleanup rules.

The schema is independent of physical layout. `fixture`, `prompt`, `verifier`,
`oracle` and `rubric` are bench-relative paths, so a large dataset may group related
assets under task directories. The layout below is the current scaffold convention;
existing schema 1/2 benches remain valid. Only the declared fixture is copied to
the agent workspace; graders and answers must remain outside that fixture.
Do not switch to YAML or create a new schema merely to move files.

## Bench directory layout

```
my-bench/
  bench.json                 # sole executable task index
  README.md                  # short dataset card
  provenance.json            # upstream pins/adaptations when applicable
  LICENSE.upstream           # preserve required upstream notices
  tasks/
    <task-id>/
      prompt.md              # instructions shown to the agent
      prompt.trigger.md      # optional on-disk/trigger instructions
      fixture/               # only this input tree reaches a trial workspace
      verify.mjs             # optional task-specific deterministic grader
      probe.mjs              # optional private behavior probe
      reference/
        oracle.mjs           # applies the reference repair to a fixture copy
        answer.md            # optional rubric
        ...                  # original reference files, outside the fixture
  verifiers/                 # optional genuinely shared grading implementation
```

New init/freeze/from-commit/draft output follows this task-local convention.
Keep a shared grader once and reference it directly in the manifest; a task does
not need a duplicate wrapper. Existing schema 1/2 relative paths, including the
bundled code-review/debugging and fixed self-test layouts, remain supported.

The harness delivers the declared fixture, instructions and selected treatment;
it does not deliberately deliver private graders or reference answers to the
agent. This separation is not a filesystem sandbox or a guarantee against an
agent reading other files accessible on its host. Review execution isolation
separately when running untrusted agents or tasks.

## `bench.json` schema

```json
{
  "schemaVersion": 1,
  "name": "my-bench",
  "tasks": [
    {
      "id": "review-r1",
      "fixture": "tasks/review-r1/fixture",
      "prompt": "tasks/review-r1/prompt.md",
      "verifier": "node tasks/review-r1/verify.mjs",
      "oracle": "node tasks/review-r1/reference/oracle.mjs",
      "rubric": "tasks/review-r1/reference/answer.md"
    }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | `1` retains legacy behavior; current source supports explicit `2` with required task claims. See [claims and scope](#claims-and-measurement-scope). |
| `name` | no | Display name; defaults to the directory name. |
| `tasks` | yes | Non-empty array. Task `id`s must be unique and match `^[A-Za-z0-9][A-Za-z0-9._-]*$`. |
| `tasks[].claims` | schema 2 only | Nonempty, distinct `quality`, `efficiency` and/or `activation` design support; activation requires `shouldTrigger`. Schema 1 remains unrecorded. See [claims and scope](#claims-and-measurement-scope). |
| `tasks[].fixture` | yes | Directory (relative to the bench root) with the synthetic repository. Convention: `tasks/<task-id>/fixture/`. |
| `tasks[].prompt` | yes | Markdown file with the task instructions. Convention: `tasks/<task-id>/prompt.md`. |
| `tasks[].verifier` | yes | Command run from the bench root; the run directory is appended as the last argument. Spawned without a shell, so the first token must be a real executable. Convention: `node tasks/<task-id>/verify.mjs`. |
| `tasks[].verifierKind` | no | `output` (default): the verifier grades the agent's final message at `_output.md`. `command`: the verifier runs a real command (e.g. a test suite) inside the run directory, for tasks where the agent edits files. `command` tasks need a CLI executor (`--agent <id>`), because only that works inside the run directory — an API-key-only `eval` refuses the bench at plan time rather than silently scoring both arms 0. |
| `tasks[].oracle` | no (warned when absent) | Command (same invocation convention as the verifier) that applies the reference solution to a fixture copy — writes `_output.md` for `output` tasks, edits files for `command` tasks. `bench check` fails when the oracle-solved fixture does not pass the verifier with every check green. A task that registers **no** oracle gets a WARN naming the consequence — winnability is unverified, so nothing proves the task is solvable — rather than a FAIL, because `bench add --freeze` legitimately produces oracle-less tasks mid-authoring. Convention: `node tasks/<task-id>/reference/oracle.mjs`. |
| `tasks[].rubric` | no | Markdown file injected into the optional LLM judge prompt (never shown to the agent under test). |
| `tasks[].shouldTrigger` | no | Whether an in-scope skill *should* fire on this task. Required for `--mode trigger` (unlabeled tasks are skipped there). Include negative controls (`false`) — aim for ≥30% of tasks; `bench check` reports the fraction and warns below that target, because false-trigger rate is the metric a thin negative sample undermines first. |

Tasks also accept optional `tasks[].verifierTimeoutSeconds` (integer 1–3600,
default 120). It bounds each verifier/oracle process during checks, evaluation, calibration,
triggering and replay, separately from model execution. See [the command contract](../docs/guides/bench-authoring.md).

All paths must stay inside the bench directory.

## Verifier contract

The verifier is the heart of a bench. It must be **deterministic**: same run directory in, same verdict out — no network, no clocks, no randomness.

- Invocation: `<verifier command> <absolute run directory>`, working directory = bench root. The command is spawned **without a shell**, so its first token must be an executable the operating system can start directly: `node verifiers/x.mjs` works, while a bare `npm test` or a `.cmd`/`.bat` wrapper does not (`ENOENT` / `EINVAL` on Windows). The parser groups quoted arguments, so `node "verifiers/check answer.mjs"` works; malformed quoting fails before execution. No shell expansion runs. See [command and error contract](../docs/guides/bench-authoring.md). If the verdict genuinely comes from a shell command, use `bench add --freeze --verifier-cmd "<cmd>"`, which writes a generated `tasks/<task-id>/verify.mjs` that node runs and that runs your command under a shell inside. Keeping the harness's own spawn shell-free is deliberate, not an oversight — benches are contributed by third parties, and a shell here would turn `"verifier": "node v.mjs & curl …"` in somebody else's `bench.json` into code execution on your machine.
- A verifier that produces **no exit code at all** — unspawnable, or killed by the 2-minute timeout — has graded nothing, so it is never read as a verdict: `bench check` fails the task and names the cause, and `eval` excludes that trial *and its paired arm* from the rates rather than scoring a fabricated failure. Without that, a broken verifier command would look like a 0% pass rate in both arms and get reported as "bench too hard".
- **For a functioning verifier, exit code 0 = pass, anything else = fail.** The grader separately excludes recognized grader infrastructure errors, including bench-owned Node uncaught exceptions and explicit `skillfit.verifier-error` JSON messages. They cannot satisfy NOP gates or score a model failure merely by exiting nonzero. Candidate failures/assertions retain normal grading; agent spending stays recorded. See [the contract and custom-runtime error channel](../docs/guides/bench-authoring.md).
- Print a one-line JSON summary as the **last stdout line**. The harness parses it (tolerating surrounding noise) and saves the raw output to `_verifier.txt`:
  - `passed` (boolean) — informational; the exit code is authoritative, and a disagreement is flagged as a warning.
  - `checks` (optional) — `[{"name": "discount-boundary", "pass": true}, ...]`: the acceptance criteria decomposed into 2–8 named programmatic checks. The trial **score** is the fraction of checks passed; scores feed the per-facet table and the paired-bootstrap Δscore CI in the report, letting a bench resolve effects binary pass/fail cannot at small sample sizes. Checks never flip a verdict. Keep them deterministic and outcome-focused. `bench check` reads the count back out of your verifier and warns outside 2–8: one check is binary pass/fail in facet costume and carries none of the graded signal, while a dozen lets whatever those checks happen to measure dominate the score.
  - Anything else (`hits`, `missed`, `decoys`, …) is free-form and preserved for humans.
- The run directory contains the agent's raw final message at `_output.md`, the full prompt at `_prompt.txt`, plus any files the agent created or modified in place (CLI executors run inside the run directory).
- Two kinds: `output` verifiers (default) grade `_output.md`; `command` verifiers (`verifierKind: "command"`) run a real command — e.g. the repo's test suite — inside the run directory, for tasks where the agent edits files. A command verifier must *fail on the untouched fixture* (the task is unsolved as shipped); `bench check` verifies exactly that. When the task registers an `oracle`, `bench check` also verifies the other direction: the oracle-solved fixture must exit 0 with every check passing. Together these are the NOP/oracle gates — they catch broken verifiers and unwinnable tasks before you spend tokens.

Node is the recommended verifier runtime because it is everywhere skillfit runs: `node tasks/<task-id>/verify.mjs`.

## Fixture rules

- Keep fixtures self-contained. Snapshot input embeds eligible files into the prompt, so size consumes tokens; workspace input presents files on disk to a CLI executor. Keep the context needed to reproduce the task instead of trimming a historical source to improve token counts.
- Files whose name starts with `_`, any `.git` directory, and `.skillfit-mock.json` are never shown to the agent. For non-mock executors the marker file is deleted from the run directory before the agent starts, so it cannot leak into real runs.
- Seed defects deliberately and record them in the task's `reference/`. The best benches are ported from real production incidents: take a bug that actually escaped, shrink the repo around it, and assert the reviewer finds it.
- Include decoys (plausible-but-correct code) so that a treatment which simply "reports more" is penalized by your scoring logic.
- Output-kind tasks may include a `.skillfit-mock.json` marker for fixed offline MockExecutor outputs:

```json
{
  "baseline": { "output": "…what a skill-less agent typically says…" },
  "treatment": { "output": "…what the same agent says with the skill…" }
}
```

The mock picks `treatment` whenever the prompt contains a `<skill name="…">` block, otherwise `baseline`. Optional `tokens: {"input": n, "output": n}` per condition feed the token-delta report; without them the mock estimates tokens as `length / 4`.

`verifierKind: "command"` tasks cannot be mock-probed: a mock produces `_output.md` *text*, while a command verifier grades *file state*, so there is nothing for the marker to stand in for. Their offline coverage is the two gates instead — the NOP probe proves the task ships unsolved, and the oracle gate proves a correct solution passes with every check green. That is why registering an oracle matters more on a command-kind bench: without one, nothing offline shows the task is solvable, and `bench check` says so.

## Claims and measurement scope

Schema 2 and frozen scope 1 apply to the current source build; see the
[build/version entry](../docs/README.md#choose-your-build).

### Declaring support

Bench schema 1 keeps its existing loading, selection and execution behavior.
Its tasks have no recorded claims, even if an old file contains an ignored field
with that name. New readers show `legacy-unrecorded`; missing historical metadata
does not create a new adoption requirement or acquire today's declarations.

Schema 2 is explicit opt-in. Every task must declare a nonempty, duplicate-free
`claims` array containing `quality`, `efficiency` or `activation`. `process` is
unsupported. An activation task must also have a boolean `shouldTrigger` label;
both positive and negative controls must declare activation support.

Claims describe the design support of the task. They do not prove that the bench
is valid, discriminative or sufficiently powered, or that any Skill is eligible
for adoption. Quality means the outcomes defined by these fixture/prompt/verifier
and named checks, not general security, performance, design or workflow quality.
Keep the existing NOP/oracle, offline control, independent validation, sample,
cost and regression gates in [metrics](../docs/reference/metrics.md) and [policy](../docs/reference/eval-component.md).

The [bench schema](../docs/schemas/bench.schema.json) documents the file shape. The
loader additionally validates referenced paths/commands, distinct task IDs and
existing file safety rules. No existing bundled or historical bench is upgraded.

### Target selection and refusal

| Entry | Requested claim |
| --- | --- |
| Ordinary paired eval or policy 1 request | `quality` |
| Explicit policy 2 request | `efficiency` |
| Trigger | `activation` |
| Calibration or fixed synthetic self-test | `null` (diagnostic only) |

No `objective` field is added to request schema 1. Policy 2 remains the existing
explicit efficiency policy. Task selection retains bench order, then checks the
intersection of support across every selected task. The harness never removes
an incompatible task automatically. Preview can show `unsupported`; execution
refuses with `BENCH_CLAIM_UNSUPPORTED` before verifier, oracle or executor calls.
Schema 1 keeps its existing unlabeled-trigger skip behavior.

### Frozen scope and evidence

New previews, native plan details and summaries contain an optional
`measurementScope` object validated by [schema 1](../docs/schemas/measurement-scope.schema.json):

- `schemaVersion`: `1`; unsupported present versions are errors.
- `benchSchemaVersion`: `1` or `2`.
- `taskClaims`: nonempty ordered `{ taskId, claims }` rows. IDs are distinct;
  schema 1 uses `claims: null`, schema 2 uses the explicit array.
- `requestedClaim`: the table's claim or null.
- `assessment`: `supported`, `unsupported`, `legacy-unrecorded`, or
  `not-applicable` for null targets.

New readers reject malformed or contradictory metadata. Native audits compare
the summary with the native/reviewed plan, selected order and original sealed
bench. Replay uses those frozen inputs and the portable package's pinned runtime;
it does not read a changed external bench to supplement claims. Removing or
changing a new summary's scope while its native plan retains it fails audit.
Old records that lack scope stay unrecorded. A report policy override cannot
rewrite the frozen requested claim; unsupported schema 2 claims block adoption.
Observed quality numbers during an efficiency study remain observations within
the declared scope. They do not authorize an undeclared quality conclusion.

### Authoring and compatibility

`bench init` still defaults to schema 1. Select `--schema-version 2` explicitly;
the teaching task then declares only quality. For a schema 2 destination,
`bench add --freeze` and `--from-commit` require repeated `--claim` values.
Claims are checked before import or drafting. Activation also requires the
existing `--should-trigger yes|no` label. Passing claims to a schema 1 destination
refuses instead of silently upgrading it.

`bench edit --set 'claims=["quality","efficiency"]'` accepts a JSON array only
for schema 2. Required claims cannot be unset; edits remain previewed until
`--yes`, backed up, validated and rolled back on failure. `bench list/show`
display declarations and the legacy state. The normal fixture/import collision,
Git parent/submodule, file count/size and dry-run protections are unchanged.

For a fresh teaching bench, these current-source commands are local and make
no model calls. Replace the teaching inputs before evaluating benefit:

```bash
node dist/cli.js bench init scoped-bench --kind command --schema-version 2 --dry-run
node dist/cli.js bench init scoped-bench --kind command --schema-version 2 --yes
node dist/cli.js bench list scoped-bench --json
```

For known synthetic answers, use a bench with predeclared
[self-test controls](../docs/guides/bench-authoring.md#test-known-controls), not an inferred expectation from claims.

### Reading difficulty diagnostics

Pass counts and thresholds remain unchanged: ceiling is >=90%, floor <=10%,
and the interval between them describes observed baseline difficulty. Reports
separate `baselineBand`, `qualityHeadroom`, `efficiencyEligibility` and
`activationCoverage`. A ceiling limits observed quality headroom; it does not
discard a task from efficiency measurement. Baseline calibration alone cannot
establish quality equivalence or cost eligibility: compare paired costs,
variance, final counter coverage and named-check regressions separately.

Efficiency cost statistics can pass on a saturated synthetic example while the
existing synthetic gate still forbids adoption. Missing costs or a named-check
regression continue to block it. Activation requires representative positive
and negative labels plus actual detection coverage. These diagnostics are not
MDE estimates, power guarantees or trajectory-level scoring.

Earlier source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/benches/README.md).

Publication-era Bench documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/benches/README.md).
