# Documentation

## Choose your build

This documentation describes the **0.14.0 package and current source**:
offline controls, bench claims, observation corrections and task-local Bench
inputs. Source guides use Node >=22, `npm run build` and `node dist/cli.js`.
A version string alone does not prove registry publication. Check availability
before using the pinned `npx skillfit@0.14.0` commands; use the reviewed source
walkthrough when the package is unavailable.

For the published npm 0.13.1 behavior, use its
[original source documentation](https://github.com/remote-controlled-man/skillfit/tree/4eaefde80f7e8a6b1e01939d3bd8a8b6418b75d6/docs)
and [publication record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md). Its archived commands retain their
original meaning; do not use that older package for 0.14.0 features.

Standalone driver links and unshipped source references use the
[reviewed source snapshot](https://github.com/remote-controlled-man/skillfit/tree/c9522ddea4c181056f1065e04f3ee0f69845146a);
this keeps them usable without sibling docs or a checkout. That implementation
snapshot predates the version bump and may still print 0.13.1; its full commit
identifies the behavior. Source maintainers follow their actual checkout. These
links do not announce a release.

## Find your task

| Reader goal | Start here |
| --- | --- |
| Learn the complete workflow without model spending | [First evaluation](guides/first-real-eval.md) |
| Prepare and validate your own cases | [Bench authoring](guides/bench-authoring.md) |
| Plan/run an experiment, handle stops and retain/clean outputs | [Evaluation workflow](guides/experiment-workflow.md) |
| Select Skills or move a Codex configuration | [Codex configuration](guides/selectable-codex.md) |
| Integrate JSON requests/results | [Component contract](reference/eval-component.md) |
| Look up result fields, costs or replay formats | [Report reference](reference/evaluation-reports.md) |
| Understand statistical verdicts and adoption limits | [Metrics protocol](reference/metrics.md) |
| Change the code or understand module owners | [Architecture](maintainers/architecture.md) |
| Prepare a software publication | [Release procedure](maintainers/releases.md) |

CLI `--help` owns flags; [Bench format](../benches/README.md) owns task files and
claims. JSON schemas, executable examples and SVG assets remain under `schemas/`,
`examples/` and `assets/`.
Active progress belongs to the source-only `docs/work/current.md`, which is not
shipped in npm. Completed process details remain at fixed Git snapshots.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/README.md).

Retired source pages and research files remain in Git: [documentation snapshot](https://github.com/remote-controlled-man/skillfit/tree/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/docs), [original research files](https://github.com/remote-controlled-man/skillfit/tree/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/evidence). Current builds do not ship a repository archive catalog or restore tool.

The publication-era layout remains available at its fixed
[index](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/README.md),
[documentation tree](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs) and
[study tree](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/evidence).

Before task-local Bench organization: [fixed input snapshot](https://github.com/remote-controlled-man/skillfit/tree/8d8ff24c7adddb0cc1e7f3653a56baddeefef363/benches). Current tasks and commands are indexed by their current `bench.json`; saved runs use their own sealed inputs.
