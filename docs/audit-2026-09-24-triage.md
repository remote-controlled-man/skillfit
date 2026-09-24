# Audit triage + work order — 2026-09-24

Companion to `docs/audit-2026-09-24.md`. That document is the findings list; this one is the
execution contract: what has been independently re-verified, what to build, in what order, and the
bar each change must clear. Where the two disagree, **this document wins**.

Executing session: read the audit first, then this. Do not edit the audit's findings sections —
record outcomes in a new `## Disposition` section appended at its end (one line per finding:
`FIXED <commit>`, `KILLED <reason>`, or `DEFERRED <reason>`).

---

## 1. Verification status (second reviewer, on `e1ced97`)

Every claim below marked **confirmed** was re-checked line-by-line or by live reproduction
(`npm test` → 222/222 green; `bench check benches/debugging` → all green with 0 warnings despite
zero oracles, exactly as the audit claims).

**Confirmed, safe to fix as specified:** A1, A2, A3, A4 (counts: feat-slug 1, async-queue 6,
ttl-cache 8, chunked-decoder 10, range-parser 12, debug-redaction 12), A5 (verbatim), A6 (verbatim),
A7 (verbatim), A8 (verbatim), A9 (verbatim), A10, A11, A12, B1, B2, B3, C1, C2.

**Promoted from [reported] to confirmed** (I verified these myself):

- **B5** — `src/harness/trigger.ts:53-59`: `precision`/`f1` are bare `number | null`; only recall and
  false-trigger rate carry Wilson intervals. Fix: precision is also a proportion
  (fired_positives / all fired) — `wilson95` applies with n = total fired. F1 is a harmonic mean of
  two proportions and has no closed-form binomial interval: report F1 bare and say so in
  `docs/metrics.md`, or drop F1. Do not fake a CI for it.
- **B6** — `src/harness/trigger.ts:103-105` copies only the skill under test into
  `runDir/<skillInstallDir>/`, while `docs/metrics.md:68-70` claims the sandbox "contains the user's
  real set." Confirmed divergence. **Fix = weaken the doc claim now** (use the `(Status: spec)`
  convention from `metrics.md:48`); implementing real-set lexical competition involves fingerprinting
  and privacy questions — file it as a future enhancement, do not build it in this pass.
- **B7** — `src/harness/judge.ts:25-41` interpolates both answers verbatim into the judge prompt, and
  `parseChecklist` (`judge.ts:47`) takes the **first** regex match, so an answer embedding a checklist
  JSON flips the verdict. Confirmed. Fix: fence answers with explicit delimiters plus an instruction
  to ignore embedded JSON, and parse the **last** JSON-looking line of the judge reply (same contract
  style as verifiers), not the first regex match anywhere.
- **B8 — confirmed in substance, but the audit's citation is wrong.** The `workspace: true` flag is
  set at `src/harness/runner.ts:143` (`{ workspace: task.verifierKind === 'command' }`), not
  `eval.ts:68-74` (that range contains nothing relevant). The substance stands: `ApiExecutor.run`
  ignores the workdir (`executors/api.ts:50`), so an API-key eval on a command-kind bench produces an
  impossible instruction and both arms score 0. Fix: at plan time, if `executor.describe().kind ===
  'api'` and any task is `verifierKind: 'command'`, throw with a clear message (API executors support
  output-kind benches only).

**Corrected while verifying:**

- **B9 — mostly subsumed, severity overstated.** `pairedBootstrapCI` (`stats.ts:50-79`) resamples
  *tasks* (cluster bootstrap) and `pooledDelta` averages each arm separately, so unequal arm lengths
  do not corrupt the resample weights as the audit speculates. The real residue is only that score
  arrays are null-filtered per arm independently (`runner.ts:480-485`). **Disposition: no separate
  fix** — the B1 fix below filters scores with the same per-trial pair filter, which removes the
  asymmetry en passant. Note this in the audit's Disposition section.

