# Author and check a bench

Build a small, independent case from work that actually failed. This guide takes
you from a fixture to an offline-checked bench; the [Bench format](../../benches/README.md)
owns paths, manifest fields, claims and verifier semantics. Use the
[current source build](../README.md#choose-your-build) for commands below.

## Choose a starter

```bash
node dist/cli.js bench init ./my-bench --kind command --dry-run
node dist/cli.js bench init ./my-bench --kind command --yes
node dist/cli.js bench check ./my-bench --json
```

The command starter supplies a synthetic repair, protected tests and an oracle.
It accepts equivalent repairs and checks behavior independently of candidate
edits. Without `--kind`, init creates a text-output starter. Replace teaching
content with a real case before interpreting efficacy. Schema 1 stays compatible
and unrecorded; select `--schema-version 2` explicitly for a new bench with
[declared claims](../../benches/README.md#claims-and-measurement-scope).

New tasks are generated under `tasks/<id>/`: `prompt.md`, optional
`prompt.trigger.md`, `fixture/`, `verify.mjs` and `reference/`. Inspect `bench.json`
to see the actual files and commands. Keep one dataset card at the root and task
instructions in their prompt; share real grading helpers under `verifiers/`
instead of copying them for each task. The loader also accepts older relative
layouts; moving files needs no format version or new CLI option.

## Freeze a real failure

Write the task as a teammate would ask it. Freeze only the files needed to
reproduce the failure; keep the answer and acceptance program outside fixtures.
Do not derive a confirmatory case from the Skill being measured.

```bash
node dist/cli.js bench add ./my-bench --freeze --task regression --prompt "Fix the observed regression" --verifier-cmd "node --test" --dry-run
```

Review, then apply with the CLI's confirmation or `--yes`. `--expect` creates a
text-output check; `--verifier-cmd` deliberately wraps a shell command inside a
Node verifier. Ordinary manifest commands remain shell-free. Freeze uses tracked
Git files and rejects Git/index failure rather than falling back to arbitrary
files. Outside Git, provide explicit `--include` paths. Capture rejects symlinks,
submodules, unsafe paths and more than 200 files / 1 MiB. Small self-contained
fixtures need no build or dependency installation; review them for secrets.
Only fixture files reach trial workspaces, never ground truth.

To mine an existing fix, use `bench add <dir> --from-commit <sha>` with optional
`--source-dir` and repeated `--include`. The parent becomes the fixture and the
fix's tests become the hidden verifier. The commit must change test and non-test
files; root/test-only commits are refused. The importer requires an executed
semantic failure witness, rejects protected test/vendor modifications and does
not accept a test merely being present but unregistered. Narrow a large project
to a self-contained slice instead of installing its dependencies during grading.

## Write and challenge the grader

Choose `output` to grade the final `_output.md`, or `command` to grade edits on
disk with a CLI executor. Use deterministic outcomes: no network, clocks,
randomness or reliance on traversal order. Try an empty answer, a plausible wrong
answer and a repair that attempts to alter the tests. Protect acceptance code
and require decoys to remain correct.

For a functioning verifier, exit 0 passes and nonzero fails. The last stdout
line may contain `passed` and named `checks`; exit status stays authoritative.
Use 2–8 checks to expose facets without letting arbitrary check counts dominate.
Commands receive the absolute trial directory as the last argument, with bench
root as cwd. Quoted arguments are supported, without shell expansion. Use a
real executable such as `node`, including on Windows; bare `.cmd` wrappers are
not portable. `verifierTimeoutSeconds` defaults to 120 and accepts integers
1–3600, independently of executor deadlines.

Spawn/timeout/output overflow and recognized grader infrastructure errors are
ungraded. A custom runtime can emit this explicit error line:

```json
{"schemaVersion":1,"kind":"skillfit.verifier-error","message":"Required grader tool could not be started."}
```

Malformed explicit errors also fail grading infrastructure. Candidate assertions
remain ordinary task grades. An infrastructure error cannot satisfy NOP or be
counted as a model failure; a live error excludes both arms of that pair while
retaining spending. [Bench format](../../benches/README.md#verifier-contract)
and the [error schema](../schemas/verifier-error.schema.json) own the contract.

Register an oracle that applies a reference repair to a disposable fixture copy.
**NOP** must fail; **Oracle** must pass with every named check green. Missing
oracles are warnings about unverified winnability, never proof the task works.

## Label trigger tasks and controls

A trigger prompt describes files on disk rather than pasting their contents.
`shouldTrigger: true` marks relevant tasks; `false` marks plausible same-domain
negative controls. Aim for at least 30% negatives. Schema 2 activation claims
require labels and the selected set needs both positive and negative tasks.
Include decoys and make false positives cost a check required for passing.
Trigger delivery and observation vary by the selected agent's matrix capabilities;
see [workflow capabilities](experiment-workflow.md#executor-capabilities).

A `.skillfit-mock.json` can supply fixed text outputs for offline output-kind
probes; it cannot simulate edits for command graders. The marker is removed
before real execution. Fixed outputs do not prove a Skill helps a live agent.

## Test known controls

Full-pipeline controls are a separate source-only `bench self-test` protocol 1.
Declare them in `controls.json` using the
[controls schema](../schemas/bench-controls.schema.json) and
[teaching example](../../benches/_self-test/example/controls.json).
They use the ordinary paired grader/statistics/audit path, with no agent API,
agent CLI, judge or drafter. Installed layout may use matrix paths, but execution
is synthetic and always ineligible for adoption.

```bash
node dist/cli.js bench self-test benches/_self-test/example --runs-root ./runs --run-group controls-001 --json --dry-run
node dist/cli.js bench self-test benches/_self-test/example --runs-root ./runs --run-group controls-001 --json --plan-sha <plan.sha256>
```

Substitute the reviewed digest. JSON execution requires it and a fresh group;
`--yes` cannot bypass it. Preview runs no graders and creates no output. Both
commands must use identical inputs/settings. Changes need another preview.
Unknown versions/fields/actions, unsafe paths/symlinks and incompatible task
kinds refuse before outputs. Plans seal the complete bench, controls and answers.

Available actions are `output-file` (UTF-8 answer for an output task), `fixture`
(leave a command fixture unchanged), `oracle` (apply its local reference repair)
and `error` (a controlled executor stop). Declare expected status, verdict,
discordant pairs, rates and errors explicitly; they are not inferred from suite
names or copied from observations. Normal NOP/oracle gates still apply.

The teaching benefit has six improved and zero regressed pairs: effective with
p = 0.03125; harm reverses them; null has p = 1 and is inconclusive; the error
control stops after one invocation. The retained code-review mock arms have
three improved and one regressed pair, p = 0.625, inconclusive. These are fixed
pipeline examples. Expectations and stable failure codes appear in the
[self-test result schema](../schemas/bench-self-test.schema.json).
Read/export a native suite directory, not the wrapper. Replay reuses sealed
synthetic data; unknown provider usage stays unknown. The
[first evaluation](first-real-eval.md) shows the complete read/export/reproduce loop.

## Validate, then calibrate separately

```bash
node dist/cli.js bench check ./my-bench --json
```

Resolve every hard failure and explain warnings. The
[bench-check schema](../schemas/bench-check.schema.json) defines gate identifiers,
locations, remediation and bounded process evidence. Exit 0 allows warnings;
exit 1 means failed gates; exit 2 means incomplete/invalid checks. JSON checking
is offline and rejects `--calibrate`.

A separately authorized `bench check <dir> --calibrate --agent <id>` spends real
baseline calls. Preview with `--dry-run`, then bind `plan.planSha256`, not the
paired eval's `plan.sha256`. Baseline rates ≤10% or ≥90% diagnose floor/ceiling;
they do not establish validity or statistical power. No completed runs is a
failure, not a measured zero rate. See [metrics](../reference/metrics.md).

The adoption scale bar is 8 tasks × 5 trials per condition; fewer than 6 discordant pairs cannot produce a significant exact verdict. Neither threshold guarantees
power. Keep ordinary verifier probes, full controls and live calibration distinct.

## Manage and draft cases

Use `bench list/show` to inspect registrations. `bench edit <dir> <id> --set
field=value` and `bench remove <dir> <id>` preview first; `--yes` applies with
backup and validation. Removal keeps task files; the last teaching task cannot
be removed until another exists. Claims editing follows the
[format contract](../../benches/README.md#claims-and-measurement-scope).

When drafting is explicitly authorized, `bench add --freeze --decompose --agent
<id>` prepares one bounded drafting call. Review its plan/call limit first.
Generated verifier/oracle must pass NOP and oracle checks without modifying the
fixture. A rejected draft writes no registered task; retain failure costs and
identity. No retry or model upgrade is implicit. Changes during confirmation
invalidate preparation. This is authoring assistance, not independent evidence
for the Skill under test.

Before contributing, use the [contributed bench rules](../../benches/contrib/README.md):
state real origin, review frozen bytes and ground truth, run offline gates and
controls, explain remaining warnings, and distinguish any authorized live
calibration from offline checks.

Earlier source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/guides/bench-authoring.md).
