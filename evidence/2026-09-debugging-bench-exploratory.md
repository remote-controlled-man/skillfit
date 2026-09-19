# Debugging bench: diagnosing-bugs on Kimi Code (exploratory, 2026-09-19)

**Status: exploratory.** 3 trials per condition — below the conclusive bar (8 tasks × 5 trials) by the
protocol in [docs/metrics.md](../docs/metrics.md). All numbers are indicative, not verdicts.

## Setup

- New bundled bench `benches/debugging/` (content sha256 `2e983f763859…`): three diagnose-and-fix tasks
  ported from the lab's July scenarios (`ttl-cache`, `debug-redaction`, `range-parser`) plus one
  negative-control task (`feat-slug`). All verifiers are command-kind: they run behavioral checks against
  the agent's edited files (the July graders, adapted to exit codes; test-asset evidence preserved).
- Skill: `diagnosing-bugs` (bundle sha256 `174139ebc836…`), inject mode, paired baseline/treatment.
- Executor: Kimi Code CLI v2.0.0 headless. Manifest: `runs/eval-20260919-184214` (local).

## Results (calibration run, 3 trials/condition)

| Task | Baseline | Treatment | Δ |
|---|---:|---:|---:|
| ttl-cache | 3/3 | 3/3 | 0pp (ceiling) |
| debug-redaction | 3/3 | 3/3 | 0pp (ceiling) |
| range-parser | 0/3 | 1/3 | +33pp (only discordant pair) |
| feat-slug (negative control) | 3/3 | 3/3 | 0pp |

Overall: 9/12 vs 10/12, 1 discordant pair, McNemar p = 1.0, Δpass 95% CI [0pp, +25pp] — inconclusive, as
expected at this scale.

## What the run actually showed

1. **The July quality-saturation finding replicates across models.** Two of three debugging tasks ceiling
   out for Kimi Code just as they did for Codex in July. Quality verdicts on these tasks are
   uninformative for current models.
2. **The July test-asset differential did NOT replicate.** In July, Codex-with-skill produced valid
   regression tests in 2/3 runs vs 0/3 baseline. Here, the ported grader's test-asset evidence is empty
   on *both* arms — the injected skill did not move Kimi Code to write regression tests. The skill's
   mechanism is model-dependent, not universal.
3. **Prompt beats skill.** `debug-redaction` explicitly demands a regression-first workflow in its task
   prompt — both arms comply, 3/3. `ttl-cache`'s prompt never mentions tests — nobody writes them, skill
   or not. On this model, what the prompt spells out dominates what the injected skill suggests.
4. `range-parser` is the bench's one discriminative task: baseline 0/3, treatment 1/3, with genuine
   near-miss failures (one behavioral miss, one insufficient-test miss). It is the only place a skill
   effect is measurable at all.

## Decision recorded

The calibration gate (baseline pass rates in the discriminative band) fails for 3 of 4 tasks, so the
formal trials-5 run was **not** executed: with at most ~5 reachable discordant pairs it cannot reach
significance by construction. The next investment is more/harder discriminative debugging tasks (the
bench's real bottleneck), not more trials on these.

## Limitations

- 3 trials per cell; indicative only.
- Single model, single harness, inject mode only (no trigger-mode run for this skill).
- The July comparison is cross-harness (patch-style responses vs. writable workspace) and cross-model —
  mechanisms differ, so "did not replicate" is scoped to this harness + model.
