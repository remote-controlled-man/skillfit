# Metrics revision history through 2026-10-22

This is a historical reading aid for the additive notes formerly interleaved in
[the current metrics contract](metrics.md). The excerpts below preserve their
original wording, including superseded status claims. They are not current
capability declarations or changes to pinned reports. The current source contract
is organized by measurement, decision, spending and evidence; its v2 statistical
formulas remain frozen at 2026-09-23.

The 2026-10-22 synchronization removes the contradictory “competition is not
implemented” note from the current contract: `--compete-installed` already copies
matrix-listed user-level Skills. It does not reproduce unlisted plugins/system
Skills or isolate inherited configuration. Claude trigger capture is connected
and tested offline, not verified against a real authenticated CLI. F1/F2/F4 source
changes remain unpublished; the package version string alone is not release
proof. See [capabilities and verification scope](eval-agent-preflight.md#current-source-capability-table).

All previous metrics section anchors remain reachable in metrics.md. The
[remediation plan](plans/2026-10-21-measurement-contract-and-capability-remediation.md#f5当前契约与入口说明)
records the mapping and the pending final synchronization after F6/F7.
Published evidence, immutable replay inputs and release records retain their
original bytes, paths, Node/platform requirements and interpretations.

## Original v2 motivation and grounding

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

## Entry reviews, 2026-10-01 through 2026-10-14

Additive component review 2026-10-13: the [Agent evaluation interface](eval-component.md)
adds versioned requests, pinned previews, native receipt audits and an independent
adoption policy. `accept`/`reject`/`inconclusive` adoption decisions do not replace
or reinterpret the frozen `effective`/`ineffective`/`inconclusive` statistical verdict.
Insufficient, stopped, synthetic or unverified evidence cannot authorize adoption;
the component never upgrades a Skill. Complete cost coverage is separate from
quality significance. All formulas and legacy manifest interpretations below remain unchanged.

Operational Agent preflight (version 0.11.0): eval preview and dispatch
check executable files, declared matrix capabilities and global same-name Skill
conflicts, keeping authentication explicitly unknown offline. Known failures
block before case probes, native run creation and calls. Sealed checks are
read as historical metadata during reporting/replay, not rerun on today's
machine. This adds no observations, environment isolation or adoption authority;
statistics, cost coverage and acceptance thresholds remain unchanged. See
[Agent environment preflight](eval-agent-preflight.md).

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

## Execution and planning additions

Operational interruption handling (2026-10-16, included in 0.10.1): SIGINT/SIGTERM
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
the chronological receipts. Current source extends these stop lines to calibration,
trigger runs and both judge orders, retaining each role's usage and controlled
stop codes. This is
an operational stop rule, **not** an API hard cap, adoption threshold or new
statistical protocol; exclusions, formulas, policies and old records remain
unchanged. See [the component contract](eval-component.md#input-and-execution).

Entry-point alignment (version 0.11.0): ordinary paired eval and Agent
requests share effective plans, spending limits and primary executor deadlines.
Ordinary JSON execution requires preview confirmation; ordinary native plans
also seal and audit the reviewed parameters. Request `baselineSkill: null`
selects no harness-installed baseline Skill, preserving installation-benefit
measurements with `REVISION_COMPARISON_REQUIRED` and no revision adoption
eligibility. Existing path requests, evidence, statistics, exclusions and
acceptance policies keep their meaning. See [shared planning](eval-planning.md).

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

## Task selection

Task selection (2026-10-16, 0.10.0): repeated CLI `--task` or request `taskIds`
restricts the evaluated population before calls. Native plans bind selected IDs
and manifest order while keeping the full bench hash. Planned calls, observed
costs and task counts use only that population. Empty, duplicate, unsafe or
unknown IDs are rejected. No statistical formula, eight-task/five-pair floor,
independence requirement or historical verdict changes; a selected small subset
remains indicative. See [case management](case-management.md).

## Verifier correction

Verifier correction (version 0.11.0): process errors include an
  unspawnable command, no exit code, timeout and output overflow. Recognized
  bench-owned Node uncaught exceptions and explicit `skillfit.verifier-error`
  messages also represent no grade, even with a numeric exit code. The same
  classification blocks offline NOP/oracle probes and rejects an errored replay.
  Candidate-code failures, assertions and ordinary nonzero exits retain normal
  task-failure semantics. Costs and raw diagnostics remain recorded; existing
  pairwise exclusions, statistical formulas and acceptance thresholds are
  unchanged. Historical receipts are not rewritten. See [verifier contract](verifier-contract.md).

## Reporting and managed-session additions

Operational reporting correction (version 0.11.0): `report eval`
dispatches paired, baseline-calibration and trigger summaries separately.
Calibration preserves recorded session status and existing >=90%/<=10%
difficulty bands. Trigger reports retain the existing count denominators, Wilson
intervals and unknown/error exclusions. Neither single-arm report enters paired
quality/adoption gates; no statistical formula or historical receipt changes.
See [report types](evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101).

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

## Superseded competition note

- **Environment fidelity caveats**: routing quality depends on the *whole installed skill set* (lexical
  competition). (Status: **spec, not implemented** — the harness installs only the skill under test into an
  otherwise empty sandboxed skills directory, so measured recall is *optimistic*: it faces no competition from
  the user's real set. Reproducing that competition means fingerprinting and copying a user's installed skills
  into a sandbox, which raises privacy questions this project has not settled; it is tracked as a future
  enhancement rather than built here. Read trigger recall as an upper bound until then.) A triggered skill
  cannot unload mid-session — one false trigger taxes the rest of the session, which is why false-trigger rate
  is a first-class metric.

## Bench preflight and input-snapshot additions

Operational correction in 0.10.1: the API executor retains explicitly reported
Chat Completions cache counts, preserving absent/invalid values as unknown.
Markdown and JSON reports share native audit, cost coverage and acceptance
assessment for files, run directories and portable packages. These changes do
not alter cost populations, statistical formulas, acceptance policy or historical
receipts. See [report inputs and statuses](evaluation-reports.md).

Operational gate (included in 0.10.1): live `eval` reuses offline bench
integrity checks before dispatch, scoped to selected tasks (labelled tasks in
trigger mode). Hard failures block all agent/judge calls. Missing oracles and
other unmeasured coverage are explicit `UNKNOWN` diagnostics; observed concerns
remain `WARN`. Neither blocks calls nor counts as passed evidence. The native
plan retains probes and separate offline elapsed time; previews mark checks
pending. This changes no statistical verdict, cost population or adoption rule.
See [the preflight contract](eval-case-preflight.md).

New native sessions also [seal input copies](evaluation-input-snapshots.md) before
dispatch. The archive's index/fingerprints bind to the frozen plan; offline replay
uses its bench and portable export uses its Skill/implementation/request copies.
Local copy time and apparent storage are separate from primary-agent token and
duration populations. Missing historical copies remain unrecorded; snapshots do
not create new observations, complete partial usage or change adoption gates.

## Efficiency release clarification

Release availability reviewed 2026-10-14: policy version 2 ships in 0.9.0.
This availability update changes no formula, evidence gate or acceptance threshold.
The legacy section anchor remains available for existing links.


## Original judge recommendations and implementation status

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
