# Skill baseline: 8 popular workflow skills (2026-07, frozen)

**Status: frozen historical evidence. Do not append data; do not merge absolute scores with later rounds.**

## Setup

- Agent: Codex CLI (frozen version), Windows, ChatGPT account default route. The CLI did not expose the served model identity per request, so we do not claim a pinned model.
- Design: paired baseline/treatment, 3 valid pairs per skill, 48 runs total. Treatment adds exactly one thing: the skill's Markdown/YAML/JSON payload. Skill bundle SHA-256 recorded per run.
- Grading: deterministic graders hidden from the agent; input/output tokens and wall time recorded.
- Each skill was paired with a task in its home domain (e.g. `security-and-hardening` → archive-path traversal fixture).

## Results

| Skill | Pairs | Baseline | Treatment | Quality Δ | Test-asset Δ | Input tokens | Output tokens | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `tdd` | 3 | 83.33% | 83.33% | 0.00pp | 0.00pp | +9.17% | +9.93% | No measurable gain |
| `diagnosing-bugs` | 3 | 100% | 100% | 0.00pp | **+66.67pp** | +11.70% | +90.74% | Conditional: 2/3 treatments produced valid regression tests, baseline 0/3 |
| `code-review` | 3 | 96.67% | 100% | +3.33pp | 0.00pp | +9.13% | +29.06% | Unstable (one run deduplicated findings; two tied) |
| `doubt-driven-development` | 3 | 100% | 100% | 0.00pp | 0.00pp | +20.68% | +20.39% | No measurable gain |
| `codebase-design` | 3 | 100% | 100% | 0.00pp | 0.00pp | +14.74% | −6.37% | No measurable gain |
| `security-and-hardening` | 3 | 100% | 100% | 0.00pp | 0.00pp | +27.44% | −4.25% | No measurable gain; highest input cost |
| `performance-optimization` | 3 | 100% | 100% | 0.00pp | 0.00pp | +16.31% | −0.99% | No measurable gain |
| `code-simplification` | 3 | 88.89% | 88.89% | 0.00pp | 0.00pp | +16.95% | +6.20% | No measurable gain |

## Conclusions adopted

1. Short, stable workflow rules go into `AGENTS.md`; full skills are not auto-injected by default.
2. `diagnosing-bugs` triggers conditionally (unknown-root-cause bugs where a regression test is worth keeping), because its benefit was a repeatable artifact, not a guaranteed one — and it costs +90.74% output tokens.
3. "No measurable gain" is not "useless forever"; it means this frozen evidence does not justify the standing token, routing, and maintenance cost of a global install.

## Caveats

- The harness requested patches rather than letting agents act in a writable workspace, so process-level behaviors (red-green-refactor sequencing) were not observable.
- 3 pairs per skill bounds statistical power; small true effects would be missed.
