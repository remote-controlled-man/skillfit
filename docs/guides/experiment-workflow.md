# Plan, run and recover an evaluation

Use the [current source build](../README.md#choose-your-build). For a complete
zero-model-call loop, start with [first evaluation](first-real-eval.md).
[Bench authoring](bench-authoring.md) covers local gates and controls;
[the component contract](../reference/eval-component.md) owns machine fields,
[report reference](../reference/evaluation-reports.md) owns saved formats and
[metrics](../reference/metrics.md) owns statistical meaning.

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
implicit. CLI deadlines default to 600 seconds; API defaults to 120. The explicit
executor deadline also applies to an ordinary-eval judge with its own timer.
Verifier deadlines are separate. Wall timestamps identify events; monotonic
clocks measure elapsed duration, which is not provider billing time.

An optional `--spending-budget ./budget.json` freezes all five positive limits:

```json
{"input":100000,"cachedInput":100000,"uncachedInput":100000,"output":10000,"durationSeconds":1200}
```

Choose actual limits before authorizing spending. All fields are required;
tokens are safe integers, seconds finite and at most Number.MAX_SAFE_INTEGER.
There is no duration-only strict budget. Both primary and judge need supported
readers and complete final counters on each invocation. Missing/partial usage
stops further calls; it is never filled with zero. Editing the budget file cannot
adjust an active run. Replanning without a strict budget does not authorize cost
or convert unknown counters into observations.

## Executor capabilities

This table describes current skillfit adapters, verified offline against the
[matrix](https://github.com/remote-controlled-man/skillfit/blob/main/src/matrix/agents.json)
and adapter fixtures. It does not attest today's installed vendor CLIs, login
or a provider backend. Sampling remains unpinned: no temperature/seed is sent.

| Executor / delivery modes | Trigger observation | Token/cache reader | Strict five-field spendingBudget | CLI version / public reported model | Verification scope |
| --- | --- | --- | --- | --- | --- |
| Codex CLI: paired inject/installed, rules/MCP overlays, calibration, trigger; optional judge/drafter | Literal read command against registered `SKILL.md` paths, not a native Skill event | Per-turn input, cached input, output; uncached input by subtraction; failed-call recovery stays partial | Adapter has the required readers; every actual call still needs complete final usage, including an enabled judge | Matrix `--version` probe during execution preparation; allowlisted configured model only, reported model unrecorded | Current factory, parser, guards and replay exercised offline; PATH presence/fixtures do not attest installed-version flags or login |
| Kimi Code CLI: same modes | Exact designated `Skill` argument in flat tool-call events | Input/output from matched local session usage; no cached-input partition | Blocked before calls: cachedInput unavailable | Matrix `--version` probe; no confirmed public model reader, reported model unrecorded | Offline factory/parser fixtures; current real CLI/authentication not verified in this remediation |
| Claude Code CLI: same modes | Exact registered directory/frontmatter Skill identity in content-block events; stream-json entrance connected | No token reader implemented | Blocked before calls: input, cachedInput and output unavailable | Matrix `--version` probe; public assistant `message.model` IDs and source lines retained | Entry point tested with Node-only fake subprocesses, including failures and portable replay; real CLI/authentication unverified |
| Chat Completions API: paired inject/snapshot; optional judge/drafter | No native trigger or installed/workspace/config-overlay delivery | Response input/output and explicit cached tokens; absent/invalid fields remain unknown | UNKNOWN offline; permitted to start, then missing/partial final counters stop further calls | No CLI version; configured/requested model and response `/model` recorded separately | Injected HTTP responses and offline replay; no provider/network validation |


Trigger is single-arm; calibration is baseline-only. Optional judges apply to
ordinary paired evaluation, not trigger/calibration or request-component runs.
Drafting has its own authoring record. Installed/workspace/overlay delivery needs
a CLI executor. CLI version capture covers the selected primary and separate
drafter; there is no separate judge CLI probe. Missing probes remain unrecorded.
Configured/requested identity and public reported IDs are separate declarations;
reports never backfill old identity from today's configuration.

## Rules and MCP overlays

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
[`src/matrix/agents.json`](https://github.com/remote-controlled-man/skillfit/blob/main/src/matrix/agents.json):

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

## Read, share and reproduce

```bash
node dist/cli.js report eval ./runs/my-run
node dist/cli.js report eval ./runs/my-run --json
node dist/cli.js report eval ./runs/my-run > ./run-report.md
node dist/cli.js report eval ./runs/my-run --export ./my-run-replay --yes
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
Restoring [historical archives](../maintainers/archive-delivery.md) is an explicit
operation; ordinary install/report/export never imports repository history or
starts paid experiments. Replay original bytes at their pinned runtime.

Earlier source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/guides/experiment-workflow.md).
