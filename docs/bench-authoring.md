# Writing your own bench

This is the guide the rest of the documentation assumes you have read. It walks the seven steps of
turning something that went wrong into a task you can measure, end to end on one real task from the
bundled `code-review` bench.

If you only want the shape of a bench directory, that is [benches/README.md](../benches/README.md).
If you want to know what the numbers mean once you have them, that is
[docs/metrics.md](metrics.md). This document is the part in between: **how to build a bench whose
numbers you can trust.**

---

## What a bench is

A bench is a folder of small tasks your agent has already failed at, plus a program that decides —
with no human reading and no second LLM judging — whether this attempt succeeded.

Run the same tasks twice, once with the skill you are considering and once without, in adjacent
order, and the difference is evidence instead of a vibe. That is the whole idea. Everything below
exists to stop the difference from meaning something it does not.

**A bench is not a test suite for your agent.** A test suite asks "does it work". A bench asks "does
*adding this thing* change the outcome", which is a comparison, and a comparison needs both arms to
be able to win.

## Why yours and not ours

The two benches under `benches/` are **teaching material**, not a product. They show what a
well-formed task looks like and they let CI prove the harness still works. They cannot tell you
whether `code-review` helps *you*, because they were not built from *your* failures.

A bench you build from your own incidents is worth more than a bigger bench you copied. Five tasks
from your last month of real failures will predict your results; fifty invented ones will not.

---

## The four properties that make the numbers mean anything

Every step below serves one of these. When you are tempted to skip a step, this is what you are
skipping.

| Property | What it means | What breaks without it |
|---|---|---|
| **Real origin** | The task came from something that actually went wrong | You measure performance on a task nobody does, and the result does not transfer |
| **Deterministic grader** | Same run directory in, same verdict out — no network, no clock, no randomness | Two runs of the same agent disagree, so any delta is noise |
| **Winnable** | A known-correct solution passes the grader with every check green | A 0% pass rate reads as "the skill did not help" when it means "the task is impossible" |
| **Discriminative** | The baseline neither always fails nor always passes, and some tasks should *not* trigger the skill | A saturated task cannot show improvement; a bench with no negative controls cannot show over-triggering |

---

## The seven steps

Walked on `benches/code-review`'s `review-r1`: a small pricing library, a pull request under review,
three defects seeded into the diff, and two pieces of correct-but-unusual code planted as traps.

### 1. Start from a real failure

**Do this.** Pick something that actually happened: a bug that escaped to production, a task your
agent botched twice in the same way, an incident thread. Write down what the agent did and what it
should have done. That sentence becomes your prompt and your ground truth.

`review-r1` models the shape "review this small PR against the spec", where the interesting failure is
not missing the obvious error-handling violation but missing the off-by-one boundary condition one
line below it. The bundled benches are **constructed** teaching material — their defects are seeded
deliberately — so read this one as the *form* a real incident takes once you freeze it, and put your
own incident in its place.

**Why it is not optional.** A hypothetical task measures how the agent performs on a task nobody
does. The result is real, precise, and useless: it does not predict your next Tuesday.

**What the tool checks.** Nothing — provenance is not machine-checkable. `benches/contrib/README.md`
rule 1 asks for it because a reviewer cannot recover it after the fact.

> **The provenance trap.** Do not build a bench *out of the skill you are testing*. A bench generated
> from the skill's own advice will be passed by the skill trivially and proves nothing about
> efficacy. It is fine as a smoke test that the harness works. Label it as such.

### 2. Freeze the scene, then shrink it

**Do this.** Scaffold the bench once, then freeze from the directory where the failure happened:

```bash
skillfit bench init my-bench
cd /path/to/where/it/broke
skillfit bench add ../my-bench --freeze --task review-r1 \
  --prompt "Review CHANGES.diff against SPEC.md. Report only concrete defects: severity, exact file:line, one sentence on which clause of the spec it violates." \
  --should-trigger yes
```

This snapshots the **git-tracked** files of the current directory into `fixtures/review-r1/`, so
`node_modules`, build output and secrets stay out, writes the prompt to `prompts/review-r1.md` plus a
`prompts/review-r1.trigger.md` stub you will fix in step 5, and registers the task in `bench.json`.
For a multi-paragraph prompt use `--prompt-file <path>` instead; the path is read relative to the
current directory, and the *content* is copied into the bench.

