# skillfit documentation

Start with your own task: create a case, check it offline, preview an evaluation,
then read and share its saved evidence. The bundled cases teach the format.

## Start here

- [First real evaluation](first-real-eval.md): npm onboarding, prerequisites, call counts and interpreting results.
- [Case authoring](bench-authoring.md): turn a real failure into a fixture, verifier and reference repair.
- [Offline first-check example](reproducible-offline-example.md): dated checks you can reproduce without a model.
- [Bench format](../benches/README.md): manifests, files and self-containment requirements.

## Build and manage cases

- [Case management](case-management.md): list, inspect, select, edit and unregister tasks.
- [Drafting records](bench-drafting.md): one confirmed drafting call and its retained costs/failures.
- [Verifier contract](verifier-contract.md): quoted commands, task failures and infrastructure errors.
- [Bench check JSON](bench-check-json.md): offline gate codes, diagnostics and exit codes.
- [Real OSS tasks](oss-task-evaluation.md): workspace inputs and independent acceptance checks.

## Plan and run evaluations

- [Bounded workflow](experiment-workflow.md) and [shared planning](eval-planning.md): previews, confirmation, budgets and output groups.
- [Installed Skill evaluation](installed-skill-evaluation.md) and [revision comparisons](skill-revisions.md): complete Skill delivery and distinct baselines.
- [Rules and MCP experiments](config-experiments.md): project overlays and server discovery.
- [Agent environment preflight](eval-agent-preflight.md) and [case preflight](eval-case-preflight.md): failures, warnings and unknown evidence before spending.
- [Agent evaluation component](eval-component.md): request/result contracts and adoption policy.
- [Timing](eval-timing.md), [interruption](evaluation-interruption.md) and [sealed inputs](evaluation-input-snapshots.md): what a run retains and how it stops.

## Read and reproduce results

- [Report types and states](evaluation-reports.md): paired, calibration and trigger evidence.
- [Cost accounting](eval-costs.md): invocation populations, cache partitions and unknown usage.
- [Metrics protocol](metrics.md): statistical verdicts and limits of claims.
- [Sharing results](sharing-results.md) and [portable replay](replay-packages.md): saved evidence, integrity and offline reproduction.
- [Evidence index](../evidence/README.md): all dated public reports and their limits.
- [Debugging Skill study](skill-evaluation-evidence.md): current study status and cumulative accounting.

## Configure agents

- [Selectable Codex setup](selectable-codex.md): choose pinned sources for particular tasks.
- [Portable Codex setup](portable-codex.md): move used Skills and global guidance between machines.
- [Codex source audit](codex-upstream-audit.md): source provenance and installation scope.

## Develop and maintain

- [Architecture](architecture.md): workflows, module ownership, dependency and evidence boundaries.
- [Contributing](../CONTRIBUTING.md): development checks, bench submissions and evidence requirements.
- [Roadmap](growth-roadmap-2026-10.md): current product work and later decisions.
- [Changelog](../CHANGELOG.md) and [release records](releases/): versioned behavior and publication evidence.
- [Package contents](package-contents.md): retained offline inputs, compatible trimming and package checks.
- [Trusted publishing](releases/trusted-publishing.md): release preparation and verification.
- [Experiment script navigation](../scripts/README.md): active utilities and fixed historical procedures.
- [Current cleanup plan](plans/2026-10-20-docs-architecture-cleanup.md): ordered tasks, actual progress and verification.

## Historical work records

[Plans](plans/) describe the scope and observations of their dates. Publication
status belongs to the corresponding release record; study status belongs to its
maintained evidence index. Fixed evidence and replay inputs keep their original paths.

The [September 24 audit](audit-2026-09-24.md) and its [triage](audit-2026-09-24-triage.md)
are historical findings against their recorded commit, rather than a current issue list.
