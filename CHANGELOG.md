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
  `docs/metrics.md` L3 says *are* provable at personal sample sizes, which makes them the last place
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

- **The report states the run's resolution, and CI bounds keep a decimal (B4).** `docs/metrics.md`'s
  verdict protocol requires the CI half-width alongside every delta, as "this bench resolves effects
  ≳ ±Xpp"; no such line existed. Worse, `formatDeltaPp` rounded to whole percentage points and was
  applied to the interval bounds, so `[-0.044, 0.610]` printed as `[-4pp, +61pp]` — which hides both
  that the interval straddles zero and how wide it is, the two things a reader needs in order not to
  over-read an underpowered run. Bounds now print to one decimal via `formatPp1` and a `Run
  resolution` line follows the CI. The task table keeps whole points, where the precision is noise.
  This closes the last open row in the audit's document-vs-code divergence table.

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
