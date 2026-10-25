# Documentation

## Choose your build

This documentation describes the **current source build**. Build with Node >=22
and `npm run build`; its package version still reads 0.13.1 but includes
unpublished controls, bench claims and observation changes. A version string
alone does not identify those features. Source guides use `node dist/cli.js`.

For the published npm 0.13.1 behavior, use its
[original source documentation](https://github.com/remote-controlled-man/skillfit/tree/4eaefde80f7e8a6b1e01939d3bd8a8b6418b75d6/docs)
and [publication record](maintainers/releases.md). Commands explicitly pinned to
`npx skillfit@0.13.1` retain their published meaning; do not substitute that prefix
for a source-only example.

## Find your task

| Reader goal | Start here |
| --- | --- |
| Learn the complete workflow without model spending | [First evaluation](guides/first-real-eval.md) |
| Prepare and validate your own cases | [Bench authoring](guides/bench-authoring.md) |
| Plan an experiment, select inputs and handle stops | [Evaluation workflow](guides/experiment-workflow.md) |
| Select Skills or move a Codex configuration | [Codex configuration](guides/selectable-codex.md) |
| Integrate JSON requests/results | [Component contract](reference/eval-component.md) |
| Look up result fields, costs or replay formats | [Report reference](reference/evaluation-reports.md) |
| Understand statistical verdicts and adoption limits | [Metrics protocol](reference/metrics.md) |
| Change the code or understand module owners | [Architecture](maintainers/architecture.md) |
| Restore original historical evidence | [Archive recovery](maintainers/archive-delivery.md) |
| Prepare a software publication | [Release procedure](maintainers/releases.md) |

CLI `--help` owns flags; [Bench format](../benches/README.md) owns task files and
claims. JSON schemas, executable examples and SVG assets remain under `schemas/`,
`examples/` and `assets/`. [Evidence](../evidence/README.md) links original results;
[the current plan](https://github.com/remote-controlled-man/skillfit/blob/main/docs/work/current.md)
owns active progress. Completed process details remain at fixed Git snapshots.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/README.md).
