# Architecture interfaces

**Current** below means an existing source interface. **Proposed** means a
remaining A4 target, not a callable API or installed npm feature. Public command,
request/result, statistical and evidence semantics remain in their existing
canonical contracts. A2/A3 change internal ownership without new CLI flags or persistent fields; current source is not proof of a released package.

## Current entry contracts

| Entry | Existing preparation/dispatch | Confirmation and result boundary |
| --- | --- | --- |
| Positional eval, inject/installed/trigger | `runEvalCli(options, expectedPlanSha256?, context = {})` → application `runEvaluation` → prepare/execute/read | JSON execution requires `--plan-sha` and the preview's run group at CLI level. Plain text execution permits an omitted digest; when supplied, digest/run-group checks apply. Do not claim all eval execution requires `--yes` or an interactive prompt |
| Paired request component | `runEvalComponent(requestPath, options)` delegates to `runComponentEvaluation`; request/policy hashes remain in the reviewed plan | Execution requires matching plan digest. Current request is installed Skill comparison without a judge; returns the existing result/assessment and never installs an accepted candidate |
| Calibration | `prepareCalibration` / `prepareBenchCalibration` → `executeCalibration` after shared offline gates | Separate typed plan with `planSha256`, not paired plan's `sha256`; JSON execution requires a preview digest/run group. Human entry can omit a supplied digest and still rechecks its prepared plan |
| Bench self-test | `prepareBenchSelfTest` → fixed controls → application `runEvaluation` for each paired suite | JSON execution requires group/digest; human execution uses existing confirmation unless `yes`. Context binds suite/control digest and stop strategy; model calls remain zero |
| Saved reports | `readEvaluationReport` / `reportEvalComponent` re-export application `readEvaluation` and its mode-specific audit/read | JSON/Markdown interpret the same saved evidence. Ordinary reading calls no model; explicit replay can execute retained local verifier commands |
| Bench authoring | Existing init/add/source/draft/manage functions | Keep each command's existing preview/write/confirmation contract; explicit draft/decompose has a separate call budget and is not a hidden prepare step |

Sources: [CLI](../src/cli.ts), [eval CLI](../src/commands/eval-cli.ts),
[component](../src/commands/eval-component.ts), [calibration](../src/commands/bench-calibration.ts),
[bench entry](../src/commands/bench.ts) and [self-test](../src/commands/bench-self-test.ts).
These distinctions are compatibility requirements, not suggestions to broaden
execution permission. The user's current authorization remains separate.

## Current internal ports

| Interface | Input/output and owner | Side effects / invariants |
| --- | --- | --- |
| `Executor.describe()` | `ExecutorDescriptor`; [types](../src/harness/types.ts) | Describes kind/model intent, actual sampling/trigger surface; description is not proof of provider identity or login |
| `Executor.run(prompt, workdir)` | `Promise<ExecutorResult>` with output and optional public identity/usage/trigger/timing | CLI/API effects belong to concrete adapters; mock/control executors cannot fall back to a real provider |
| `ExecutorFailure` | Same exported error class, result and `executorInvoked` indication | Pre-dispatch refusal and invoked failure are different; retain available partial usage, never recreate the class across a compatibility boundary |
| `prepareEvalPlan(options, context)` | `{ plan, lines, options, assertCurrent }`; [planner](../src/commands/eval-plan.ts) | Compatibility wrapper over `prepareEvaluation` and a presenter; no dry-run command capture. Full context and serialized property order remain digest-bound |
| `runEval(options)` | `Promise<RunManifest \| TriggerManifest \| null>`; [eval](../src/commands/eval.ts) | Compatibility adapter over read-only resolution and `executeEvalPlan`; dry-run emits the same preview and returns null |
| `runTrial` / `runExperiment` | ExperimentPlan → trial outcome / paired RunManifest; [runner](../src/harness/runner.ts) | Prepare workspaces, execute/check/record and summarize; raw internal engine APIs are not a substitute for CLI/request preflight and authorization |
| `runVerifier(benchDir, command, runDir, timeoutSeconds?)` | `Promise<ProcessResult>` with exitCode/output/error; [verifier](../src/harness/verifier.ts), re-exported by runner | Parsed argv, default timeout policy and infrastructure-error classification remain shared by checks/execution/replay |
| `ExperimentSession.wrap(executor, role)` | Executor wrapper; [session](../src/harness/experiment-session.ts) | Guard inputs/configuration, count starts/finishes, append ledger and bind identity; role is agent or judge |
| `finish(error?, result?, resultName?)` / session summary | Retained result/session/artifact evidence | Completion status describes accounting, not efficacy or adoption. Failure/abrupt termination may leave incomplete evidence |
| `parseEvalReport` / `assessEvaluation` | Saved observations plus audit/policy → report/assessment; [parser](../src/harness/eval-manifest.ts), [assessment](../src/harness/eval-acceptance.ts) | One parser; statistical verdict and adoption decision are distinct. Current modules mix some I/O/pure responsibilities and are not wholly declared pure |
| `exportEvaluation` / `verifyReplayPackage` | Native sealed run → fresh portable package / verified package metadata | Verify exact input/runtime inventories and hashes, preserve collisions, never repair an old package by substituting today's code |

