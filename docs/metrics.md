# skillfit metrics (v2, frozen 2026-09-23)

Additive component review 2026-10-13: the [Agent evaluation interface](eval-component.md)
adds versioned requests, pinned previews, native receipt audits and an independent
adoption policy. `accept`/`reject`/`inconclusive` adoption decisions do not replace
or reinterpret the frozen `effective`/`ineffective`/`inconclusive` statistical verdict.
Insufficient, stopped, synthetic or unverified evidence cannot authorize adoption;
the component never upgrades a Skill. Complete cost coverage is separate from
quality significance. All formulas and legacy manifest interpretations below remain unchanged.

This document defines what skillfit measures and how verdicts are computed. It is the contract that
`src/harness/` implements and that bench authors design against. Changes here are deliberate: edit with a
reasoned PR, cite sources, and bump the date.

Status reviewed 2026-10-01: L1 records complete installed-resource fingerprints and distinguishes
implemented trigger rates from task-class breakdowns and installed-skill competition that remain
specification. The v2 verdict protocol is unchanged.

Additive workflow review 2026-10-09: optional managed-session and native read metadata below
describe execution coverage and observations. They do not change the v2 statistical formulas,
verdict thresholds, pairwise exclusions or legal legacy manifest interpretation.

Additive revision review 2026-10-12: `--baseline-skill` in installed mode compares two
complete versions of the same Skill. Optional v4 `baselineTarget` records the previous
version; `target` records treatment. Both inputs are frozen, and trial receipts identify
the installed arm's version. All v2 formulas, verdict thresholds and pairwise exclusions
remain unchanged. A revision delta is relative to the previous Skill, not to no Skill;
it establishes neither installation benefit nor general non-regression. See
[the revision workflow](skill-revisions.md).

Additive timing correction 2026-10-12: new trial receipts use a monotonic
`performance.now()` interval for elapsed cost and retain wall duration plus
optional CLI deadline/observation diagnostics. A detected clock discontinuity or
observation gap is an executor environment error, with the existing pairwise
exclusion and spending retention. No v2 formula or threshold changes. Legacy
wall-duration receipts keep their recorded interpretation; see [execution timing](eval-timing.md).
Plans also pin logical/physical workspace aliases so matrix-defined pure trust
registrations for either frozen name count as the same bookkeeping. Retargeting
an alias or changing any other configuration still stops further calls.

This is the **why**. The **how** — turning one of your own failures into a task that satisfies this
contract — is [bench-authoring.md](bench-authoring.md).

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

Operational interruption handling (2026-10-16, unreleased source): SIGINT/SIGTERM
stops subsequent dispatches and managed active processes, retaining receipts and
sealing a stopped prefix. Interrupted execution is ungraded; available counters
remain partial unless the invocation already settled with final usage. Missing
usage remains unknown. No retries, replacements, new observations, efficacy
verdict or upgrade eligibility are inferred from cancellation. Existing formulas
and historical evidence are unchanged. See [the interruption contract](evaluation-interruption.md).

