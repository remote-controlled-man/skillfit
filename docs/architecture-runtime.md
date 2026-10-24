# Architecture runtime scenarios

These are **current-source** scenarios; the [interface view](architecture-interfaces.md#target-application-interfaces-proposed) distinguishes implemented evaluation services from proposed authoring services.
The [metrics contract](metrics.md), [planning contract](eval-planning.md),
[cost accounting](eval-costs.md) and mode-specific guides own their semantics;
this page describes how components collaborate.

## Preview, dispatch and paired execution

1. CLI parses arguments or loads a request, resolves selected bench/target and
   executor descriptors, output layout and limits through `prepareEvaluation`:
   read-only `resolveEvalInputs`, then pure `buildEvalPlan` with the actual
   implementation fingerprint. Calibration has its own typed preparation path. Preview does not execute verifiers, oracles, Agent
   or judge calls or create a run. Existing read-only environment/version
   inspection may occur; offline authentication remains unknown.
2. The entry enforces its existing [confirmation contract](architecture-interfaces.md#current-entry-contracts).
   `executeEvalPlan` resolves again; reviewed-plan comparison must match before calls.
   Offline case checks execute local NOP/oracle/verifier probes in disposable
   workspaces. A gate failure or input/environment change refuses dispatch.
3. A fresh `ExperimentSession` freezes bench/target/implementation and guarded
   request inputs, creates `_inputs`, `_inputs.json` and `_plan.json`, and
   checks that the implementation matches the reviewed descriptor. Existing
   destinations and changed aliases are rejected.
4. Within each selected task, trials run adjacent baseline/treatment arms;
   balanced order alternates the first arm. Workspace setup delivers only the
   declared condition's Skill/configuration. The session wraps each Agent or
   optional judge invocation, checks guards/call ceilings and appends ledger
   events. Spending stops are checked between invocations; in-flight overshoot
   remains possible.
5. The runner retains executor output/usage/identity and verifier results.
   Grading/exclusion does not erase attempted calls or their available costs.
   Pair/task summaries and the manifest are computed under the frozen protocol.
   Session finishing records the terminal session and artifact index.

```mermaid
sequenceDiagram
    participant Entry as CLI or request adapter
    participant Plan as eval-planning
    participant Eval as eval-service
    participant Gate as Offline case checks
    participant Session as ExperimentSession
    participant Engine as runner
    participant Exec as Executor
    Entry->>Plan: Prepare current preview
    Note over Plan: Resolve read-only inputs; build with explicit digest
    Plan-->>Entry: Reviewed plan and digest
    Note over Entry: Apply this entry's existing confirmation rules
    Entry->>Eval: Dispatch and recheck reviewed inputs
    Eval->>Gate: Execute local case integrity probes
    Gate-->>Eval: Ready or block before model calls
    Eval->>Session: Freeze inputs and native plan in fresh run
    Eval->>Engine: Run selected task pairs
    Engine->>Session: Wrapped invocation
    Session->>Exec: Check guards, log start, invoke
    Exec-->>Session: Output or failure with available usage
    Session-->>Engine: Record completion and guard outcome
    Engine-->>Eval: Manifest or stopped error
    Eval->>Session: Finish and index retained evidence
```

This is a successful-path overview with explicit failure returns; it does not
imply that a blocked preflight already has a native run, or that every failure
can create a complete artifact index.

## Mode-specific paths

| Scenario | Current path and delivery | Retained result / conclusion boundary |
| --- | --- | --- |
| Paired inject | `eval-cli`/request → eval-service → runner; target text enters treatment prompt; supported configuration overlays use workspaces | Paired outcomes/verdict under [metrics](metrics.md); baseline assumptions and inherited configuration are explicit |
| Installed Skill/revision | eval-service → runner with complete resource installation and native-diff tooling; revision installs the previous Skill in baseline | Measures declared target vs no harness-installed Skill or a previous revision; revision benefit is not automatically benefit over no Skill |
| Trigger | eval-service trigger dispatch → trigger engine; install the Skill, use labeled task prompts, parse structured observation | Single installed arm, activation/recall/false-trigger evidence; no judge and no paired efficacy/adoption result. Missing observation stays unknown |
| Calibration | calibration-service prepare/execute → shared `runTrial` using an empty target and baseline arm | `_calibration.json`, baseline difficulty, costs and session state; no treatment arm, no quality equivalence or cost-saving conclusion |
| Offline self-test | self-test preparation → fixed `ControlExecutor` → normal paired eval/audit/report; inject or installed suites | Benefit/harm/null/error controls and `_self-test.json`; `harnessModelCalls: 0`, synthetic evidence never eligible for adoption. Local verifier/oracle commands still execute |
| Saved report | report dispatcher → eval-read-service → paired or single-arm parsing/audit/assessment → renderer | Reads retained evidence without a model call; missing receipts/usage/model identity cannot be filled from today's environment |
| Explicit replay/export | verify retained delivery and inputs; replay may rerun local verifiers; export copies verified original inputs/runtime to a fresh destination | Reproduction of saved delivery/grades, not a new model run or third-party live reproduction; unsupported historical runtimes fail explicitly |

Relevant implementations: [eval service](../src/harness/eval-service.ts),
[calibration service](../src/harness/calibration-service.ts), [trigger](../src/harness/trigger.ts),
[self-test](../src/commands/bench-self-test.ts), [saved read service](../src/harness/eval-read-service.ts)
and [portable runtime](../src/harness/replay-package.ts). Current self-test does
not support trigger, rules/MCP, judge or drafting suites.

## Evidence lifecycle and failure states

The steps below explain existing files and statuses. They are not a new
persistent state machine, enum or replacement for a result schema.

| Point | Observable evidence | Required interpretation |
| --- | --- | --- |
| Preview | In-memory/printed plan; machine result may be `planned`; case preflight `pending` | No execution evidence and no adoption authorization |
| Rejection before session | Diagnostic and any separately returned preflight; no native run is required | Do not manufacture completed/stopped experiment data for a call that never started |
| Session prepared | Fresh sealed inputs/native `_plan.json`; only that session may hand the directory to an engine | Another run cannot reuse that directory; recheck fingerprints and alias/config guards |
| Invocation started/finished | `_calls.jsonl`, trial/judge receipts, public transcripts/usage when available | Retain agent/judge roles, failures and partial lower bounds; no unknown-to-zero conversion |
| Normal finish | Mode-specific manifest/result, `_session.json`, `_artifacts.json` | `completed` session means accounting settled; quality/activation/acceptance are separate evaluations |
| Budget/error/signal stop | Retained prefix, stop reason/code and available partial results | Session status can be `stopped`/`incomplete`; wrapper results have their own existing status. No sample replacement, implicit retry or adoption |
| Abrupt interruption or damaged files | Possibly missing finish/index/receipt or a started call without complete output | Report missing/incomplete evidence honestly; do not infer final usage or successful sealing |

`ExperimentSummary.status` is `completed | stopped | incomplete`. Public report
and self-test statuses are separate contracts; a self-test can have status
`passed` for an expected error control while its nested native evaluation is stopped. This
does not make that native evaluation complete or eligible for adoption.
SIGINT/SIGTERM handling attempts descendant cleanup and preserves receipts;
it does not promise recovery after every crash or power loss.

## Deployment and write boundaries

| Location | Owner and behavior |
| --- | --- |
| Source checkout | `src/`, development scripts/tests and the document registry. `dist/` is build output; its full pinned content participates in implementation fingerprints |
| Installed npm package | Compiled runtime, matrix, bundled inputs/docs/profiles/driver and required retained recipes. No source checkout or runtime dependency installation should be needed for supported CLI paths |
| Native run | Fresh user-selected output directory with receipts and sealed input/runtime copies. Collision and input-layout guards protect original data |
| Portable package | `run/`, `inputs/`, `runtime/dist/` and `reproduce.mjs` plus integrity metadata; the standalone reproducer invokes the package's pinned CLI |
| Historical archives | Explicit pinned restoration with size/hash checks and original environment limits. Installation/reporting does not automatically download them |
| Actual user configuration | Only explicit install/setup/bundle-installer workflows use the configuration transaction; preserve first-original/previous-target backups, validation and best-effort rollback |

Package migration must keep new lower-level modules and old compatibility
exports together. Never rewrite a historical package/runtime or reuse today's
implementation to satisfy an old digest. See [package contents](package-contents.md),
[portable replay](replay-packages.md), [sealed inputs](evaluation-input-snapshots.md)
and [archive delivery](archive-delivery.md).

Reading or auditing a portable package through today's `report eval` uses the
current report/audit implementation against the retained run/inputs. Running
the package's `reproduce.mjs` invokes its pinned CLI. Both avoid model calls,
but they are different compatibility checks; current-reader success does not
prove that a frozen reproducer runs, and neither permits replacing its runtime.

## Quality scenarios

Each row is a review/verification obligation, not a claim that all target
architecture rules already have production tests. A1 validates documentation;
the indicated implementation stages must execute the corresponding regressions.

| ID / trigger | Observable architectural requirement | Evidence location / migration owner |
| --- | --- | --- |
| Q1: Add an agent capability or mode | Matrix/adapter contract, planning, receipts and interpretation remain coherent; unsupported combinations fail before calls | [executor](../src/harness/executors/cli.test.ts), [preflight](../src/commands/eval-agent-preflight.test.ts), [CLI usage](../src/commands/eval-cli-usage.test.ts); A3/A5, F7 for claim/schema changes |
| Q2: Preview or change a confirmed input/context | No model/verifier/oracle/run writes during preview; mismatch refuses before invocation | [preflight](../src/commands/eval-preflight.test.ts), [component](../src/harness/eval-component.test.ts), [self-test](../src/commands/bench-self-test.test.ts); A3 |
| Q3: Reach a budget or interrupt/fail a call | No further calls; preserve attempted population, role, partial usage and stop reason; bound process cleanup | [budget](../src/harness/eval-budget.test.ts), [judge accounting](../src/harness/judge-accounting.test.ts), [interruption](../src/commands/eval-interruption.test.ts); A2/A3 |
| Q4: Read legacy/missing or corrupted evidence | Preserve unknown identity/claims/usage and explicit errors; refuse tampering without silently changing historical meaning | [report](../src/commands/eval-report.test.ts), [identity](../src/commands/eval-model-identity.test.ts), [export](../src/commands/eval-export.test.ts); A2/A3 and original F contracts |
| Q5: A synthetic benefit or expected error passes | Run/audit the normal pipeline while adoption remains false; error control retains a stopped prefix | [self-test](../src/commands/bench-self-test.test.ts), [self-test signals](../src/commands/bench-self-test-interruption.test.ts); A2/A3 |
| Q6: Move package/export and remove original inputs | Supported operations and replay work from retained bytes/runtime; altered input/digest refuses | [export modes](../src/commands/eval-export-modes.test.ts), [package](../scripts/check-package.test.mjs), [archive integrity](../scripts/check-archives.test.mjs); V1 |
| Q7: Introduce a reverse or undeclared dependency | Existing runtime cycle/core checks remain; target layer/type/I/O violations require meaningful new rejection cases | [architecture tests](../scripts/check-architecture.test.mjs); A5, not implemented by A1 |
| Q8: Author/import/edit a case or apply configuration | Preserve preview, source restrictions, collisions and applicable backup/validation/rollback; no hidden drafting invocation | [bench source](../src/commands/bench-source.test.ts), [management](../src/commands/bench-manage.test.ts), [transaction](../src/install/transaction.test.ts); A4, installation unchanged |

[ADR 0003](decisions/0003-plan-confirm-execute-separation.md) explains the staged
separation while preserving these lifecycle and compatibility requirements.
