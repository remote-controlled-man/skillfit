# Plan, run and recover an evaluation

Use the [current source build](../README.md#choose-your-build). For a complete
zero-model-call loop, start with [first evaluation](first-real-eval.md).
[Bench authoring](bench-authoring.md) covers local gates and controls;
[the component contract](../reference/eval-component.md) owns machine fields,
[report reference](../reference/evaluation-reports.md) owns saved formats and
[metrics](../reference/metrics.md) owns statistical meaning.

## Choose the study and batches

Declare the question, claim, representative tasks, sample size, policy and stop
conditions before looking at validation outcomes. Development and optional live
calibration use separate batches; freeze independent validation before evaluating
the candidate on it. Calibration is baseline difficulty, trigger is single-arm
activation, and paired eval compares outcomes/costs. Do not pool these populations.

Use this order:

1. Prepare reusable inputs and run offline `bench check` / known controls.
2. Develop and, if separately authorized, calibrate on development tasks.
3. Freeze validation inputs, candidate, policy, task order and spending limits.
4. Preview the exact fresh batch and confirm its digest within spending scope.
5. Execute the fixed cohort, retaining attempted failures and available costs.
6. Read sealed facts; save derived analysis outside the batch.
7. Export only for a real recipient/reference, verify/replay the delivery, then
   apply the [retention rules](#retain-and-clean-up) to unused whole batches.

## Plan before spending

```bash
node dist/cli.js eval ./my-skill --bench ./my-bench --agent codex --dry-run
```

Replace the paths with checked inputs. Preview is read-only: no output group,
verifier/oracle/judge/model dispatch or fresh login probe. Review selected tasks,
claim, delivery, trial count, pair order, call ceilings, timeouts, counters,
executor/judge and paths. Ready environment checks do not prove authentication.

Injection compares a prompt overlay. Installed mode delivers complete Skill
bundles into disposable per-condition configuration layouts. Revision comparisons
use two complete same-name versions. Workspace input gives a CLI agent files on
disk; snapshots and trigger observation have different capabilities. Rules/MCP
use [configuration overlays](#rules-and-mcp-overlays).

JSON/request execution binds the reviewed digest and explicit fresh run group.
Remove `--dry-run` and supply `--plan-sha <plan.sha256>` only when spending is
authorized. Text mode retains its confirmation behavior; a supplied digest must
still match. Calibration uses `plan.planSha256` instead. Input, policy,
environment/context or implementation changes require a new preview. Existing
outputs cannot be overwritten, including stopped or empty groups. Outputs must
be outside inputs/configuration and non-overlapping.

Execution repeats preflight and hard local gates before spending. Broken fixture,
verifier, oracle, protected-file or source checks stop dispatch. NOP must fail;
the oracle repair must pass. Infrastructure errors are ungraded, and no oracle
means winnability is unknown. [Claims](../../benches/README.md#claims-and-measurement-scope)
restrict schema 2 targets before gates or model calls.

## Bound calls and spending

Use a small preview first, with registered task ID and fresh paths:

```bash
node dist/cli.js eval ./my-skill --mode installed --bench ./my-bench --task my-task --agent codex --trials 1 --max-calls 2 --pair-order balanced --executor-timeout-seconds 300 --runs-root ./runs --run-group preview-001 --json --dry-run
```

`--max-calls` caps attempted calls, including an enabled judge. Refusal before
dispatch differs from an invoked failure. No automatic retry or model upgrade is
implicit. Omitted CLI deadlines retain 600 seconds; API defaults to 120. The explicit
executor deadline also applies to an ordinary-eval judge with its own timer.
Verifier deadlines are separate. Wall timestamps identify events; monotonic
clocks measure elapsed duration, which is not provider billing time.

An optional `--spending-budget ./budget.json` freezes all five stop-line fields:

```json
{"input":100000,"cachedInput":100000,"uncachedInput":100000,"output":10000,"durationSeconds":1200}
```

Choose actual limits before authorizing spending. All fields are required;
tokens are positive safe integers; numeric seconds are positive, finite and at most Number.MAX_SAFE_INTEGER.
There is no duration-only strict budget. Both primary and judge need supported
readers and complete final counters on each invocation. Missing/partial usage
stops further calls; it is never filled with zero. Editing the budget file cannot
adjust an active run. Replanning without a strict budget does not authorize cost
or convert unknown counters into observations.

For Token-first work in the current source, set budget `durationSeconds` to `null`
and request `executorTimeoutSeconds` to `null` (ordinary CLI flag:
`--executor-timeout-seconds none`). Both nulls are explicit: omission preserves
legacy deadlines; a positive duration preserves legacy between-call stopping.
For example, `{"input":1200000,"cachedInput":1050000,"uncachedInput":200000,"output":30000,"durationSeconds":null}`
sets four Token stop lines without a time stop line. Choose the limits for the
actual study and retain `maxCalls`; the numbers here do not authorize spending.
This source feature is not in the already published npm 0.14.0 package.

Token-only execution requires during-call usage observation on **every** executor
role. Currently only the Codex adapter supports it, including a Codex judge or
drafter. Other adapters refuse before dispatch. About once a second, the adapter
reads the latest identity/workspace-bound cumulative local Token snapshot and
compares it with the budget remaining after earlier completed calls. It never
adds repeated snapshots. At a reached line it stops the managed process tree,
retains partial usage/source and `SPENDING_BUDGET_REACHED`, and skips grading and
later calls. Output includes provider-reported reasoning tokens;
[cache arithmetic](../reference/evaluation-reports.md#cache-and-coverage) owns how
cached and uncached input relate.

The local session format is internal and best-effort: updates may lag, and missing,
invalid or stale observations stay unknown. Public Codex JSON usage appears at
`turn.completed` ([official non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode)).
A disabled Agent deadline keeps timing diagnostics without aborting on elapsed
waiting or clock-observation gaps. Manual cancellation, terminal CLI/network
failure, output bounds and separate verifier/tool timeouts still apply.
[Stopping semantics](../reference/metrics.md#costs-budgets-and-stopping) owns
overshoot, lower-bound receipts and the rule that elapsed time is not active
model computation.

## Executor capabilities

This table describes current skillfit adapters, verified offline against the
[matrix](https://github.com/remote-controlled-man/skillfit/blob/ed5eaff7d222de1c73874ce022785fbe89291017/src/matrix/agents.json)
and adapter fixtures. It does not attest today's installed vendor CLIs, login or a
provider backend, and [sampling remains unpinned](../reference/metrics.md#unit-of-analysis).

| Executor / delivery modes | Trigger observation | Token/cache reader | Spending budget | CLI version / public reported model | Verification scope |
| --- | --- | --- | --- | --- | --- |
| Codex CLI: paired inject/installed, rules/MCP overlays, calibration, trigger; optional judge/drafter | Literal read command against registered `SKILL.md` paths, not a native Skill event | Per-turn input, cached input, output; uncached input by subtraction; failed-call recovery stays partial | Numeric duration: between-call stop lines. Null duration: during-call cumulative observation, with delayed/unknown updates; every completed call still needs complete final usage, including an enabled judge | Matrix `--version` probe during execution preparation; allowlisted configured model only, reported model unrecorded | Current factory, parser, guards and replay exercised offline; PATH presence/fixtures do not attest installed-version flags or login |
| Kimi Code CLI: same modes | Exact designated `Skill` argument in flat tool-call events | Input/output from matched local session usage; no cached-input partition | Blocked before calls: cachedInput unavailable | Matrix `--version` probe; no confirmed public model reader, reported model unrecorded | Offline factory/parser fixtures; current real CLI/authentication not verified in this remediation |
| Claude Code CLI: same modes | Exact registered directory/frontmatter Skill identity in content-block events; stream-json entrance connected | No token reader implemented | Blocked before calls: input, cachedInput and output unavailable | Matrix `--version` probe; public assistant `message.model` IDs and source lines retained | Entry point tested with Node-only fake subprocesses, including failures and portable replay; real CLI/authentication unverified |
| Chat Completions API: paired inject/snapshot; optional judge/drafter | No native trigger or installed/workspace/config-overlay delivery | Response input/output and explicit cached tokens; absent/invalid fields remain unknown | Numeric duration: UNKNOWN offline; missing/partial final counters stop further calls. Token-only/no-deadline mode unavailable | No CLI version; configured/requested model and response `/model` recorded separately | Injected HTTP responses and offline replay; no provider/network validation |


Trigger is single-arm; calibration is baseline-only. Optional judges apply to
ordinary paired evaluation, not trigger/calibration or request-component runs.
Drafting has its own authoring record. Installed/workspace/overlay delivery needs
a CLI executor. CLI version capture covers the selected primary and separate
drafter; there is no separate judge CLI probe. Missing probes remain unrecorded.
Configured/requested identity and public reported IDs are separate declarations;
reports never backfill old identity from today's configuration.

## Read, share and reproduce

```bash
node dist/cli.js report eval ./runs/my-run
node dist/cli.js report eval ./runs/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./my-run-replay --yes
node ./my-run-replay/reproduce.mjs --verify-only
node ./my-run-replay/reproduce.mjs
```

Use a native run directory (a self-test suite is one), a supported saved summary,
or a replay package as appropriate. Reports read saved inputs, not the current
machine, and do not call agents. Markdown is a derived report, not replacement
evidence. Review prompts, outputs, copied project files and paths before sharing;
a portable export can include private material. Keep any redacted derivative
separate with its own recovery instructions; never edit original evidence.

Export pins the run's original runtime and hash-checked inputs, not today's
implementation. Reproduction audits and regrades saved output without model
calls. It preserves unknown usage and synthetic/incomplete eligibility limits.
Native stopped/incomplete inputs are first-class records, not zeros or success.
Do not pool cohorts or drop negative results. The [report format reference](../reference/evaluation-reports.md)
explains required files, missing legacy capabilities and explicit recovery.

SIGINT/SIGTERM seal stopped-prefix accounting and terminate descendants; abrupt
kill can leave incomplete evidence. Guards protect original configuration and
stop on unexpected changes. Completed accounting alone is not efficacy.
Current report/export/replay operates on explicitly supplied saved runs. Preserve
their sealed inputs and original runtime; replay does not start a new paid experiment.

## Store process data and analysis

Run skillfit from the project/study workspace that owns the experiment. Relative
paths, including the default `./runs`, resolve from that working directory, not
from skillfit's installation or source checkout. Source builds are tools: invoke
their compiled CLI by absolute path when working elsewhere.

Use an outer study workspace, ignored when it is inside a Git project; only batch
directories have the native CLI layout. For example, select `--runs-root ./runs/my-study/batches` and an explicit
fresh `--run-group dev-001` or `validation-001` when previewing/confirming:

```text
runs/my-study/
  request.json             # optional experiment request, when using --request
  batches/
    dev-001/               # native records, including sealed inputs/runtime
    validation-001/        # independent validation; same native layout
  derived/                 # analyses, charts, reports and their method/version
  scratch/                 # temporary work with no evidence consumer
  exports/                 # complete deliveries made for an actual consumer
```

This is a convention using existing paths, not a new format or required set of
folders. Create only what is needed. Local inputs/outputs remain out of Git;
reusable benches and source methods belong to their existing owners. Ignored
storage is not a backup or a public delivery location.
Exclude generated outputs from the owning project's Git history; skillfit does
not edit that project's ignore rules.

`runs/` is generated data in that owning workspace, not a skillfit source module.
Use one named workspace for an actual study; do not mix source clones, package
installations, build logs or release verification into it. One-off validation
scratch uses OS temporary directories, and release receipts use their explicit
external destination. Create neither a placeholder README nor another
archive/catalog to make an empty output directory persist.

| Data | Where and what to retain |
| --- | --- |
| Memory-only intermediate values | Keep in memory; no file for each variable. |
| Observed facts | Existing native call/trial receipts, responses, timing, usage and provenance. Preserve failures, missing/partial values and the sealed input identity. |
| Derived process metrics | `derived/`, outside every native batch. Identify source batch/hash, method/version, unit and missing-value meaning; preserve a method needed by a final conclusion. |
| Temporary work | `scratch/`, only when no record, analysis or delivery depends on it; reclaim after its processes finish. |

Choose process measurements for a declared question, such as observable tool
calls or stage time. Keep observations separate from computed counts/ratios.
Missing observation is unknown, not zero; an assistant's description is not an
observed event. Logs that supply an observation follow the facts rule. New raw
observations need an owned, versioned writer/reader contract; there is no generic
custom telemetry or trajectory-scoring facility in this CLI.

Sealed, hash-indexed native records are immutable: do not add analysis files inside
`batches/<group>/`, edit a receipt, or delete a transcript/trial workspace that
appears in `_artifacts.json`. Those workspaces are part of the record, even if
they look temporary. Store reports in `derived/` after creating that directory.
External analysis is not automatically included in portable export; disclose its
inputs/method and deliver it separately when a conclusion depends on it. A
redacted derivative keeps its own identity and recovery limits.

## Retain and clean up

Retention is a consumer decision, separate from `completed` / `stopped` /
`incomplete`. A completed run may be unused; a failed run may be essential.

| Keep while… | Action |
| --- | --- |
| A conclusion, cost account, investigation or replay still references the batch | Keep the complete native record or a verified complete delivery that satisfies those consumers. Include negative/stopped observations in the declared population. |
| A recipient or published claim relies on a delivery | Keep one complete verified package in the actual delivery location, with its descriptor/hash and stated availability. Check needed external verifier toolchains. |
| Analysis can be rebuilt from retained facts/method | Delete/recompute expendable derived copies when needed; retain final interpretation and method where actually consumed. |
| Temporary work has no remaining consumer | Clean it after the processes finish. Native indexed files never become scratch by filename. |

Cleanup is manual; there is no retention marker, automatic expiry, GC command or
supported native-record slimming. Before deleting anything:

1. Select explicit, known batch/scratch/duplicate-export paths and inspect their
   contents/size. Do not target the whole runs root or private lab.
2. Confirm no process is active and no conclusion, accounting, diagnosis or
   delivery depends on those bytes. Do not delete negative results selectively
   while keeping a study claim that depends on its original cohort.
3. If keeping a portable delivery instead, verify and actually replay the complete
   moved package first; confirm no remaining consumer needs the original path.
4. Delete only the selected unused **whole batch**, redundant complete export,
   or genuinely expendable outer files. Keep active/referenced batches and intact
   indexed records.

A fixed published package may be a normalized or redacted derivative, not an
exact backup of private originals. Verify the delivery satisfies its actual
consumer before discarding an original; record the loss of raw recovery when
the owner chooses to retire that work. Ending an entire unused study may remove
its local originals together. This does not rewrite published observations or
justify dropping negative outcomes from a retained claim.

Snapshots and portable exports contain intentional exact-byte copies. The export
preview reports payload size; native `inputSnapshot.cost` reports snapshot bytes,
files and copy time. Avoid exports without a consumer and unneeded duplicate
local deliveries. No shared object store or payload deduplication is required.

## Rules and MCP overlays

This optional recipe leaves the main workflow above unchanged.
A configuration experiment holds task/fixture constant while changing only
matrix-defined project configuration. An MCP discovery check validates catalog
protocol, not effectiveness, and starts a local server even though it calls no
tool. Run it only against a server you intend to inspect.

### Inspect an MCP server

Create a local JSON file describing a stdio server. The optional `env` object is passed only to the
child process. Keep credentials in inherited environment variables whenever possible; do not commit
secrets in the spec.

```json
{
  "schemaVersion": 1,
  "name": "my-server",
  "transport": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/server.mjs"],
  "env": {},
  "timeoutMs": 10000
}
```

Inspect the plan, then run the read-only discovery check:

```bash
node dist/cli.js mcp check ./my-server.probe.json --dry-run
node dist/cli.js mcp check ./my-server.probe.json
```

The check starts the server, performs the MCP initialization handshake, follows every `tools/list`
page, and audits unique tool names, descriptions, input schemas, and annotations. It rejects a
different negotiated protocol version, a missing tools capability, malformed responses, and repeated
pagination cursors. It never calls a tool. This separates protocol or catalog defects from model
behavior.

The probe supports newline-delimited stdio and Streamable HTTP. Inspect the
transport-specific plan before execution; discovery performs network I/O for an
HTTP server. It never establishes tool effectiveness.

### Prepare the overlay

Create a directory with this shape:

```text
context7-experiment/
├── skillfit-experiment.json
├── baseline/                 # optional
│   └── .codex/config.toml
└── treatment/
    └── .codex/config.toml
```

`skillfit-experiment.json`:

```json
{
  "schemaVersion": 1,
  "name": "context7",
  "kind": "mcp",
  "baseline": "baseline",
  "treatment": "treatment"
}
```

Valid kinds are `mcp` and `rules`. `baseline` is optional; omit it to compare against the untouched
bench fixture. `treatment` is required and must contain at least one file. Both paths must stay inside
the experiment directory, including after symlinks are resolved.

The treatment must use the selected agent's project path from
[`src/matrix/agents.json`](https://github.com/remote-controlled-man/skillfit/blob/ed5eaff7d222de1c73874ce022785fbe89291017/src/matrix/agents.json):

| Agent | Rules path | MCP path |
|---|---|---|
| Codex CLI | `AGENTS.md` | `.codex/config.toml` |
| Claude Code | `CLAUDE.md` | `.mcp.json` |
| Kimi Code | `AGENTS.md` | `.kimi-code/mcp.json` |

Each overlay may contain only the selected agent's matrix-defined project configuration files.
skillfit rejects source code, tests, fixtures, and other files in an overlay so the treatment cannot
smuggle a solution into the task workspace.

Do not store tokens in an overlay. Reference environment variables from the agent's configuration
format and provide them only in the local process environment.

### Preview the comparison

```bash
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5 --dry-run
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5
```

For every task and trial, skillfit copies the same fixture into both arms. It snapshots the fixture
for the task prompt, then applies the arm's overlay. Configuration contents are therefore absent from
the prompt snapshot. The local agent CLI discovers rules or MCP through its normal project loader.

Codex loads project `.codex/config.toml` only for trusted projects. For Codex MCP trials, skillfit
passes a per-run CLI trust override for the disposable trial repository. It does not change the user's
Codex config or persist trust after the run. Review the bench fixture and MCP overlay before running:
the trusted trial can load their project configuration. See the
[official Codex configuration guide](https://learn.chatgpt.com/docs/config-file/config-basic).

The resulting schema-v4 manifest records target kind, name, content hash, overlay file list, bench
hash, executor, tokens, per-task outcomes, confidence intervals, and verdict. The same verifier and
statistical protocol used for Skill experiments applies.


Useful cases check task outcomes, correct/false tool selection, errors, observable
costs and confirmation behavior. Prefer a disposable fixture server for repeatable
outcomes. An experiment does not authorize side effects in external systems.
