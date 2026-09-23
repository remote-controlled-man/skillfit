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
- Bundled benches: all `code-review` and `debugging` verifiers emit facet checks; `code-review` tasks
  register oracle scripts (validated by the gate in CI). The `debugging` bench intentionally has no
  oracles yet — its command-kind tasks need verified reference patches, which are follow-up work.
  `bench init` templates now include checks and a working oracle.

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
