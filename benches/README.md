# skillfit benches

A **bench** is a portable, deterministic test suite for measuring whether a skill (or rules file, or MCP configuration) actually improves an AI coding agent on tasks that resemble your real work. Skills markets tell you what is popular; benches tell you what works.

`skillfit eval <skill-path> --bench <bench-dir>` pairs every task twice — once **baseline** (no skill injected) and once **treatment** (skill injected into the prompt) — for `N` trials each, then compares pass rates. `skillfit bench init` scaffolds a new bench (with a working example task) and `skillfit bench check` validates one offline — verifier self-tests, oracle/NOP gates, facet-count bounds, mock-arm probes, fixture hygiene — before you spend a single token on runs. Add `--calibrate --agent <id>` to also run real baseline-difficulty probes: one inject-mode arm per task with an empty skill payload, so `shouldTrigger` labels are **not** required and you pay for one arm, not two. Each task is banded against the L0 floor/ceiling as too hard or broken (≤10% baseline pass rate), discriminative (in between), or too easy/saturated (≥90%); aim for 30–70%. A calibration that completes no runs fails loudly instead of reporting a band it never measured.

## Bench directory layout

```
my-bench/
  bench.json                 # required: manifest
  prompts/
    <task-id>.md             # task instructions shown to the agent
  fixtures/
    <task-id>/               # synthetic repository copied into each run directory
      ...
      .skillfit-mock.json    # optional: canned outputs for offline/mock runs
  verifiers/
    <task-id>.mjs            # deterministic grader; exit code 0 = pass
  ground-truth/              # seed answers / rubrics (never copied into run directories)
    <task-id>.md
    oracle-<task-id>.mjs     # optional: applies the reference solution to a fixture copy
    solutions/<task-id>/     # optional: the reference solution as real files, for the oracle to copy
```

Only the task's `fixtures/<task-id>/` directory is copied into a run directory. Everything else — prompts, verifiers, ground truth — stays in the bench directory, so agents never see the answers.

## `bench.json` schema

