# skillfit metrics (v1, frozen 2026-09-19)

This document defines what skillfit measures and how verdicts are computed. It is the contract that
`src/harness/` implements and that bench authors design against. Changes here are deliberate: edit with a
reasoned PR, cite sources, and bump the date.

Grounding: the framework synthesizes [SkillsBench](https://arxiv.org/abs/2602.12670) (paired evaluation,
per-task pass rates), [SWE-Skills-Bench](https://www.alphaxiv.org/abs/2603.15401) (ΔP / token overhead ρ),
the [STARS](https://arxiv.org/abs/2604.10286) capability-vs-activation split, [OpenAI's skill eval
guidance](https://developers.openai.com/blog/eval-skills) (trigger test classes), [Anthropic's eval
guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (bench composition), and
the LLM-judge literature cited in §5.

## Unit of analysis

One **run** = one (task, condition, trial). Runs are **paired** on (task, trial): baseline and treatment see
the same fixture, prompt, and seed. Statistical treatment is always *paired*: per-task first, then pooled
across tasks with tasks as the resampling unit. Never pool unpaired.

## L0 — bench health (guard metrics)

A bench that cannot discriminate must not produce verdicts.

- **Ceiling**: warn when a task's baseline pass rate ≥ 90% (implemented). Saturated tasks "graduate" to
  regression duty — they verify no harm, but measure no lift
  ([SWE-Skills-Bench found 24/49 skills ceiling-bound](https://www.alphaxiv.org/abs/2603.15401)).
- **Floor**: warn when baseline pass rate ≤ 10% — the task is too hard or broken, and all-zero arms are
  equally uninformative.
- **Engagement sanity**: if the agent never touched the fixture (empty output, executor error), the trial is
  excluded from rates and reported as an error, not a failure (implemented).

## L1 — trigger quality (activation)

Whether the agent invokes the skill when it should, and only then. A skill's realized value is gated by this:
an excellent skill that never fires — or fires everywhere — is worthless. Public benchmarks measure efficacy
conditional on injection; trigger quality is skillfit's differentiating layer. (Status: **spec; implementation
is the next milestone**.)

- **Task classes** (adopted from OpenAI's eval-skills taxonomy): `explicit` (skill named in prompt),
  `implicit` (in-domain task, skill not named), `contextual` (noisy realistic task), `negative`
  (`should_trigger: false` — decoy tasks measuring over-triggering). Explicit and implicit results are
  reported separately; they exercise different mechanisms.
- **Metrics**: trigger recall (fires on should-trigger tasks), false-trigger rate (fires on negative tasks),
  precision, F1 — each with Wilson 95% CIs.
- **Detection is mechanical, per agent** (see `src/matrix/agents.json`): Claude Code —
  `-p --output-format stream-json --verbose` (`--bare` forbidden: it skips skill discovery); Codex CLI —
  `exec --json` (no skill event exists → canary: the benched skill is instructed to emit
  `SKILLFIT_SKILL:<name>`); Kimi Code — `-p --output-format stream-json` (assistant `tool_calls` events).
- **Presentation fidelity**: trigger-mode tasks present work as files on disk with a natural request; the
  harness never inlines a repository snapshot in trigger mode. A self-contained prompt suppresses skill
  consultation (measured: 0/9 trigger recall with an inline snapshot vs. the skill firing on the same tasks
  from disk — see evidence/2026-09-trigger-snapshot-correction.md). Trigger-mode prompt variants live in
  per-task `promptTrigger` files.
- **Environment fidelity caveats**: routing quality depends on the *whole installed skill set* (lexical
  competition), so L1 runs install the skill into a sandboxed skills directory containing the user's real
  set, not an isolated one. A triggered skill cannot unload mid-session — one false trigger taxes the rest
  of the session, which is why false-trigger rate is a first-class metric.

## L2 — conditional efficacy (the paired A/B core)

Measured with the skill force-injected (today's `eval` behavior), isolating content quality from routing.

- **ΔP** = treatment pass rate − baseline pass rate (per task, then pooled).
- **ρ** = (tokens_treatment − tokens_baseline) / tokens_baseline, input and output separately.
- **pass@1** (mean pass rate) and **pass^k** (all k trials pass — reliability the user actually pays for).
  pass@k is *not* a headline metric: it hides variance that costs real tokens in agent settings.
- Per-task numbers are **descriptive** (a few trials can never be significant alone); inference happens only
  at bench level (§4).

## L3 — realized value (the "should I install it" answer)

`EV ≈ P(trigger | relevant) · ΔP · V − P(trigger) · C_body − P(false trigger) · (C_body + δ_derail · V) − C_metadata`

- `V` = value of one task pass (user-set; default 1), `C_body` = tokens of the loaded skill body,
  `δ_derail` = quality loss from a false trigger (bounded by observed negative deltas, up to −10pp in
  SWE-Skills-Bench), `C_metadata` = always-on routing cost ≈ 30–50 tokens/skill/turn.
- **Cost-of-pass** per arm: `v = mean cost / pass rate`; report `v_treatment / v_baseline` (replaces
  ΔP/ρ, which is unstable near ρ = 0; after the [cost-of-pass](https://openreview.net/pdf?id=vC9S20zsgN)
  formulation).
- Honest budget rule: at individual-user sample sizes, **cost claims are provable, quality claims are
  bounded** (token deltas reach significance far more easily than pass-rate deltas — cf. the
  [ETH AGENTS.md study](https://arxiv.org/abs/2602.11988): −3% quality not significant, +20% cost
  significant at p<0.001). Reports say which of the two a verdict rests on.

## L4 — judge (soft quality, optional)

The deterministic verifier is the sole pass/fail authority; the judge never flips a verdict.

- Blind pairwise comparison, **AB/BA position-swapped** double call; winner only on consistent verdicts,
  else tie ([Zheng et al.](https://arxiv.org/abs/2306.05685)).
- k=3 samples per side; ties conservative ([Markham 2026](https://arxiv.org/html/2604.13717v3)).
- Judge model must come from a **different family** than the agent under test
  ([self-preference bias](https://arxiv.org/abs/2404.13076)).
- **Binary rubric checklists**, not 1–10 Likert scales ([Husain](https://hamel.dev/blog/posts/llm-judge/index.html)).
- Calibration gate: a bench's rubric needs ≥30 human-labeled examples; report Cohen's κ, warn below 0.6
  ([Thakur et al.](https://arxiv.org/abs/2406.12624)).
- Agent output is quoted/sanitized in judge prompts — judge input is a prompt-injection surface.

## Verdict protocol (what "effective" means)

- Collect discordant pairs across the bench: `b` = pairs where only treatment passed, `c` = pairs where only
  baseline passed.
- **McNemar exact test** (two-sided binomial on b+c): `p = 2 · P(X ≥ max(b,c))`, X ~ Binomial(b+c, 0.5).
- If `b + c < 6`, significance is unattainable (best possible p = 0.031 at 6/0) → verdict `inconclusive`,
  reason states the discordant count.
- Verdict `effective` iff p < 0.05 and ΔP > 0; `ineffective` iff p < 0.05 and ΔP < 0; else `inconclusive`.
- Always report alongside: b/c counts, **paired bootstrap 95% CI** for ΔP (≥1000 resamples over tasks,
  seeded and deterministic, pairs kept together), and the CI half-width as the run's resolution
  ("this bench resolves effects ≳ ±Xpp").
- Scale labels: below 5 trials × 8 tasks, results are stamped **indicative**, not conclusive
  (SkillsBench norm: 5 trials/task).
- Manifest `schemaVersion: 2` carries per-trial pass flags per (task, condition) so all of the above is
  recomputed from raw outcomes, never from aggregates.

## Bench composition guidance (for authors and the upcoming scaffolding tooling)

- 20–50 tasks drawn from real failures is a healthy personal bench
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)); grow from observed
  failures, stop at theoretical saturation.
- ≥30% negative-trigger tasks once L1 lands; difficulty mix roughly 50% easy / 30% medium / 20% hard.
- Adopt [SkillsBench's contribution gates](https://arxiv.org/html/2602.12670v1): human-authored prompts
  (LLM-written tasks under-measure the model), oracle solution passes the verifier at 100%, minimal
  deterministic assertions, realistic data, anti-cheat layout (tests and ground truth never enter the
  fixture), grade the outcome not the path.
- Layout stays [Harbor](https://github.com/harbor-framework/benchmark-template)-compatible so personal
  benches can graduate into shared benchmark tooling.

## Non-goals (v1)

No cross-model leaderboards, no hosted dashboards, no trajectory-level scoring. skillfit answers one
question per user: *is this skill worth installing for my agent on my tasks?*
