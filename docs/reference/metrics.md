# skillfit metrics (v2, frozen 2026-09-23)

This is the current source contract for what skillfit measures and how it
computes verdicts. The **v2 statistical protocol** is frozen at 2026-09-23;
additive evidence/operational contracts do not change its formulas, thresholds,
paired exclusions or historical interpretations. Current-source behavior reviewed
2026-10-22 includes unpublished numerical, trigger, model-identity, self-test and
bench-claim changes; a `0.13.1` version string does
not imply those changes are in the released npm package. See the
[capability table](../guides/experiment-workflow.md) for
implemented readers and verification scope, and [revision history](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/metrics-history.md)
for the former chronological additions. Changes to this contract need a reasoned
PR and an explicit date/protocol scope.

This page owns measurement meaning, statistical formulas, shared adoption gates,
stop semantics and evidence limitations. [Planning](../guides/experiment-workflow.md) owns option
defaults, confirmation and budget input format; the [component](eval-component.md)
owns machine request/result fields and policy configuration; [cost accounting](evaluation-reports.md)
owns cost populations and coverage fields. Implemented facts belong in these
contracts; progress belongs in the linked [measurement plan](https://github.com/remote-controlled-man/skillfit/blob/main/docs/work/current.md#status).

- [Analysis unit and sampling](#unit-of-analysis)
- [Declared scope and offline controls](#declared-scope-and-offline-controls-current-source)
- [Bench health](#l0--bench-health-guard-metrics), [activation](#l1--trigger-quality-activation),
  [paired outcomes](#l2--conditional-efficacy-the-paired-ab-core),
  [realized value](#l3--realized-value-the-should-i-install-it-answer) and [advisory judge](#l4--judge-soft-quality-optional)
- [Statistical verdict](#verdict-protocol-what-effective-means) and [efficiency adoption](#explicit-efficiency-acceptance-policy-version-2-since-090)
- [Costs, budgets and stopping](#costs-budgets-and-stopping)
- [Evidence and model identity](#evidence-and-replay) and [known limitations](#non-goals-and-known-limitations)

The **how** — turning a real failure into a task — is [bench authoring](../guides/bench-authoring.md).
The [evaluation component](eval-component.md) separates the statistical verdict
(`effective`/`ineffective`/`inconclusive`) from adoption
(`accept`/`reject`/`inconclusive`). A within-bench statistical signal alone never
authorizes installation, and no component automatically upgrades a Skill.

## Unit of analysis

One **run** = one (task, condition, trial). Runs are **paired** on (task, trial): baseline and treatment see
the same fixture and the same prompt, and the two arms of a pair are executed **adjacently** — the trial loop
is outermost, reducing systematic separation by elapsed time. Adjacency does not eliminate provider drift,
cache effects or other environmental variation.

`pairOrder` defaults to `baseline-first`; predeclared `balanced` alternates the
first arm by task position and trial number while keeping both arms adjacent.
Native plans/ledgers retain the actual order. Balanced order controls assignment,
not cache state or sampling; efficiency policy 2 requires it.

Sampling is **not pinned**. Current CLI and API adapters send no temperature or
seed control and report `sampling: null`; CLI models/settings come from the active
CLI configuration. `withSampling` preserves an injected executor's explicit
metadata and otherwise records null. This is an adapter limitation, not a claim
that every vendor interface lacks controls or that randomness caused an observed
null effect. Statistical treatment is paired: per-task first, then pooled with
tasks as the resampling unit. Never pool unpaired.

Repeated `--task` / request `taskIds` selects tasks in bench order before calls.
Empty, duplicate, unsafe or unknown IDs fail. The plan binds the selected IDs
while retaining the full bench hash; calls and cost/task populations use the
selected cohort. A small selected cohort does not waive scale or independence gates.

## Declared scope and offline controls (current source)

[Bench claims](../../benches/README.md#claims-and-measurement-scope) owns schema 2 declarations, objective derivation,
pre-call refusal and frozen measurementScope 1. Default schema 1 remains
legacy-unrecorded; missing historical scope does not acquire today's declarations
or a new adoption gate. A declaration identifies design support, not validity
or statistical power. Unsupported schema 2 targets cannot be made acceptable
by silently dropping tasks or choosing a different report policy. Quality
observations during an efficiency run do not expand its declared conclusions.

[Self-test protocol 1](../guides/bench-authoring.md#test-known-controls) applies predeclared benefit/harm/null/error
controls through the paired pipeline without a model. Matching expected outcomes
checks that pipeline on those controls; it does not prove real-task discrimination,
native Skill discovery, general efficacy or adoption eligibility. Self-test and
calibration declare a null diagnostic target. Ordinary mock markers in bench
check remain informational verifier probes. These source additions have no
assigned minimum published release and do not alter the frozen statistical rules.

## L0 — bench health (guard metrics)

Bench-health diagnostics qualify interpretation; they do not silently delete tasks or
suppress the exact-test verdict. A ceiling warning is not an automatic rejection
of an efficiency comparison. Current reports separate baseline ceiling/floor,
quality headroom, efficiency eligibility and activation coverage; see the
[diagnostic contract](../../benches/README.md#reading-difficulty-diagnostics). Calibration
alone cannot qualify a cost comparison: paired variance, final cost coverage and
regression checks still apply, including for a 100%-passing baseline.

- **Ceiling**: warn when a task's baseline pass rate ≥ 90% (implemented). Saturated tasks can serve as
  regression controls with limited observed quality headroom
  ([SWE-Skills-Bench found 24/49 skills ceiling-bound](https://www.alphaxiv.org/abs/2603.15401)).
  The same rule applies per facet: a check whose baseline pass rate ≥ 90% is flagged as saturated
  (implemented).
- **Floor**: warn when baseline pass rate ≤ 10% (implemented) — the task is too hard or broken, and
  all-zero quality arms are equally uninformative for quality improvement; efficiency
  and activation need their own evidence.
- **Engagement sanity**: if the agent never engaged with the fixture, the executor errored, or the
  verifier has a process/infrastructure error, the trial is excluded from rates and reported as an error, not a failure
  (implemented). Non-engagement means the final message is empty or whitespace. For an output task
  that message is the deliverable. For a command task the deliverable is the file edit, so an empty
  message still counts when the disposable worktree differs from the fixture commit. Exclusion is *pairwise*: since
  every statistic here is paired, dropping a trial from one arm alone would misalign the (task, trial) pairs
  that McNemar and the paired bootstrap resample, so an error in either arm removes that pair from both, and
  each arm reports its `errors` count next to its graded `trials`.
  Command tasks whose disposable Git initialization/reflog verification fails are likewise
  environment errors before their executor starts; inherited disabled reflog is overridden only
  in the disposable repository. This does not change the paired exclusion or verdict formulas.

  Process errors include unspawnable commands, missing exit codes, timeouts, output
  overflow, recognized bench-owned Node uncaught exceptions and explicit
  `skillfit.verifier-error` messages. Candidate-code failures, assertions and
  ordinary nonzero exits remain graded failures. The same distinction applies
  to offline NOP/oracle gates and replay. See [verifier contract](../guides/bench-authoring.md).

A 100% baseline does not show quality lift or prove equivalence. It can still be
useful for an efficiency comparison if both arms have successes, complete costs,
no observed pass/score/check regression and all policy 2 gates pass. Baseline
calibration alone has no treatment cost comparison and cannot establish savings;
it retains its existing >=90%/<=10% bands. Goal-specific diagnostics are not
implemented yet. Tasks too hard for both arms also offer no successes for the
per-success cost endpoint.

## L1 — trigger quality (activation)

Whether the agent invokes the skill when it should, and only then. A skill's realized value is gated by this:
an unobserved activation limits what can be claimed about realized benefit. Trigger
measurement observes routing, while paired experiments measure task outcomes.
It does not grade an entire workflow or prove that loading caused a benefit.
Without `--compete-installed`, trigger mode installs one Skill alone and recall is an upper bound.
That flag copies other user-level Skills from the matrix directories; system Skills and plugins outside
those directories are not copied. Optional `triggerClass` values are `explicit`, `implicit`, and
`contextual`; unlabeled positive tasks stay in the pooled recall. Claude Code's matrix entry and
structured adapter are exercised offline with Node-only fake subprocesses; real CLI compatibility and
authentication have not been machine-verified. Codex observes a literal `SKILL.md` read command.

- **Task classes** (adopted from OpenAI's eval-skills taxonomy): `explicit` (skill named in prompt),
  `implicit` (in-domain task, skill not named), `contextual` (noisy realistic task), `negative`
  (`shouldTrigger: false` — decoy tasks measuring over-triggering). The current manifest records only
  `shouldTrigger: true/false` and optional positive `triggerClass`; class recall is reported when labeled.
- **Metrics**: trigger recall (fires on should-trigger tasks), false-trigger rate (fires on negative tasks),
  and precision (positives fired / all fired) — each a proportion over its own denominator, each with a
  Wilson 95% CI. F1 is reported **bare**: it is a harmonic mean of two proportions and has no closed-form
  binomial interval, so an interval printed for it would be invented precision rather than a measurement.
- **Detection is mechanical, per agent** (see `src/matrix/agents.json`): Kimi Code —
  `-p --output-format=stream-json` (assistant `tool_calls` events naming the `Skill` tool); Codex CLI —
  `exec --json` (no skill event exists → detection via the `command_execution` item that reads the skill's
  `SKILL.md` at a registered project path); Claude Code —
  `-p --output-format stream-json --verbose` (`--bare` forbidden: it skips skill discovery) — implemented
  in the matrix and verified with offline adapters, not a live CLI run. See the official
  [headless output](https://code.claude.com/docs/en/headless#stream-responses) and
  [CLI reference](https://code.claude.com/docs/en/cli-reference).
- **Observation protocol v2 (2026-10-21)**: matrix `wireShape` and `sessions.skillKey` select the
  format and identity field. The frozen `triggerDetection` declaration records `schemaVersion: 2`,
  wireShape, method (`skill-tool-argument` or `skill-file-read-command`),
  identityMatch (`exact-registered-identity`), sorted complete `identities` and registered `skillPaths`.
  The same declaration is retained in the reviewed/native plan, executor, each trial and summary.
  A Skill call must match the complete designated identity, never text elsewhere in its arguments.
  [Claude's directory/frontmatter naming rule](https://code.claude.com/docs/en/skills) registers those complete names; a namespaced
  identity must be explicitly registered in full. An arbitrary `plugin:review` cannot match `review`.
- **Complete observations**: a negative requires a successful process, a recognized, interpretable
  stream and its normal ending (Claude init and success result; Codex thread start and completed turn; Kimi final Assistant text
  without pending tool calls). Malformed identity arguments, truncated/unknown formats, incomplete
  streams or ambiguous commands remain unknown. Each `triggerEvidence` retains status
  (`observed`, `not-observed`, `unknown`), complete, matchedIdentity or null and one-based eventLines
  for positive observations. A positive may survive an incomplete stream; execution errors still
  exclude it from rates and retain partial usage. A public Claude failure result rejects even at exit 0.
- **Read-command scope**: Codex recognizes literal cat, numeric-range sed -n, Get-Content/Windows type and
  supported shell wrappers against registered paths in the disposable workdir (including its physical
  directory alias). Drive-qualified Windows paths may contain literal 8.3 names such as `RUNNER~1`;
  home expansion remains unsupported. This is a read-command observation, not proof of successful loading or use. Echo,
  comments and search mentions do not count as positive observations. Unsupported shell expressions,
  expansions, parent traversal through potentially aliased directories, pipelines and ambiguous reads
  remain unknown. Unknown coverage is not silently zero.
- **Historical compatibility**: missing declarations display legacy/unversioned detection; saved
  counts are not redetected or pooled across protocols. Unsupported declaration versions fail.
  Legacy direct constructors may infer a recognized format, but do not claim a frozen v2 declaration
  without a fixed wireShape. New production CLI factories declare the protocol. Existing historical
  files and frozen replay runtimes remain unchanged; corrections require a new dated record.
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
- **Environment fidelity caveats**: `--compete-installed` copies and fingerprints other
  user-level Skills from matrix directories. Default runs have no copied competitors,
  so recall is optimistic. Unlisted system Skills/plugins are not copied; inherited
  configuration is not fully isolated. Competition support is implemented, with
  this limited scope. A false activation may add context/work, but the trigger
  rates alone do not quantify its downstream quality or cost effect.

Paired installed runs may also record `skillReads` observed/unobserved/unknown
per arm using **surviving graded pairs**. These read observations are neither
trigger recall/precision nor proof of use, causation or benefit. Missing legacy
fields stay unrecorded. Single-arm trigger/calibration reports retain their own
metrics and never enter paired quality/adoption gates; see [report types](evaluation-reports.md).

## L2 — conditional efficacy (the paired A/B core)

Measured with the Skill force-injected (`eval --mode inject`, the compatible default), isolating content quality from routing.
`eval --mode installed` uses the same paired statistics but measures native discovery plus complete
Skill resources, so its delta is realized task efficacy under the recorded environment, not efficacy
conditional on guaranteed activation. Keep these delivery surfaces distinct when comparing studies.

- **ΔP** = treatment pass rate − baseline pass rate (per task, then pooled).
- **ρ** = (tokens_treatment − tokens_baseline) / tokens_baseline, input and output separately.
- **pass@1** (mean pass rate) and **pass^k** (all k trials pass — reliability the user actually pays for).
  pass@k is *not* a headline metric: it hides variance that costs real tokens in agent settings.
- Per-task tables also apply the exact discordant-pair verdict rule, but a few
  repetitions rarely support precise inference or broader claims. The headline
  interval resamples task blocks, and adoption assesses the declared bench and
  validation cohort. See [verdict protocol](#verdict-protocol-what-effective-means).

### Facet scores (graded outcome signal)

Design motivation comes from [Skill2Env](https://github.com/NVlabs/Skill2Env):
graded programmatic outcomes can be more sensitive than binary pass/fail, while
mixing subjective process rewards can harm task outcomes. See the preserved
[v2 rationale and grounding](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/metrics-history.md#original-v2-motivation-and-grounding).

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

This is a conceptual decomposition, not a computed adoption verdict or a validated
utility estimate.

`EV ≈ P(trigger | relevant) · ΔP · V − P(trigger) · C_body − P(false trigger) · (C_body + δ_derail · V) − C_metadata`

- `V` = value of one task pass (user-set; default 1), `C_body` = tokens of the loaded skill body,
  `δ_derail` = quality loss from a false trigger (bounded by observed negative deltas, up to −10pp in
  SWE-Skills-Bench), `C_metadata` = always-on routing cost ≈ 30–50 tokens/skill/turn.
- **Cost-of-pass** per arm: `v = mean cost / pass rate`; report `v_treatment / v_baseline` (replaces
  ΔP/ρ, which is unstable near ρ = 0; after the [cost-of-pass](https://openreview.net/pdf?id=vC9S20zsgN)
  formulation).
- Cost differences may be easier to resolve than binary pass-rate differences in
  some task mixtures; neither is automatically provable at a personal sample size.
  The [ETH AGENTS.md study](https://arxiv.org/abs/2602.11988) is motivation, not a
  power guarantee for another bench. Descriptive cost tables have no significance
  verdict; explicit policy 2 adds a scoped interval for uncached input per success.
  Report that endpoint and its coverage, not dollar savings or a significant
  latency effect. Quality `inconclusive` does not prove no benefit or equivalence.

## L4 — judge (soft quality, optional)

The deterministic verifier is the sole pass/fail authority; the optional judge
never flips the statistical verdict or supplies programmatic facet checks. This
keeps outcome grading separate from an advisory model's preferences.

Implemented behavior:

- Blind pairwise **AB/BA position-swapped double calls**, winner only when both
  agree; otherwise tie. Means use unanimous trials and `consistentTrials` exposes
  agreement. There is no k=3 majority ensemble: order luck can hide position bias.
- Binary `correct` / `complete` / `grounded` checklist, 0–3 per answer, rather than
  a 1–10 Likert score.
- CLI judges run in a fresh temporary directory with only anonymous `answerA.md`
  and `answerB.md`, outside the run group. The temporary directory is removed
  after judging; retained call receipts and `judge-trial-N.json` preserve evidence.
- Answers are fenced with fresh nonce-delimited BEGIN/END markers and explicitly
  labeled untrusted; the checklist is parsed from the **last** JSON object. This
  reduces accidental collisions, without eliminating prompt injection or making
  an untrusted judge authoritative.

Using a judge from a different model family and calibrating its rubric against
>=30 human-labeled examples (reporting Cohen's κ and investigating κ<0.6) remain
recommendations, not enforced gates or completed calibration. Public model
identity is recorded where observable; it does not attest model-family separation.
The κ calibration gate remains unimplemented. Background: [position bias](https://arxiv.org/abs/2306.05685),
[self-preference](https://arxiv.org/abs/2404.13076),
[binary rubric design](https://hamel.dev/blog/posts/llm-judge/index.html), and
[calibration](https://arxiv.org/abs/2406.12624).

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

Current quality/score bootstrap defaults are 2,000 resamples with Mulberry32 seed
`20260919`, alpha 0.05, drawing N surviving task blocks with replacement and
recomputing pooled arm means each time. Tasks with no graded/scored pairs are
omitted from that respective resample pool to avoid undefined means. Sorted
percentile indices use `floor(q * resamples)` (clamped to the array bounds).
These implementation details preserve the >=1,000 seeded-resample contract;
efficiency policy 2 has its distinct frozen 10,000-resample procedure below.

### Shared adoption gates

Adoption is separate from the statistical verdict. Both policies require two
complete installed versions of the same Skill, a completed native revision
experiment without excluded errors, per-task paired outcomes, verified native
receipts and a policy bound before execution. Every declared task needs at least
five surviving graded pairs and there must be at least eight tasks; a policy may
raise these floors. Both arms need successful tasks and final input, cache
partition, output and elapsed coverage for every invocation. Injected/synthetic
or unattested component runs cannot authorize adoption.

Observed paired pass, score or named-check regressions reject, including pair-level
regressions concealed by an aggregate gain. A negative overall verdict or an
exceeded declared all-invocation per-success cost cap also rejects. Rejection
reasons take precedence over missing-evidence reasons; otherwise unmet gates
give `inconclusive`. `accept` is advisory eligibility only, scoped to recorded
tasks/environment, with `automaticUpgrade: false`.

The default quality policy additionally requires a positive `effective` verdict
meeting its declared minimum gain. Policy 2 changes the primary endpoint to cost
under the additional rules below, preserving the quality verdict. Validation
purpose must be declared before calls; the declaration does not prove that tasks
were held independently from development or repeated candidate selection.
Neither significance nor the scale floor proves generalization or equivalence.
See [policy fields and defaults](eval-component.md#adoption-policy).

### Numerical integrity correction (2026-10-21)

The exact test above is unchanged. `mcnemarExactP` requires nonnegative safe
integer counts and a safe integer sum. One-direction discordance uses the exact
identity `p = 2^(1-b-c)`. Otherwise, `b+c <= 1022` retains the existing
small-sample recurrence. Larger samples sum decreasing weights starting
at the binomial mode and normalize by symmetry, avoiding the old `2^-(b+c)`
starting mass that became subnormal after 1022 and zero at 1075. Computation uses constant
auxiliary space and at most O(b+c) iterations; binary64 rounding still applies,
and a genuinely tiny tail may round to zero. Independent integer-binomial
references test accuracy and decisions near 0.05; the formula, six-pair gate,
bootstrap and adoption policy are unchanged.

Current readers reject saved zero-p records consistent with the old zero-mass
pattern when stable recomputation is nonzero or changes the verdict. They return
`RECORDED_STATISTICS_NUMERIC_ERROR` with recorded and computed statistics, rather
than silently replacing the saved p-value or verdict. This diagnoses a numerical
pattern, not the record's provenance. Correct historical records retain the
existing validation rules, including genuinely unrepresentable tiny tails.
Preserve erroneous originals and pinned runtimes; publish any correction as a
separate dated record linked to the original. See [report diagnostics](evaluation-reports.md#numerical-integrity-errors).

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

<a id="bench-composition-guidance-for-authors-and-the-upcoming-scaffolding-tooling"></a>

## Bench composition guidance

These are the targets. [bench-authoring.md](../guides/bench-authoring.md) is the walkthrough that gets a bench to
them, step by step, on one real task.

- 20–50 tasks drawn from real failures is a healthy personal bench
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)); grow from observed
  failures, stop at theoretical saturation.
- ≥30% negative-trigger tasks when measuring activation; difficulty mix roughly 50% easy / 30% medium / 20% hard.
- Adopt [SkillsBench's contribution gates](https://arxiv.org/html/2602.12670v1): human-authored prompts
  (LLM-written tasks under-measure the model), oracle solution passes the verifier at 100% (**enforced
  when registered**: `bench check` fails a task whose oracle-solved fixture does not exit 0 with every
  check passing, and emits `WARN` for a task that registers no oracle at all, since winnability is then
  unverified — live case preflight classifies that missing evidence as `UNKNOWN`,
  still nonblocking, because `bench add --freeze` legitimately produces
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
[installed-skill-evaluation.md](../guides/experiment-workflow.md) for usage and limits.

In installed mode, `--baseline-skill` selects a previous complete Skill with the
same frontmatter name and a different fingerprint. Both versions are frozen;
`baselineTarget` identifies baseline and `target` treatment, with per-trial arm
identity. A revision delta is relative to that previous Skill, not to no Skill,
and establishes neither installation benefit nor general non-regression. Without
it, baseline receives no harness-installed Skill; inherited configuration still
applies. See [revision comparisons](../guides/experiment-workflow.md).

Rules and MCP targets use the same paired statistics as Skill targets but a different treatment
mechanism. Both arms start from the same fixture and receive an identical prompt snapshot. The
baseline/treatment project overlays are applied only after that snapshot, so the local CLI must load
the configuration through its real project path. API executors are inadmissible because they cannot
observe workspace configuration. See [rules and MCP overlays](../guides/experiment-workflow.md#rules-and-mcp-overlays).

`mcp check` is a protocol and catalog preflight, not an efficacy result. It proves that a compatible
stdio server initializes and exposes structurally usable tool definitions without calling a tool.
Only a paired task experiment can support a claim that the MCP setup improves outcomes.

## Costs, budgets and stopping

`spendingBudget` / `--spending-budget` is **optional as a whole**; once supplied,
**all five fields are required**. [Planning](../guides/experiment-workflow.md)
owns their names, numeric ranges, complete example and hash binding. These are
absolute whole-batch stop lines, distinct from call counts and relative adoption
cost caps. A duration-only guard is unsupported.

The same guard applies to paired eval, trigger, calibration and both optional
judge orders. All invoked primary/judge spending counts, including failures and
excluded partners. Reaching any line prevents the **next** call; one in-flight
call can overshoot. Missing/partial/invalid final usage or an execution/guard error
stops further calls and retains known/unknown costs. No retries, replacement
samples or automatic expansion follow. A final predeclared call may complete the
cohort at a line with complete evidence. Completed audits replay chronological
before/after snapshots; elapsed limits are operational guards, not API hard caps,
adoption thresholds or provider invoices.

Known missing token/cache readers block a strict budget before calls for either
primary or judge. Among current CLI adapters, Codex has all required counters;
Kimi lacks cached-input partitioning and Claude collects no token counters.
API coverage is unknown offline and requires complete response counters at
runtime. This is skillfit reader support, not a claim about vendor capabilities.
See [capabilities](../guides/experiment-workflow.md).

SIGINT/SIGTERM stops subsequent dispatches and managed active processes, retaining
receipts and sealing the stopped prefix. Interrupted execution is ungraded;
available counters remain partial unless already final. Missing usage stays
unknown. Stopped/incomplete runs cannot authorize adoption. Read [interruption](../guides/experiment-workflow.md)
and [execution timing](../guides/experiment-workflow.md) for monotonic elapsed intervals, wall timing,
CLI deadlines and clock/observation-gap errors.

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
[evaluation cost accounting](evaluation-reports.md) for field and denominator rules.

`invocationCosts` separately records primary Agent, judge and combined spending;
judge successes are parsed grading calls and are not task successes for Agent
cost per success. Both judge orders retain prompt/output/usage receipts even on
failure. Historical missing judge costs remain unknown. API/cache readers retain
only explicit compatible counters; a malformed/failed response is not evidence
of a free invocation. Missing cache counts never become zero.

Failed JSON CLI invocations may add an identity/time-bound local numeric usage
snapshot when the matrix capability permits it. This is partial cumulative usage,
never final coverage or an accepted outcome; receipt `usageEvidence` preserves
the counter provenance without private transcript bodies. Unknown/ambiguous
metadata remains unknown, and original frozen failures are not rewritten.
Quality exclusions, verdicts and every completeness/adoption gate stay unchanged.

## Evidence and replay

Native plans freeze inputs, implementation, selected tasks, order, effective
deadlines and allowed configuration. Sealed input copies retain the original
bench/Skill/request/runtime; local copy time and storage are separate from
executor costs. Input/configuration mutation stops further calls. Paired
installed runs deliver the same pinned native diff helper to both arms; its
presence is not proof of use. Logical/physical workspace aliases in the plan may
share matrix-defined pure trust bookkeeping, but retargeting them or changing
other configuration still stops calls. Inherited configuration is not isolated.

Optional `experiment` metadata records declared/planned, started and finished
calls, the ceiling, completion state and plan hash. Judges add two declared calls
per pair. Native audit checks receipts/ledger against the plan; offline replay
regrades saved delivery with trusted verifier code. Portable packages use the
retained runtime/inputs; they make no model calls, new trigger observations or
claims of independent validation. Authentication always remains unknown offline.

Historical absence remains unrecorded; new readers do not infer old usage,
activation protocols or model identity from today's configuration. Unsupported
sub-object versions fail explicitly. Statistical formulas, policy 1/2 thresholds
and hash normalization remain unchanged. Fixed reports/replay inputs and release
records are not rewritten; any evidence correction is a separate dated entry.
See [input snapshots](../guides/experiment-workflow.md), [bounded workflow](../guides/experiment-workflow.md),
[report states](evaluation-reports.md), [preflight](../guides/experiment-workflow.md) and
[portable packages](evaluation-reports.md).

## Public model identity per invocation

New executor receipts carry optional `modelIdentity` version 1, separate from
usage and statistical populations. `configured` records an already permitted
setting, `requested` records the model explicitly sent in that invocation, and
`reportedModels` retains public response IDs with source locations. Neither
configured/requested names nor an assistant's textual self-description establish
a reported model. API success and failure retain the public response body; request
headers and API credentials are not recorded. Invalid or interrupted JSON stays
unrecorded unless a complete public model-bearing event was already received.

API observations use the response's `/model`. The matrix currently enables
Claude assistant-message observations at `jsonl:<one-based original line>:/message/model`.
Codex/Kimi surfaces without a confirmed public response field remain unrecorded;
startup model configuration is not substituted. Multiple observed IDs are retained.
These are provider/CLI declarations, not attestation of backend routing or a
complete inventory of internal/subagent models.

`modelIdentities` version 1 aggregates primary, judge and drafter invocation
coverage independently: invoked, reported, unrecorded, model IDs, and relative
receipt paths with each call's identity sources. A guard refusal that never
invoked the executor is excluded. Historical absence remains unrecorded, and
unknown/invalid receipts cannot establish positive model coverage. This does not
change token final/partial/unknown coverage, costs, quality verdicts, policy
thresholds/hashes or automatic upgrade behavior.

Frozen executor `modelIntent`, preview metadata and `_plan.json` are not rewritten
when a response arrives. The historical `servedModel: "unrecorded"` plan field is
retained; current identity is disclosed through call receipts and summaries.
Native audits bind new claims to sealed response bytes, frozen intent and the
invocation ledger; portable evaluation replay uses these saved observations and
never probes today's CLI/configuration or calls a model. Legacy receipts remain
readable without being reinterpreted. See [reading reports](evaluation-reports.md)
and [drafting records](../guides/bench-authoring.md).

<a id="non-goals-v1"></a>

## Non-goals and known limitations

- No cross-model leaderboards, hosted dashboards or trajectory-level scoring.
  Deterministic checks can observe artifacts such as a regression test, but do
  not prove TDD order, review discipline or another workflow's internal process.
  A zero outcome delta cannot exclude a process effect that was not measured.
- No validated MDE or power planner. A bootstrap half-width is not an MDE;
  inconclusive results require a new predeclared design, not post-hoc sampling
  until significant. Task heterogeneity, repeat correlation, provider drift and
  cache reuse limit generalization. Sampling remains unpinned.
- Current source supports opt-in [bench schema 2 claims and frozen measurementScope](../../benches/README.md#claims-and-measurement-scope). Schema 1 remains legacy-unrecorded; declarations do not prove validity, power or process improvements.
  Existing `bench check` mock markers remain verifier-level informational probes.
  Current source adds [bench self-test](../guides/bench-authoring.md#test-known-controls), a separate full-pipeline
  synthetic control that cannot authorize efficacy/adoption or validate real Agent
  discovery. It uses the unchanged statistics and actual retained receipts;
  a matched stopped error is a self-test success, never a completed eval verdict.
- CLI presence, offline fixtures and exported replay are distinct from live
  installed-version/authentication validation and third-party live reproduction.
  Current repository evidence does not establish an independent third-party live
  reproduction; author runs and offline replay must be labeled accordingly.

skillfit reports observations on a pinned task mixture and available model
identity. Whether to enable a configuration also requires representative tasks,
independent validation, complete costs and the chosen policy's gates. It cannot
promise a conclusive quality verdict for every budget or workflow claim.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/metrics.md).