**Still unconfirmed leads — reproduce before touching code:** B4, C3–C13, plus the two "smaller
notes" (persisted `--verifier-cmd` re-execution; `shell: false` verifier spawn vs `.cmd` on
Windows). §5 gives reproduction steps. If a lead does not reproduce, write `KILLED <reason>` in the
audit Disposition and move on. Do not fix what you have not reproduced.

---

## 2. Amendments to the audit's fix specs

These are binding. They come from re-reading the cited code, not preference.

1. **B1 is Wave 1, not Wave 3.** It silently manufactures discordant pairs at exactly the 3–5-trial
   scale the tool targets. The audit itself flags Wave-3-first as defensible; with B1's diff being
   the same size as A1's, there is no reason to wait.
2. **B1 fix must pair by trial number before filtering.** Build `Map<trial, {baseline, treatment}>`,
   drop any pair where either side has `error !== null`, then compute stats/McNemar from the
   survivors. Independent per-arm filtering (the audit's literal wording) would recreate the B9
   misalignment inside McNemar. Apply the same surviving-pairs filter to the score arrays
   (`runner.ts:480-485`). Carry `errors: number` on `ConditionStats`, surface a per-arm warning when
   > 0, and record it in the manifest. Mirror `trigger.ts:196-199`'s existing behavior.
3. **B2: interleave, but do not promise a seed.** Change the loops to
   `for trial { for condition }` — cheap and real. But kimi/codex headless CLIs expose no seed or
   temperature knob, so `docs/metrics.md:27`'s "same seed" is a claim the surface cannot honor.
   Record `sampling: null` (or the actual values if a future surface offers them) in the manifest's
   executor block, and reword `metrics.md:27` to state what is actually controlled: same fixture,
   same prompt, interleaved order, seed recorded (null where unsupported). This is an explicit
   doc-weakening row — say so in the commit message.
4. **B3 fix:** run the judge with cwd = a fresh `mkdtempSync` directory containing only
   `answerA.md` / `answerB.md`; keep the existing seed derivation (`runGroup:task:trial`)
   unchanged; write `judge-trial-N.json` into the task directory *after* the call, never use the
   task directory as cwd. Acceptance test: the judge executor's observed cwd must contain no
   `_result.json`.
5. **A1 gate level is WARN, not FAIL.** `bench add --freeze` legitimately produces oracle-less tasks
   mid-authoring; a hard fail would block the intended workflow. The warning must name the
   consequence: "no oracle — task winnability is unverified."
6. **A7/A8/A9 change scoring or difficulty of a published bench.** Each lands with: a CHANGELOG
   entry under Unreleased stating the bench changed materially, and a fresh `--calibrate` run
   afterwards before any new evidence claims are made against that bench. Old evidence entries stay
   untouched (append-only); they describe the old bench version.
7. **A10 minimal move only.** Once A2 lands the six oracles, make `bench check` run each oracle
   against the mock arm for command-kind tasks (the winnability direction, offline). Do not build
   the file-patch mock extension unless that proves insufficient.
8. **C2 semantics are an explicit decision:** `install --dry-run` reports conflicts in the plan
   output and exits 0; add `--strict` for the CI case that wants non-zero. Document both in
   `--help` and README. (New flag → README.md plus all four translations.)
9. **Waves 1 and 2 land in the same wave, as separate commits.** The moment the WARN gates exist,
   `bench check` on the bundled benches warns until the examples are fixed — main must not sit in a
   state where our own teaching material trips its own gate without the fix commits right behind.

---

## 3. Work order

### Wave 0 — confirm or kill (do first, it's mostly reading)

Work through §5's reproductions for B4 and C3–C13. Write one Disposition line per item in the
audit doc. Budget: this is triage, not fixing. Fixes for survivors join Wave 3.

### Wave 1 — gates + verified measurement bugs

One commit per finding, message references the audit ID. Tests first or in the same commit.

| ID | Where | Fix (per §2 amendments) | Acceptance |
|---|---|---|---|
| A1 | `src/commands/bench.ts:337` | WARN when `task.oracle` absent | test: oracle-less bench warns; oracle bench doesn't |
| A4 | bench check, verifier JSON `checks` array | WARN when count outside 2–8 | tests at 1 and 12; pass at 2 and 8 |
| A3 | `bench.ts:405-460`, `trigger.ts:279` | FAIL loudly when 0 tasks eligible for calibration ("calibration ran 0 tasks: difficulty unmeasured"); decouple calibration from `runTriggerExperiment` — drive the inject path with the existing empty `calibration-none` skill | test: unlabelled bench → FAIL line, never `PASS 0/0` |
| A12 | `bench.ts:385-390` | WARN when negative controls < 30% (not only at 0) | test with 20% fixture bench |
| B1 | `runner.ts:155-182, 243-258, 324-330, 460-479` | pair-by-trial, drop errored pairs, `errors` count + warning (amendment 2) | test: executor throws on baseline trial 2 → that trial excluded from both arms, error counted, verdict not moved by the hole |
| B2 | `runner.ts:460-469` + `metrics.md:27` + manifest executor block | interleave loops; record `sampling: null`; reword doc (amendment 3) | test: run order interleaves conditions per trial |
| B3 | `runner.ts:296-320` | judge cwd = fresh temp dir with only the two answers (amendment 4) | test: judge cwd contains no `_result.json` |
| B5 | `trigger.ts:53-59` + `metrics.md:56` | Wilson CI for precision; F1 bare with a doc note | test: precision CI present, sane bounds |
| B7 | `judge.ts:25-47` | delimited answer fencing; parse last JSON line, not first match | test: answer embedding a checklist JSON does not flip the verdict |
| B8 | `runner.ts:143`, `commands/eval.ts` plan path | throw when api executor meets command-kind bench | test: clear error, no run started |

### Wave 2 — examples match the paradigm

| ID | Fix | Notes |
|---|---|---|
| A2 | Write 6 `oracle-<id>.mjs` from the corrected implementations already fenced in `benches/debugging/ground-truth/*.md`; register in `bench.json`. `benches/code-review/ground-truth/oracle-r1.mjs` shows the shape. | After this, `bench check benches/debugging` shows oracle PASS lines |
| A5 | `feat-slug.mjs`: port the canonical-test comparison from `ttl-cache.mjs`; add 2–4 edge checks (unicode, consecutive separators, empty input); use `process.execPath` instead of PATH `node` | closes the rewrite-the-test cheat |
| A6 | `range-parser.mjs`: canonical comparison or behavior-based regression assertions; total checks ≤ 8 | the 10 behavior checks are sound; replace the 2 hollow ones |
| A7 | `seeded-bugs.mjs` + r2/r3 variants: add `no-false-positives` check failing on `decoyHits.length > 0`; tighten `missing-tests` to require a coverage assertion, not the bare word "test" | amendment 6: CHANGELOG + re-calibrate |
| A8 | `debug-redaction.mjs:256-260`: drop the notes-regex check (the restore-original check at `:245-254` already grades the real outcome); rebalance sections to land in 2–8 | |
| A9 | De-spec `prompts/ttl-cache.md` and `prompts/range-parser.md` (symptom + failing repro, no defect enumeration); keep exactly one deliberately spec-style task, labelled as such | amendment 6: difficulty changed — re-calibrate |
| A12 | Add two negative controls (one per bench) to clear your own new 30% gate | |

### Wave 3 — robustness (confirmed items only)

1. **C1 first** — it is the only finding that can leave a user permanently stuck with a false error
   message. Stage all writes to a temp location, rename in one pass, back up the lockfile too, and
   make recovery able to adopt an unrecorded-but-hash-matching write instead of hard-conflicting.
2. **C2** — per amendment 8 (`--strict`).
3. Survivors of Wave 0, one commit each, smallest fix that closes the hole.

### Wave 4 — the authoring guide (the audit's §6 "missing artifact")

Write `docs/bench-authoring.md`: the seven steps walked end to end on one real task (freeze →
shrink → grader → mine alternative → trigger variant → labels/decoys/mock → rehearse), with each
step's non-optional rationale. Link it from `README.md` (plus translations), `benches/README.md`,
`benches/contrib/README.md`, and `docs/metrics.md`. **Write it after Waves 1–2 land** — the guide
must describe gates that actually exist. This document is the deliverable the audit calls "the
product"; treat it that way.

Also fold A11 into this wave: `benches/contrib/README.md` keeps its PR checklist but links the
guide as the required reading before rule 1.

---

## 4. Acceptance bar (applies to every item)

- `npm test` green before every commit — read the **full** summary block (`# pass` / `# fail`),
  never a grep-filtered tail. A previous session pushed red while believing green because of
  filtered output.
- Tests are `node:test`, offline, `MockExecutor` / injected fs roots. Never call a real model API or
  agent CLI from tests.
- Zero runtime dependencies. ESM relative imports carry `.js`. Agent-specific behavior comes from
  `src/matrix/agents.json`; matrix edits need a `verifiedAt` bump + docs link.
- Docs updated in the **same commit** as the behavior change. Every row of the audit's §5
  divergence table ends either fixed-in-code or explicitly marked `(Status: spec)` per the
  `metrics.md:48` convention — no row stays ambiguous.
- CHANGELOG entry per wave under Unreleased.
- CLI output English. New/changed user-facing flags → `README.md` + zh-CN/ja/ko/es mirrors.
- `evidence/` is append-only. `runs/` is gitignored local output.
- Never touch `workspace4skills/` (private lab). Never `git clean -fdx`.
- Out of scope for this pass: npm publish (needs the owner's 2FA), Claude Code support (no account;
  off the roadmap), real-set competition in trigger mode (B6 enhancement), the file-patch mock
  extension (A10 full version).

---

## 5. Reproductions for the remaining leads

```bash
# B4 — resolution line absent + rounding destroys CI width
node dist/cli.js eval <any-skill> --bench benches/code-review --executor mock --trials 2 \
  --run-group b4-repro   # then read runs/b4-repro/manifest + printed report:
                         # is there a "resolves effects ≳ ±Xpp" line? are CI bounds integer-rounded?

# C3 — EPIPE on stdin (cli.ts:162-165): point an executor at a bogus agent flag in a scratch copy
#      of agents.json (never edit the real one for this) and watch for uncaught EPIPE vs rejection.

# C4 — kill only signals the shell (cli.ts:121-124): start a long mock-sleep trial, let the
#      timeout fire, then `ps` / Task Manager for surviving child processes.

# C5 — rl.question hangs on non-TTY (install.ts:535-543, bench.ts:136-144):
echo "" | node dist/cli.js install recommended --agent kimi-code   # without --yes, from CI-like stdin

# C6 — doctor exits 0 on bad agent id:
node dist/cli.js doctor --agent bogus; echo "exit=$?"              # expect non-zero, audit says 0

# C7 — turn.completed overwritten not accumulated (cli.ts:256-266): needs a multi-turn stream
#      fixture; write one under test fixtures and assert accumulation.

# C8 — two parseFrontmatter implementations diverge (install.ts:211-220 vs doctor.ts:128-155):
#      feed a SKILL.md with BOM and a `description: >-` folded scalar to both paths.

# C9/C10 — git mining parsing (bench.ts:946-953, 973-989): mine a commit with a non-ASCII path
#      and one with a rename (R100); watch gitShow failures and totalBytes NaN.

# C11 — report "Overall" mixes populations (report.ts:70-73): craft a receipt set where one skill
#      is installed for 2+ agents; check fired/never arithmetic against installed.size.

# C12 — hardcoded 'kimi-code' in harness (cli.ts:154): confirmed by reading; fix = matrix
#      capability flag + agents.json entry (verifiedAt bump).

# C13 — quoteShellArg passes whitespace-free strings unquoted (cli.ts:25-30): confirmed by
#      reading; assess exploitability (today only agents.json feeds it), then fix by quoting
#      everything or documenting the trust boundary in SECURITY.md.
```

Windows note for the executing session: the Bash tool here is Git Bash. Heredocs eat backslashes —
write any script containing regex or Windows paths with the Write tool, never inline. Nested
`node --test` inherits `NODE_TEST_CONTEXT` and silently runs zero tests — the existing verifiers
scrub it; keep that pattern in anything new.