Then shrink the fixture by hand. Keep the trap, delete the rest. `review-r1`'s is six small files —
`SPEC.md`, `CHANGES.diff`, three source files and one test — totalling 4 KB.

**Why it is not optional.** In inject mode the whole fixture is **inlined into the prompt** for every
trial of both arms. Fixture size is token cost, and a large fixture buries the trap in context the
agent will skim. `bench check` warns above 64 KB.

**What the tool checks.** Fixture size (WARN above 64 KB), and that `bench.json` paths stay inside
the bench directory.

> Only `fixtures/<task-id>/` is copied into a run directory. Prompts, verifiers and ground truth stay
> in the bench, so the agent never sees the answers. If you put the answer inside the fixture, you
> have leaked it.

### 3. Write the grader

**Do this.** The grader is a program that takes the run directory as its last argument and exits 0
for pass, non-zero for fail. Three ways to get one, cheapest first:

```bash
# (a) the agent's final message must contain a string
--expect "INVALID_QUANTITY"

# (b) a command runs inside the run directory and its exit code is the verdict
--verifier-cmd "node --test"

# (c) an agent drafts verifier.mjs + oracle.mjs from the frozen fixture
--decompose --agent <id>
```

For anything you care about, write `verifiers/<task-id>.mjs` by hand. `review-r1`'s is
`verifiers/seeded-bugs.mjs`, and it does two things:

```js
const bugs = [
  { id: 'bare-error',        anchor: /order\.js/, evidence: [/\b25\b/, /INVALID_QUANTITY/, /AppError/, …] },
  { id: 'discount-boundary', anchor: /order\.js/, evidence: [/\b30\b/, />=\s*10/, /off-by-one/i, …] },
  { id: 'missing-tests',     anchor: /applyBulkDiscount/, evidence: [/\b(?:no|missing|without)\b…\b(?:tests?|coverage)\b/i, …] },
];
const decoys = [
  { id: 'c-style-loop', anchor: /order\.js/, evidence: [/\b2[23]\b/] },
  { id: 'percentoff',   anchor: /money\.js/, evidence: [/percentOff/] },
];
```

Each entry becomes a **named check** in the JSON summary the verifier prints as its last stdout line:

```json
{"passed":false,"hits":["bare-error"],"missed":["discount-boundary","missing-tests"],"decoys":["c-style-loop"],"checks":[{"name":"bare-error","pass":true},{"name":"discount-boundary","pass":false},{"name":"missing-tests","pass":false},{"name":"no-false-positives","pass":false}]}
```

**Why it is not optional.** The exit code is the only pass/fail authority the harness aggregates. If
your grader is wrong, every number downstream is wrong, and nothing else in the pipeline can tell.

Two rules that are easy to get wrong:

- **Aim for 2–8 checks.** One check is binary pass/fail wearing a costume — it gives you none of the
  graded signal checks exist to provide. A dozen lets whatever those checks happen to measure
  dominate the score, and the per-facet table in the report stops being readable.
- **Grade the outcome, not the path.** "The agent mentioned it should write a test" is an outcome.
  "The agent's notes contain the word `debug`" is a path, and it rewards agents that narrate rather
  than agents that fix.

**What the tool checks.** For an `output`-kind task, that the verifier rejects a missing `_output.md`
and rejects an empty one — both FAIL, and together they are the NOP gate for tasks that grade text.
Also that the check count is in range (WARN), and that the exit code and the JSON `passed` flag agree
(WARN). It gets a 2-minute timeout, and a verifier that produces no exit code at all is reported as a
bench defect, never as the agent failing.

> **The command in `bench.json` is spawned without a shell.** Its first token must be an executable the
> operating system can start directly, so `node verifiers/x.mjs` works and a bare `npm test` or a
> `.cmd`/`.bat` wrapper does not (`ENOENT` / `EINVAL` on Windows). If the verdict really does come from
> a shell command, go through `--verifier-cmd`: that writes a generated `verifiers/<task-id>.mjs` which
> node runs, and *it* runs your command under a shell inside. Keep that string out of third-party
> benches you did not read — see `SECURITY.md`.

### 4. Or mine it from git history

**Do this.** If the failure was already fixed in a commit, you do not have to write anything:

