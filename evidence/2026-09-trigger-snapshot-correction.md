# Correction: trigger-mode inline-snapshot artifact (2026-09-19)

This corrects the "Trigger-mode follow-up" section of
[2026-09-bench-calibration.md](2026-09-bench-calibration.md), which reported **0/9 trigger recall** for the
`code-review` skill on Kimi Code. That number was a harness artifact, not a property of the skill or model.

## What was wrong

The first trigger-mode implementation inlined the full repository snapshot into the prompt (same as inject
mode). A self-contained prompt gives the agent no reason to consult its skills directory, so activation
measured ~zero regardless of the skill.

## Evidence

Two targeted probes with the same skill installed and files on disk (no inline snapshot):

| Probe | Prompt framing | Skill fired? |
|---|---|---|
| P1 | "review the PR (see `CHANGES.diff`)" | yes |
| P2 | "review my most recent commit" (real git history) | yes |

After the fix (trigger mode never inlines snapshots; bench tasks use `promptTrigger` files that reference
the working directory), a full re-run (`runs/eval-20260919-123630`, bench content sha256 `dd057adb3fe3…`,
kimi-code CLI v2.0.0, 3 trials/task):

| Metric | Before (inline snapshot) | After (files on disk) |
|---|---|---|
| Trigger recall | 0/9 (0%) [95% CI 0%–30%] | **1/9 (11%) [95% CI 2%–44%]** |
| False-trigger rate | 0/3 (0%) | 0/3 (0%) [95% CI 0%–56%] |
| Task pass rate | 3/3 everywhere | 3/3 everywhere |

## Corrected conclusion

The skill **can** trigger on these tasks, but does so unreliably (~11% recall) — and triggering is moot for
quality here anyway (100% pass regardless, per the saturated L2 results). Two lessons, now encoded in the
harness and in `docs/metrics.md` (L1 "presentation fidelity"):

1. Trigger-mode prompts must present work as files on disk; an inline snapshot is a confounder that
   suppresses consultation.
2. A skill that fires rarely *and* changes nothing when it fires has zero realized value — both halves of
   the measurement are needed before drawing either conclusion.

## Limitations

- Single model/agent (Kimi Code CLI v2.0.0), one skill, small-N: the 11% recall has a wide CI [2%, 44%].
- Probes P1/P2 were single runs, not paired trials.
- The run environment also exposes the user's other installed skills, so routing competition existed
  (this is deliberate — trigger quality depends on the installed set).
