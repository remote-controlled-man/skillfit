# Changelog

## 0.13.1 — current driver guidance and release document checks (2026-10-21)

- Correct stale fixed-version commands in the driver Skill and first-run guide;
  synchronize current installed examples and release links. Preserve historical
  feature minimums and immutable release evidence.
- Explain explicit pinned archive restoration and the existing
  `--compete-installed` scope. Add package/install-time checks for current
  documentation versions so stale Skill commands block release validation.
  See the [0.13.1 release record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md).

## 0.13.0 — protected installation and lean archive delivery (2026-10-21)

- Separate installation file transactions from command planning. Preserve CLI
  behavior and backups; prevent first-backup overwrite races and retain primary,
  rollback and cleanup errors with recovery copies.
- Move 19 historical compressed archives out of npm packages starting with 0.13.0. Add an
  explicit pinned, hash-checked restore tool with previews and offline local
  sources; keep Git originals, frozen replay support and published releases.
  See [archive restoration](docs/maintainers/archive-delivery.md) and the
  [0.13.0 release record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.0.md).

## 0.12.0 — reliable case authoring and evaluation costs (2026-10-17)

- Unify bundled/local bench resolution for eval and read-only check/list/show/
  calibration. Preserve explicit broken-path errors and local precedence; keep
  bench writers on local paths. Add an npm-only offline first-run walkthrough,
  packaged-command regressions, current driver guidance and mirrored README steps.
- Preserve API-reported counters and raw response evidence before rejecting bad
  answer formats, malformed JSON or HTTP failures. Keep supplied final fields,
  unknown missing fields, ungraded errors and stop-without-retry behavior through
  primary/judge receipts and stopped reports. Do not backfill historical usage.
- Read structured CLI output/usage in ordinary paired runs and CLI judges,
  separately from optional Skill detection. Prefer existing matrix streaming
  templates; retain normal text, raw evidence and partial failure counters.
- Add offline `USAGE_CAPABILITY` checks for strict budget compatibility across
  primary/judge/calibration roles. Known missing counters block before spending;
  API/injected coverage stays unknown and existing runtime guards remain strict.
- Align bench fingerprints with sealed snapshots by excluding Git metadata,
  including worktree files; retain actual case bytes and reject metadata as a
  declared task input. Git-root benches can complete, audit and replay.
- Reject output inside bench/Skill/configuration/runtime inputs or Git metadata
  during preview and again at setup, resolving aliases and uncreated descendants.
  Preserve existing outputs and make no verifier or executor calls for bad layouts.
- Bound frozen case imports to ordinary selected files: never fall back from an
  empty/broken Git index, require `--include` outside Git, reject links and
  destination-bench inputs, and cap fixtures at 200 files / 1 MiB.
- Confirm before the single `--decompose` call. Support explicit budgets, executor
  deadlines and record groups; retain original inputs, public outputs, reported
  costs and gate failures. Stop process trees on interruption, preserve concurrent
  bench edits, and never retry or upgrade automatically.
- Add optional per-case `verifierTimeoutSeconds` (1–3600; default 120) consistently
  across verifier/oracle checks, evaluation, calibration, trigger mode and replay.
  Expose it through case import and manifest editing without changing old defaults.

## 0.11.0 — complete basic evaluation workflow (2026-10-17)

- Block calibration before spending when case integrity or Agent environment
  checks fail; preserve warnings/unknowns and recheck after local probes. Add
  reviewed JSON calibration plans, selected tasks, deadlines and spending limits.
- Cancel standalone bench verification/oracle work and offline delivery replay,
  including their process trees. Reuse nested cancellation scopes and retain
  original run evidence; no retry or extra model observations.
- Give trigger runs the same reviewed JSON plans, deadlines and token/time stop
  lines. Pin full installed resources and competition in plans. Retain monotonic
  elapsed time, invocation state and final/partial/unknown usage per receipt.
- Retain independent receipts for both judge orders, including failed parsing,
  partial usage and interruption. Show primary/judge/combined invocation costs;
  include all roles in spending stops. Explicit unavailable judging blocks.
- Export and audit calibration, trigger and paired-with-judge native evidence.
  Portable replay uses original sealed inputs/runtime and local verifiers only.
  Historical missing judge usage remains unknown; single-arm verification never
  becomes paired efficacy or upgrade eligibility.
- Add cross-entrypoint, cancellation, spending, moved-package and evidence
  tampering regressions, public machine schemas and updated workflow guidance.
  Keep zero runtime dependencies and the existing statistical/adoption protocol.

### Included: offline Agent environment preflight (2026-10-16)

- Check selected primary/judge CLI executables via filesystem PATH lookup and
  match declared matrix capabilities before case probes, run creation or calls.
  Preserve preview without execution, with explicit ready/blocked check results.
- Expose the existing global same-name Skill contamination block in previews,
  including directory/frontmatter aliases and matrix home overrides. Keep login
  UNKNOWN offline; no auth files, login/version commands or network probes are
  used by this check. Unreadable/unlisted Skill scopes remain unverified.
- Bind deterministic checks into paired plans, recheck after case probes and
  seal results with native evidence. Reports and portable replay retain original
  checks without probing the current machine. Keep injected/synthetic evidence
  restrictions, costs, statistics, acceptance and old records unchanged.
- Add offline regressions, schema, shared preflight guide and mirrored README
  updates. No runtime dependencies or real model evaluations were added.

### Included: verifier errors and quoted commands (2026-10-16)

- Share a shell-free quote-aware parser across bench validation, verifier/oracle
  probes, evaluation and replay. Preserve spaced/empty arguments and Windows
  separators; reject malformed quotes without spawning or enabling expansions.
- Recognize bench-owned direct Node load/syntax/runtime exceptions and explicit
  version-1 `skillfit.verifier-error` messages. Fail offline gates even without
  an oracle; exclude errored trials/pairs instead of scoring model failures.
  Retain actual exit codes, raw diagnostics and all invoked spending. Legacy
  exit-only failures, assertions and candidate-code failures keep their meaning.
- Reject errored verifier replay even when its exit code matches the saved
  failure. Add offline regression tests, a command/error contract and mirrored
  README guidance. Existing statistics/acceptance gates and historical evidence
  remain unchanged. No runtime dependencies or real model evaluations were added.

### Included: shared eval plans and no-Skill request baselines (2026-10-16)

- Use one read-only plan generator for ordinary paired eval and Agent requests.
  Add ordinary `--json`, budget-file, deadline, pair-order and output-group flags;
  JSON execution requires the same entry's preview hash and an explicit group.
  Seal ordinary reviewed plans and audit their effective parameters.
- Accept explicit `baselineSkill: null` in version-1 requests, installing the
  complete candidate only in treatment. Existing path requests remain valid;
  omitted/invalid baselines fail. Retain improvements, regressions and costs
  without relaxing revision adoption gates or inherited-configuration limits.
- Apply explicit deadlines to API calls too; expose effective defaults (CLI/
  requests 600s, API 120s). Freeze parsed spending limits, retain incomplete costs
  and stop without retries. The completed release also applies shared limits to
  trigger, calibration and judge calls as described above. Add offline
  confirmation, delivery, stop-line and delete-original/export/replay regressions,
  mirrored README guidance and the shared planning contract. No dependencies,
  statistical changes or real model calls.

### Included: calibration and trigger report dispatch (2026-10-16)

- Resolve calibration `_calibration.json` and trigger v1 manifests before the
  paired report path. Markdown/JSON show the same recorded state and type-specific
  metrics; completed calibration is no longer mislabeled stopped. Missing final
  summaries stay stopped/incomplete, with no fabricated aggregate metrics.
- Add descriptive `skillfit.calibration-report` and `skillfit.trigger-report`
  JSON kinds. Retain difficulty bands, baseline usage coverage, trigger rates and
  Wilson intervals, class/competition/detection context, and unknown/error counts.
  Reject inconsistent summaries and incompatible paired options.
- Keep paired requests, report contract, statistical/adoption policy and original
  receipts unchanged. Single-arm summaries remain unverified/ineligible and do
  not enable portable replay exports. Add offline regression tests and update
  mirrored READMEs and workflow guides. No runtime dependencies or real model evaluations were added.