Operational spending guard (2026-10-15, included in 0.10.0): paired evaluations
may declare five absolute `spendingBudget` stop lines, pinned in their request,
preview and native plan. All invoked agent spending counts, including failures
and excluded partners. Reaching a line prevents the next call; one in-flight call
may overshoot. Missing/partial/invalid final usage or an execution/guard error
stops further calls and retains spent/unknown costs. There is no retry or
replacement. A final predeclared call with complete evidence may finish the
cohort at a line. Completed audits replay sealed before/after snapshots against
the chronological receipts. Trigger mode and judges are unsupported. This is
an operational stop rule, **not** an API hard cap, adoption threshold or new
statistical protocol; exclusions, formulas, policies and old records remain
unchanged. See [the component contract](eval-component.md#input-and-execution).

Environment correction (2026-10-14): new paired installed runs deliver the same
versioned native untracked-file diff helper and usage guidance to both arms.
Plans, source snapshots and delivered copies bind its content; mutation stops
further calls while retaining spending. This is common environment tooling,
not a Skill treatment or an efficacy claim. Its use is not attested by delivery.
Older runs retain their original environment and cannot be pooled into a new
validation cohort. All costs, formulas, coverage requirements and verdict gates
remain unchanged.

Additive pair ordering 2026-10-13: versioned JSON requests can declare
`pairOrder: "balanced"`. The first arm alternates by task position and trial
number, keeping both arms adjacent and recording the strategy in the native plan
and manifest. Offline assessment checks actual ledger order. The compatibility
default remains `baseline-first`; old records without order metadata keep their
recorded interpretation. This controls a systematic first/second-arm assignment,
without isolating cache state or changing any verdict, exclusion or resampling
formula. See [the component contract](eval-component.md).

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

Task selection (2026-10-16, 0.10.0): repeated CLI `--task` or request `taskIds`
restricts the evaluated population before calls. Native plans bind selected IDs
and manifest order while keeping the full bench hash. Planned calls, observed
costs and task counts use only that population. Empty, duplicate, unsafe or
unknown IDs are rejected. No statistical formula, eight-task/five-pair floor,
independence requirement or historical verdict changes; a selected small subset
remains indicative. See [case management](case-management.md).

A bench that cannot discriminate must not produce verdicts.

- **Ceiling**: warn when a task's baseline pass rate ≥ 90% (implemented). Saturated tasks "graduate" to
  regression duty — they verify no harm, but measure no lift
  ([SWE-Skills-Bench found 24/49 skills ceiling-bound](https://www.alphaxiv.org/abs/2603.15401)).
  The same rule applies per facet: a check whose baseline pass rate ≥ 90% is flagged as saturated
  (implemented).
- **Floor**: warn when baseline pass rate ≤ 10% (implemented) — the task is too hard or broken, and
  all-zero arms are equally uninformative.
- **Engagement sanity**: if the agent never engaged with the fixture, the executor errored, or the
  verifier produced no exit code at all (unspawnable command, killed by its timeout, or output over
  the capture limit), the trial is excluded from rates and reported as an error, not a failure
  (implemented). Non-engagement means the final message is empty or whitespace. For an output task
  that message is the deliverable. For a command task the deliverable is the file edit, so an empty
  message still counts when the disposable worktree differs from the fixture commit. Exclusion is *pairwise*: since
  every statistic here is paired, dropping a trial from one arm alone would misalign the (task, trial) pairs
  that McNemar and the paired bootstrap resample, so an error in either arm removes that pair from both, and
  each arm reports its `errors` count next to its graded `trials`.
  Command tasks whose disposable Git initialization/reflog verification fails are likewise
  environment errors before their executor starts; inherited disabled reflog is overridden only
  in the disposable repository. This does not change the paired exclusion or verdict formulas.

## L1 — trigger quality (activation)

Paired installed-Skill runs may additionally record `skillReads` counts (`observed`,
`unobserved`, `unknown`) per arm, task and overall, with the **surviving graded pair**
denominator. These mechanical transcript observations are not trigger recall/precision and do
not establish use, causation or benefit. Errored pairs are excluded from these counts as from
the quality rates. Older v4 manifests without these fields remain valid.

Optional `experiment` metadata records declared/planned calls, the ceiling, actual started and
finished calls, completion state and frozen plan hash. A stopped/incomplete experiment cannot
support an installation recommendation, regardless of the unchanged statistical verdict on its
surviving observations. Enabled judges contribute two declared calls per pair. No replacement
samples, retries or partial task-set truncation are added to meet a budget; see
[the bounded workflow](experiment-workflow.md) for the fingerprint/ledger contract and limits.

Whether the agent invokes the skill when it should, and only then. A skill's realized value is gated by this:
an excellent skill that never fires — or fires everywhere — is worthless. Public benchmarks measure efficacy
conditional on injection; trigger quality is skillfit's differentiating layer. (Status: **partial** — without `--compete-installed`, trigger mode installs one Skill alone and recall is an upper bound. That flag copies other user-level Skills from the matrix directories; system Skills and plugins outside those directories are not copied. Optional `triggerClass` values are `explicit`, `implicit`, and `contextual`; unlabeled positive tasks stay in the pooled recall. Claude Code capture is implemented against the documented shape and is not machine-verified. Codex detection counts a `SKILL.md` read.)

- **Task classes** (adopted from OpenAI's eval-skills taxonomy): `explicit` (skill named in prompt),
  `implicit` (in-domain task, skill not named), `contextual` (noisy realistic task), `negative`
  (`shouldTrigger: false` — decoy tasks measuring over-triggering). The current manifest records only
  `shouldTrigger: true/false` and pools the positive classes; reporting explicit and implicit results
  separately remains specification because they exercise different mechanisms.
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
- **Environment errors**: unavailable disposable Git initialization/reflog excludes a command trigger trial
  before its executor starts. The existing error exclusion and trigger-rate formulas remain unchanged.
- **Presentation fidelity**: trigger-mode tasks present work as files on disk with a natural request; the
  harness never inlines a repository snapshot in trigger mode. A self-contained prompt suppresses skill
  consultation (measured: 0/9 trigger recall with an inline snapshot vs. the skill firing on the same tasks
  from disk — see evidence/2026-09-trigger-snapshot-correction.md). Trigger-mode prompt variants live in
  per-task `promptTrigger` files.
- **Content identity**: trigger manifests retain `skill.bundleSha256/files` for the injectable
  Markdown/YAML/JSON bundle and additionally record `skill.installedSha256/installedFiles` for every
  installed regular file, including scripts, binary assets and hidden files. The full fingerprint hashes
  sorted relative paths and file bytes before the agent runs; it does not fingerprint permissions or
  empty directories. Each trial receipt records the observed `skillInstalledSha256/skillInstalledFiles`.
  Every copy must match the planned installed fingerprint before its executor starts. Keep the source
  unchanged throughout a run; a mismatch stops the experiment before the affected agent call. The input
  root is resolved, while nested symbolic links and non-regular resources are rejected before a run
  directory is created because their content cannot be pinned by this file-byte contract. These are
  additive fields in trigger schema v1; older manifests lack a full installed fingerprint and must be
  labelled unrecorded, never reconstructed from their injectable hash.
- **Environment fidelity caveats**: routing quality depends on the *whole installed skill set* (lexical
  competition). (Status: **spec, not implemented** — the harness installs only the skill under test into an
  otherwise empty sandboxed skills directory, so measured recall is *optimistic*: it faces no competition from
  the user's real set. Reproducing that competition means fingerprinting and copying a user's installed skills
  into a sandbox, which raises privacy questions this project has not settled; it is tracked as a future
  enhancement rather than built here. Read trigger recall as an upper bound until then.) A triggered skill
  cannot unload mid-session — one false trigger taxes the rest of the session, which is why false-trigger rate
  is a first-class metric.

## L2 — conditional efficacy (the paired A/B core)

Measured with the Skill force-injected (`eval --mode inject`, the compatible default), isolating content quality from routing.
`eval --mode installed` uses the same paired statistics but measures native discovery plus complete
Skill resources, so its delta is realized task efficacy under the recorded environment, not efficacy
conditional on guaranteed activation. Keep these delivery surfaces distinct when comparing studies.

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
  the same protocol as ΔP, one level down in granularity. Trials without checks are excluded pairwise:
  a trial stays in Δscore only when both arms scored it, so the denominators match. A task enters the
  CI only when that leaves at least one scored pair.
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
- Agent output is **fenced**, not merely quoted: each answer sits between nonce-delimited
  `<<<BEGIN ANSWER A …>>>` / `<<<END ANSWER A …>>>` markers (fresh random nonce per judge call, so an
  answer cannot reproduce them), and the prompt states that the blocks are untrusted data whose embedded
  instructions and JSON must be disregarded. The checklist is parsed from the **last** JSON object in the
  judge's reply rather than the first match anywhere, so an answer that gets echoed while the judge reasons
  cannot take the verdict. Judge input remains a prompt-injection surface: this closes the accidental
  collision and raises the cost of a deliberate one, and it does not make an untrusted judge trustworthy.

Implementation status (2026-09-22): blind pairwise with **AB/BA position-swapped double calls and
winner-only-if-unanimous aggregation** is implemented (`--judge-agent` drives any matrix agent CLI, or
`SKILLFIT_JUDGE=1` + API key; means are computed over unanimous trials only and `consistentTrials` is
reported per task). Blinding is enforced on the filesystem, not just in the prompt (2026-09-25): a CLI
judge has file tools, so it runs in a fresh temporary directory containing only `answerA.md` and
`answerB.md`, never in the run group where both arms' `_output.md` and `_result.json` (which names the
condition and the evaluation-target hash) are reachable. The directory is removed after the pair is judged;
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
  bench emits checks, and the observed CI half-width. A bootstrap half-width is not a validated
  minimum detectable effect. A collapsed Δpass or Δscore interval can arise when the observed tasks/pairs lack
  variation, and must not be presented as zero uncertainty or arbitrarily fine resolution. This
  interpretation guard changes no CI or verdict calculation.
- Scale labels: below 5 trials × 8 tasks, results are stamped **indicative**, not conclusive
  (completed graded pairs after exclusions, rather than requested repetitions).
  (SkillsBench norm: 5 trials/task). The exact-test verdict and this scale label answer different
  questions: an `effective` or `ineffective` verdict can occur below the scale bar, but then it is a
  within-bench statistical signal, **not** a claim that the configuration generalizes to a user's
  broader task mix. The CLI defaults to 5 trials per condition; 5 is a starting point, not a power
  guarantee. Add representative, discriminative tasks before multiplying repetitions of a narrow
  fixture. Review the CI width, discordant pairs, baseline ceiling/floor, and errors before any
  efficacy claim. Predeclare the task set and trial count; adding trials after seeing the p-value
  until it crosses a threshold invalidates the nominal 0.05 interpretation.
- Manifest `schemaVersion: 4` carries a typed evaluation target (`skill`, `rules`, or `mcp`), its
  content hash and file list, plus per-trial pass flags and per-trial facet scores per
  (task, condition) so all of the above is recomputed from raw outcomes, never from aggregates. Those
  arrays hold **graded trials only** — an errored pair is removed from both arms, so the two arrays stay
  index-aligned and re-pairing from the manifest is correct, but an index is no longer a trial number.
  Each condition also reports `errors` alongside `trials`, and the per-trial `_result.json` files remain
  the authoritative record of which trial was dropped and why.

## Bench composition guidance (for authors and the upcoming scaffolding tooling)

Operational gate (source after npm 0.10.0): live `eval` reuses offline bench
integrity checks before dispatch, scoped to selected tasks (labelled tasks in
trigger mode). Hard failures block all agent/judge calls. Missing oracles and
other unmeasured coverage are explicit `UNKNOWN` diagnostics; observed concerns
remain `WARN`. Neither blocks calls nor counts as passed evidence. The native
plan retains probes and separate offline elapsed time; previews mark checks
pending. This changes no statistical verdict, cost population or adoption rule.
See [the preflight contract](eval-case-preflight.md).

These are the targets. [bench-authoring.md](bench-authoring.md) is the walkthrough that gets a bench to
them, step by step, on one real task.

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

## Workspace configuration experiments

Paired runs can select `--input workspace` to present task files on disk without
an inline snapshot. CLI executors only; the compatible default remains
`snapshot`. Calibration must use the same selection. New v4 manifests and trial
receipts record `inputMode`; its absence in an older manifest is reported as
legacy/not recorded. Skill content remains force-injected in the treatment, so
this changes task presentation, not L1/L2 or the statistical verdict protocol.
The initial workspace prompt estimate excludes subsequent tool reads and replies.

Paired `--mode installed` is a separate, opt-in delivery surface for Skill/CLI experiments and
requires workspace input. Prompts remain identical; only treatment receives the complete Skill at
the matrix-defined project directory. Compatible v4 `skillDelivery` metadata records the selection
and directory. Here `target.bundleSha256/files` fingerprint all regular resources (sorted relative
paths and bytes, including scripts and binary assets; excluding permissions and empty directories).
Per-run receipts retain nullable mechanical activation observations and available raw transcripts.
Source drift, unsafe paths, symlinks and fixture collisions fail before the affected agent call.
Inherited agent configuration is not isolated, and installation does not guarantee activation.
Old v4 manifests and inject mode retain their existing interpretation. Paired tests, scale labels,
error exclusions, CI calculations and verdict semantics above are unchanged. See
[installed-skill-evaluation.md](installed-skill-evaluation.md) for usage and limits.

New condition summaries also record `tokenCoverage.input/output`: the number of
graded surviving runs that supplied each field. Existing `tokens` totals and
verdict semantics are unchanged. Missing or partial coverage cannot establish a
complete overhead claim; legacy totals without coverage are shown as unrecorded.

Optional `tasks[].costs` and `overall.costs` (cost schema 1) add descriptive
accounting for surviving graded pairs and all invoked agent runs separately.
They partition input into recorded cache-read and uncached tokens, retain
failed/excluded invocations' spending, and report each measure per successful
task (total spending / successes, including graded failures). Each measure's
`final/partial/unknown` coverage sums to its population's run count. Incomplete
usage is a known lower bound and suppresses percentage comparisons; missing
cache counts are unknown, never zero. Timeouts retain measured elapsed time and
available public-transcript usage as partial receipts. Pre-call guard/setup
refusals are counted separately and do not enter spending totals. Judge and
other cohorts' spending are excluded. These observations introduce no cost
significance, monetary estimate or change to the quality protocol. See
[evaluation cost accounting](eval-costs.md) for field and denominator rules.

Failed JSON CLI invocations may add an identity/time-bound local numeric usage
snapshot when the matrix capability permits it. This is partial cumulative usage,
never final coverage or an accepted outcome; receipt `usageEvidence` preserves
the counter provenance without private transcript bodies. Unknown/ambiguous
metadata remains unknown, and original frozen failures are not rewritten.
Quality exclusions, verdicts and every completeness/adoption gate stay unchanged.

Rules and MCP targets use the same paired statistics as Skill targets but a different treatment
mechanism. Both arms start from the same fixture and receive an identical prompt snapshot. The
baseline/treatment project overlays are applied only after that snapshot, so the local CLI must load
the configuration through its real project path. API executors are inadmissible because they cannot
observe workspace configuration. See [config-experiments.md](config-experiments.md).

`mcp check` is a protocol and catalog preflight, not an efficacy result. It proves that a compatible
stdio server initializes and exposes structurally usable tool definitions without calling a tool.
Only a paired task experiment can support a claim that the MCP setup improves outcomes.

## Non-goals (v1)

No cross-model leaderboards, no hosted dashboards, no trajectory-level scoring. skillfit answers one
question per user: *is this configuration worth enabling for my agent on my tasks?*

Release availability reviewed 2026-10-14: policy version 2 ships in 0.9.0.
This availability update changes no formula, evidence gate or acceptance threshold.
The legacy section anchor remains available for existing links.

<a id="explicit-efficiency-acceptance-policy-version-2-unreleased"></a>

## Explicit efficiency acceptance (policy version 2, since 0.9.0)

The default version-1 quality policy and all quality verdicts above remain unchanged.
An explicitly predeclared version-2 policy with `objective: "efficiency"` can instead
accept a cost improvement with no **observed** correctness regression. A quality tie
keeps its `inconclusive` verdict; this is neither proof of equivalence nor a quality
gain. Both policies require the same native evidence, validation purpose, complete
usage, error-free finished experiment and eight-task/five-pair floors. Version 2
also requires native, predeclared balanced adjacent pair order. Any paired task,
score or named-check regression rejects regardless of aggregate savings.

The primary cost is **all invoked agent uncached-input tokens / successful task
executions**, including spending on unsuccessful executions. Every task must have
final uncached-input coverage, positive baseline spending and successes in both
arms; missing tasks are never removed to improve the estimate. Bootstrap the
whole paired task blocks, preserving both arms, all recorded trials, all spending
and successes. For each of 10,000 resamples, draw N tasks with replacement from
the N declared tasks and recompute the pooled ratio `(T tokens / T successes) /
(B tokens / B successes) - 1`. Use Mulberry32 seed `20261013`; sort changes and
take zero-based indices `floor(0.025 * 10000)` and `floor(0.975 * 10000)` for the
95% percentile interval. The upper bound must be at most the negative declared
minimum reduction (default 10%, floor 1%; comparison tolerance 1e-12), and at least
the declared fraction of tasks must individually reduce that same per-success
measure (default and floor 75%). No trial-level pseudo-replication or replacement
of failed samples is allowed.

Version 2 separately caps all-invocation input, cached input, uncached input,
output and elapsed time per success; defaults allow no increase. Explicit caps
show permitted tradeoffs. An elapsed-time cap is descriptive, not a latency
significance test. Complete coverage of **all five** measures is still required.
The interval concerns the recorded task mixture and the empirical distribution
of its task blocks. Related defects within a repository, inherited configuration,
provider drift and cache reuse limit generalization; it is not a repository-level
or future-model guarantee. It estimates neither dollars nor provider-internal
retry costs. Policy normalization/hashes remain versioned, and a policy chosen
after execution cannot authorize adoption. See [the component contract](eval-component.md).
