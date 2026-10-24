# Offline Agent environment preflight

Version 0.11.0 checks the Agent environment in `eval` preview and before
live dispatch. npm 0.10.1 does not include this
addition. Ordinary paired/trigger eval, Agent requests and baseline calibration
share the check implementation. This is separate from [offline case integrity](eval-case-preflight.md).

## Current source capability table

Reviewed 2026-10-22 against the [matrix](../src/matrix/agents.json),
[preflight counter declarations](../src/harness/agent-preflight.ts),
[CLI reader](../src/harness/executors/cli.ts), [API reader](../src/harness/executors/api.ts)
and [model-identity reader](../src/harness/model-identity.ts). This table describes
skillfit's adapters, not the full capabilities of vendor products. The current
checkout includes unpublished numerical, trigger, model-identity, self-test and
bench-claim changes; npm 0.13.1 and its immutable
release record do not attest these additions. Commands pinned to 0.13.1 in the
onboarding guides retain their released meaning. Build the current checkout to
exercise the source additions below.

| Executor / delivery modes | Trigger observation | Token/cache reader | Strict five-field spendingBudget | CLI version / public reported model | Verification scope |
| --- | --- | --- | --- | --- | --- |
| Codex CLI: paired inject/installed, rules/MCP overlays, calibration, trigger; optional judge/drafter | Literal read command against registered `SKILL.md` paths, not a native Skill event | Per-turn input, cached input, output; uncached input by subtraction; failed-call recovery stays partial | Adapter has the required readers; every actual call still needs complete final usage, including an enabled judge | Matrix `--version` probe during execution preparation; allowlisted configured model only, reported model unrecorded | Current factory, parser, guards and replay exercised offline; PATH presence/fixtures do not attest installed-version flags or login |
| Kimi Code CLI: same modes | Exact designated `Skill` argument in flat tool-call events | Input/output from matched local session usage; no cached-input partition | Blocked before calls: cachedInput unavailable | Matrix `--version` probe; no confirmed public model reader, reported model unrecorded | Offline factory/parser fixtures; current real CLI/authentication not verified in this remediation |
| Claude Code CLI: same modes | Exact registered directory/frontmatter Skill identity in content-block events; stream-json entrance connected | No token reader implemented | Blocked before calls: input, cachedInput and output unavailable | Matrix `--version` probe; public assistant `message.model` IDs and source lines retained | Entry point tested with Node-only fake subprocesses, including failures and portable replay; real CLI/authentication unverified |
| Chat Completions API: paired inject/snapshot; optional judge/drafter | No native trigger or installed/workspace/config-overlay delivery | Response input/output and explicit cached tokens; absent/invalid fields remain unknown | UNKNOWN offline; permitted to start, then missing/partial final counters stop further calls | No CLI version; configured/requested model and response `/model` recorded separately | Injected HTTP responses and offline replay; no provider/network validation |

Trigger is single-arm; calibration is baseline-only. Judges are optional in
ordinary paired eval, not trigger/calibration or request-component execution.
Drafting is its own authoring record, not an evaluation report kind. Installed
and workspace delivery require a CLI executor. Elapsed time is measured by the
harness for all executors and is not provider billing/compute time.
CLI version capture covers the selected primary Agent and separate drafter;
there is no separate judge CLI version probe. A missing/failed probe stays
unrecorded and never substitutes for a reported model ID.

