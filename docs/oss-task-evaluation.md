# Evaluate a Skill on a real OSS task

This workflow measures a pinned task on your agent. It produces inspectable
observations and evidence gaps, not a guaranteed yes/no answer from one task.
Use a broader frozen task set before claiming general benefit for OSS work.

## 1. Preserve the request and starting state

Choose a real failure independently of the Skill you want to test. Save the
original issue request as `issue.md`, omitting the solution discussion. Record
the repository URL, pre-fix commit, relevant environment and where the request
came from. If you paraphrase it, retain both versions and explain the changes.

For a historical fix that includes regression tests:

```bash
skillfit bench init my-oss-bench --dry-run
skillfit bench init my-oss-bench --yes
skillfit bench add my-oss-bench --from-commit <fix-sha> --source-dir <local-repo> --prompt-file issue.md --dry-run
skillfit bench add my-oss-bench --from-commit <fix-sha> --source-dir <local-repo> --prompt-file issue.md --yes
```

The parent is the fixture; the fix's tests remain hidden in the verifier. The
supplied request replaces the fix commit message, which may reveal the solution.
Without it, the old commit-message behavior remains. The importer normalizes
trailing whitespace/newlines as it does for frozen tasks.

Commit mining keeps its existing 200-file / 1-MB cap; use `--include` or author
a prepared fixture for larger tasks. `--input workspace` changes presentation
during evaluation, not those importer limits. For an unresolved failure, use
`bench add --freeze` with an executable verifier and a reference repair; see
[bench authoring](bench-authoring.md). Keep enough callers and dependencies to
exercise the actual defect. Explain any mocks or extracted code in provenance.

## 2. Review the acceptance contract and offline environment

Map each of 2–8 checks to a requirement in the issue or an explicit behavior to
preserve. A merged PR can contain extra improvements: do not silently require
them when the original issue never asked for them. Hidden assertions with an
unreviewed contract can mistake a reasonable repair for a failed task.

Register an oracle command in `bench.json`. Run:

```bash
skillfit bench check my-oss-bench
```

The untouched fixture must fail and the reference must pass every check.
For coding tasks, check the resulting files and real regression tests; narration
about writing tests is not a substitute. Keep verifiers and reference repairs
outside the fixture. Preserve source licenses and pinned source hashes.

Prepare a self-contained offline runtime **before** measuring. The harness copies
files and runs commands; it does not install packages, containers or services.
Neither import path automatically vendors dependencies. A task that needs an
unavailable library or build step is not ready. Dependency setup and runtime
stubs must be identical in both arms and recorded. Any prepared binary assets
stay on disk in workspace mode; they are not converted into prompt text.

## 3. Select presentation, pin the inputs and inspect the plan

For CLI coding agents, prefer files on disk:

```bash
skillfit eval <skill-dir> --bench my-oss-bench --agent codex --input workspace --trials 5 --dry-run
skillfit bench check my-oss-bench --calibrate --agent codex --input workspace --trials 3 --dry-run
```

`workspace` skips repository snapshot creation entirely. Both arms receive the
same request and copied fixture; treatment additionally receives the Skill's
force-injected content. `snapshot` remains the default for compatibility and API
text tasks. Workspace requires a CLI executor; trigger mode already uses disk
files and rejects explicit `--input`. This is presentation, not a new security
sandbox. The agent's own permissions and inherited configuration still apply.

Review the hashes, total agent calls and initial prompt estimate. Workspace
estimates omit subsequent file reads, replies and retries. Record CLI version,
configured model/reasoning, sandbox, timeout and inherited rules/Skills/MCP.
An unknown served model should be reported as unknown. Remove treatment
contamination through a controlled profile rather than editing your daily setup.
Pin the bench, Skill and runner revision before the run; avoid rebuilding the
runner or editing task files while calls are in progress.

## 4. Calibrate, then declare a separate validation run

```bash
skillfit bench check my-oss-bench --calibrate --agent codex --input workspace --trials 3
```

Calibration uses the same disk presentation with no injected Skill and records
`inputMode` in its baseline receipts. A few calls are a pilot, not a reliable
difficulty estimate. Inspect errors before ceiling/floor warnings. Preserve all
pilot results. If you revise prompts/checks, pin a new version and do not pool
results across versions. Add independent real failures when a task saturates;
do not rewrite tasks until the Skill wins.

Freeze the task set and trial count for a separate validation. The protocol's
scale bar is 8 distinct tasks × 5 trials per condition; that is 80 calls and still
does not guarantee sufficient power. A single task can only inform that task.

## 5. Run and inspect the decision

```bash
skillfit eval <skill-dir> --bench my-oss-bench --agent codex --input workspace --trials 5
skillfit report eval <manifest-path>
```

The report shows pass counts, mean check scores, each check's denominator,
uncertainty, errors, presentation and token coverage. Its installation section
separates observed quality from missing evidence. `inconclusive` means the run
does not reliably distinguish a benefit or regression; it does not mean the
Skill is ineffective. Preserve raw manifests and each arm's receipts alongside
the pinned inputs. `report eval` is read-only and never reruns the agent.

For a Skill, force injection measures conditional quality. Separately prepare
relevant and negative-trigger tasks, then measure natural activation:

```bash
skillfit eval <skill-dir> --bench <trigger-bench> --agent codex --mode trigger --trials 5 --dry-run
skillfit eval <skill-dir> --bench <trigger-bench> --agent codex --mode trigger --trials 5
```

Trigger mode is a single arm, not a quality comparison. It currently does not
reproduce competition from your complete installed Skill set. Usage totals with
missing fields or unknown coverage cannot establish complete token overhead;
even complete usage is not a billing estimate. Maintainer acceptance, code review
and deployment outcomes remain separate from this offline task experiment.

## Reproducible starting example

[`oss-mcp-use-utf8`](../benches/contrib/oss-mcp-use-utf8/README.md) includes pinned
real source, a local runtime adaptation, an eight-check contract and an oracle.
Its earlier baseline saturated, so use it to validate the workflow and guard
regressions, not to establish Skill lift. The vendored Matt input is an evaluation
fixture and does not install anything into your agent.
