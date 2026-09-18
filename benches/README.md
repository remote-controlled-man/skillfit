# skillfit benches

A **bench** is a portable, deterministic test suite for measuring whether a skill (or rules file, or MCP configuration) actually improves an AI coding agent on tasks that resemble your real work. Skills markets tell you what is popular; benches tell you what works.

`skillfit eval <skill-path> --bench <bench-dir>` pairs every task twice — once **baseline** (no skill injected) and once **treatment** (skill injected into the prompt) — for `N` trials each, then compares pass rates.

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
| `tasks[].rubric` | no | Markdown file injected into the optional LLM judge prompt (never shown to the agent under test). |

All paths must stay inside the bench directory.

## Verifier contract

The verifier is the heart of a bench. It must be **deterministic**: same run directory in, same verdict out — no network, no clocks, no randomness.

- Invocation: `<verifier command> <absolute run directory>`, working directory = bench root.
- **Exit code 0 = pass, anything else = fail.** That is the only signal the harness aggregates.
- Print a one-line JSON summary to stdout for humans (the harness saves it to `_verifier.txt`), e.g. `{"passed":true,"hits":["a","b"],"missed":[]}`.
- The run directory contains the agent's raw final message at `_output.md`, the full prompt at `_prompt.txt`, plus any files the agent created or modified in place (CLI executors run inside the run directory).

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

## What the harness records

Each run writes to `runs/<runGroup>/<task-id>/<condition>/trial-<n>/`:

- `_prompt.txt` — the exact prompt sent to the executor (task prompt + isolation rules + repository snapshot + skill payload for treatment + output contract)
- `_output.md` — the raw agent output
- `_verifier.txt` — verifier stdout/stderr
- `_result.json` — timing, pass flag, verifier exit code, token usage, skill bundle hash
- `runs/<runGroup>/manifest.json` — model/executor identity, skill bundle sha256, bench content sha256, date, per-task per-condition pass rates, token deltas, verdicts, and warnings

Verdicts: `effective` (treatment pass rate higher), `ineffective` (lower), `inconclusive` (equal, or fewer than 3 trials per condition — sample too small). If a task's baseline pass rate is ≥ 90%, the report warns that the bench may be too easy to discriminate anything.

## Optional LLM judge

Verifiers measure pass/fail. For a second, softer dimension, set `SKILLFIT_JUDGE=1` (plus `SKILLFIT_API_KEY` or `SKILLFIT_JUDGE_API_KEY`; tune with `SKILLFIT_JUDGE_MODEL` / `SKILLFIT_JUDGE_BASE_URL`). After each trial pair, the two outputs are shown to the judge in a hash-randomized A/B order (anti position-bias) and scored 1–10; means land in the manifest under `tasks[].judge`. The judge never replaces the deterministic verifier.

## Porting your production scenario

1. Pick one recurring, expensive task shape (reviewing a PR, migrating a module, writing a migration plan).
2. Shrink a real instance into `fixtures/<task-id>/` — keep the trap, drop everything else.
3. Write the prompt a teammate would write, in `prompts/<task-id>.md`.
4. Encode the acceptance criteria you would check by hand into `verifiers/<task-id>.mjs`. Exit code is the whole contract.
5. Record the seed answer in `ground-truth/` so future bench edits stay honest.
6. Dry-run: `skillfit eval <skill> --bench my-bench --dry-run`, then a real run with `--trials 3` (or more).