An absent `spendingBudget` remains allowed. If present, **all five fields are
mandatory**; there is no duration-only or partially specified budget. Both the
primary and optional judge must satisfy capability checks. Codex is the only
current CLI adapter with all required token readers; this does not guarantee
final coverage in any particular invocation. Replanning without the strict
budget does not make unknown costs known or authorize spending. See
[stop rules](eval-planning.md#stop-rules-and-results).

New `modelIdentity` v1 retains configured/requested intent separately from
reported IDs. Multiple IDs and unknown coverage remain visible per role/call.
Public response IDs are declarations, not backend attestation or a full subagent
inventory. The frozen plan's legacy `servedModel: "unrecorded"` is not backfilled;
portable replay uses saved bytes, never today's CLI/configuration. See
[model identity contract](metrics.md#public-model-identity-per-invocation) and
[report fields](evaluation-reports.md).
All adapters leave sampling unpinned; current requests send no temperature/seed.

## Bench and offline control support

These current-source contracts apply across the adapters above; they do not
change vendor capability or provide real CLI/authentication attestation. Their
feature protocols, rather than npm 0.13.1's version string, establish availability.

| Surface | Capability and limit | Authority |
| --- | --- | --- |
| Bench schema 1 / explicit schema 2 | Default 1 stays legacy-unrecorded. Schema 2 gates the requested claim across all selected tasks before probes/calls; no automatic task removal or upgrade | [Bench claims and measurementScope 1](bench-claims.md) |
| Full-pipeline self-test protocol 1 | Fixed mock-only paired inject/installed controls, no Agent/API/judge/drafter calls; activation self-test unsupported; synthetic never eligible | [Self-test controls and replay](bench-self-test.md) |
| Saved scope | Paired/trigger/calibration reports and portable replay retain frozen declarations; old missing fields stay unrecorded | [Reports](evaluation-reports.md#frozen-measurement-scope-current-source), [portable packages](replay-packages.md) |

## What is checked

| Code | Result and scope |
| --- | --- |
| `CLI_AVAILABLE` | Checks the selected matrix command's executable on PATH using filesystem access; no `which`, `where`, agent invocation or version probe runs as part of this check. Missing/non-executable files are `FAIL`. API execution needs no CLI (`INFO`). |
| `MATRIX_CAPABILITY` | Matches headless/streaming/Skill delivery declarations and existing executor/input/task compatibility rules. An incompatible choice is `FAIL`; a matrix match does not prove installed-version flag support. |
| `USAGE_CAPABILITY` | Version 0.12.0 checks the adapter's known token counters. A strict whole-batch budget with unavailable required counters is `FAIL` for either primary or judge, before case probes or spending. API/injected coverage stays `UNKNOWN`; runtime final-usage checks still apply. |
| `EXECUTOR_INJECTED` | `UNKNOWN` for a test/programmatic injected executor; it cannot attest an actual CLI installation. Existing synthetic-evidence restrictions still apply. |
| `AUTHENTICATION` | Always `UNKNOWN`: no login command, credential file or network request is used to infer authentication. Existing keys/config files do not prove valid credentials. |
| `GLOBAL_SKILL_CONFLICT` | For the primary CLI Agent evaluating a Skill, checks readable direct Skill entries in matrix-listed user/global roots. A matching directory name or frontmatter name is `FAIL` because baseline may already load the Skill. |
| `GLOBAL_SKILL_SCAN` | Describes the limited root scope; unreadable entries/roots stay `UNKNOWN`. An unreadable root cannot establish absence of contamination. |
| `ENVIRONMENT_CHANGED` | `FAIL` if the check result changes during offline case probes; a fresh preview is needed. |

Agent-specific commands and paths come from `src/matrix/agents.json`, including
configured home overrides and user/global shared Skill roots. Both the target
directory identity and its root `SKILL.md` frontmatter name are considered, so
renaming a candidate directory or a global alias does not hide a same-name Skill.
Directory aliases are followed for manifest inspection. No global Skill is moved,
deleted, disabled or copied by this check.

Executable discovery checks absolute PATH entries and executable-file access
(Windows also uses case-insensitive environment keys and PATHEXT). Shell aliases,
functions and relative PATH entries do not establish availability inside the
disposable trial directory. Use a normal installed executable on an absolute PATH.
The existing native runtime version capture can still probe a CLI during an
authorized real run; it is separate from this read-only preflight.

Streaming is required for native trigger detection. Version 0.12.0 also
uses a matrix-defined structured command for ordinary paired, calibration and
judge invocations whenever available, without implying a Skill trigger event.
Other CLI surfaces keep their existing text fallback. The optional judge's CLI is
checked too, so an unavailable judge blocks before primary-agent spending. API
filesystem/config limitations remain hard errors. Injected executors skip real
binary attestation and use explicitly injected home roots for tests; no actual
user home is scanned for an unconfigured injected executor.

The current Codex JSON adapter can retain input, cached-input and output counters.
The current Kimi adapter can recover input/output but not cache partitioning;
the Claude structured adapter does not collect token counters. This describes skillfit's
implemented readers, not everything the vendor CLI might support. Because all
five spending lines are required, a known missing token/cache reader blocks that
budgeted combination before any call. A new plan without these token limits
still needs explicit spending review and cannot turn unknown costs into zero.
No adapter declaration establishes login, installed-version flag compatibility
or actual final usage; missing/partial counters during a run still stop it.

## Preview, block and recheck

```bash
node dist/cli.js eval ./my-skill --mode installed --bench ./my-bench --agent codex --trials 1 --max-calls 2 --run-group preflight-001 --json --dry-run
```

Paired JSON preview includes `plan.evaluation.agentPreflight`. Its discriminator
is `schemaVersion: 1`, `kind: "skillfit.agent-preflight"`,
`scope: "offline-agent-environment"`; see the [schema](schemas/agent-preflight.schema.json).
It contains `status`, matrix version/date, ordered `checks`, summary counts and
`cost: {modelCalls: 0, cliInvocations: 0}`. Each check has a stable `code`,
`role` (`agent`/`judge`), matrix Agent ID or null, `status`, English `message`,
`remediation` and evidence `paths`. It does not include credentials or Skill bodies.
Human preview prints the same results. Trigger JSON uses the same
`plan.evaluation.agentPreflight`; calibration JSON uses `plan.agentPreflight`
inside its separate `skillfit.calibration-plan`. Both previews execute no
verifier, oracle, agent or judge. See [planning and confirmation](eval-planning.md).

`ready` means zero known failures **within this offline scope**. Login, installed
CLI flag compatibility and unlisted configuration remain unverified. A planned
response/exit 0 from a read-only preview means a plan was generated; callers must
also inspect `agentPreflight.status`. Missing CLI/global-conflict previews can
still describe a `blocked` plan without writing or calling anything. Existing
invalid input/executor combinations remain immediate validation errors.

Live execution rejects `blocked` checks **before** verifier/oracle execution,
native run-directory creation or any primary/judge invocation. JSON returns
`skillfit.eval-error`, `error.code: "AGENT_PREFLIGHT_FAILED"` and the complete
`agentPreflight`, with upgrade eligibility false. Human errors name the failed
checks and remedies. There is no bypass flag. The existing global same-name
contamination guard remains a hard block; it is now visible earlier.

After successful case probes, the environment is inspected again before native
setup. Changed availability/conflicts require a fresh preview and block calls.
The deterministic report is bound into the reviewed eval/calibration plan, so changed
binary resolution or check results also invalidate its confirmation hash.
Authentication unknown is nonblocking and never becomes an authenticated claim;
spending still needs the caller's authorization and working credentials.

## Saved evidence and limitations

Native plans seal `details.agentPreflight`. Paired JSON assessment exposes the
recorded value as top-level `agentPreflight`; human reports show state/checks
without local evidence paths. Calibration and trigger reports expose the saved
metadata too; sealed native records can be audited/replayed, while standalone
historical summaries remain unverified. Historical runs without
the field return null; no past environment is reconstructed.

Report, export and portable replay retain the original check results. They never
repeat PATH/global-Skill/authentication probes on the reader's current machine.
Paired native audit validates recorded state/counts and retains unknown offline
authentication; ordinary reviewed plans must match the sealed checks. A later
machine change cannot silently rewrite the experiment's readiness record.

This is not environment isolation, model identity attestation or a full recursive
inventory of plugins/system/ancestor-project configuration. A different judge's
global configuration is still outside primary-agent configuration fingerprinting.
Executable presence does not guarantee a successful invocation or provider
availability. Existing per-call input/config guards, spending stops, exclusions,
statistical formulas and adoption gates remain unchanged. Inspect paths before
sharing raw JSON/native evidence.