```bash
skillfit bench add my-bench --from-commit <sha> [--source-dir <repo>] [--include <dir>...]
```

The parent commit becomes the fixture. The fix commit's own test files are embedded into the
verifier, hidden from the agent: they must fail on the parent state and pass once the fix is
re-implemented. This is the FAIL_TO_PASS pattern from SWE-bench, and it is the cheapest source of
winnable, discriminative tasks there is — the tests are real, they were written before the fix, and
somebody already proved the task is solvable.

The commit must change **at least one test file and at least one non-test file**. A test-only commit
has no fix for the agent to write; a fix with no tests has no hidden grader.

**Why it is not optional.** It is optional — this is an *alternative* to steps 2 and 3, not an addition
to them. It earns a step of its own because, for a repository with a decent history, it produces better
tasks in one command than you will write by hand in an afternoon, and because the tasks it produces come
with the two properties that are hardest to get by hand: a real grader and a proof of winnability.

**What the tool checks.** Root commits, test-only commits, and fixtures over 200 files / 1 MB are
rejected with a named reason. Use `--include` to narrow a large repo.

> **The hard constraint, for both importers:** the verifier must run against the copied fixture with
> **no build step and no installed dependencies**. A TypeScript repo that needs `tsc`, or tests that
> need `node_modules`, will not work as a mined fixture. Narrow with `--include`, or hand-port a
> self-contained slice.

### 5. Write the trigger variant

**Do this.** `bench add` already wrote `prompts/<task-id>.trigger.md` and registered it as
`"promptTrigger"` in `bench.json` — but all it did was append one generic line, *"The repository is in
your current working directory."*, to a copy of the inject prompt. **Edit it.** The inject prompt almost
certainly still says the work is pasted below, and that is exactly the thing that breaks trigger mode.

For `review-r1` the whole edit is one sentence:

```
- The repository snapshot below is the pre-PR state.
+ The repository in your current working directory is the pre-PR state.
```

**Why it is not optional.** Trigger mode measures whether an *installed* skill gets picked up on its
own — a different question from whether the skill helps when you paste it into the prompt. If you
inline a repository snapshot in trigger mode, the prompt no longer looks like the work that would have
routed to the skill, and recall collapses. This was measured, not theorised: **0/9 trigger recall with
an inline snapshot**, where the same tasks read from disk did fire the skill. See
`evidence/2026-09-trigger-snapshot-correction.md`.

**What the tool checks.** That `promptTrigger` names a file that exists. It cannot tell you the
phrasing is natural, and it cannot tell you that you left "the snapshot below" in there — read it
aloud and ask whether a teammate would write it that way.

### 6. Label it, load it, and plant decoys

**Do this.** Five things, all in service of the fourth property above.

**(a) Label.** Set `"shouldTrigger": true` or `false` in `bench.json` — `--should-trigger yes|no` at
freeze time writes it for you. Unlabelled tasks are skipped by trigger mode entirely.

**(b) Make at least 30% of your labelled tasks negative controls** — tasks where the skill should
*not* fire. `code-review` has two of five: `explain-x1` (explain this code) and `summarize-s1`
(write the changelog entry for this PR).

A good negative control is **behavioural**, not just a label. `summarize-s1` is built on the same
pricing library as the review tasks — same domain, same files, opposite ask — and its verifier has a
`not-a-review` check that fails the moment the output starts citing spec sections or reporting
defects. A task labelled `shouldTrigger: false` whose verifier would happily accept a review is not a
control; it is a coin flip with a label on it.

**(c) Plant decoys.** Correct-but-unusual code that a verbose reviewer would flag: a C-style `for`
loop in a file that otherwise uses `for...of`; a helper that looks like it should round but correctly
delegates. Then make the grader **penalise** them — `review-r1`'s `no-false-positives` check fails on
any decoy hit, and exit 0 requires it.

**(d) Add a mock marker** so the bench runs offline, in CI, without an API key —
`fixtures/review-r1/.skillfit-mock.json`, one canned answer per arm:

```json
{
  "baseline":  { "output": "…a review that catches one bug and flags the style decoy…",
                 "tokens": { "input": 1800, "output": 120 } },
  "treatment": { "output": "…a review that catches all three and flags nothing else…",
                 "tokens": { "input": 2600, "output": 200 } }
}
```