Generic module boundaries and one injectable Executor port do not imply that
every entry is already a reusable application service. The current mixed
responsibilities are listed in the [boundary/debt view](architecture-boundaries.md#migration-and-debt-ownership).
`runProcess(command, args, cwd, timeoutMs)` is now an internal
[process mechanism](../src/harness/process.ts); it was private to runner and is
not added to runner's legacy exports. `ProcessResult`, `runVerifier`,
`verifierLogFor`, `verifierFailure`, `gitInit`, `engagementError`, `TrialOutcome`
and `summarizeJudge` remain available through their previous runner path.

A2's [workspace interface](../src/harness/trial-workspace.ts) accepts explicit
fixture/output paths and `removeMockMarker`; it does not infer the condition.
Callers retain snapshot/overlay/install/Git/prompt ordering. Existing installed
Skill/native-diff mechanisms retain their own collision and fingerprint rules.
[Pure paired summary](../src/harness/trial-summary.ts) accepts task-local outcomes
and judge results and returns the existing `tasks`/`overall`, retaining paired
exclusions, cost populations and exact statistical formulas.
[Judge protocol](../src/harness/judge-protocol.ts) accepts an explicit nonce;
`judge.ts` preserves its optional random default wrapper and re-exports the same
`JudgePairFailure` class. [Trigger summary](../src/harness/trigger-summary.ts)
retains the separate single-arm metrics. Audits no longer import execution modules
for these operations; this does not create a public SDK.

<a id="target-application-interfaces-proposed"></a>

## Application interfaces and remaining target

A3 implements the evaluation/read operations below. Only bench authoring
prepare/apply remains proposed for A4. These internal interfaces are not a public
SDK or new serialized schema. Old command paths/signatures delegate to the same
implementation.

| Operation | Input → output | Effects and responsibility |
| --- | --- | --- |
| Current `resolveEvalInputs` | Existing options/isolated input paths + optional environment and clock dependencies → resolved bench/target, mode, fingerprints and pending/known preflight data | Read-only existing resolution/inspection. No run creation, verifier/oracle/judge/model dispatch or extra environment probes |
| Current `buildEvalPlan` | Resolved data + explicit implementation digest + context → existing reviewed plan/preview shape | Deterministic construction; no filesystem, clock, environment, console or process exit. Context retains request/policy/self-test bindings |
| Current `executeEvalPlan` | Rechecked plan + resolved input + executor/session dependencies → existing mode-specific result or stopped failure | Recheck content/environment/implementation/context, run required gates, create fresh session and dispatch. Does not choose a new task subset or bypass confirmation |
| Current `readEvaluation` | Saved path + existing report options → current report/assessment | Parse/audit/assess without model invocation; explicit replay uses retained local verification. Command renderer only adapts the returned result |
| Proposed `prepareBenchChange` | Existing authoring options + explicit source dependencies → proposed writes/source fingerprints/diagnostics | Default preparation is read-only. Drafting stays an explicit separate bounded operation |
| Proposed `applyBenchChange` | Approved prepared change + write dependencies → existing authoring result | Recheck source/target/collision, apply current validation and applicable rollback; new artifacts have no old content to back up |

Current owners are [eval planning](../src/harness/eval-planning.ts),
[execution/application service](../src/harness/eval-service.ts),
[neutral options](../src/harness/eval-options.ts),
[saved read service](../src/harness/eval-read-service.ts) and
[single-arm reader](../src/harness/single-arm-read.ts). `prepareEvaluation`
combines read-only resolution with the actual dist fingerprint; `assertCurrent`
rechecks the full context and implementation at dispatch. `buildEvalPlan` itself
needs only resolved preview data, an explicit digest and context. Its internal
context discriminator is not persisted; arbitrary legacy context fields remain
hash-bound. Presentation hooks receive resolved data/results and never supply
plan data by capturing text.

[Calibration](../src/harness/calibration-service.ts) retains its independent
baseline plan: `resolveCalibrationInputs` → pure `buildCalibrationPlan` →
`prepareCalibration`/`executeCalibration`. Its wire uses `planSha256` and preserves
baseline ordering. Self-test keeps controls/confirmation in the entry adapter,
while each suite calls the application interface. Case preflight and its error
class now live in harness with same-instance legacy re-exports. Authoring's
proposed location remains `harness/bench-authoring.ts`; A4 is unimplemented.

The existing plain/JSON/request confirmation differences remain intact. A
stronger universal confirmation rule would change public behavior and needs a
separate approved contract change. Existing low-level callers remain low-level
callers; service extraction must not claim they independently perform every
entry check today.

## Hashes, compatibility and migration gates

| Constraint | Required migration evidence |
| --- | --- |
| Same resolved data and fixed implementation digest | Preserve preview/result fields, JSON property order and digest computation, including the full existing context object |
| Actual code is moved or added | The implementation fingerprint changes; produce a new preview/confirmation. Do not omit new runtime modules to preserve an old hash |
| Legacy evidence lacks metadata | Preserve unknown usage/model identity/claims. F7 schema 2/measurementScope are present in current source; legacy schema 1 retains unspecified claims and absent old metadata is not fabricated |
| Error/helper moves | Re-export the same class and delegate to the same implementation; preserve verifier messages, exit codes and stop-prefix accounting |
| Move installed or portable package | Include new runtime dependencies and compatibility exports; the installed CLI uses its shipped implementation, and the portable standalone reproducer uses its retained implementation, without source checkout |
| New mode or entry is introduced | Keep matrix/adapter, plan, session, report/schema and checks coherent; don't create a second planner, parser or verdict policy |

A3 follows A2, F7 local delivery and F5 content synchronization. F3 remote CI
and the whole F5 acceptance remain independently pending; A4/A5 and V1 remain
open. The [plan](plans/2026-10-22-documentation-governance-and-architecture.md),
[ADR 0003](decisions/0003-plan-confirm-execute-separation.md) and
[quality scenarios](architecture-runtime.md#quality-scenarios) own migration
order, rationale and verification references respectively.
