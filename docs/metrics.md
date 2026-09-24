# skillfit metrics (v2, frozen 2026-09-23)

This document defines what skillfit measures and how verdicts are computed. It is the contract that
`src/harness/` implements and that bench authors design against. Changes here are deliberate: edit with a
reasoned PR, cite sources, and bump the date.

v2 (2026-09-23): adds graded facet scores (L2), the oracle gate, and floor/facet-saturation warnings.
Motivation: binary pass/fail extracts one bit per trial, which is why quality claims stayed unprovable at
individual-user sample sizes. [Skill2Env](https://github.com/NVlabs/Skill2Env) (Table 1) shows the
sensitivity gap empirically: the same training moved its graded S2EBench mean 56.6→75.1 while pass@1
moved only 33.4→37.7. Its counter-evidence shapes the design too: mixing an LLM-judged process rubric
into the reward *reduced* task pass rates (50.1% vs 54.1% outcome-only), so facet checks must be
programmatic and the judge stays advisory. Skill-sourced task generation (its S2EBench was built from the
same distribution it evaluated) is rejected here for efficacy claims.

Grounding: the framework synthesizes [SkillsBench](https://arxiv.org/abs/2602.12670) (paired evaluation,
per-task pass rates), [SWE-Skills-Bench](https://www.alphaxiv.org/abs/2603.15401) (ΔP / token overhead ρ),
the [STARS](https://arxiv.org/abs/2604.10286) capability-vs-activation split, [OpenAI's skill eval
guidance](https://developers.openai.com/blog/eval-skills) (trigger test classes), [Anthropic's eval
guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (bench composition),
[Skill2Env](https://github.com/NVlabs/Skill2Env) (graded programmatic scoring, oracle/NOP acceptance
gates), and the LLM-judge literature cited in §5.

## Unit of analysis

One **run** = one (task, condition, trial). Runs are **paired** on (task, trial): baseline and treatment see
the same fixture and the same prompt, and the two arms of a pair are executed **adjacently** — the trial loop
is outermost, so condition is never confounded with elapsed time (provider drift, rate-limit degradation,
a filling cache would otherwise land entirely on whichever arm ran second).

Sampling is **not pinned**, and this is a deliberate weakening of an earlier claim: the headless CLI surfaces
in the capability matrix expose no seed or temperature knob, so the harness controls order rather than
sampling. The manifest records `executor.sampling` as `null` where the surface offers nothing, instead of
implying a control that does not exist; a future surface that accepts a seed should populate it. Statistical
treatment is always *paired*: per-task first, then pooled across tasks with tasks as the resampling unit.
Never pool unpaired.

## L0 — bench health (guard metrics)

A bench that cannot discriminate must not produce verdicts.

- **Ceiling**: warn when a task's baseline pass rate ≥ 90% (implemented). Saturated tasks "graduate" to
  regression duty — they verify no harm, but measure no lift
  ([SWE-Skills-Bench found 24/49 skills ceiling-bound](https://www.alphaxiv.org/abs/2603.15401)).
  The same rule applies per facet: a check whose baseline pass rate ≥ 90% is flagged as saturated
  (implemented).
- **Floor**: warn when baseline pass rate ≤ 10% (implemented) — the task is too hard or broken, and
  all-zero arms are equally uninformative.
- **Engagement sanity**: if the agent never touched the fixture (empty output, executor error), the trial is
  excluded from rates and reported as an error, not a failure (implemented). Exclusion is *pairwise*: since
  every statistic here is paired, dropping a trial from one arm alone would misalign the (task, trial) pairs
  that McNemar and the paired bootstrap resample, so an error in either arm removes that pair from both, and
  each arm reports its `errors` count next to its graded `trials`.

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
  and precision (positives fired / all fired) — each a proportion over its own denominator, each with a
  Wilson 95% CI. F1 is reported **bare**: it is a harmonic mean of two proportions and has no closed-form
  binomial interval, so an interval printed for it would be invented precision rather than a measurement.
- **Detection is mechanical, per agent** (see `src/matrix/agents.json`): Kimi Code —
  `-p --output-format=stream-json` (assistant `tool_calls` events naming the `Skill` tool); Codex CLI —
  `exec --json` (no skill event exists → detection via the `command_execution` item that reads the skill's
  `SKILL.md`; normalize shell-escaped path separators before matching); Claude Code —
  `-p --output-format stream-json --verbose` (`--bare` forbidden: it skips skill discovery) — implemented
  against the documented shape but not yet machine-verified.
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

### Facet scores (graded outcome signal)

A verifier may decompose its acceptance criteria into named **checks** and report them in its JSON summary:
`{"passed": bool, "checks": [{"name": string, "pass": bool}]}`. The trial **score** is the fraction of
checks passed ∈ [0,1]. A bench should carry 2–8 checks per task — the bound `bench check` warns on
when it is violated, because one check degenerates to the binary signal facets were introduced to
replace, and a long tail lets an arbitrary subset dominate the score.

- **The exit code remains the sole pass/fail authority** — checks never flip a verdict, and the McNemar
  protocol below is unchanged. When the exit code and the checks disagree, the run records a warning and
  the exit code wins. This is the Skill2Env rubric lesson applied: graded signals must be *programmatic*
  (its LLM-judged rubric reward cost 4pp of task pass rate), so the judge is never a check source.
- **Δscore** = treatment mean score − baseline mean score, reported per task (descriptive) and pooled at
  bench level with a paired bootstrap 95% CI (tasks as the resampling unit, ≥1000 resamples, seeded) —
  the same protocol as ΔP, one level down in granularity. Trials without checks are excluded; a task
  enters the CI only when both arms have at least one scored trial.
- Equal weight per check, per bench version: the check list is frozen by the bench content hash, and the
  report prints the per-facet table so the weighting is transparent rather than hidden.
- Why bother: at personal sample sizes binary ΔP rarely reaches significance; graded scores carry several
  bits per trial and resolve effects pass/fail cannot (Skill2Env Table 1: graded mean moved ~4× more than
  pass@1 under the same treatment). Scores do not fix *saturation* — a facet the baseline always passes is
  1.0 on both arms — which is why facet-saturation warnings exist (L0).

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

The deterministic verifier is the sole pass/fail authority; the judge never flips a verdict. This is not
just conservatism: Skill2Env's rubric arm (LLM-judged process score mixed into the reward at fixed
weight) *reduced* task pass rates relative to outcome-only training — process-signal contamination of
outcome optimization is a measured failure mode, not a hypothetical one.

- Blind pairwise comparison, **AB/BA position-swapped** double call; winner only on consistent verdicts,
  else tie ([Zheng et al.](https://arxiv.org/abs/2306.05685)).
- k=3 samples per side; ties conservative ([Markham 2026](https://arxiv.org/html/2604.13717v3)).
- Judge model must come from a **different family** than the agent under test
  ([self-preference bias](https://arxiv.org/abs/2404.13076)).
- **Binary rubric checklists**, not 1–10 Likert scales ([Husain](https://hamel.dev/blog/posts/llm-judge/index.html)).
- Calibration gate: a bench's rubric needs ≥30 human-labeled examples; report Cohen's κ, warn below 0.6
  ([Thakur et al.](https://arxiv.org/abs/2406.12624)).
- Agent output is quoted/sanitized in judge prompts — judge input is a prompt-injection surface.

Implementation status (2026-09-22): blind pairwise with **AB/BA position-swapped double calls and
winner-only-if-unanimous aggregation** is implemented (`--judge-agent` drives any matrix agent CLI, or
`SKILLFIT_JUDGE=1` + API key; means are computed over unanimous trials only and `consistentTrials` is
reported per task). Blinding is enforced on the filesystem, not just in the prompt (2026-09-25): a CLI
judge has file tools, so it runs in a fresh temporary directory containing only `answerA.md` and
`answerB.md`, never in the run group where both arms' `_output.md` and `_result.json` (which names the
condition and the skill bundle hash) are reachable. The directory is removed after the pair is judged;
`judge-trial-N.json` is written to the task directory afterwards. The judge scores answers with a **binary checklist** (`correct` / `complete` /
`grounded`, 0–3 per answer) instead of a Likert scale. The k=3 majority-ensemble recommendation was
**considered and rejected**: a position-biased judge can still win a 2-of-3 majority by order luck,
which hides the bias inside the vote instead of surfacing it; the unanimous AB/BA gate is stricter and
reports `consistentTrials` as the bias signal. The κ calibration gate remains open.

## Verdict protocol (what "effective" means)

- Collect discordant pairs across the bench: `b` = pairs where only treatment passed, `c` = pairs where only
  baseline passed.
- **McNemar exact test** (two-sided binomial on b+c): `p = 2 · P(X ≥ max(b,c))`, X ~ Binomial(b+c, 0.5).
- If `b + c < 6`, significance is unattainable (best possible p = 0.031 at 6/0) → verdict `inconclusive`,
  reason states the discordant count.
- Verdict `effective` iff p < 0.05 and ΔP > 0; `ineffective` iff p < 0.05 and ΔP < 0; else `inconclusive`.
- Always report alongside: b/c counts, **paired bootstrap 95% CI** for ΔP (≥1000 resamples over tasks,
  seeded and deterministic, pairs kept together), the **paired bootstrap 95% CI for Δscore** when the
  bench emits checks, and the CI half-width as the run's resolution
  ("this bench resolves effects ≳ ±Xpp").
- Scale labels: below 5 trials × 8 tasks, results are stamped **indicative**, not conclusive
  (SkillsBench norm: 5 trials/task).
- Manifest `schemaVersion: 3` carries per-trial pass flags and per-trial facet scores per
  (task, condition) so all of the above is recomputed from raw outcomes, never from aggregates. Those
  arrays hold **graded trials only** — an errored pair is removed from both arms, so the two arrays stay
  index-aligned and re-pairing from the manifest is correct, but an index is no longer a trial number.
  Each condition also reports `errors` alongside `trials`, and the per-trial `_result.json` files remain
  the authoritative record of which trial was dropped and why.

## Bench composition guidance (for authors and the upcoming scaffolding tooling)

- 20–50 tasks drawn from real failures is a healthy personal bench
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)); grow from observed
  failures, stop at theoretical saturation.
- ≥30% negative-trigger tasks once L1 lands; difficulty mix roughly 50% easy / 30% medium / 20% hard.
- Adopt [SkillsBench's contribution gates](https://arxiv.org/html/2602.12670v1): human-authored prompts
  (LLM-written tasks under-measure the model), oracle solution passes the verifier at 100% (**enforced
  when registered**: `bench check` fails a task whose oracle-solved fixture does not exit 0 with every
  check passing, and *warns* on a task that registers no oracle at all, since winnability is then
  unverified — a warning rather than a failure because `bench add --freeze` legitimately produces
  oracle-less tasks mid-authoring; the NOP half, verifier must fail the untouched fixture, is enforced
  unconditionally), minimal deterministic assertions, realistic data, anti-cheat layout (tests and ground truth
  never enter the fixture), grade the outcome not the path. An agent may *draft* the verifier + oracle
  (`bench add --freeze --decompose`), but the draft is admitted only after both gates pass locally, and a
  bench generated from the skill under test is inadmissible for efficacy claims (same-distribution
  contamination — the S2EBench lesson).
- Layout stays [Harbor](https://github.com/harbor-framework/benchmark-template)-compatible so personal
  benches can graduate into shared benchmark tooling.

## Non-goals (v1)

No cross-model leaderboards, no hosted dashboards, no trajectory-level scoring. skillfit answers one
question per user: *is this skill worth installing for my agent on my tasks?*
