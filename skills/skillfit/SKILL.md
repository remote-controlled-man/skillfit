---
name: skillfit
description: Measure whether agent skills, rules, or MCP configs actually help — usage receipts from local session history, trigger-rate measurement, and paired A/B evals with statistical verdicts. Use when the user asks whether a skill is worth installing, whether their installed skills ever get used, wants to A/B-test agent configuration, or wants to build a bench from a real failure.
---

# skillfit driver

Drive the `skillfit` CLI to answer evidence questions about agent configuration. The CLI is the source of
truth for all numbers; your job is to pick the right command, run it, and interpret the output honestly.

## Prerequisites

Check availability with `npx skillfit@0.14.0 --version`, or `node dist/cli.js --version` inside a clone.
If neither works, tell the user to install from https://github.com/remote-controlled-man/skillfit and stop.
For source-only commands below, set `skillfit_source` to the absolute path of a
built checkout, then run from the project/study workspace that owns the outputs.
The evaluation workflow requires 0.12.0 or newer for Git-bench/layout,
ordinary CLI costs, API-failure evidence, bundled names and recorded case drafting.
Earlier versions lack some of these fixes; inspect the installed version before using new flags.
The 0.14.0 package adds numerical, trigger-observation and per-call
model-identity corrections, self-test protocol 1 and bench schema 2 /
measurementScope 1. npm 0.13.1 does not include these additions. Registry
availability is separate from source preparation; if 0.14.0 is unavailable,
use the reviewed implementing source snapshot. Read the
[capability table](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/experiment-workflow.md#executor-capabilities)
before promising a mode, strict budget or model provenance. A package version
string does not prove the checkout's new behavior is released.

Source links in this standalone driver use the
[reviewed source snapshot](https://github.com/remote-controlled-man/skillfit/tree/c9522ddea4c181056f1065e04f3ee0f69845146a). They do not follow main.
This snapshot predates the 0.14.0 version bump and may still print 0.13.1; the
full commit, not that earlier version label, identifies its implementation.
For published npm 0.13.1 behavior, use its
[original documentation](https://github.com/remote-controlled-man/skillfit/tree/4eaefde80f7e8a6b1e01939d3bd8a8b6418b75d6/docs);
do not substitute that older package for an example requiring 0.14.0 features.

## Which command for which question

| User asks… | Run |
|---|---|
| "我的 skill 有没有被用到 / are my skills used at all" | `skillfit report` — read-only, free, instant; start here |
| "这个配置健不健康" | `skillfit doctor` — read-only |
| "这个 skill 值不值得装 / does this skill help" | Preview `skillfit eval <skill-path> --mode installed --bench <bench> --agent <id> --trials 3 --dry-run`, then run within authorized spending |
| "新版 Skill 是否值得采用 / evaluate a candidate for a Skill evolution workflow" | With npm 0.9.0 or a current checkout, use `eval --request <request.json> --dry-run`; read the [component contract](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/reference/eval-component.md) for inputs and acceptance policy |
| "agent 自己想不想得起用它 / does it trigger" | same + `--mode trigger`. Add `--compete-installed` to copy other user Skills; otherwise recall is an upper bound. Codex counts a `SKILL.md` read |
| "这个 MCP 能不能连上 / is this MCP catalog valid" | `skillfit mcp check <probe.json>` — read-only discovery; calls no tools |
| "这个 MCP / AGENTS.md 真的有帮助吗" | Preview `skillfit eval <experiment-dir> --bench <bench> --agent <id> --trials 3 --dry-run`; follow the [configuration experiment guide](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/experiment-workflow.md#rules-and-mcp-overlays) |
| "建一个 bench" | `skillfit bench init [dir]` then `skillfit bench check [dir]`; default schema 1 stays unrecorded; source supports explicit `--schema-version 2` with [claims](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/benches/README.md#claims-and-measurement-scope) |
| "花钱前确认流水线能测到预期对照" | 0.14.0 / reviewed source: preview `node "$skillfit_source/dist/cli.js" bench self-test "$skillfit_source/benches/_self-test/example" --runs-root ./runs --run-group controls-001 --json --dry-run` from the owning workspace, then confirm with `--plan-sha <plan.sha256>`; read [self-test](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/bench-authoring.md#test-known-controls) for controls, limits and fresh output rules |
| "做代码修改 case" | `bench init <dir> --kind command --dry-run`, then apply within the authorized scope; replace the teaching case with the real fixture, prompt, verifier and oracle |
| "给 Agent 看 case 校验失败原因" | `bench check <dir> --json` — offline gate IDs, evidence and remediation; this is the integrity result, not calibration |
| "先测 case 难度" | Version 0.11.0: `bench check <dir> --calibrate --agent <id> --task <id> --trials 1 --max-calls 1 --run-group <fresh-name> --json --dry-run`; calibrate only within authorized spending |
| "查看或管理 case" | `bench list <dir> --json`, `bench show <dir> <id> --json`; preview `bench edit <dir> <id> --set field=value --json` or `bench remove <dir> <id> --json` |
| "只测几个 case" | Repeat `eval --task <id>` or set request `taskIds`; source also supports task selection for calibration/trigger; preview the selected budget and keep validation independent |
| "把结果交给另一台机器复现" | Preview `report eval <run-dir> --export <new-dir> --json`, then apply within the authorized scope; read the [portable package contract](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/reference/evaluation-reports.md) for matching inputs, stopped costs and sharing review |
| "把这次翻车存成任务" | `skillfit bench add <bench> --freeze --task <id> --prompt "..." --verifier-cmd "<cmd>"` |
| "帮我起草 verifier" | same but `--decompose --agent <id>` — an agent drafts verifier + oracle; admitted only if the NOP + oracle gates pass |

Executor choice: `--agent kimi-code`, `--agent codex` or `--agent claude-code` drives the local CLI (no API key needed).
It uses that CLI's authentication; offline preflight cannot confirm login.
Without `--agent`, paired eval needs `SKILLFIT_API_KEY`/`OPENAI_API_KEY`. Current-source
trigger adapters for all three are exercised offline. Claude's stream-json entry
is connected with fake-subprocess coverage; this is not live CLI/authentication
verification. Codex observes literal registered-file read commands rather than a
native Skill event. Missing/incomplete observation remains unknown, not false.

Installed mode delivers the complete Skill; default inject mode measures injected
text. Since 0.12.0, bundled-name resolution is shared by read-only bench
commands and eval; local paths win. Editing still needs an owned local directory.
Git-root benches are supported since 0.12.0, with metadata excluded consistently.
Keep `--runs-root` outside the bench/Skill/runtime and Git metadata; bad layouts
are rejected at preview, including aliases. See the
[first-run guide](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/first-real-eval.md).

Since 0.12.0, `--freeze` selects tracked ordinary files inside Git; outside Git,
explicit `--include <file-or-dir>` selections are required. Narrow large fixtures
before importing. For `--decompose`, preview and authorize its single call within
existing spending permission. Failed/interrupted drafts retain costs and inputs;
never retry implicitly. See [drafting records](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/bench-authoring.md).

Current-source schema 2 requires explicit `--claim` values for add/freeze/from-commit;
claims edits use a JSON array and never upgrade schema 1 implicitly. Preview and
inspect every selected task's `measurementScope`: unsupported schema 2 targets
refuse before verifier/oracle/executor calls. Derivation comes from mode/policy;
never add an `objective` field to request schema 1. Calibration and fixed self-test
controls have null diagnostic targets. Claims are design declarations, not proof
of validity, power, workflow-process measurement or adoption eligibility.

The self-test uses fixed mock-only paired inject/installed controls, no Agent/API/
judge/drafter calls. It executes trusted local verifier/oracle programs; keep them
offline. Missing controls mean not-configured, never permission for live fallback.
Read/export an individual native suite rather than the wrapper parent; replay
preserves synthetic identity, unknown provider usage and ineligibility. It does
not test native activation.

## Spend discipline

Real eval and calibration runs cost tokens and time. Before any non-dry-run run:

1. Run with `--dry-run` and show planned calls (selected tasks × trials × conditions, plus enabled judges).
2. State the call ceiling and known cost limits. Continue within existing spending authorization; ask only when the proposed run exceeds it or spending has not been authorized.

Version 0.11.0 supports JSON preview/confirmation, fixed task selection,
five-field spending limits and executor timeouts for ordinary eval, trigger and
calibration. JSON execution needs the same explicit fresh `--run-group` and
exact preview hash: `plan.sha256` for eval, `plan.planSha256` for calibration.
Dry previews execute no verifier/oracle/agent. Inspect the environment's nested
`status`: a generated `planned` result can still be blocked by a missing CLI.
Login always remains offline unknown. Live calibration/eval block hard case or
environment failures; warnings and unknown evidence are not interchangeable.
See [shared planning](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/experiment-workflow.md).

Calibration has one no-Skill baseline arm and defaults to two trials; trigger
has one installed arm, defaults to five and skips unlabeled selected tasks.
Retain positive and negative labels for trigger measurement. Trigger already
uses on-disk files; omit `--input`, paired order and judge options. A small
development mechanism check cannot become independent validation by renaming it.

## Interpretation discipline (do not skip)

For request-based eval, review the JSON plan and its call ceiling, then execute with
its exact `--plan-sha` within existing spending authorization. Read
`acceptance.decision` and `eligibleForUpgrade`; a zero exit status only means a
report was produced. `reject` and `inconclusive` cannot authorize an upgrade.
`accept` is scoped advisory eligibility, not permission to install or publish.
`automaticUpgrade` is always false. Reproduce saved outcomes and accounting with
`report eval <run-dir> --json --replay`, using trusted verifier code; it calls no model.
This interface is included in npm 0.9.0 and newer; npm 0.8.0 does not include it.
For new cost comparisons, declare `pairOrder: "balanced"` to alternate which arm
runs first while keeping pairs adjacent. Freeze the task set, candidate and policy
before validation; development results and stopped batches stay separate.
The default policy needs a positive quality gain. Explicit policy version 2 with
`objective: "efficiency"` instead tests stable uncached-input savings with no
observed pass/score/check regression. Declare the objective before calls and read
`costs.efficiency`; a tied quality result stays inconclusive and is not equivalence.
Missing usage or an incomplete batch cannot authorize adoption under either objective.
Optional request `spendingBudget` (0.10.0+) sets whole-batch stop lines. The object
is optional; once supplied, **all five fields are mandatory**: input, cachedInput,
uncachedInput, output and durationSeconds. Token limits must be positive safe
integers; seconds must be positive finite numbers within the parser's safe-number bound.
Reaching a line or losing complete final usage stops subsequent calls. An in-flight
call can overshoot; do not treat it as a provider hard cap or retry permission.
In version 0.11.0, those stops include optional ordinary-eval judge calls.
Read separate Agent/judge/total `invocationCosts` and coverage; older missing
judge receipts remain unknown. An explicitly enabled API judge without
credentials fails instead of silently disabling judging. Ctrl+C/SIGTERM stop
managed work and retain records; do not retry, replace or expand stopped calls
without a fresh authorized plan.

Since 0.12.0, ordinary CLI usage parsing is independent of trigger
detection. Inspect `USAGE_CAPABILITY`: known missing adapter counters block a
strict budget before calls; API/injected coverage remains unknown. API response
format/HTTP failures retain reported counters and raw evidence while stopping
the batch. Missing fields remain unknown, not zero or permission to retry.
Among current CLI adapters, Codex has all required token/cache readers. Kimi lacks
cachedInput and Claude has no token reader, so either blocks the strict five-field
budget before calls, including when selected as judge. Removing the budget requires
a fresh spending review; it does not recover missing costs.

Current-source receipts separate configured/requested models from public response
IDs with source locations. Inspect role/call coverage in reports; Codex/Kimi's
reported models and missing legacy identities remain unrecorded. A CLI version,
configuration alias or assistant's prose cannot prove which model served a call.
Portable replay retains saved declarations without querying today's configuration.
For new records also inspect frozen `measurementScope` and goal-specific
diagnostics. Report policy overrides cannot rewrite that target or grant an
undeclared claim. Legacy missing scope remains unrecorded, without a new
historical adoption requirement; a declaration mismatch is an integrity error.

- Read the verdict line, the discordant-pair counts, and the CI — not just the delta. `inconclusive` means
  the run cannot tell, not that the skill is useless.
- Anything printed as `indicative` (small benches, few trials) must be reported as indicative.
- A baseline pass rate ≥ 90% warning limits observed quality headroom; it does not
  automatically discard a task for efficiency. Complete costs, successes in both
  arms and no observed pass/score/check regression are still required. Calibration
  alone cannot establish savings or quality equivalence.
- Trigger mode: report recall, false-trigger rate, CIs and unknown/error coverage.
  Its single installed arm cannot establish a no-Skill comparison or loading benefit.
- The 8-task/5-pair scale/adoption floor is not a power guarantee or a minimum for
  every within-bench exact-test verdict. No validated MDE planner or trajectory
  scoring exists. A test artifact or zero outcome delta cannot settle unmeasured
  process claims; distinguish saved replay from independent third-party live runs.
- Cite the actual native run and summary path: paired/trigger `manifest.json`,
  calibration `_calibration.json`, or retained session/receipts for a stopped run.
- Source supports native audit, offline delivery replay and portable export for
  supported sealed calibration/trigger and new judge runs. Historical standalone
  summaries stay unverified; missing receipts/runtime support cannot be fabricated.
  Replay preserves observations and cannot authorize single-arm adoption or prove
  independent validation. Paired `--policy`/`--records` do not apply to single-arm reports.
- Full metric definitions: `docs/reference/metrics.md` in the skillfit repo.

## Safety

- `report` and `doctor` are read-only except explicit `report eval --export --yes`,
  which writes a fresh local replay directory. Export calls no model; running
  `reproduce.mjs` executes trusted verifiers. Review project data before sharing.
- `mcp check` starts the configured local server and performs discovery only; it never calls a tool.
- `eval` writes under the declared runs root (`runs/` by default).
  Run from the project/study workspace that owns the experiment; relative output
  paths follow that working directory. Keep retained studies outside the skillfit
  source checkout; source-development validation uses OS temporary directories.
  Exclude outputs from that project's Git history; the CLI does not edit its ignore rules.
  Keep derived analysis/scratch outside sealed batches; never edit/prune indexed
  receipts. Follow the [workflow](https://github.com/remote-controlled-man/skillfit/blob/c9522ddea4c181056f1065e04f3ee0f69845146a/docs/guides/experiment-workflow.md#retain-and-clean-up)
  for explicit manual retention/cleanup. This CLI has no automatic GC or generic
  custom process-metric collector.
- `bench init` / `bench add` show a plan before writing; `bench edit/remove` default
  to a plan and apply with `--yes`, with backup and validation. Removal preserves
  files and cannot remove the last registration. Use existing authorization for
  scoped writes; ask only when that authorization is missing.

<a id="historical-study-archives"></a>
