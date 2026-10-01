# A reproducible first check (2026-10-01)

This example checks the two benches bundled with skillfit. It uses deterministic Node verifiers and
reference solutions, with no agent CLI or model API call. After cloning, installing dev dependencies,
and building as shown in the [quick start](../README.md#quick-start), run:

```bash
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
```

Observed on 2026-10-01:

| Bench | Tasks | Content hash prefix | Check summary |
|---|---:|---|---|
| `code-review` | 5 | `cab1d3037592` | 27 passed, 0 warnings, 0 failures |
| `debugging` | 8 | `4ec827c25f6a` | 36 passed, 0 warnings, 0 failures |

Each check verifies that the untouched task fails where appropriate, that the oracle passes, and
that fixture hygiene and trigger labels meet the bench contract. Output-graded tasks also check mock
responses. Command-graded tasks cannot be simulated by a mock that only writes text; their offline
coverage comes from the untouched-fixture and oracle gates. The [CI workflow](../.github/workflows/ci.yml)
runs the same checks on macOS, Linux, and Windows.

These numbers establish **bench integrity only**. They do not show that a Skill improves an agent,
that the tasks are discriminative for today's model, or that a model would choose the right Skill.
Measuring those questions requires a live paired experiment, calibrated task difficulty, sufficient
discordant pairs, and a dated manifest. See the [metrics protocol](metrics.md) and the
[result-sharing guide](sharing-results.md).