## [0.10.1] — 2026-10-16

- Read chat-completions `usage.prompt_tokens_details.cached_tokens` into cached
  input costs and budget checks. Preserve explicit zero; missing, malformed,
  fractional or incompatible counts stay unknown. Never double-count cached
  input, invent billing or backfill published evidence.
- Use one saved-evidence assessment for Markdown and JSON reports. Both accept
  manifests, native run directories and portable packages, including stopped or
  incomplete batches, and support `--replay`, `--records` and `--policy`. Retain
  available costs and show audit/acceptance reasons; rendering is not adoption.
- Ship the interruption, offline case-gate and sealed-input fixes described below.
  Add offline regressions, a reproducible installed-feature smoke recipe and
  operational documentation. No runtime dependencies, real model calls,
  automatic upgrades or statistical-policy changes.
- See the [release record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.10.1.md) for publication status and
  verification. Historical evidence and release receipts remain unchanged.

## 0.10.1 details — seal evaluation inputs before dispatch (2026-10-16)

- Copy and hash-verify the full pinned bench, target, previous Skill, compiled
  implementation and component request in fresh native sessions before dispatch.
  Preserve empty directories and executable bits, bind the snapshot index in
  the frozen plan, and fail setup with zero calls if sealing cannot finish.
- Native replay and portable export default to sealed inputs after originals
  are edited, deleted or moved. Reject damaged snapshots without silently using
  current originals or overrides. Historical runs retain matching-root recovery;
  published evidence is never rewritten or backfilled.
- Keep original-input/configuration drift guards and collision protection;
  also guard snapshot integrity between calls. Record local sealing time,
  file/byte counts and zero model calls separately from agent cost populations.
  Global configuration/Skill contents remain fingerprint-only.
- Add offline regressions for deleted originals, moved runs, full Skill/request
  retention, stopped costs, portable replay, historical recovery, corrupted
  snapshots, empty fixtures, executable files and zero-call setup failure.
  No runtime dependencies, new real evaluations or verdict change.

## 0.10.1 details — enforce offline case gates before eval (2026-10-16)

- Run selected cases through offline integrity checks before any live eval
  agent/judge call, including installed revisions, configuration and trigger
  modes. Reject hard failures and changed inputs without creating a run. Dry-run
  remains side-effect-free and declares required checks pending.
- Distinguish observed warnings from unknown winnability/mock coverage and live
  difficulty. Preserve inapplicable probes as information; ready means only zero
  hard failures. Freeze diagnostics and offline elapsed time in native plans,
  return structured JSON failures and retain results through offline export/replay.
- Fail incomplete mock verifier probes instead of treating process failure as an
  ordinary negative example; identify omitted mock arms explicitly. Preserve
  standalone bench-check version 1 statuses, including no-oracle warnings.
- Add offline regressions for zero-call gates, scope, input drift, previews,
  warning/unknown separation, request JSON, process interruption and portable
  retention. Use real-output assertions in old test fixtures instead of always-pass
  verifiers. No dependencies, new model calls or verdict-policy change.

## 0.10.1 details — reliable evaluation interruption (2026-10-16)

- Handle Ctrl+C/SIGTERM across live paired, request, trigger and calibration
  evaluations. Stop subsequent calls, terminate managed CLI/verifier/judge process
  trees and abort local HTTP requests. Preserve exit 130/143 after sealing.
- Retain available outputs, partial/unknown or already-final usage, the original
  ledger, stopped session, interruption metadata and artifact hashes. Preserve
  interrupted judge output/usage separately without claiming complete judge costs.
  No automatic retry, replacement, new efficacy verdict or upgrade occurs.
- Add offline fake-process/fetch regressions for tree cleanup, retained costs,
  repeat signals, between-call cancellation, stopped-package replay, exit codes
  and signal-handler/context cleanup. No runtime dependencies or real model calls.
  Included in 0.10.1; the immutable npm 0.10.0 archive is unchanged.

## [0.10.0] — 2026-10-16

- Select cases with repeatable `eval --task` or request `taskIds`. Freeze selected
  IDs/order and full bench hash; reject invalid selections before calls. Preview
  and costs count the selected population; small samples stay indicative.
- Add JSON-capable `bench list/show/edit/remove`. Edits/removals preview by default,
  apply with `--yes`, back up and validate the manifest. Preserve unknown metadata
  and all task files; prevent removal of the final task. Reject symlink backups.
- Export paired native evidence without a judge as a portable offline directory:
  matching inputs, unchanged receipts, pinned compiled CLI, checksums and a replay
  entry point. Refuse missing/changed inputs and existing destinations; preserve
  stopped runs and partial/unknown costs. Export only writes locally.
- Include the post-0.9.1 code-edit starter, JSON bench checks, spending stop lines
  and retained experiment evidence described below. Update CLI help, mirrored
  READMEs, Agent driver and operational contracts. Zero runtime dependencies,
  no new real model calls, unchanged statistical gates and no automatic upgrade.
- See the [release record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.10.0.md) for source, checks and publication
  verification. Historical experiment and release records remain unchanged.

## 0.10.0 details — machine-readable bench checks (2026-10-16)

- Add offline `bench check --json` with a version 1 contract and JSON Schema.
  Every gate carries a stable code, status, task ID, related location and
  actionable warning/failure guidance. Process evidence retains the actual
  command, exit code, named verifier checks and the last 8,192 output code units.
- Preserve human output and existing validation rules. JSON stdout contains one
  document; exits 0/1/2 distinguish no failed gates, failed gates, and incomplete
  checks / option errors. Warnings remain visible. JSON mode rejects calibration,
  including calibration previews, before executing any verifier or agent.
- Add offline regression coverage and mirror the README examples. No live model
  calls, runtime dependencies, statistical-policy changes or npm release.

## 0.10.0 details — case authoring and evidence maintenance (2026-10-15)

- Add `bench init --kind command` to scaffold a code-editing case with a broken
  fixture, protected tests, independent behavioral verifier and reference repair.
  The existing output template remains the default. Generated next steps preview
  at most two calls; no model is called while scaffolding or checking the case.
  The starter is synthetic and must be adapted to the user's real task.
- Add optional request-based `spendingBudget` guards for all five batch cost
  measures. Retain a stopped run and prevent later calls when a limit is reached
  or complete final usage is unavailable; a call already in flight may overshoot.
  This source feature is not part of the published 0.9.1 archive.
- Retain the eight-task offline validation, the independent correctness-regression
  stop at 12/80, and the failed receiver probe at 1/2, with portable offline
  replay packages. The study totals 195 actual calls; seven historical final
  usages remain unknown and no candidate qualifies for adoption.
- Move the long experiment history to the maintained
  [evidence index](docs/maintainers/archive-delivery.md). Refocus onboarding and the
  roadmap on authoring cases for users' own tasks. No further model calls or npm
  publication are included.

## 0.10.0 details — bounded mechanism evidence (2026-10-15)

- Retain exactly four authorized development calls: original/v4 both pass 2/2,
  with v4 uncached input down 27.76%, output 17.56% and time 15.92%. Agents
  actually use the common native diff helper in 4/4 runs, displaying five patches.
  A dependency-free offline archive regrades every delivery and reproduces costs,
  adoption gates, startup warnings and all 182 cumulative calls, including seven
  earlier unknown usages. This reused task cannot establish stable improvement
  or causal helper savings; acceptance stays inconclusive and no further calls
  or independent validation are authorized. See the [report](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/evidence/2026-10-15-native-diff-mechanism.md).
- These evidence files follow the immutable npm 0.9.1 publication; no new package
  publication, runtime change, dependency or acceptance-policy change is included.

## [0.9.1] — 2026-10-15

- Prepare a manual, default-dry-run GitHub Actions npm release workflow with
  OIDC, exact-archive checks, version reuse protection and verified registry
  installation after publication scanning. Add offline regression checks;
  see the [maintainer procedure](docs/maintainers/architecture.md).
