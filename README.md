<div align="center">

<img src="docs/assets/skillfit-mark.svg" alt="skillfit logo" width="96" />

# skillfit

**A/B testing for agent configuration.**

We put 8 popular workflow skills through 24 baseline/treatment pairs against a<br/>
frozen Codex CLI baseline: every one cost **9–27% more input tokens**, and none<br/>
showed a robust task-quality gain — [full table and its limits](#our-own-data).

skillfit runs that paired experiment on *your* tasks, with deterministic verifiers,<br/>
an exact McNemar verdict, paired-bootstrap intervals and trigger rates — so "this<br/>
skill feels useful" becomes dated, replayable evidence with its limits stated.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [简体中文](README.zh-CN.md)

[Documentation](docs/README.md) · [Quick start](#first-run-with-npm) · [Bench guide](benches/README.md) · [Reports](docs/reference/evaluation-reports.md) · [Contributing](#contributing)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.en.svg" alt="The same task runs with baseline and treatment configurations before skillfit compares outcomes, token use, and uncertainty" width="100%" />
</p>

---

## Install

```bash
npx skillfit@0.14.0 --help
npx skillfit@0.14.0 doctor
```

Requires Node.js 22+. Both commands above are offline and make no model calls: `--help` lists the eight commands, and `doctor` is a read-only health report that detects which supported agents you have, inspects their rules files, and flags invalid or conflicting Skills. [Choose your build](docs/README.md#choose-your-build) owns the package/source boundary, availability checks and older release documentation.

## See a real report before you spend

No agent CLI, no login, no model calls. These read the benches shipped inside the package and take a few seconds:

```bash
npx skillfit@0.14.0 bench check code-review
npx skillfit@0.14.0 bench self-test code-review --suite existing-mock-arms --runs-root ./runs --run-group controls-001 --yes
npx skillfit@0.14.0 report eval ./runs/controls-001/existing-mock-arms
```

`bench check` runs the bundled verifiers against known-good and known-bad answers, so you can watch the harness discriminate: the oracle passes, an empty output fails, a mock baseline fails and a mock treatment passes. `bench self-test` then drives the complete paired pipeline — grader, exact McNemar verdict, paired-bootstrap intervals, audit — on synthetic controls, and `report eval` renders it. That report is banner-marked **Synthetic harness run**: it proves the pipeline works, not that any Skill helps. Add `--dry-run` to the self-test to print its plan and write nothing.

## Why

Installing a configuration does not show whether it helps your tasks. Three published results show how far intuition drifts from measurement:

- Curated Skills raised the average pass rate from **33.9% to 50.5% (+16.6pp)** across 87 tasks and 18 model–harness configurations — but configuration-level gains ranged from **+4.1pp to +25.7pp**, so the aggregate says little about *your* setup ([SkillsBench v4](https://arxiv.org/abs/2602.12670v4)).
- LLM-generated repository context files made agents **significantly more expensive without making them better**: cost rose **20% on SWE-bench and 23% on CTXbench** (p < 0.001%), while resolution rate moved −0.5% and −2% with no significant effect (p = 87% and 37%), and dropped in 5 of 8 settings ([Evaluating AGENTS.md v3](https://arxiv.org/abs/2602.11988v3), §4.2).
- **36.82% of 3,984 scanned public Skills** had at least one security issue in Snyk’s February 5, 2026 study ([ToxicSkills findings](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)).

skillfit provides paired A/B experiments with deterministic verifiers, statistical verdicts and trigger-rate measurement. These studies motivate the tool; they do not validate skillfit or predict gains on your tasks.

Build cases around your own tasks: pin the starting files, write the request, and define what a correct result must do. The bundled benches teach the format; the CLI runs your cases, compares outcomes and costs, and preserves evidence. See the [case authoring guide](docs/guides/bench-authoring.md).

## First run with npm

In your project directory, point at a Skill you actually use — any directory holding a `SKILL.md` with `name` and `description` frontmatter. Save the example below as `my-skill/SKILL.md`, which is what the `eval` command refers to:

```markdown
---
name: my-skill
description: When to load this skill, in one sentence
---

# My skill

The instructions the agent should follow.
```

Then scaffold a case and preview an evaluation:

```bash
npx skillfit@0.14.0 bench init my-bench --kind command --dry-run
npx skillfit@0.14.0 bench init my-bench --kind command --yes
npx skillfit@0.14.0 bench check ./my-bench --json
npx skillfit@0.14.0 eval ./my-skill --bench ./my-bench --mode installed --agent codex --trials 1 --max-calls 2 --runs-root ./runs --run-group first-eval --json --dry-run
```

Replace the teaching fixture, prompt, verifier and oracle before measuring benefit. The preview declares two calls and makes none. Inspect `plan.evaluation.agentPreflight.status`; login remains unknown offline. Keep cases and runs in separate directories. Continue with [your first real evaluation](docs/guides/first-real-eval.md).

## What you get

Choose the question before spending; these outputs support different conclusions:

| Question | Measurement | Limit |
| --- | --- | --- |
| Does task quality change? | Paired outcomes, McNemar verdict and task-bootstrap intervals | `inconclusive` is not proof of no effect; small samples may remain unresolved |
| Can a revision reduce cost? | Predeclared efficiency policy: all-invocation uncached-input tokens per success | Requires complete usage, independent validation and no observed regression; does not estimate dollars or prove equivalence |
| Is the installed Skill observed activating? | Single-arm trigger recall, false-trigger rate and unknown coverage | Cannot establish paired quality/cost benefit or causation |

This historical trigger run observes activation when the Skill is installed but not mentioned:

```console
$ node dist/cli.js eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
Precision           : 1/1 (100%) [95% CI 21%–100%]
F1                  : 0.20 (no CI: a harmonic mean of two proportions has no closed-form binomial interval)
```

The run recorded one activation in nine in-domain trials. The table's pass counts belong to that same installed arm; they are not a no-Skill baseline. This single-arm observation cannot show whether loading the Skill improves outcomes.

<sub>Captured 2026-09-22 on Kimi Code from a source checkout, against the four-task `code-review` bench. The bench has since gained a fifth task; the four metric lines above are re-rendered from that run's recorded per-task counts, so the run is real and the formatting is current.</sub>

## Running the rest of this page from source

The npm commands above run from any directory. Everything below is written as
`node dist/cli.js …` and runs from the repository root, so the examples can point
at skillfit's own benches, example manifests and `skills/` directory. Build that
checkout once:

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
git switch --detach c9522ddea4c181056f1065e04f3ee0f69845146a
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node dist/cli.js doctor
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
node dist/cli.js install --agent codex --dry-run
```

The detached commit pins the reviewed implementation this page describes; it
predates the 0.14.0 version bump. For development on your own checkout, follow
[CONTRIBUTING.md](https://github.com/remote-controlled-man/skillfit/blob/main/CONTRIBUTING.md).

The checks are offline; `doctor` is read-only and both previews only print plans. Adapters cover **Claude Code**, **OpenAI Codex CLI** and **Kimi Code**; see the [current source capability table](docs/guides/experiment-workflow.md#executor-capabilities) for modes, trigger readers, token/cache limits and verification scope. The matrix declares commands; offline fixtures do not attest installed CLI compatibility or login.

The 0.14.0 package carries the measurement features described as **current source**, including [offline self-test protocol 1](docs/guides/bench-authoring.md#test-known-controls) and explicit [bench schema 2 / frozen measurementScope 1](benches/README.md#claims-and-measurement-scope). Schema 1 remains compatible and unrecorded; declarations do not prove that a bench can measure benefit, and unsupported schema 2 targets refuse before verifier, oracle or model calls. The [capability table](docs/guides/experiment-workflow.md#executor-capabilities) describes adapter support; [metrics](docs/reference/metrics.md#public-model-identity-per-invocation) defines per-call model identity and unknown legacy evidence.

Paired eval defaults to **5 trials per condition**: 8 tasks require 80 agent executions before optional judges. The 8×5 scale/adoption floor is not a minimum for every within-bench exact-test verdict or a power guarantee. Sampling is unpinned, and no validated MDE planner is available. Preview the count and set `--max-calls` before spending. See [bounded experiments](docs/guides/experiment-workflow.md).

## Build your own cases

Scaffold a code-editing teaching case, then replace its inputs with your real task:

```bash
node dist/cli.js bench init my-bench --kind command --dry-run
node dist/cli.js bench init my-bench --kind command --yes
node dist/cli.js bench check my-bench
node dist/cli.js bench check my-bench --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --input workspace --trials 1 --max-calls 2 --dry-run
```

Use `bench add --freeze` to capture a failure or `--from-commit` to import a fix. The [case authoring guide](docs/guides/bench-authoring.md) covers both paths, verifier requirements and offline validation.

Before live spending, the 0.14.0 package or a reviewed source build can run [bench self-test](docs/guides/bench-authoring.md#test-known-controls) with predeclared synthetic benefit, harm, null and error controls. It checks the paired pipeline without model calls; it does not establish model quality, statistical power for your real tasks or adoption eligibility.

List and inspect cases, or preview an edit. `--yes` applies a validated change with a backup; removal keeps case files. Select a smaller run with repeated `--task`:

```bash
node dist/cli.js bench list my-bench --json
node dist/cli.js bench show my-bench example-task --json
node dist/cli.js bench edit my-bench example-task --set shouldTrigger=true --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --task example-task --input workspace --trials 1 --max-calls 2 --dry-run
```

See [case management](docs/guides/bench-authoring.md). Live evaluation checks [case integrity](docs/guides/experiment-workflow.md) and the [Agent environment](docs/guides/experiment-workflow.md) before calls; a successful preview alone does not establish readiness.

### Evaluate a real OSS task

Use `--input workspace` for CLI runs that inspect and edit files on disk. API executors require the default snapshot mode. Keep calibration and paired input modes consistent:

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --input workspace --trials 5 --dry-run
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --input workspace --trials 3 --dry-run
```

Import the issue request with `--prompt-file` so the fix message does not reveal the answer. Follow the [real OSS workflow](docs/guides/bench-authoring.md) or inspect the [pinned mcp-use example](benches/contrib/oss-mcp-use-utf8/README.md).

### Compare Skill revisions

Compare two complete versions with the same frontmatter name and different fingerprints. Both arms receive identical natural prompts; revision effects are distinct from installation benefit:

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5 --dry-run
```

See [revision comparisons and installed Skill delivery](docs/guides/experiment-workflow.md#plan-before-spending).

### Agent evaluation component

Agent callers can preview a version-1 JSON request, then execute its pinned plan:

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

The [component contract](docs/reference/eval-component.md) defines quality and efficiency policies; `accept`, `reject` and `inconclusive` remain separate from the statistical verdict. Adoption requires complete, independent validation; nothing upgrades automatically.

[Experiment planning](docs/guides/experiment-workflow.md#plan-before-spending) covers task selection, pair order and plan confirmation. Optional `spendingBudget` / `--spending-budget` requires **all five fields**; see [spending limits](docs/guides/experiment-workflow.md#bound-calls-and-spending) for supported counters, unknown usage and in-flight overshoot. Calibration measures baseline difficulty and trigger mode measures discovery; neither proves paired benefit.

### Test rules and MCP setups

Create baseline and treatment project overlays next to `skillfit-experiment.json`.
The first command previews; the second runs real agent calls. Inspect the plan
and choose a call budget before execution:

```text
context7-experiment/
├── skillfit-experiment.json
├── baseline/.codex/config.toml
└── treatment/.codex/config.toml
```

```bash
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5 --dry-run
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5
```

Start with `skillfit mcp check` for server discovery and catalog auditing; it calls no tool. Then measure outcomes with the [rules and MCP workflow](docs/guides/experiment-workflow.md#rules-and-mcp-overlays). For Codex MCP trials, a per-run trust override loads the disposable project config without changing user config.

## Share an evaluation

Try a saved synthetic report, then use the manifest or directory printed by your own run:

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

Markdown and JSON read paired, calibration and trigger records, including incomplete runs. Rendering a report does not authorize adoption. The [report reference](docs/reference/evaluation-reports.md) explains sharing, report states and cost coverage.

Export a sealed run to a fresh portable directory. Preview first; `--yes` writes:

```bash
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs --verify-only
node ./exports/my-run/reproduce.mjs
```

[Portable replay](docs/reference/evaluation-reports.md) verifies saved observations and runs trusted local verifiers, with zero model calls. [Sealed inputs](docs/guides/experiment-workflow.md) preserve the original case and target. [Interruption](docs/guides/experiment-workflow.md) retains available spending; unknown usage stays unknown.

Current source keeps task inputs in benches and generated observations in explicit run directories. Report/export/replay uses those saved runs; old study files remain at fixed Git commits and are no longer a release prerequisite.

## Selectable Codex setup

Inspect 67 installable sources, then choose Skills relevant to your tasks. `--starter` selects 13 unvalidated-as-a-set Skills; `--all` selects all 67. Source hashes verify installation integrity, not efficacy. Selection needs network access; only `--yes` installs:

```bash
node dist/cli.js setup codex --list
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes
```

See the [selectable setup guide](docs/guides/selectable-codex.md) for source provenance, retired entries and evidence limits.

### Portable Codex setup

Export user-level Skills observed in at least two Codex sessions and your active global guidance:

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

For options, including the full 65-Skill upstream catalog via `--upstream-lock`, see [portable setup](docs/guides/selectable-codex.md) and the [source audit](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/codex-upstream-audit.md).

## The eight commands

| Command | What it does | Writes? |
|---|---|---|
| `doctor` | Inspect agent configuration, invalid Skills, conflicts and supported MCP declarations | Read-only |
| `report` | Summarize observed Skill usage or render saved evaluation results | Only `report eval --export --yes` writes a fresh replay directory |
| `eval <target>` | Compare a Skill, rules or MCP overlay; trigger mode observes Skill activation | Saves runs; real evaluations call an agent/model |
| `mcp check <spec>` | Connect to an MCP server and audit `tools/list`; never invoke a tool | No skillfit output files; starts or contacts the server |
| `bench` | Scaffold, inspect, edit and validate tasks; current source also supports offline `self-test` | Edits require confirmation; calibration/drafting call agents and save output; plain checks run local verifiers |
| `install` | Apply a profile with conflict checks, backups, verification and rollback on failure | After confirmation; preview with `--dry-run`, add `--strict` to fail on conflicts |
| `setup codex` | Select pinned Skills and global routing guidance; defaults to a preview | Only `--yes` installs; source selection needs network |
| `bundle` | Export selected local Skills and global guidance for another machine | After confirmation; generated setup previews before installation |

Use `node dist/cli.js --help` for flags and the [configuration guide](docs/guides/selectable-codex.md) for setup options. No observed Skill use is not proof of uselessness. Offline checks and replay still execute trusted local bench code. Installation keeps the first `<file>.skillfit-bak`; rollback handles write/validation failures, while abrupt termination can leave a partial install.

### Bring your own bench

A bench is `bench.json`, fixtures and deterministic verifiers. Use the [bench authoring guide](docs/guides/bench-authoring.md) and [format reference](benches/README.md); bundled cases teach the format rather than establish model quality.

## Our own data

We ran skillfit's harness on 8 popular workflow skills from the public catalog — four from `mattpocock/skills` and four from `addyosmani/agent-skills`, each at the commit pinned in [codex-upstream-sources.json](profiles/codex-upstream-sources.json) — over 24 baseline/treatment pairs on Codex CLI against a frozen 2026-07 baseline. One showed a limited regression-test artifact signal in 2/3 treated runs; no Skill showed a robust task-quality gain. These runs do not validate the current 67-Skill catalog or the legacy 13-Skill set, and a run the report labels indicative is not an installation recommendation:

| Skill | Quality Δ | Input tokens | Verdict |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp test-asset gain (2/3 runs); task quality unchanged | +11.7% | Limited historical artifact signal |
| `code-review` | +3.3pp (unstable) | +9.1% | Not enough evidence |
| `tdd` | 0.00pp | +9.2% | No measurable gain |
| `doubt-driven-development` | 0.00pp | +20.7% | No measurable gain |
| `security-and-hardening` | 0.00pp | +27.4% | No measurable gain, highest cost |
| 3 more | 0.00pp | +14.7~17.0% | No measurable gain |

These are observed outcomes on the recorded tasks, not tests of every workflow claim. **The harness requested patches rather than giving the agent a writable workspace, so process-level behavior such as red-green-refactor sequencing was not observable — and `tdd`, `diagnosing-bugs` and `code-review` are process skills.** The quality column is therefore a null result with a known hole in it rather than a refutation; the cost column does not depend on process observation. Regression-test artifacts do not establish process order, and 0.00pp cannot exclude an unmeasured process effect. A saturated baseline (6 of the 8 baselines were already at 100%) limits observed quality headroom; it does not automatically discard a task for an efficiency comparison with complete costs and no observed regression.

See the [original study records](https://github.com/remote-controlled-man/skillfit/blob/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/evidence/README.md) and [archived debugging study](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/skill-evaluation-evidence.md) for dated scope and available records. These author-run records do not establish independent third-party live reproduction; offline replay verifies saved observations.

## Design principles

- **Native configuration.** Use each agent’s supported rules and Skill locations, including `AGENTS.md`, `SKILL.md` and `.agents/skills/` where applicable; the agent matrix owns the differences.
- **Deny by default.** We install only what a profile explicitly declares, pinned by content hash.
- **Dry-run first.** Preview configuration changes before applying them; replacements keep backups and are verified. New bench/run/bundle artifacts preserve existing outputs through collision checks.
- **Honest numbers.** New efficacy submissions need a pinned, shareable manifest; some older reports lack downloadable raw manifests. Verdict semantics are frozen in [docs/reference/metrics.md](docs/reference/metrics.md): significance comes from an exact McNemar test over discordant pairs, deltas carry paired-bootstrap CIs, and runs below 8 tasks × 5 trials are labeled *indicative* even if their within-bench verdict is statistically significant.

### Disclaimer

Not affiliated with Anthropic, OpenAI, Moonshot AI, or any agent vendor. Evaluation results depend on model version, harness, and tasks — treat them as dated evidence, not eternal truth.

## Roadmap

**Next:** live validation on tasks this project does not own, and adapters for more agent CLIs. No validated minimum-detectable-effect planner exists, so choosing a call budget stays a user decision.

**Not yet measured:** the 67-Skill catalog and the 13-Skill starter set are not evaluated as sets, and bundled benches teach the format rather than establish model quality. Adapter and trigger-verification limits are in the [capability table](docs/guides/experiment-workflow.md#executor-capabilities).

Released behavior and dates live in the [changelog](CHANGELOG.md); the [release procedure](docs/maintainers/releases.md) owns publication.

## Getting help

Check the [documentation](docs/README.md) for the build you use. For bugs or questions, [search existing issues or open one](https://github.com/remote-controlled-man/skillfit/issues); include the command, expected/actual behavior, skillfit and Node versions, OS and relevant agent version. Review artifacts for private content before sharing. Follow [SECURITY.md](https://github.com/remote-controlled-man/skillfit/blob/main/SECURITY.md) for security reports.

## Contributing

Follow [CONTRIBUTING.md](https://github.com/remote-controlled-man/skillfit/blob/main/CONTRIBUTING.md). Useful contributions include real-workflow cases, reproducible evidence and matrix corrections. [Security reports](https://github.com/remote-controlled-man/skillfit/blob/main/SECURITY.md) have a separate channel.

For development handoff, use [architecture and maintenance](docs/maintainers/architecture.md). Active progress is recorded in the source-only `docs/work/current.md`; that plan is excluded from npm.

## License

[MIT](LICENSE)