**(e) Write the ground truth.** `ground-truth/<task-id>.md` records what a correct outcome looks
like and why the grader is right. This is what stops a future edit from quietly moving the goalposts,
and it is what you write the oracle from.

**Why it is not optional.** Without decoys that cost something, **verbosity wins**: an agent that
reports twelve findings, nine of them noise, beats one that reports three correct findings. Without
negative controls, a skill that fires on *everything* scores a perfect recall and looks excellent.
Both failure modes produce confident, publishable, wrong numbers.

**What the tool checks.** The negative-control fraction (WARN at zero, WARN below 30%, PASS at or
above); that the mock marker parses; and for output-kind tasks it runs both mock arms through the
verifier and prints which way each went, so a marker whose baseline arm accidentally *passes* is
visible offline.

### 7. Rehearse before you pay

**Do this.** Four commands, in this order, each cheaper than the next:

```bash
skillfit bench check my-bench                                  # offline, free
skillfit bench check my-bench --calibrate --agent <id>         # real runs, one arm per task
skillfit eval <skill-path> --bench my-bench --dry-run          # plan only, writes nothing
skillfit eval <skill-path> --bench my-bench --agent <id> --trials 3
```

`bench check` answers "is this bench well-formed". `--calibrate` answers "is it the right
difficulty": each task is banded as **too hard or broken** (baseline pass rate ≤ 10%),
**discriminative** (in between), or **too easy / saturated** (≥ 90%). Aim for 30–70%. A saturated
task cannot show improvement no matter how good the skill is; an impossible one cannot show anything
either, and both arms score zero.

**Why it is not optional.** Difficulty is the one property you cannot get by reading your own bench.
A task that looks hard to you may be trivial to a current model, and the only way to find out costs
tokens — so spend the smallest amount that answers the question, before spending the real amount.

**What the tool checks.** A calibration that completes zero runs **fails** rather than reporting a
band it never measured. Errored runs are excluded from the rate rather than counted as failures.

---

## The two gates

`bench check` runs your task in both directions before you spend anything on it.

| Gate | Runs | Proves | FAILs when |
|---|---|---|---|
| **NOP** ("no operation") | the grader against work nobody did — the untouched fixture for a `command` task, a missing and then an empty `_output.md` for an `output` task | the task ships unsolved, and the grader can tell success from silence | the grader exits 0 on a fixture nobody edited, or accepts a missing/empty answer |
| **Oracle** | your reference solution, then the grader | the task is winnable, and the checks agree with the exit code | the oracle does not exit 0 with every check green |

The oracle is a program that applies the known-correct solution to a fresh copy of the fixture —
writes `_output.md` for an output task, edits files for a command task. Convention:
`node ground-truth/oracle-<task-id>.mjs`, registered as `"oracle"` in `bench.json`. Get one for free
from `--decompose`, or register a script you already have with `--oracle`.

**Neither gate proves the task is not gameable.** They prove it starts unsolved and that one known
solution passes. They do not prove that *only* correct solutions pass. `debugging/feat-slug` is the
worked example: its grader used to run the fixture's own visible test suite in place, so replacing
the shipped assertions with `assert.equal(1, 1)` was a complete solution — it passed both gates. The
fix was a check that compares the visible suite against the canonical fixture before running it.

**So: try to cheat your own bench.** Write the laziest output that a reasonable reading of the prompt
would produce, run the grader on it, and see whether it passes. If it does, add a check. This is the
single highest-value ten minutes in the whole process and no tool can do it for you.

---

## How a bench lies to you

The failure modes worth knowing before you hit them, with the symptom you will actually see.