- Verify the first real GitHub Actions OIDC publication: registry version/latest,
  exact archive, 2,333 installed files, CLI smoke, registry signature and source
  attestation all pass. Retain the original workflow timeout and a separate
  read-only verification timeout; the original run remains failed. See the
  [publication receipt](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.9.1-verification.json).
- Align package and lockfile versions at 0.9.1 for the first reviewed OIDC
  publication. Runtime behavior, evaluation policies and dependencies are unchanged;
  see the [release guide](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.9.1.md).

## [0.9.0] — 2026-10-15

- Release the Agent-callable evaluation component, installed old/new Skill comparison,
  explicit efficiency policy, bounded execution and offline receipt replay as
  `skillfit@0.9.0`; see the [release guide](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.9.0.md).
  The [registry installation receipt](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.9.0-verification.json)
  pins the published archive. No automatic Skill upgrade is included.
- Supply identical pinned native untracked-file diff tools in new paired installed
  evaluations. Preserve output, native exit status and errors; retain old evidence
  compatibility. Offline delivery tests do not establish live adoption or net savings.
- Publish the four-call reading development rejection and numeric cost review:
  uncached input +34.35%, no observed check regression, 178 cumulative executor
  calls and seven earlier missing public final usages. Correct the broad 50-empty-diff
  scan to 19 missing patches plus 31 legitimate check-only traces, without changing
  old evidence or adoption gates. The narrowed draft remains unvalidated.
- Align the package and lockfile root version at 0.9.0 without changing dependencies.

## 0.9.0 details — Agent evaluation component

- Retain the user-requested recovery spending stop with one ungraded invocation, 79 uninvoked entries and exact offline receipt/cost replay. Account for all 174 cumulative calls, keep partial and unattested readiness counters separate, and leave the subsequent development proposal unexecuted without any upgrade claim.
- Publish compressed, dependency-free replay packages for stopped and completed debugging development cohorts. Preserve v3 rejection, v4's concrete repair, all increased costs, partial-failure supplements and unchanged earlier evidence; no stable improvement or automatic upgrade is claimed.
- Preserve known v4 regression controls and the first independent validation interruption in a separate offline replay package: LRU point savings, normalize-url cost rejection and diagnosed clamshell sleep retain all costs without grading incomplete work or claiming stable improvement.
- Recover best-effort partial usage for failed Codex JSON calls using a matrix capability, exact thread/workspace/time binding and cumulative numeric counters. Preserve counter provenance without private bodies; errors remain excluded and partial coverage cannot authorize adoption. Existing failure receipts stay unchanged.
- JSON requests can declare a symmetric `executorTimeoutSeconds` (default 600, maximum 3600). Preview/native plans pin the deadline and receipt audit checks it; changing it requires a fresh batch without replacing earlier timeouts.
- Add explicit policy version 2 (`objective: "efficiency"`): whole-task, fixed-seed cost bootstrap, broad per-task savings and all usage-partition caps, retaining every correctness/evidence gate. Version-1 normalization/hashes and positive-quality requirements stay compatible; a quality tie is never relabeled as a quality improvement, and no upgrade is automatic.
- JSON requests can opt into `pairOrder: "balanced"`; first arms alternate across tasks and trials while pairs remain adjacent. Preview/native plans pin the strategy, manifests record it, and offline audit checks actual ledger order. The baseline-first default and statistical verdict formulas remain compatible.
- Add four historical minipass development tasks and eight independent p-map/quick-lru validation tasks, with pinned source, dependency-free offline execution, public outcome checks and executable regression replay. Offline gates establish benchmark integrity, not model efficacy.

- Accept a strict version 1 request with `eval --request`, return a JSON preview,
  and require `--plan-sha` before real calls. Freeze the request and inline policy
  with the native session while reusing installed old/new Skill evaluation.
- Return JSON quality changes, observed task/check regressions, complete agent
  invocation accounting and a separate adoption policy. Incomplete, stopped,
  synthetic or unverified evidence cannot authorize adoption; no upgrade is executed.
- `report eval --json` audits native inventory, hashes, paired receipts and costs;
  `--replay` verifies cloned deliveries offline. Retain stopped-run partial spending
  and unknown usage when no final manifest exists. Statistical verdicts are unchanged.

## 0.9.0 details — Skill revision evaluation and reproducible evidence

- `eval --mode installed --baseline-skill <previous>` compares two complete versions of
  the same Skill with identical task prompts. Plans, manifests and receipts pin both
  versions; source drift stops execution. Reports identify observed task regressions.
- Record cached and uncached input, output, elapsed time and usage coverage for both
  graded pairs and all invocations. Preserve partial usage from failed calls and keep
  missing usage unknown. These measurements do not establish a dollar bill.
- Use monotonic trial timing, retain wall timing and detect CLI observation gaps or
  clock discontinuities. Check deadlines on heartbeat, output and process close;
  terminate the process tree and bound pipe draining. Pin logical and canonical
  workspace aliases without exempting unrelated configuration changes.
