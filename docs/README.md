# skillfit documentation

Start with your own task: create a case, check it offline, preview an evaluation,
then read and share its saved evidence. The bundled cases teach the format.

This index routes readers to maintained guides and contracts. The
[capability table](eval-agent-preflight.md#current-source-capability-table) owns
current-source support and verification limits; the [0.13.1 release record](releases/0.13.1.md)
owns that published version. A checkout carrying the same version number can
contain unpublished changes. Follow each guide's version boundary before using
its commands, especially source-only self-test protocol 1 and bench schema 2 /
measurementScope 1. Use the contracts below for those interfaces; the same
package version string does not establish their availability.

## Start here

- [First real evaluation](first-real-eval.md): npm onboarding, prerequisites, call counts and interpreting results.
- [Current source capabilities](eval-agent-preflight.md#current-source-capability-table): modes, trigger observations, token/cache readers, strict budgets, model identity and offline/live verification limits; unpublished source changes are separate from npm 0.13.1.
- [Case authoring](bench-authoring.md): turn a real failure into a fixture, verifier and reference repair.
- [Bench self-test](bench-self-test.md): check known synthetic benefit/harm/null/error controls through the paired pipeline before considering live spending; requires the current source build.
- [Offline first-check example](reproducible-offline-example.md): dated checks you can reproduce without a model.
- [Bench format](../benches/README.md): manifests, files and self-containment requirements.
- [Bench claims and scope](bench-claims.md): source-only schema 2 opt-in, target refusal, frozen declarations and schema 1 compatibility.

## Build and manage cases

- [Case management](case-management.md): list, inspect, select, edit and unregister tasks.
- [Drafting records](bench-drafting.md): one confirmed drafting call and its retained costs/failures.
- [Verifier contract](verifier-contract.md): quoted commands, task failures and infrastructure errors.
- [Bench check JSON](bench-check-json.md): offline gate codes, diagnostics and exit codes.
- [Full-pipeline offline controls](bench-self-test.md): synthetic paired benefit/harm/null/error suites with zero harness model calls; current source, not published npm 0.13.1.
- [Real OSS tasks](oss-task-evaluation.md): workspace inputs and independent acceptance checks.

## Plan and run evaluations

- [Bounded workflow](experiment-workflow.md): the steps from an offline-checked case to a saved report; [shared planning](eval-planning.md) owns settings, confirmation, budgets and output groups.
- [Installed Skill evaluation](installed-skill-evaluation.md) and [revision comparisons](skill-revisions.md): complete Skill delivery and distinct baselines.
- [Rules and MCP experiments](config-experiments.md): project overlays and server discovery.
- [Agent environment preflight](eval-agent-preflight.md) and [case preflight](eval-case-preflight.md): failures, warnings and unknown evidence before spending.
- [Agent evaluation component](eval-component.md): machine request/result fields and policy configuration; [metrics](metrics.md) owns measurement and adoption semantics.
- [Timing](eval-timing.md), [interruption](evaluation-interruption.md) and [sealed inputs](evaluation-input-snapshots.md): what a run retains and how it stops.

## Read and reproduce results

- [Report types and states](evaluation-reports.md): paired, calibration and trigger evidence.
- [Cost accounting](eval-costs.md): invocation populations, cache partitions and unknown usage.
- [Metrics protocol](metrics.md): current measurement contract, statistical verdicts, efficiency adoption and limits of claims; [revision history](metrics-history.md) retains the former chronological additions.
- [Sharing results](evaluation-reports.md#sharing-a-result) and [portable replay](replay-packages.md): saved evidence, integrity and offline reproduction.
- [Historical archive restoration](archive-delivery.md) and [exact inventory](archive-inventory.md): explicit pinned downloads and offline workspaces.
- [Evidence index](../evidence/README.md): all dated public reports and their limits.
- [Debugging Skill study](skill-evaluation-evidence.md): current study status and cumulative accounting.

## Configure agents

- [Selectable Codex setup](selectable-codex.md): choose pinned sources for particular tasks.
- [Portable Codex setup](portable-codex.md): move used Skills and global guidance between machines.
- [Codex source audit](codex-upstream-audit.md): historical September selection snapshot; use selectable setup for the maintained provenance contract.

## Develop and maintain

These source-maintenance records are separate from CLI usage. Plans, decisions
and raw release receipts stay in Git rather than ordinary npm installations.

- [Architecture](architecture.md): workflows, module ownership, dependency and evidence boundaries.
- [Documentation governance](documentation-governance.md): document responsibilities, topic authority, maintenance roles and historical protections; its registry maps topics to sources, dependent guides and checks.
- [Architecture decisions](decisions/README.md): decision status, rationale and delivery boundaries; proposed designs are separate from current implementation.
- [Contributing](../CONTRIBUTING.md): development checks, bench submissions and evidence requirements.
- [Roadmap](growth-roadmap-2026-10.md): current product work and later decisions.
- [Changelog](../CHANGELOG.md) and [release records](releases/): versioned behavior and publication evidence.
- [Package contents](package-contents.md): retained offline inputs, external archives and package checks.
- [Trusted publishing](releases/trusted-publishing.md): release preparation and verification.
- [Experiment script navigation](../scripts/README.md): active utilities and fixed historical procedures.
- [Measurement remediation plan](plans/2026-10-21-measurement-contract-and-capability-remediation.md#当前执行状态): the sole F1–F8/R1–R4 task status and acceptance record.
- [Documentation and architecture plan](plans/2026-10-22-documentation-governance-and-architecture.md#当前执行状态): the sole D/A/V task status, dependencies and acceptance record; pending design does not add CLI capabilities.

## Historical work records

[Plans](plans/) describe the scope and observations of their dates. Publication
status belongs to the corresponding release record; study status belongs to its
maintained evidence index. Fixed evidence and replay inputs keep their original paths.
The [plan lifecycle table](documentation-governance.md#plans-and-lifecycle)
classifies each plan, including the earlier
[installation/archive delivery](plans/2026-10-20-install-transactions-and-archive-delivery.md)
and [cleanup](plans/2026-10-20-docs-architecture-cleanup.md) records. Historical
classification neither completes unchecked work nor grants new execution authority.

The [September 24 audit](audit-2026-09-24.md) and its [triage](audit-2026-09-24-triage.md)
are historical findings against their recorded commit, rather than a current issue list.
