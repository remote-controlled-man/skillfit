<div align="center">

<img src="docs/assets/skillfit-mark.svg" alt="skillfit logo" width="96" />

# skillfit

**Measure configuration outcomes, costs and activation on your own tasks.**

Compare a skill, rules file, or MCP setup with a baseline for *your* agent —<br/>
then use the recorded evidence and its limits to decide what to enable.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [简体中文](README.zh-CN.md)

[Documentation](docs/README.md) · [Quick start](#first-run-with-npm) · [Bench guide](benches/README.md) · [Metrics protocol](docs/reference/metrics.md) · [Evidence](evidence)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.en.svg" alt="The same task runs with baseline and treatment configurations before skillfit compares outcomes, token use, and uncertainty" width="100%" />
</p>

---

## Why

The agent-config ecosystem has solved **distribution** (`npx skills add`, plugin marketplaces, MCP registries) but not **selection**. The evidence says unverified configuration can hurt:

- Curated Skills raised average pass rates by **+16.6pp** across 87 tasks and 18 model–harness configurations; gains varied by configuration ([SkillsBench v4](https://arxiv.org/abs/2602.12670v4)).
- LLM-generated context files showed no statistically significant success-rate improvement, while increasing average inference cost by **20% on SWE-bench and 23% on CTXbench** ([Evaluating AGENTS.md v3](https://arxiv.org/abs/2602.11988v3)).
- **36.82% of 3,984 scanned public Skills** had at least one security issue in Snyk’s February 5, 2026 study ([ToxicSkills findings](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)).

skillfit is the missing measurement layer: paired A/B experiments with deterministic verifiers, statistical verdicts, and trigger-rate measurement — packaged as a CLI anyone can run.

Build cases around your own tasks: pin the starting files, write the request, and define what a correct result must do. The bundled benches teach the format; the CLI runs your cases, compares outcomes and costs, and preserves evidence. See the [case authoring guide](docs/guides/bench-authoring.md).

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

<sub>Captured 2026-09-22 on Kimi Code against the four-task `code-review` bench. The bench has since gained a fifth task; the four metric lines above are re-rendered from that run's recorded per-task counts, so the run is real and the formatting is current.</sub>

## Install

```bash
npx skillfit@0.13.1 --help
npx skillfit@0.13.1 doctor
```

Requires Node.js 22+. npm may download the package; the case checks and previews below make no model calls.

## First run with npm

In your project directory, replace `./my-skill` with a directory containing your `SKILL.md`:

```bash
npx skillfit@0.13.1 bench init my-bench --kind command --dry-run
npx skillfit@0.13.1 bench init my-bench --kind command --yes
npx skillfit@0.13.1 bench check ./my-bench --json
npx skillfit@0.13.1 eval ./my-skill --bench ./my-bench --mode installed --agent codex --trials 1 --max-calls 2 --runs-root ./runs --run-group first-eval --json --dry-run
```

Replace the teaching fixture, prompt, verifier and oracle before measuring benefit. The preview declares two calls and makes none. Inspect `plan.evaluation.agentPreflight.status`; login remains unknown offline. Keep cases and runs in separate directories. Continue with [your first real evaluation](docs/guides/first-real-eval.md).

### Run from source

Build a local checkout:

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node dist/cli.js doctor
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
node dist/cli.js install --agent codex --dry-run
```

The checks are offline; `doctor` is read-only and both previews only print plans. Adapters cover **Claude Code**, **OpenAI Codex CLI** and **Kimi Code**; see the [current source capability table](docs/guides/experiment-workflow.md#executor-capabilities) for modes, trigger readers, token/cache limits and verification scope. The matrix declares commands; offline fixtures do not attest installed CLI compatibility or login.

The current checkout adds unpublished measurement features and corrections; build it to use additions marked **current source** in the documentation.

This includes [offline self-test protocol 1](docs/guides/bench-authoring.md#test-known-controls) and explicit [bench schema 2 / frozen measurementScope 1](benches/README.md#claims-and-measurement-scope). Schema 1 remains compatible and unrecorded; declarations do not prove that a bench can measure benefit. Unsupported schema 2 targets refuse before verifier, oracle or model calls.

The npm 0.13.1 commands above retain their released behavior. The [capability table](docs/guides/experiment-workflow.md#executor-capabilities) describes adapter support; [metrics](docs/reference/metrics.md#public-model-identity-per-invocation) defines per-call model identity and unknown legacy evidence.

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

Use `bench add --freeze` to capture a failure or `--from-commit` to import a fix. Read the [case authoring guide](docs/guides/bench-authoring.md), [JSON check contract](docs/guides/bench-authoring.md), [verifier contract](docs/guides/bench-authoring.md) and [drafting records](docs/guides/bench-authoring.md).

Before live spending, a current source build can run [bench self-test](docs/guides/bench-authoring.md#test-known-controls) with predeclared synthetic benefit, harm, null and error controls. It checks the paired pipeline without model calls; it does not establish model quality, statistical power for your real tasks or adoption eligibility. This entry is not available in published npm 0.13.1.

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

See [revision comparisons](docs/guides/experiment-workflow.md) and [installed Skill delivery](docs/guides/experiment-workflow.md).

### Agent evaluation component

Agent callers can preview a version-1 JSON request, then execute its pinned plan:

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

The [component contract](docs/reference/eval-component.md) defines quality and efficiency policies; `accept`, `reject` and `inconclusive` remain separate from the statistical verdict. Adoption requires complete, independent validation; nothing upgrades automatically.

[Shared planning](docs/guides/experiment-workflow.md) covers ordinary/request plans, `--json`, task selection, balanced pair order, deadlines and plan-hash confirmation. `spendingBudget` / `--spending-budget` is optional as a whole; when supplied, **all five fields are mandatory**. Among current CLI readers, only Codex has all required token/cache counters; Kimi/Claude block this budget before calls, and API coverage remains unknown until responses. Reaching a line prevents the next call; an in-flight call can overshoot, and missing/partial final usage stops further calls. Calibration measures baseline difficulty; trigger mode measures discovery. Neither proves paired benefit. Installed evaluations provide the same pinned native diff helper to both arms.

### Test rules and MCP setups

Create baseline and treatment project overlays next to `skillfit-experiment.json`:

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

Markdown and JSON read paired, calibration and trigger records, including incomplete runs. Rendering a report does not authorize adoption. See [sharing](docs/reference/evaluation-reports.md), [report states](docs/reference/evaluation-reports.md) and [cost coverage](docs/reference/evaluation-reports.md).

Export a sealed run to a fresh portable directory. Preview first; `--yes` writes:

```bash
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs --verify-only
node ./exports/my-run/reproduce.mjs
```

[Portable replay](docs/reference/evaluation-reports.md) verifies saved observations and runs trusted local verifiers, with zero model calls. [Sealed inputs](docs/guides/experiment-workflow.md) preserve the original case and target. [Interruption](docs/guides/experiment-workflow.md) retains available spending; unknown usage stays unknown.

Version 0.13.0 adds an explicit [restore tool](docs/maintainers/archive-delivery.md): fetch pinned bytes once, then replay historical study archives offline. Git originals and frozen reports stay available; normal installation and CLI commands do not fetch archives.

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
| `doctor` | Detects installed agents, checks rules bloat, skill validity/conflicts, MCP declaration presence and JSON syntax where supported, and silent-failure traps (e.g. AGENTS.md that Claude Code never reads) | Never |
| `report` | Skill usage receipts from retained local session history: fires per skill, candidates with no observed fire, and raw catalog size before agent-side limits. Absence is a prioritization signal, not proof of uselessness. It also renders an existing evaluation manifest as Markdown with `report eval`. | `--export --yes` writes a fresh replay directory; otherwise read-only |
| `eval <target>` | Paired baseline/treatment runs for a Skill, rules overlay, or MCP overlay; deterministic verifier + optional blind LLM judge, token-cost delta, McNemar exact test, paired bootstrap CI, and graded facet-score CIs. `--mode trigger` installs a Skill and measures trigger recall / false-trigger rate from the agent transcript | `runs/` locally |
| `mcp check <spec>` | Handshakes with a stdio MCP server or a Streamable HTTP endpoint, requests `tools/list`, and audits tool names, descriptions, input schemas, and annotations. Never calls a tool | Never |
| `bench` | `init` scaffolds a bench directory with a working example task; `check` validates a bench offline (verifier self-tests, oracle/NOP gates, mock-arm probes, fixture hygiene, trigger-label coverage); `add --freeze` turns a failure you just watched into a permanent bench task, and `--decompose` confirms before one agent call to draft the verifier + oracle, admitted only if both gates pass | `init`/`add`/`edit`/`remove` write after confirmation; `check --calibrate` calls an agent and writes runs; plain `check` runs local verifiers |
| `install` | Managed-block rules (`<!-- SKILLFIT_START/END -->`, idempotent), skill copy with conflict protection, content-hash lockfile, post-install verification. Writes are staged first; if a write or verification fails, the installer rolls back changed target files, including the lockfile. Abrupt termination can still leave a partial install; re-run to reconcile. Your original is kept at `<file>.skillfit-bak` and the first backup wins, so later updates cannot overwrite it. `--dry-run` reports conflicts and exits 0; add `--strict` to make them fail (CI gates) | Only after confirmation |
| `setup codex` | Lists or installs a chosen set of pinned, verified upstream Skills and repository-owned Skills with global routing guidance; defaults to a dry run | Only with `--yes` |
| `bundle` | `export` creates a portable Codex profile from used local Skills and active global guidance | Only after confirmation |

### Bring your own bench

A bench is `bench.json`, fixtures and deterministic verifiers. Use the [bench authoring guide](docs/guides/bench-authoring.md) and [format reference](benches/README.md); bundled cases teach the format rather than establish model quality.

## Our own data

We ran skillfit's harness on 8 popular workflow skills (24 baseline/treatment pairs, Codex CLI, frozen 2026-07 baseline). One showed a limited regression-test artifact signal in 2/3 treated runs; no Skill showed a robust task-quality gain. These runs do not validate the current 67-Skill catalog or the legacy 13-Skill set, and a run the report labels indicative is not an installation recommendation:

| Skill | Quality Δ | Input tokens | Verdict |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp test-asset gain (2/3 runs); task quality unchanged | +11.7% | Limited historical artifact signal |
| `code-review` | +3.3pp (unstable) | +9.1% | Not enough evidence |
| `tdd` | 0.00pp | +9.2% | No measurable gain |
| `doubt-driven-development` | 0.00pp | +20.7% | No measurable gain |
| `security-and-hardening` | 0.00pp | +27.4% | No measurable gain, highest cost |
| 3 more | 0.00pp | +14.7~17.0% | No measurable gain |

These are observed outcomes on the recorded tasks, not tests of every workflow claim. Regression-test artifacts do not establish process order, and 0.00pp cannot exclude an unmeasured process effect. A saturated baseline limits observed quality headroom; it does not automatically discard a task for an efficiency comparison with complete costs and no observed regression.

See the [evidence index](evidence/README.md) and [archived debugging study](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/skill-evaluation-evidence.md) for dated scope and available records. These author-run records do not establish independent third-party live reproduction; offline replay verifies saved observations.

## Design principles

- **Standards, not formats.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — we write what agents already read.
- **Deny by default.** We install only what a profile explicitly declares, pinned by content hash.
- **Dry-run first.** Preview configuration changes before applying them; replacements keep backups and are verified. New bench/run/bundle artifacts preserve existing outputs through collision checks.
- **Honest numbers.** New efficacy submissions need a pinned, shareable manifest; some older reports lack downloadable raw manifests. Verdict semantics are frozen in [docs/reference/metrics.md](docs/reference/metrics.md): significance comes from an exact McNemar test over discordant pairs, deltas carry paired-bootstrap CIs, and runs below 8 tasks × 5 trials are labeled *indicative* even if their within-bench verdict is statistically significant.

### Disclaimer

Not affiliated with Anthropic, OpenAI, Moonshot AI, or any agent vendor. Evaluation results depend on model version, harness, and tasks — treat them as dated evidence, not eternal truth.

## Roadmap

See the [current work plan](https://github.com/remote-controlled-man/skillfit/blob/main/docs/work/current.md), [changelog](CHANGELOG.md) and [release procedure](docs/maintainers/releases.md).

See the [capability table](docs/guides/experiment-workflow.md#executor-capabilities) for current adapter and trigger verification limits, and the current work plan for pending implementation. Later work includes live validation and additional agent adapters. The [evidence index](evidence/README.md) and [debugging study status](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/skill-evaluation-evidence.md) retain the limits of current results. The 67-Skill catalog and 13-Skill starter set are not evaluated as sets.

## Contributing

Follow [CONTRIBUTING.md](https://github.com/remote-controlled-man/skillfit/blob/main/CONTRIBUTING.md). Useful contributions include real-workflow cases, reproducible evidence and matrix corrections. [Security reports](https://github.com/remote-controlled-man/skillfit/blob/main/SECURITY.md) have a separate channel.

For development handoff, use [architecture and maintenance](docs/maintainers/architecture.md). The [current work plan](https://github.com/remote-controlled-man/skillfit/blob/main/docs/work/current.md#status) records cleanup progress and pending research.

### License

[MIT](LICENSE)
