# Documentation

## Choose your build

These pages describe the **0.14.0 package and current source**; source guides use
Node >=22, `npm run build` and `node dist/cli.js`. A version string does not prove
registry publication, so check availability before using the pinned
`npx skillfit@0.14.0` commands. For published npm 0.13.1 behavior use its
[original documentation](https://github.com/remote-controlled-man/skillfit/tree/4eaefde80f7e8a6b1e01939d3bd8a8b6418b75d6/docs)
and [publication record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md).
Standalone driver links and unshipped source references use the
[reviewed source snapshot](https://github.com/remote-controlled-man/skillfit/tree/c9522ddea4c181056f1065e04f3ee0f69845146a),
which predates the version bump and may still print 0.13.1.

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
`examples/` and `assets/`. Active progress belongs to the source-only
`docs/work/current.md`, which is not shipped in npm.

Retired pages, research files and earlier layouts stay in Git history:
[documentation snapshot](https://github.com/remote-controlled-man/skillfit/tree/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/docs),
[research files](https://github.com/remote-controlled-man/skillfit/tree/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/evidence),
[pre-task-local Bench inputs](https://github.com/remote-controlled-man/skillfit/tree/8d8ff24c7adddb0cc1e7f3653a56baddeefef363/benches).
Current builds ship no archive catalog or restore tool; saved runs use their own
sealed inputs.
