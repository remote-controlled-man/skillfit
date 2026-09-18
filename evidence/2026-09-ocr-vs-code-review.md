# OCR delegate vs. code-review skill (2026-09-18)

## Setup

- Subject: [alibaba/open-code-review](https://github.com/alibaba/open-code-review) v1.12.5 (npm global), **delegation mode** (OCR does deterministic file selection + rule resolution; the host agent reviews with its own model) vs. the local `code-review` skill (mattpocock upstream HEAD).
- Same model, same fixtures, blind judged.
- Fixtures: r1 / r2 (small diffs, 3 seeded issues each), big (14-file changeset, 5 seeded defects + 2 decoys).

## Results

| Fixture | code-review skill | OCR delegate | Δ |
|---|---:|---:|---:|
| r1 | 9.5 | 10 | +0.5 |
| r2 | 9.5 | 9 | −0.5 |
| big | 12/14 | 13/14 | +1 |

- **Small diffs: a dead tie.** Zero file:line drift, zero false positives on both sides. On small diffs `git diff` already exhausts the review surface; OCR's deterministic file selection has nothing to add.
- **Large diffs: OCR slightly ahead.** Both hit 5/5 seeded defects with zero line drift and 14/14 file coverage — Alibaba's claim that general agents skimp on large diffs did **not** reproduce against the local skill. The gap came from false-positive discipline: the skill reported rename noise as 3 medium findings, OCR reported 1 borderline.
- Unverified: OCR's 1/9-token claim, its hosted LLM pipeline (needs a configured endpoint; we tested delegation only), its AACR-Bench precision/recall claims.

## Conclusion adopted

The two tools are complementary, and review routing was set accordingly:

- `code-review` skill — default for substantive changes, required when a spec/issue exists to check against.
- `open-code-review-delegate` — large changesets (>5 files), defect-pattern sweeps, pure-correctness reviews without a spec.
- At most one AI review per change; executable verification (tests, build, lint) outranks both.

## Limitations

Synthetic fixtures (big is only 14 files); the skill arm ran in a single-context harness (its two axes executed sequentially instead of via subagents); single model, single run per cell.