| Symptom | Usual cause | Fix |
|---|---|---|
| 0% in both arms | The grader cannot run — a shell command written straight into `bench.json` instead of going through `--verifier-cmd`, a missing dependency, a build step | Read `_verifier.txt` in the run directory; `bench check` names the spawn error before you spend anything |
| 0% in both arms | The task is genuinely impossible, or the prompt leaks nothing about what is wanted | Register an oracle. If you cannot write one, the task is not well-defined yet |
| 100% in both arms | Saturated: a current model solves it without help | `--calibrate` will tell you. Retire the task or make it harder |
| Treatment wins every task, including the ones it should not touch | No negative controls, so over-triggering is invisible | Add ≥30% `shouldTrigger: false` tasks with a behavioural check |
| Verbose arms win | Decoys are counted but not penalised | Make a false positive fail a check that exit 0 requires |
| The agent edits the test suite and passes | The grader runs agent-writable files in place | Compare them against the canonical fixture first (see `feat-slug`) |
| Two identical runs disagree | A clock, a network call, `Math.random`, or map-iteration order in the grader | Remove it. "Deterministic" is literal |
| A great result at 3 trials × 5 tasks | Underpowered, not wrong | The report prints the CI half-width as `Run resolution: this bench resolves effects ≳ ±X.Xpp` — read it before believing the delta. `effective` needs at least 6 discordant pairs *and* McNemar exact p < 0.05 in the right direction; below 8 tasks × 5 trials the report labels the whole run indicative |
| Trigger recall is a perfect 1.00 | Recall in trigger mode is an **upper bound**: only your skill is installed, so nothing competes for the route | Treat it as "did not fail to fire", not as "fires better than the alternative". Marked `(Status: spec)` in `docs/metrics.md` |

---

## Where this comes from

The paradigm is not invented here. It is assembled from published practice, and
[docs/metrics.md](metrics.md) carries the citations for each layer:

- **FAIL_TO_PASS mining** (step 4) — SWE-bench: a real fix commit's own tests, run against the parent
  state, are a grader nobody had to write and everybody can trust.
- **Paired A/B with a non-parametric test** (step 7) — the unit of analysis is the (task, trial)
  *pair*, not the run, so McNemar's exact test and a paired bootstrap apply at the 3–5 trial scale a
  single person can afford.
- **Facet scores alongside binary pass/fail** (step 3) — a 2–8 check decomposition resolves graded
  movement that a binary hides, which matters most when n is small.
- **Negative controls and decoys** (step 6) — standard practice in measurement and information
  retrieval: a classifier that fires on everything has perfect recall and no value, and a reviewer
  that reports everything has perfect coverage and no precision.
- **Deterministic graders, LLM judges advisory only** (steps 3, 7) — the judge is optional, blind,
  position-swapped, and never flips a verdict.

---

## Checklist

Copy this into the PR description when you submit a bench to `benches/contrib/`.

```
[ ] 1. Real origin — I can name the incident, bug, or repeated failure this came from
[ ] 2. Fixture is git-tracked files only, under ~64 KB, and contains no answer and no secret
[ ] 3. Grader is deterministic: no network, no clock, no randomness, no map-order dependence
[ ] 3. Grader emits 2–8 named checks and grades outcomes, not process
[ ] 3. I tried to cheat my own bench and it refused
[ ] 4. (If mined) fixture runs with no build step and no installed dependencies
[ ] 5. prompts/<id>.trigger.md presents the work as files on disk, not as a pasted snapshot
[ ] 6. shouldTrigger is set, ≥30% of labelled tasks are behavioural negative controls
[ ] 6. Decoys exist and a false positive costs a check that exit 0 requires
[ ] 6. .skillfit-mock.json has both arms; ground-truth/<id>.md records the seed answer
[ ] 7. bench check reports 0 failures; every remaining warning is explained in the PR body
[ ] 7. --calibrate output is pasted, with the band per task
[ ] 7. An oracle is registered and its gate passes (this is what removes the winnability warning)
```

---

## Further reading

- [benches/README.md](../benches/README.md) — directory layout, `bench.json` schema, the verifier
  contract in full, fixture rules, what the harness records per run.
- [docs/metrics.md](metrics.md) — the frozen measurement contract: L0–L4, the verdict protocol, the
  statistics, and what each layer can and cannot prove at personal sample sizes.
- [benches/contrib/README.md](../benches/contrib/README.md) — the submission rules and what
  maintainers do with your PR.
- `benches/code-review/` and `benches/debugging/` — the two worked examples. `code-review` is
  output-kind throughout: the grader reads the agent's final message. `debugging` is mostly
  command-kind — the agent edits files in the run directory and a real test suite grades the result —
  with two output-kind negative controls. Within it, `ttl-cache` is the diagnose-from-incidents shape
  and `feat-slug` is the implement-against-a-visible-suite shape, including the tamper guard the
  gates do not provide.
