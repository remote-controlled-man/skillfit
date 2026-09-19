# Bench calibration: the code-review difficulty ladder on Kimi Code (2026-09-19)

## Setup

- **Question:** can the bundled `code-review` bench discriminate a skill effect for a current strong model? (Asked after the first task, `review-r1`, saturated at 100% baseline.)
- **Executor:** Kimi Code CLI v2.0.0 headless (`kimi -p`, prompt-file transport via the matrix-driven CLI executor), user's configured default model.
- **Bench:** `benches/code-review` @ content sha256 `89a3335d39a3…` — three tasks as a difficulty ladder:
  - `review-r1` — explicit spec violations (bare `Error`, off-by-one boundary, missing tests).
  - `review-r2` — cross-referencing defects (error code absent from the §1 stable-code table, intermediate rounding against §3, argument mutation against §2).
  - `review-r3` — omission + rule-conflict defects (dropped `EMPTY_ORDER` guard with its test deleted, promotional price further bulk-discounted against §3's "never itself discounted"), hidden in a refactor-style diff with camouflage changes.
- **Skill under test:** local `code-review` skill (bundle sha256 `0c32f24e572c…`), 3 trials per condition per task, deterministic verifiers, no LLM judge.
- **Manifests:** run group `eval-20260919-092904` (all three tasks, final bench state); `eval-20260919-083959` independently replicates `review-r1`. Raw manifests live under `runs/` (gitignored by design).

## Results

| Task | Baseline | Treatment | Δ | Verdict |
|---|---:|---:|---:|---|
| review-r1 | 3/3 (100%) | 3/3 (100%) | 0pp | inconclusive |
| review-r2 | 3/3 (100%) | 3/3 (100%) | 0pp | inconclusive |
| review-r3 | 3/3 (100%) | 3/3 (100%) | 0pp | inconclusive |

The baseline found **every seeded defect in every trial** — including the omission defect (guard dropped, covering test deleted) and the rule-conflict defect — with correct post-PR line numbers and correct numeric consequences (e.g. "priced at 7.6 instead of 8"). All hits were hand-audited against the recorded `_output.md` files; verifier credit was genuine in every inspected trial. Decoy discipline was near-perfect (one false flag across 18 runs).

## Conclusion

For this model (Kimi Code CLI v2.0.0, 2026-09), **small-PR review against an explicit spec is a saturated task shape**: explicit violations, spec-table cross-referencing, purity, rounding-order, omission, and rule-conflict defects are all found reliably with no skill injected. The ladder stays in the bench as a regression net — weaker or future models may score lower, and the harness warns per task when a baseline reaches ≥90% — but it cannot measure skill lift for this model.

The evidence-backed next bench is **hard-bug diagnosis**, not a harder review task: the [July baseline](2026-07-skill-baseline.md) shows skills can have measurable effect there (+66.7pp for `diagnosing-bugs`), so a debugging bench has actual headroom to measure.

## Limitations

- Single model, single harness, 3 trials per cell — pass rates are coarse-grained.
- All three tasks share one shape (small synthetic PR + explicit spec). The saturation claim does not generalize to large diffs, real codebases, or other task shapes.
- Verifier credit is lexical (anchor + evidence regexes); loose phrasings can miscount in principle, which is why hits were hand-audited for these runs.