- Add the pinned `oss-normalize-url` historical failure bench and retain the original,
  compact v1 and v2 comparison evidence, including failed recovery stages. Track the
  frozen compiled replay files so a clean checkout can reproduce saved outcomes.
  See the [experiment handoff](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/plans/2026-10-13-skill-experiment-cleanup.md) and
  [script navigation](https://github.com/remote-controlled-man/skillfit/blob/main/tools/README.md). This work does not implement automatic
  Skill evolution or an adoption gate; statistical verdict semantics are unchanged.

## 0.9.0 details — Streamable HTTP MCP preflight

- `mcp check` accepts transport `http` for a Streamable HTTP endpoint. It still does not call a tool.
  Cursor, Gemini CLI, and OpenCode adapters remain open until their official paths are verified.
  Claude Code trigger capture is still not machine-verified.

## [0.8.0] — 2026-10-11

Published to npm as `skillfit@0.8.0`. `npx skillfit` installs that release. A clone can still be built with `npm ci` and `npm run build`.

- `--compete-installed` copies other user-level Skills into a trigger trial. Without it, recall is an upper bound. System Skills and plugins outside the matrix directories are not copied.
- Positive trigger tasks may set `triggerClass` to `explicit`, `implicit`, or `contextual`. Unlabeled tasks stay in the pooled recall.
- Codex trigger runs say that detection counted a `SKILL.md` read. Installed-mode reports separate a long-body read from the task result. A run below 8 tasks × 5 graded pairs is not an installation recommendation.
- Claude Code trigger capture, Cursor / Gemini CLI / OpenCode adapters, and a hosted dashboard remain open.

## Unreleased — record what trigger and publication do not yet cover (2026-10-11)

- State in the README roadmap, metrics protocol, and installed-Skill guide that trigger recall is an
  upper bound, Codex counts a `SKILL.md` read, and `installed` mode does not separate description
  discovery from reading the long body.
- Record that the eight-skill study, the 67-Skill catalog, and the 13-Skill starter set are not an
  installation recommendation. Stop the driver Skill from suggesting `npx skillfit`.

## Unreleased — measurement and write-path fixes (2026-10-11)

- Exclude an empty final message from graded rates as an engagement error. A command task still
  counts when the disposable worktree changed. Bootstrap confidence intervals drop tasks that have
  no graded survivors, so a small bench cannot report `NaN`. Δscore keeps a trial only when both
  arms produced a score. Cost-of-pass is printed only when both arms recorded every token field.
- `bench add` backs up a file it overwrites and restores the bench if the write or the post-write
  check fails. Rules and bridge files are not written through a symlink.
- Codex skills installed at `$CODEX_HOME/skills` (default `~/.codex/skills`) are visible to doctor,
  report, and bundle export. Kimi session usage follows the matrix `KIMI_CODE_HOME` override and
  ignores that variable when a test injects a home directory. The Claude `AGENTS.md` bridge path
  and import line come from the matrix.
- Agent and verifier output captures are bounded. Verifier and git processes see EOF on stdin.
  API token counts are accepted only when they are finite numbers. The CLI version is read from
  `package.json`.
- On Windows, a run directory on another drive is not treated as nested inside an input, bench
  text stays LF, and the historical-test reporter is loaded by file URL.

## Unreleased — installed delivery, bounded runs, and OSS benches (2026-10-09)

- Compare a complete installed Skill in paired workspaces (`--mode installed`), and record the
  installed-file fingerprint separately from the injectable bundle hash.
- Freeze a bounded experiment plan, call ledger, and receipts. `--max-calls` rejects a plan above
  the ceiling; input drift or an executor failure stops further calls.
- Exclude command trials whose disposable Git setup fails, and normalize an inherited disabled reflog
  inside that repository only.
- Add the pinned `oss-lru-cache` historical-failure bench. Regressions must pass the upstream
  reference, cancellation reasons are graded as recorded, and calibration can retain the native
  transcript.

## Unreleased — README localization and identity (2026-10-09)

- Keep English and Simplified Chinese as the maintained README languages and localize the evidence
  diagram for each. Remove the three other translations after reviewing maintenance scope.
- Add a compact SVG mark shared by both READMEs. Replace illustrative outcome counts in the diagram
  with a process illustration that does not imply an unpublished experiment result.
- Include linked documentation and SVG assets in the npm package so its rendered README can load them.

## Unreleased — review follow-up (2026-10-01)

- **D1:** Trigger experiments now record a separate complete installed-file fingerprint and file
  list, including scripts and binary assets, in manifests and trial receipts. Verify every copy before
  execution, reject unpinnable nested links, and mark legacy installed fingerprints as unrecorded.
  Injectable bundle hashes and statistical calculations keep their existing meaning.
- **D2:** Eval and baseline calibration share early integer/range validation for `--trials` (1–20).
  Reject fractional and malformed values instead of truncating calibration repetitions; preserve
  existing defaults, and synchronize CLI help and all five README languages.
- **D3:** Align the bench authoring guide with the current observed CI half-width wording and
  explain that collapsed pass-rate or score intervals do not establish zero uncertainty.

## Unreleased — real OSS task evaluation

- Add `--input workspace` to paired CLI evaluations and baseline calibration,
  with recorded presentation, a calibration dry-run and initial-prompt estimates.
- Honor issue prompts in commit imports instead of always exposing fix messages.
- Render checks, graded scores, usage coverage and bounded installation next steps
  in read-only evaluation reports; keep the statistical verdict protocol unchanged.
- Add a licensed, pinned mcp-use UTF-8 replay and pinned Matt evaluation input,
  plus a real-task workflow guide. The replay is a regression/workflow example.
- Independent review tightened workspace executor preflight, usage/score evidence
  consistency, completed-pair scale labels and CI half-width interpretation.
- Warn when either the pass-rate or graded-score bootstrap interval collapses;
  statistical calculations and verdicts are unchanged.

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are when the work landed on `main`.

## [Unreleased]

- Preserve the routing-interrupted followup with 46 completed delivery regrades, one ungraded execution error, 33 uninvoked entries and unknown failed-token cost. Keep individual cost increases, all 172 cumulative executor calls, the unavailable efficiency interval and unchanged ineligible decision reproducible offline.

- Add eight prospective p-debounce, debounce and humanize-duration defects with exact source pins, controlled timing, public outcomes and executable regression witnesses. A separate fixed followup preserves original/v4 resources and the 10% policy; earlier inconclusive/negative evidence and cumulative spending remain visible.

- Retain the completed 80-call independent original/v4 comparison and a dependency-free replay archive: 40/40 passes per arm and aggregate savings still receive an ineligible `inconclusive` decision because the frozen 10% conservative reduction bound is unmet. Preserve individual cost increases, all 125 study calls, unknown authoring/billing costs and an exact v4 procedural reproduction request.

Graded facet scoring and verifier/oracle acceptance gates, informed by a Skill2Env review
(see `docs/reference/metrics.md` v2). The exit code remains the sole pass/fail authority; the McNemar verdict
protocol is unchanged.

### Added

- **Community evidence gate:** CI now discovers contributed benches and runs their offline checks on
  macOS, Linux, and Windows. The evidence issue template requests pinned target and bench hashes, the
  full NOP/oracle result, executor identity, manifest, and limitations. Contribution guidance now
  distinguishes offline integrity from a separate live-agent reproduction; a dated first-check example
  records what the bundled bench checks do and do not prove.
- **Shareable evaluation report:** `skillfit report eval <manifest.json>` renders an existing
  schema-v4 paired experiment as read-only Markdown with provenance hashes, per-task pass and error
  counts, verdict, McNemar p-value, paired-bootstrap interval, and warnings. Older schemas and missing
  or inconsistent report fields fail explicitly. A synthetic sample runs offline in three-OS CI;
  the sharing guide and an opt-in bench-check workflow show how to review results without calling a model.
- **Cross-platform first run:** the five README quick starts now use the same Bash/PowerShell-safe
  commands from a fresh clone through two offline bench checks and read-only plans. CI exercises the
  first-run eval plan on macOS, Linux, and Windows. The selectable Codex setup guide leads with the
  native Node CLI and keeps the Bash wrapper optional. An October 2026 delivery plan records the
  next reporting and community-evidence gates.
- **First-class rules and MCP A/B experiments:** `skillfit eval` now accepts a directory containing
  `skillfit-experiment.json` plus baseline/treatment workspace overlays. Both arms receive the same
  task prompt and fixture snapshot; the overlay is applied afterwards so local agent CLIs discover
  `AGENTS.md`, `.codex/config.toml`, `.mcp.json`, or matrix-defined equivalents through their normal
  project loader. Config experiments require a CLI executor and validate the treatment path against
  `src/matrix/agents.json`. Run manifests upgrade to `schemaVersion: 4` and record a typed evaluation
  target (`skill`, `rules`, or `mcp`) with its content hash and file list.
- **Read-only MCP preflight:** `skillfit mcp check <spec.json>` launches a newline-delimited stdio MCP
  server, negotiates the 2025-11-25 initialization lifecycle, requests `tools/list`, and audits unique
  tool names, descriptions, object input schemas, and annotations. It never calls a tool. Dry-run
  output withholds argument values. The paired outcome experiment remains the proof of model lift.
- **README product tour:** all five README languages now share a maintainable SVG evidence-loop
  diagram, MCP/rules quick start, the eight-command table, and links to the new configuration
  experiment guide.

- **Portable Codex setup:** `bundle export` captures frequently used user Skills and active global
  guidance in a transferable profile with a standalone Node installer. Installation writes a managed
  global `AGENTS.md` block, preserves existing content, checks `CODEX_HOME` and active overrides,
  copies binary Skill assets, and verifies every written file. User-invoked-only Skills remain
  explicit-only in the generated routing guidance.
- **Pinned upstream Skill sources:** `bundle export --upstream-lock` selects the lock's GitHub Skills
  and local Skills as a portable set. On the new machine, the standalone setup fetches the GitHub
  files from exact author commits, checks their SHA-256 hashes and invocation policy, then runs the
  existing safe install plan. The reviewed Codex lock records 65 upstream and two local Skills;
  the personal bundle stays outside Git.
- **`docs/guides/bench-authoring.md` — the authoring guide (A11).** The paradigm was complete and well-sourced
  but had no single home: `docs/reference/metrics.md` carried the *why*, `benches/README.md` the *what*,
  `benches/contrib/README.md` the *how to submit*, and the two bundled benches the *what one looks
  like*. The mainline — the seven steps, why each is non-optional, one task walked end to end — was
  reconstructable only by reading all four and reconciling them, and the reconciliation did not hold:
  the examples contradicted the reference and the gates did not enforce the rules. Waves 1–2 fixed the
  contradictions; this is the artifact they were for. Walked on `code-review/review-r1`, with the two
  gates, what neither of them proves (gameability — `feat-slug` is the worked example), a table of the
  ways a bench produces confident wrong numbers, and a PR checklist. Linked from all five READMEs,
  `benches/README.md`, `benches/contrib/README.md`, `docs/reference/metrics.md` and `CONTRIBUTING.md`; the contrib
  checklist stays as the short form and names the guide as required reading before rule 1. New
  `src/docs.test.ts` pins the links across all five languages and reads every threshold the guide
  quotes back out of the source, so changing a constant breaks the doc's test rather than silently
  making the doc wrong.
- **Facet scores**: verifiers may emit `"checks": [{"name", "pass"}]` in their JSON summary. Trials get a
  graded score (fraction of checks passed); manifests upgrade to `schemaVersion: 3` with per-trial
  scores, per-task facet tables, and a paired-bootstrap 95% CI for pooled Δscore alongside the existing
  Δpass CI — resolving effects binary pass/fail cannot at personal sample sizes. `_result.json` bumps to
  `schemaVersion: 2`. Trigger-mode trial records also carry score/checks.
- **Oracle gate**: new optional `tasks[].oracle` command (reference solution, same invocation convention
  as the verifier). `bench check` now fails when the oracle-solved fixture does not exit 0 with every
  check passing — the positive counterpart to the existing NOP gate.
- **`bench add --decompose --agent <id>`**: an agent drafts `verifier.mjs` + `oracle.mjs` from the frozen
  fixture (acceptance criteria as named checks); the draft is admitted only when both gates pass locally,
  otherwise nothing is written. `--verifier-kind` selects output/command grading; `--oracle <cmd>`
  registers a hand-written reference solution on any importer.
- **New warnings**: baseline floor (≤10%, "too hard or broken"), per-facet saturation (≥90% baseline),
  and verifier-consistency notes when the exit code disagrees with the JSON summary.
- Bundled benches: all `code-review` and `debugging` verifiers emit facet checks, and **every task in
  both benches now registers an oracle** that the gate validates in CI. `debugging`'s six reference
  solutions were already written down as verified code blocks in `ground-truth/*.md`; they are now
  real files under `ground-truth/solutions/<task-id>/` that `ground-truth/oracle-<task-id>.mjs`
  copies into the run directory. They live as files rather than embedded strings so the regexes and
  template literals they contain need no escaping. `bench init` templates include checks and a
  working oracle.

### Changed

- Codex CLI paired and trigger evaluations now both request `workspace-write` explicitly. This keeps
  command-graded trials writable even when the user's default Codex sandbox is read-only; the
  matrix verification timestamp and official CLI reference were updated together.

- Paired and trigger evaluations now default to five trials; dry-run plans show the full execution
  count and flag runs below the 8-task × 5-trial scale bar before any agent call. A first-real-eval
  guide explains the cost, setup-contamination risk, and how to read errors and uncertainty. All five
  READMEs now distinguish within-bench statistical verdicts from broader efficacy claims and state
  when historical raw manifests are unavailable. The evidence index no longer links to an unpublished
  draft.

- **`report` no longer overclaims usage or context cost.** Per-agent fired counts are restricted to
  currently installed Skills. "Never fired" is now "no observed fire in retained history" and is
  explicitly a prioritization signal because install dates are unavailable. The description-token
  figure is labelled as raw catalog size before agent-side limits, truncation, or omission.

- **`docs/reference/metrics.md` L1 status corrected (2026-09-29).** Trigger-mode rates already exist, so the
  old blanket "implementation is the next milestone" sentence was stale. Positive tasks currently
  carry only a Boolean `shouldTrigger` label; explicit, implicit, and contextual classes are not
  reported separately, and real installed-skill competition remains unimplemented. The verdict
  protocol did not change.

Wave 1 of the `docs/audit-2026-09-24.md` remediation (see that document's Disposition section for the
per-finding ledger). These change behaviour or weaken a claim that the code could not honour.

- **Paired runs are now interleaved.** The trial loop is outermost, so the two arms of a pair execute
  adjacently instead of all baselines before all treatments — condition is no longer confounded with
  elapsed time (provider drift, rate-limit backoff).
- **`docs/reference/metrics.md` no longer claims a shared seed.** The headless CLI surfaces in the capability
  matrix expose no seed or temperature knob, so the earlier "same fixture, prompt, and seed" was
  unsatisfiable as written. The contract now states what *is* controlled (same fixture, same prompt,
  adjacent order) and the manifest records `executor.sampling: null` where the surface offers nothing,
  rather than implying a control that does not exist.
- **`--calibrate` measures the inject path.** It previously routed through trigger mode, whose
  `shouldTrigger` filter silently calibrated zero tasks on an unlabelled bench. Labels are no longer
  required and only one arm per task runs, so calibration costs half what a paired eval would.
- **`bench check` gained three warnings**: a task with no registered oracle (winnability unverified), a
  verifier whose facet-check count falls outside the documented 2–8 range, and a negative-control
  fraction below the 30% target. All three are warnings, not failures, so `bench add --freeze`
  mid-authoring and CI are unaffected. Against the bundled benches this surfaces 11 warnings on
  `debugging` and 1 on `code-review` — the teaching material is now visibly short of its own contract,
  which the next wave closes.
- **Trigger recall is documented as an upper bound.** Only the skill under test is installed into the
  run directory; real routing quality depends on lexical competition with the user's whole installed
  set, which the harness does not reproduce. Marked `(Status: spec)` in `docs/reference/metrics.md` rather than
  built, because copying a user's real skill set into a sandbox raises privacy questions this project
  has not settled.
- **Correction to the 0.3.0 entry below**: it claimed recall, false-trigger rate, precision *and* F1
  all carry Wilson 95% CIs. Only the first two did. Precision does now; F1 deliberately does not, and
  the report says why inline.

### Fixed

- MCP preflight now rejects malformed JSON-RPC response shapes and unsupported initialization,
  follows paginated `tools/list` results, and stops repeated cursors. Configuration experiments
  reject overlays whose symlinks leave or alias the experiment directory.
- Codex MCP trials now pass a scoped, per-run project trust override so the disposable workspace
  actually loads its project configuration without changing the user's Codex config.
- All five README quick starts now use the source checkout while the package remains unpublished,
  with an offline bundled bench check as the first reproducible success.

- **`install` now rolls back a failed apply, including its lockfile (2026-09-29).** Staging already
  protected against failures before the first rename, but a later rename failure left earlier target
  files changed with no updated lockfile. The installer now keeps temporary copies of each target's
  immediate prior state, stages the lockfile with the content files, and restores applied targets if
  a rename or post-install verification fails. Fault-injection tests cover a failure on the second
  content file and a failure on the lockfile after an update. An abrupt process termination remains
  outside this rollback path; the five READMEs now state that limit instead of promising that every
  mid-install failure applies nothing.

- **Errored trials are excluded, not scored as failures (B1).** An executor error left
  `passed = false` on the record and both `statsFor` and `trialFlags` counted it, so a single API
  timeout manufactured a discordant pair and moved Δpass, the McNemar p-value and the bootstrap CI —
  enough to flip a verdict at the 3–5 trial scale this tool targets. `docs/reference/metrics.md` L0 claimed this
  was already handled; it was handled in the trigger path only. Exclusion is *pairwise*: dropping a
  trial from one arm alone would misalign the (task, trial) pairs every statistic resamples, so an
  error in either arm removes that pair from both. `ConditionStats` gains a required `errors` count,
  and a warning names each exclusion. This also removes the per-arm score-array asymmetry the audit
  filed separately as B9.
- **The judge is actually blind (B3).** `judgePair` ran with cwd set to the task directory — the parent
  of both arms — where a CLI judge with file tools could read either `_output.md` and their
  `_result.json`, which names the condition and the skill bundle hash. It now runs in a fresh temp
  directory holding only `answerA.md` / `answerB.md`, removed after the pair is judged.
- **Judge input is fenced and parsed from the end (B7).** Both answers were interpolated verbatim into
  the judge prompt and `parseChecklist` took the *first* checklist-shaped JSON in the reply, so an
  answer that embedded one — and got echoed while the judge reasoned — took the verdict. Answers now
  sit inside nonce-delimited markers marked as untrusted data, and the *last* JSON object wins.
- **Precision carries a Wilson CI (B5)**, computed over the fired runs.
- **`eval` refuses an API executor against a command-graded bench (B8)** at plan time, including during
  `--dry-run`. Previously it issued an instruction the executor could not carry out, scored both arms
  0, and then blamed bench difficulty via the floor warning.
- **`--calibrate` fails loudly when it measured nothing (A3)** instead of printing
  `PASS calibration: 0/0 task(s) in the discriminative band`. Errored runs are excluded from the
  difficulty rate rather than counted as failures.

- **`install` no longer destroys your original backup, and no longer leaves partial state (C1).** Four
  real defects, found by reproducing the audit's claim rather than taking it at face value — and the
  headline claim did *not* reproduce (see below).
  - `.skillfit-bak` is a single slot and every update overwrote it, so a second `install` replaced the
    user's pre-skillfit original with skillfit's own previous version. The one file the suffix exists to
    protect was the one it destroyed. Backups are now taken at most once per path: the earliest copy
    wins.
  - Writes were applied one file at a time, so a failure part-way left earlier items on disk while
    `validateWrites` and the lockfile update never ran. They are now staged beside their targets and
    renamed in one pass; a staging failure removes every staged file and applies nothing.
  - The lockfile was written with no backup, against the "backup before write, no exceptions" rule. It
    is now backed up to `skillfit.lock.json.skillfit-bak` first. Its backup *is* overwritten on each
    run, deliberately: for skillfit's own state the useful rollback target is the previous version,
    whereas for user content it is the earliest.
  - A run that failed part-way left the lockfile describing an older state than disk, and because later
    runs skip items whose content already matches, that stale entry was never corrected. Entries for
    skipped items that skillfit already owns are now refreshed on the next successful run, preserving
    their original `installedAt`. Unmanaged skips (a `CLAUDE.md` bridge import skillfit did not write)
    are still never claimed.
  - **Not fixed, because it does not happen:** the audit claimed a partial write leaves `install`
    permanently conflicting while reporting "Nothing was written". Reproduced and disproved — the
    conflict path requires a file that *differs* from the profile with no lockfile entry, and skillfit's
    own partial writes match the profile, so the next run adopts them and completes. The second run in
    the reproduction recovered cleanly.

- **`install --dry-run` reports conflicts instead of failing on them (C2).** The conflict check ran
  before the dry-run early return, so a pre-flight `--dry-run` exited non-zero on exactly the condition
  it exists to surface — a CI job using it as a check failed for asking the question. A dry run now
  prints the conflicts, says what to do, and exits 0. New `--strict` restores the non-zero exit for
  gates that want it; a real (non-dry) run still always throws, since it cannot proceed. Documented in
  `--help` and in the `install` row of all five READMEs.

- **`doctor --agent <typo>` exits 2 instead of 0 (C6).** Findings are advisory and a clean report
  exits 0 by design, but an unrecognised `--agent` means the health check never ran. It printed to
  stderr and returned, so a CI job running `doctor --agent kimi-code` against a renamed agent id read
  a typo as a clean bill of health. Findings still never set an exit code; only usage errors do, using
  this CLI's existing code 2.

- **`install` and `bench` no longer hang, or silently exit 0, when stdin cannot answer (C5).** Both
  commands had their own copy of a `readline` confirmation prompt with no `'close'` handler, so when
  stdin closed without delivering a line the promise never settled. Two outcomes, both bad: an
  open-but-silent stdin (a CI pipe) **hung forever**, and a closed one let the event loop drain so the
  process **exited 0 having written nothing** — which reads as success. Both now share one helper,
  `src/commands/confirm.ts`: closed stdin means "no" on a terminal, where a human pressed Ctrl-D, and
  an error naming `--yes` otherwise, where nothing could ever have answered. Sharing it is the point —
  `parseFrontmatter` had the same two-copies problem and the two drifted (C8).

- **A CLI executor whose agent exits early no longer takes the process down with it (C3).** Writing the
  prompt to `child.stdin` had no `'error'` listener, so an agent CLI that exited before draining stdin
  (a bad flag, an auth failure) raised EPIPE — or `EOF` on Windows — as an *uncaught exception* rather
  than a promise rejection. `main().catch` never saw it, the process died mid-trial, and a
  half-populated run group was left behind. It now rejects with a message naming the command, and kills
  the child so it cannot outlive the failure.

- **A timed-out trial now kills the agent, not just the shell (C4).** `child.kill()` signals only the
  process that was spawned, and with `shell: true` — the default for every agent CLI in the matrix —
  that process is the shell. Verified on Windows: the shell died and the grandchild kept running, so a
  trial that hit its 10-minute timeout left a live agent spending tokens against a run the harness had
  already given up on. The verifier's own 2-minute timeout had the same hole, and a verifier that runs
  `node --test` starts children too. New `src/harness/kill-tree.ts` kills the process group on POSIX
  (children spawned `detached`) and uses `taskkill /T /F` on Windows, where there is no equivalent
  signal; both the executor and the verifier path use it.

- **Multi-turn token usage accumulates instead of being overwritten (C7).** Each `turn.completed`
  event replaced the running total rather than adding to it, so a session with more than one turn
  reported only its last turn's usage. That corrupts ρ and cost-of-pass — the two claims
  `docs/reference/metrics.md` L3 says *are* provable at personal sample sizes, which makes them the last place
  to under-report. The sibling token path (`kimi-usage.ts`) already summed the same kind of per-entry
  records, so the two paths in one codebase disagreed about whether usage records are increments.
  They are; this one now treats them that way. The code comment records the residual risk: if a surface
  ever reports *cumulative* usage, accumulating would double-count, and the two readings are mutually
  exclusive.

- **`doctor` and `install` now share one frontmatter parser (C8).** Each had its own, and they
  disagreed on four inputs: a byte-order mark (install returned `null`, doctor parsed fine), trailing
  spaces after the `---` fence (same), quoted values (install kept the quotes), and `>` / `|` block
  scalars (install stored the literal marker as the description). So a `SKILL.md` could pass `doctor`
  and then be rejected by `install`'s post-write validation — the two commands giving opposite
  answers about the same file on disk. Both also stored `>-` as a two-character description, which
  then passed a presence check because a non-empty string is truthy. Extracted to
  `src/frontmatter.ts`; block scalars now fold (`>`) or keep line breaks (`|`) correctly and chomping
  indicators are handled. With one implementation, agreement is structural rather than something a
  test has to keep verifying, so the duplicated parser tests were consolidated rather than doubled.

- **`bench add --from-commit` can mine a repository whose paths are not ASCII (C9).** git quotes and
  octal-escapes non-ASCII paths by default, so `src/café-notes.txt` came back from `ls-tree` as
  `"src/caf\303\251-notes.txt"` — quotes included — and the follow-up `git show` then failed on a path
  that does not exist. Any repository with an accented, Cyrillic or CJK filename was unminable, and the
  error named the mangled path rather than the cause. Every git call in the mining path now passes
  `-c core.quotePath=false`, and `ls-tree` records are NUL-separated so a path containing a newline or
  a tab also survives. `-z` alone does not suppress the quoting; that was verified before the fix
  rather than assumed.

- **`--from-commit` says why it cannot mine a submodule, instead of disabling its own size guard
  (C9).** `ls-tree` reports a gitlink's size as `-`, `Number('-')` is `NaN`, the running total became
  `NaN`, and `NaN > MINED_MAX_BYTES` is `false` — so one submodule anywhere in the parent state turned
  off the 1 MB / 200-file fixture limit for the whole repository. A non-numeric size is now an error
  naming the offending path and explaining that the fixture would need the submodule's own checkout.

- **The harness no longer names an agent (C12).** `CliExecutor` decided whether to read token usage
  out of the session log with `if (this.label === 'kimi-code')` — agent-specific behaviour hardcoded
  in harness code, which `AGENTS.md` forbids outright. It is now a matrix capability,
  `headless.usageFromSessionLog`, set on kimi-code (whose headless transcript carries no usable token
  counts) and on no other agent. Adding a fourth agent whose CLI behaves the same way is now a
  one-line matrix edit rather than a source change, and a test scans the executor module for quoted
  agent ids so the rule survives future edits. Matrix `verifiedAt` bumped to 2026-09-25; the
  capability depends on the session log location already documented at `sessions.docs` for that agent.

- **The report states the run's resolution, and CI bounds keep a decimal (B4).** `docs/reference/metrics.md`'s
  verdict protocol requires the CI half-width alongside every delta, as "this bench resolves effects
  ≳ ±Xpp"; no such line existed. Worse, `formatDeltaPp` rounded to whole percentage points and was
  applied to the interval bounds, so `[-0.044, 0.610]` printed as `[-4pp, +61pp]` — which hides both
  that the interval straddles zero and how wide it is, the two things a reader needs in order not to
  over-read an underpowered run. Bounds now print to one decimal via `formatPp1` and a `Run
  resolution` line follows the CI. The task table keeps whole points, where the precision is noise.
  This closes the last open row in the audit's document-vs-code divergence table.

- **A verifier that never ran is a bench defect, not an agent failure (audit note 2).** Verifiers and
  oracles are spawned with `shell: false`, so on Windows a `.cmd`/`.bat` wrapper throws `spawn EINVAL`
  and a bare `npm` throws `spawn ENOENT` — reproduced live on this host. Both surfaced as
  `{exitCode: null}`, which `runTrial` read as `passed = false` with no error recorded, so the trial
  looked exactly like the agent failing the task; both arms fail identically, and the report then
  advised that the bench was too hard. The command-kind NOP gate had it worse: `exitCode !== 0` is the
  condition it exists to require, so an unspawnable verifier *passed* the gate. A missing exit code is
  now a named harness error on the trial (excluded pairwise, per B1), a `bench check` FAIL that quotes
  the spawn error and the no-shell rule, and a rejection reason in `--decompose`'s gates. `shell: false`
  itself is kept deliberately and documented in `SECURITY.md`: `CONTRIBUTING.md` solicits benches from
  strangers, and a shell would make `"verifier": "node v.mjs & curl …"` in a contributed `bench.json`
  run on every machine that checks it. Warnings that said "executor error" now say "executor or
  verifier error", since one channel carries both.

- **The report's `Overall` line counts one population, not three (C11).** `installed` was a set
  deduped across agents while `fired` and `never` were per-agent sums printed on the same line as
  though all three described the same things. A skill installed for three agents counted once in the
  first figure and up to three times in the other two, `fired` could exceed `installed`, and the
  numbers never added up — the same four skills installed for a second agent printed "4 installed,
  3 fired, 5 never", eight outcomes for four skills. Both are now restricted to the installed set, so
  `installed = fired + never` holds exactly and a skill that fired but has since been uninstalled no
  longer inflates the count. Per-agent lines are unchanged: only `Overall` is a deduped population, and
  a test pins both so the distinction is not incidental. The mismatch was created by an earlier commit
  that deduped one term of a three-term line.

- **Shell-unsafe spawn arguments are refused instead of passed through (C13).** `quoteShellArg`
  returned any argument without whitespace verbatim into a `shell: true` spawn, so `a;rm`, `a&&rm`,
  `a|rm`, `x$(whoami)` and backtick forms all reached the command line unchanged. Not reachable today —
  argv only ever comes from `src/matrix/agents.json` plus a `{promptFile}` substitution skillfit chose
  itself — but the function is exported, and a latent hole in the one place that builds shell command
  lines is a poor thing to leave behind. Quoting harder is not the fix: inside double quotes a POSIX
  shell still expands `$(…)` and backticks while `cmd.exe` still expands `%VAR%`, and no single scheme
  is correct for both. The rejected set is ``; & | < > ` $`` plus CR/LF, narrow on purpose so Windows
  paths and `node -e` expressions keep working; every payload that actually injects is still caught,
  and no token in the matrix contains a rejected character. `SECURITY.md` records the trust boundary.

- **`bench add --verifier-cmd` says out loud that the string is persisted (audit note 1).** The command
  is written into `verifiers/<task-id>.mjs` and re-executed with `shell: true` on every later
  `bench check` and `eval`, so it outlives the invocation that created it. Both the dry-run plan and
  the real run now log that before writing, because the scripted `--yes` path is exactly the one where
  nobody reads a prompt. Severity is disclosure rather than escalation — a verifier is arbitrary code
  by design, so accepting a contributed bench already means accepting code execution.

### Bench content (material)

These change what a bundled bench scores or how hard it is, so **evidence gathered against an earlier
version of these benches does not transfer**. Existing `evidence/` entries are append-only and describe
the bench as it was; re-run `bench check --calibrate` before making any new claim against a bench
listed here.

- **`debugging/feat-slug` can no longer be passed by rewriting its own test suite.** The verifier was a
  thin `node --test` wrapper run in place, so replacing the shipped assertions with `assert.equal(1, 1)`
  was a complete solution — verified: it scored 1/1 and exited 0. It now carries six checks: the visible
  suite is compared against the canonical fixture copy before it is run, and four further checks import
  `src/slug.mjs` directly so a stub fails even with the suite untouched. `node --test` is invoked via
  `process.execPath` instead of PATH `node`. The non-ASCII check asserts slug *shape* only (no leading,
  trailing or doubled separator) because the visible suite never specifies accent handling and both
  folding and dropping are defensible — pinning an output would grade an invented requirement.

- **`debugging/range-parser` no longer accepts a test suite that asserts nothing.** Two of its twelve
  checks graded the *text* of `test/*.mjs` — at least four `test(` occurrences, and a match on
  `/negative|maxItems|invalid|reject/i` — so four empty `test('invalid …', () => assert.ok(true))`
  blocks scored full marks. They are replaced by one behavioural check: the suite must pass against
  the final implementation *and* fail against the original buggy one, restored into a temporary copy
  of the workspace. The four `TypeError` cases also merge into a single check, since they assert one
  rejection contract and scoring them separately inflated the count without adding a distinction
  anyone would act on. Twelve checks become eight, inside the 2–8 range. Verified closed: the
  keyword-stuffed suite above now scores 7/8 and exits 1.

- **`debugging/debug-redaction` no longer grades the agent's notes, and drops a keyword scan.** One check
  required `_output.md` to match `/RED\s*:.*node\s+--test.*fail/is` and the GREEN equivalent — grading
  bookkeeping about a red/green cycle the harness already verifies for itself, by restoring the original
  leaking implementation and re-running the suite. It was satisfiable by typing the two strings. A fourth
  regression check matched `/debug\s*:\s*true/` and a redaction keyword over test source, which a test
  containing those words and no assertions would satisfy; the restore-original check strictly subsumes it.
  Both are gone. The sentinel assertions also consolidate — the two behavior checks that inspected the same
  debug report merge, and the two secrecy scopes (non-harness files, notes) merge into one property. Twelve
  checks become eight, inside the 2–8 range. The prompt still asks for RED/GREEN notes; they are requested
  but not graded, and are still scanned for the sentinel. This closes the last `metrics.md` divergence from
  "grade the outcome not the path".

- **`code-review` decoys are now scored, and `missing-tests` needs a real coverage claim.** All three
  review verifiers computed `decoyHits`, printed them for humans, and then scored `passed = missed.length
  === 0` — so reporting plausible-but-correct code cost nothing, and a review that simply said more beat
  one that said less and was right. `benches/README.md` promised the opposite, and `r1.md`'s own scoring
  anchors already specified "reporting the style decoy costs −1"; the verifier just never implemented its
  rubric. Each gains a fourth check, `no-false-positives`, which fails on any decoy hit and is required
  for exit 0. It is also false when `_output.md` is missing, since crediting silence with precision would
  hand a quarter of the facet score to an agent that reviewed nothing. Separately, `missing-tests` matched
  a bare `/test/i` on any line naming `applyBulkDiscount`; it now requires a negation or obligation word
  near "test"/"coverage". Effect on the mock arms: review-r1's baseline drops from 1/3 to 1/4 because it
  reports the C-style-loop decoy, and pooled Δscore moves 7/12 → 9/16. Pass/fail verdicts are unchanged.

- **`debugging/ttl-cache` is a diagnosis task again; `range-parser` is labelled as the bench's one
  spec task.** The ttl-cache prompt enumerated all four seeded defects as "user reports", one per
  verifier check, so it measured whether an agent could follow a precise written list rather than
  whether it could find what was wrong — and it saturated for the same reason. It now reports three
  user-visible incidents and states the contract they violate, withholding the defect list; the list
  stays in `ground-truth/` as the author's answer key and the judge rubric. `range-parser` was flagged
  by the same audit row but is a different case: its fixture ships a stub whose visible test asserts
  the *wrong* behaviour, so there is nothing working to diagnose, and its eight checks assert specific
  `TypeError`/`RangeError` behaviour an agent could not otherwise know to implement. Enumerating that
  contract is the task, not a leak, so it is kept and labelled rather than de-specced — both ground
  truth files now name their task class and explain the distinction, and `bench.json`'s description
  records the mix. Difficulty changed for ttl-cache, so re-run `--calibrate` before making new claims.

- **Three new negative controls; both bundled benches now clear every gate.** `code-review` gains
  `summarize-s1` (write the changelog entry for this PR) and `debugging` gains `explain-cache` and
  `document-queue`. Negative controls were 25% and 17% against a ≥30% target; they are now 40% (2/5)
  and 38% (3/8), and `bench check` on both bundled benches reports **0 warnings and 0 failures** — the
  teaching material no longer trips the gates it teaches.
  The two new `debugging` controls are the hardest kind of decoy: their fixtures are the *correct*
  implementations, byte-identical to the reference solutions `oracle-ttl-cache.mjs` and
  `oracle-async-queue.mjs` install for the sibling tasks. Same domain, same file, opposite ask — a
  debugging skill keyed to vocabulary rather than to the request fires on them. Both are also
  behavioural discriminators, not just labels: the prompts state twice that nothing is broken and a
  `no-defect-claims` check fails an answer that reports one anyway, and each mock's treatment arm does
  exactly that (inventing, in `document-queue`'s case, the two bugs the sibling task really contains).
  `summarize-s1` fails an answer that starts citing `SPEC §` and reporting violations. They are the
  first `verifierKind: "output"` tasks in the `debugging` bench, because grading prose by running a
  test suite would grade nothing.
- **Consequence for the mock demo:** `code-review`'s pooled mock verdict moves from `effective` to
  `inconclusive` (9 improved against 3 regressed, McNemar p ≈ 0.146, Δpass +40pp). That is the correct
  reading of a skill that helps on three review tasks and derails a summarisation task at 3 trials × 5
  tasks, and it is a better teaching artefact than a clean win was.
- **`debugging/chunked-decoder` rebalanced from 10 checks to 8.** Not in the work order — the audit
  listed it as out of range and Wave 2's table omitted it, which would have left the bundled bench
  warning against its own gate. Two pairs merged, each asserting one contract: the 2-byte and 3-byte
  multibyte-split cases (same per-chunk-decoding bug, same fix), and the negative and absurd length
  prefixes (both must throw `TypeError` mentioning the length). Pristine fixture still scores 4/8.
- **README trigger demo block corrected and dated.** B5 changed the Precision and F1 output format, so
  the captured block no longer matched what the CLI prints. The four metric lines are re-rendered from
  that run's recorded per-task counts — the run is real, only the formatting is current — and the block
  is now labelled with its capture date and the fact that the bench has since gained a task. The four
  translations were also missing the Precision and F1 lines entirely, violating the rule that the demo
  console block stays verbatim in every language; all five are now byte-identical.

## [0.3.0] — 2026-09-22

A large capability wave. Everything in 0.2.0 plus:

### Added

- **Trigger mode** (`eval --mode trigger`): installs the skill into the run directory's agent skills dir
  instead of injecting it, captures the agent's stream-json transcript, and measures trigger recall /
  false-trigger rate / precision / F1 with Wilson 95% CIs. Verified on Kimi Code and Codex CLI.
- **`skillfit report`**: zero-cost skill usage receipts from local session history (Kimi Code wire.jsonl,
  Claude Code projects/*.jsonl, Codex rollouts), with per-skill fire counts, never-fired lists, and a
  presence-tax estimate (per-session description-token cost of merely having skills installed).
- **Statistical verdicts**: exact McNemar test over discordant (task, trial) pairs (fewer than 6
  discordant pairs is always inconclusive), deterministic paired-bootstrap 95% CIs, cost-of-pass ratio,
  and indicative-vs-conclusive scale labels. Manifest upgraded to `schemaVersion: 2` with per-trial
  outcomes.
- **`skillfit bench`**: `init` (scaffold with a passing example task), `check` (offline verifier
  self-tests, mock-arm probes, fixture hygiene, trigger-label coverage), `check --calibrate` (real
  baseline-difficulty bands: discriminative / too easy / too hard), `add --freeze` (freeze a real failure
  with a command or output verifier), `add --from-commit` (SWE-bench-style FAIL_TO_PASS mining: parent
  commit as fixture, the fix's own tests embedded in the verifier).
- **`--judge-agent`**: drive the blind judge with a local agent CLI instead of an API key; same-family
  judging prints a self-preference warning. Judge calls run **AB/BA position-swapped** and only
  unanimous verdicts count toward means, and answers are scored with a **binary checklist**
  (`correct` / `complete` / `grounded`, 0–3) instead of a Likert scale.
- **Agent matrix**: headless templates, stream-json capture configs, session-store paths, and
  `verifierKind` (`output` vs `command`) in the bench format. `shouldTrigger` task labels and
  `promptTrigger` presentation variants.
- **Driver skill** at `skills/skillfit/` — teaches agents to drive the CLI (command routing, spend
  discipline, interpretation discipline).
- **Real token usage for all CLI executors**: Codex via stream events, Kimi Code by resolving each run's
  session wire.jsonl through the documented workDirKey and summing its `usage.record` entries. Trigger
  manifests also surface per-task token totals.
- **Prompt-token cost estimates in dry-run plans** (inject: baseline vs treatment per run; trigger: prompt
  size plus the skill body that loads only when fired).
- Bundled benches: `code-review` gained review-r2/r3 tiers and the explain-x1 negative trigger control;
  new `debugging` bench (ttl-cache, debug-redaction, range-parser, async-queue, chunked-decoder,
  feat-slug).
- **Evidence watch** (`.github/workflows/watch.yml`): opt-in weekly re-run of a pinned eval configuration,
  gated on `SKILLFIT_WATCH=1` + `SKILLFIT_API_KEY`.
- Community flow: `benches/contrib/` submission contract, GitHub issue templates for bugs and evidence.
- CI: bench-integrity gate and report smoke on every push/PR. README in five languages. CHANGELOG and
  SECURITY policies published.

### Fixed

- Headless CLI executors were broken for kimi-code (`--print` never existed) and for any multi-word
  argument under `shell: true` (cmd.exe word-splitting) — now matrix-driven with a verified prompt-file
  transport and shell quoting.
- Trigger mode no longer inlines the repository snapshot (a self-contained prompt suppresses skill
  consultation — measured 0/9 recall artifact vs 2/2 on-disk).
- Verifier child processes no longer inherit `NODE_TEST_CONTEXT`, which silently zeroed nested
  `node --test` runs.
- Trigger detection on Codex now normalizes shell-escaped doubled backslashes before matching
  `SKILL.md` paths (real transcripts carry them doubled).
- `report` Overall installed count deduplicates skills shared between agents.
- Judge standard formalized: AB/BA position-swapped calls with winner-only-if-unanimous aggregation
  (k=3 majority-ensemble considered and rejected — it can hide order bias inside the vote).
- agents.json kimi docs links unified to the official docs domain; all 15 links re-verified live.

### Evidence

- `evidence/2026-09-bench-calibration.md`, `2026-09-trigger-snapshot-correction.md`,
  `2026-09-debugging-bench-exploratory.md`, `2026-09-debugging-hardening.md`,
  `2026-09-22-codex-trigger-capture.md`.

## [0.2.0] — 2026-09-19

Version bump and npm publish readiness (repository/homepage/bugs metadata, `prepublishOnly` gate).
Superseded by 0.3.0 before any registry publish.

## [0.1.0] — 2026-09-19

Initial release: `doctor` (read-only configuration health check), `eval` (paired baseline/treatment
experiments with deterministic verifiers and an optional blind judge), `install` (dry-run-first,
backup-always writer). Supports Claude Code, OpenAI Codex CLI, and Kimi Code via a data-driven agent
capability matrix. Zero runtime dependencies, Node >= 22, offline `node:test` suite.