```json
{
  "schemaVersion": 1,
  "name": "my-bench",
  "tasks": [
    {
      "id": "review-r1",
      "fixture": "fixtures/review-r1",
      "prompt": "prompts/review-r1.md",
      "verifier": "node verifiers/seeded-bugs.mjs",
      "oracle": "node ground-truth/oracle-r1.mjs",
      "rubric": "ground-truth/r1.md"
    }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | Must be `1`. |
| `name` | no | Display name; defaults to the directory name. |
| `tasks` | yes | Non-empty array. Task `id`s must be unique and match `^[A-Za-z0-9][A-Za-z0-9._-]*$`. |
| `tasks[].fixture` | yes | Directory (relative to the bench root) with the synthetic repository. Convention: `fixtures/<task-id>/`. |
| `tasks[].prompt` | yes | Markdown file with the task instructions. Convention: `prompts/<task-id>.md`. |
| `tasks[].verifier` | yes | Command run from the bench root; the run directory is appended as the last argument. Convention: `node verifiers/<task-id>.mjs`. |
| `tasks[].verifierKind` | no | `output` (default): the verifier grades the agent's final message at `_output.md`. `command`: the verifier runs a real command (e.g. a test suite) inside the run directory, for tasks where the agent edits files. `command` tasks need a CLI executor (`--agent <id>`), because only that works inside the run directory — an API-key-only `eval` refuses the bench at plan time rather than silently scoring both arms 0. |
| `tasks[].oracle` | no (warned when absent) | Command (same invocation convention as the verifier) that applies the reference solution to a fixture copy — writes `_output.md` for `output` tasks, edits files for `command` tasks. `bench check` fails when the oracle-solved fixture does not pass the verifier with every check green. A task that registers **no** oracle gets a WARN naming the consequence — winnability is unverified, so nothing proves the task is solvable — rather than a FAIL, because `bench add --freeze` legitimately produces oracle-less tasks mid-authoring. Convention: `node ground-truth/oracle-<task-id>.mjs`. |
| `tasks[].rubric` | no | Markdown file injected into the optional LLM judge prompt (never shown to the agent under test). |
| `tasks[].shouldTrigger` | no | Whether an in-scope skill *should* fire on this task. Required for `--mode trigger` (unlabeled tasks are skipped there). Include negative controls (`false`) — aim for ≥30% of tasks; `bench check` reports the fraction and warns below that target, because false-trigger rate is the metric a thin negative sample undermines first. |

All paths must stay inside the bench directory.

## Verifier contract

The verifier is the heart of a bench. It must be **deterministic**: same run directory in, same verdict out — no network, no clocks, no randomness.

- Invocation: `<verifier command> <absolute run directory>`, working directory = bench root.
- **Exit code 0 = pass, anything else = fail.** That is the only pass/fail signal the harness aggregates.
- Print a one-line JSON summary as the **last stdout line**. The harness parses it (tolerating surrounding noise) and saves the raw output to `_verifier.txt`:
  - `passed` (boolean) — informational; the exit code is authoritative, and a disagreement is flagged as a warning.
  - `checks` (optional) — `[{"name": "discount-boundary", "pass": true}, ...]`: the acceptance criteria decomposed into 2–8 named programmatic checks. The trial **score** is the fraction of checks passed; scores feed the per-facet table and the paired-bootstrap Δscore CI in the report, letting a bench resolve effects binary pass/fail cannot at small sample sizes. Checks never flip a verdict. Keep them deterministic and outcome-focused. `bench check` reads the count back out of your verifier and warns outside 2–8: one check is binary pass/fail in facet costume and carries none of the graded signal, while a dozen lets whatever those checks happen to measure dominate the score.
  - Anything else (`hits`, `missed`, `decoys`, …) is free-form and preserved for humans.
- The run directory contains the agent's raw final message at `_output.md`, the full prompt at `_prompt.txt`, plus any files the agent created or modified in place (CLI executors run inside the run directory).
- Two kinds: `output` verifiers (default) grade `_output.md`; `command` verifiers (`verifierKind: "command"`) run a real command — e.g. the repo's test suite — inside the run directory, for tasks where the agent edits files. A command verifier must *fail on the untouched fixture* (the task is unsolved as shipped); `bench check` verifies exactly that. When the task registers an `oracle`, `bench check` also verifies the other direction: the oracle-solved fixture must exit 0 with every check passing. Together these are the NOP/oracle gates — they catch broken verifiers and unwinnable tasks before you spend tokens.

Node is the recommended verifier runtime because it is everywhere skillfit runs: `node verifiers/<task-id>.mjs`.

## Fixture rules

- Keep fixtures small and self-contained; every file is embedded into the prompt, so size is tokens.
- Files whose name starts with `_`, any `.git` directory, and `.skillfit-mock.json` are never shown to the agent. For non-mock executors the marker file is deleted from the run directory before the agent starts, so it cannot leak into real runs.
- Seed defects deliberately and record them in `ground-truth/`. The best benches are ported from real production incidents: take a bug that actually escaped, shrink the repo around it, and assert the reviewer finds it.
- Include decoys (plausible-but-correct code) so that a treatment which simply "reports more" is penalized by your scoring logic.
- Include a `.skillfit-mock.json` marker so the bench can be exercised offline with the MockExecutor:

```json
{
  "baseline": { "output": "…what a skill-less agent typically says…" },
  "treatment": { "output": "…what the same agent says with the skill…" }
}
```

The mock picks `treatment` whenever the prompt contains a `<skill name="…">` block, otherwise `baseline`. Optional `tokens: {"input": n, "output": n}` per condition feed the token-delta report; without them the mock estimates tokens as `length / 4`.

`verifierKind: "command"` tasks cannot be mock-probed: a mock produces `_output.md` *text*, while a command verifier grades *file state*, so there is nothing for the marker to stand in for. Their offline coverage is the two gates instead — the NOP probe proves the task ships unsolved, and the oracle gate proves a correct solution passes with every check green. That is why registering an oracle matters more on a command-kind bench: without one, nothing offline shows the task is solvable, and `bench check` says so.

## What the harness records

Each run writes to `runs/<runGroup>/<task-id>/<condition>/trial-<n>/`:

- `_prompt.txt` — the exact prompt sent to the executor (task prompt + isolation rules + repository snapshot + skill payload for treatment + output contract)
- `_output.md` — the raw agent output
- `_verifier.txt` — verifier stdout/stderr
- `_result.json` — timing, pass flag, verifier exit code, facet checks + score, token usage, skill bundle hash
- `runs/<runGroup>/manifest.json` — model/executor identity, skill bundle sha256, bench content sha256, date, per-task per-condition pass rates, graded trial counts and executor-error counts, facet scores, token deltas, verdicts, and warnings

A trial whose executor errored was never graded, so it is excluded from the rates rather than counted as a failure — and excluded *pairwise*, because every statistic here is paired: an error in either arm drops that (task, trial) pair from both. Each condition reports `errors` next to `trials`, and a warning names the exclusion.

Verdicts: `effective` (treatment pass rate higher), `ineffective` (lower), `inconclusive` (equal, or fewer than 3 trials per condition — sample too small). The report warns when a task's baseline pass rate is ≥ 90% (too easy to discriminate anything) or ≤ 10% (too hard or broken), and flags any individual check the baseline already passes ≥ 90% of the time as saturated.

## Optional LLM judge

Verifiers measure pass/fail. For a second, softer dimension, set `SKILLFIT_JUDGE=1` (plus `SKILLFIT_API_KEY` or `SKILLFIT_JUDGE_API_KEY`; tune with `SKILLFIT_JUDGE_MODEL` / `SKILLFIT_JUDGE_BASE_URL`). After each trial pair, the two outputs are shown to the judge in a hash-randomized A/B order (anti position-bias) and scored 1–10; means land in the manifest under `tasks[].judge`. The judge never replaces the deterministic verifier.

## Trigger mode (`--mode trigger`)

Inject mode answers "does the skill help when it is used?". Trigger mode answers the prior question — "does the agent use it at all?" — and its flip side, "does it fire when it shouldn't?".

In trigger mode the skill is **installed** into each run directory (the agent's project skills directory from the capability matrix, e.g. `.kimi-code/skills/`), never injected into the prompt. The agent runs headless with structured (stream-json) output, and skillfit detects invocation mechanically from the transcript: a call to the agent's skill tool naming the skill under test (see `headless.streamJson` in `src/matrix/agents.json`). The raw transcript is saved as `_transcript.jsonl` for audit.

Only the skill under test is installed — the run directory's skills folder is otherwise empty. Real routing quality depends on lexical competition with everything else the user has installed, so **read trigger recall as an upper bound**. Reproducing that competition would mean copying the user's real skill set into a sandbox, which is tracked as a future enhancement rather than done here (see `docs/metrics.md` L1).

Every task needs a `shouldTrigger` label:

- `true` — in-domain tasks. Recall = fired / should-trigger runs.
- `false` — negative controls: plausible, in-scope-looking tasks that are actually out of domain. False-trigger rate = fired / negative runs.

The manifest reports recall, false-trigger rate, and precision, each with a Wilson 95% CI, plus F1 — which is deliberately bare, because a harmonic mean of two proportions has no closed-form binomial interval and printing one would be invented precision. Executor errors and undetectable transcripts are excluded from the rates and surfaced as warnings. Trigger capture is currently verified for **Kimi Code** and **Codex CLI**; agents without a `streamJson` template fail with a clear error.

## Porting your production scenario

The fastest path is freezing a failure you just watched happen:

```bash
skillfit bench add <bench-dir> --freeze --task <id> \
  --prompt "What went wrong and what the agent should have done" \
  --verifier-cmd "node --test"   # or: --expect "string the output must contain"
