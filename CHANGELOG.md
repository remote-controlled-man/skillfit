# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are when the work landed on `main`.

## [Unreleased]

Graded facet scoring and verifier/oracle acceptance gates, informed by a Skill2Env review
(see `docs/metrics.md` v2). The exit code remains the sole pass/fail authority; the McNemar verdict
protocol is unchanged.

### Added

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

Wave 1 of the `docs/audit-2026-09-24.md` remediation (see that document's Disposition section for the
per-finding ledger). These change behaviour or weaken a claim that the code could not honour.

- **Paired runs are now interleaved.** The trial loop is outermost, so the two arms of a pair execute
  adjacently instead of all baselines before all treatments — condition is no longer confounded with
  elapsed time (provider drift, rate-limit backoff).
- **`docs/metrics.md` no longer claims a shared seed.** The headless CLI surfaces in the capability
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
  set, which the harness does not reproduce. Marked `(Status: spec)` in `docs/metrics.md` rather than
  built, because copying a user's real skill set into a sandbox raises privacy questions this project
  has not settled.
- **Correction to the 0.3.0 entry below**: it claimed recall, false-trigger rate, precision *and* F1
  all carry Wilson 95% CIs. Only the first two did. Precision does now; F1 deliberately does not, and
  the report says why inline.

### Fixed

- **Errored trials are excluded, not scored as failures (B1).** An executor error left
  `passed = false` on the record and both `statsFor` and `trialFlags` counted it, so a single API
  timeout manufactured a discordant pair and moved Δpass, the McNemar p-value and the bootstrap CI —
  enough to flip a verdict at the 3–5 trial scale this tool targets. `docs/metrics.md` L0 claimed this
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