```

This snapshots the current directory (git-tracked files only, so `node_modules` and build output stay out) into `fixtures/<task-id>/`, generates the verifier wrapper, and registers the task. If writing the verifier by hand is the bottleneck, let an agent draft it — and get a reference solution in the bargain:

```bash
skillfit bench add <bench-dir> --freeze --task <id> \
  --prompt "What went wrong and what the agent should have done" \
  --decompose --agent <id> [--verifier-kind command]
```

`--decompose` stages the frozen fixture, has the agent write `verifier.mjs` + `oracle.mjs` (acceptance criteria as named checks), and **admits the draft only if both gates pass locally**: the verifier must fail the untouched fixture (NOP gate) and must exit 0 with full checks after the oracle solves it (oracle gate). A draft that fails either gate is rejected and nothing is written. Note the provenance rule: a bench generated *from the skill under test* is fine as a smoke test but proves nothing about efficacy — decompose from real failures, not from the skill's own content. Already have a reference-solution script? Register it with `--oracle "node ground-truth/oracle-<id>.mjs"` so `bench check` gates on it.

Or mine a fix straight out of git history:

```bash
skillfit bench add <bench-dir> --from-commit <sha> [--source-dir <repo>] [--include <dir>...]
```

The commit must change at least one test file and one non-test file: the parent commit becomes the fixture, and the fix's own tests are embedded into the verifier (hidden from the agent; they must fail on the parent state and pass once the fix is re-implemented — the SWE-bench FAIL_TO_PASS pattern). Root commits, test-only commits, and fixtures over 200 files / 1 MB are rejected with clear errors.

Constraints for both importers: the verifier must run against the copied fixture **without a build step or installed dependencies** (a TypeScript repo that needs `tsc`, or tests that need `node_modules`, will not work as mined fixtures — narrow with `--include` or hand-port a self-contained slice instead). The manual path, for shaping a task by hand:

1. Pick one recurring, expensive task shape (reviewing a PR, migrating a module, writing a migration plan).
2. Shrink a real instance into `fixtures/<task-id>/` — keep the trap, drop everything else.
3. Write the prompt a teammate would write, in `prompts/<task-id>.md`.
4. Encode the acceptance criteria you would check by hand into `verifiers/<task-id>.mjs`. Exit code is the whole contract.
5. Record the seed answer in `ground-truth/` so future bench edits stay honest.
6. Dry-run: `skillfit eval <skill> --bench my-bench --dry-run`, then a real run with `--trials 3` (or more).
