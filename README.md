<div align="center">

# skillfit

**Skill registries tell you what's popular. skillfit tells you what actually works.**

Measure whether a skill, rules file, or MCP setup improves *your* agent on *your* tasks —<br/>
then install only what survives the experiment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[Quick start](#quick-start) · [Bench guide](benches/README.md) · [Metrics protocol](docs/metrics.md) · [Evidence](evidence/)

</div>

---

## Why

The agent-config ecosystem has solved **distribution** (`npx skills add`, plugin marketplaces, MCP registries) but not **selection**. The evidence says unverified configuration can hurt:

- Curated skills improve pass rates by **+16.6pp** on average — but agent-self-generated skills score **−1.3pp**, and focused skills beat large bundles ([SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670))
- LLM-generated context files scored **−3%** while raising inference cost by 20%+ ([ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988))
- 36% of scanned public skills contain prompt injection ([Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/))

skillfit is the missing measurement layer: paired A/B experiments with deterministic verifiers, statistical verdicts, and trigger-rate measurement — packaged as a CLI anyone can run.

## What you get

A real run, measuring whether an agent even *bothers to load* a skill when it is installed but not mentioned:

```console
$ npx skillfit eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
```

The skill fired once in nine in-domain tasks — and the tasks pass 3/3 without it. That is a verdict no registry can give you.

## Quick start

```bash
# 1. Health-check your current setup (read-only, safe)
npx skillfit doctor

# 2. A/B-test a skill before installing it (pick a bundled bench by name, or pass your own path;
#    use --agent to drive a local agent CLI instead of an API key)
npx skillfit eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. Or measure whether the agent triggers the skill on its own (and only when it should)
npx skillfit eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. Install only the evidence-backed minimal set (dry-run by default)
npx skillfit install
```

Supported agents: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([capability matrix](src/matrix/agents.json) — machine-readable, dated, doc-linked). Trigger-mode capture is currently verified for Kimi Code and Codex CLI.

## The five commands

| Command | What it does | Writes? |
|---|---|---|
| `doctor` | Detects installed agents, checks rules bloat, skill validity/conflicts, MCP config parseability, silent-failure traps (e.g. AGENTS.md that Claude Code never reads) | Never |
| `report` | Skill usage receipts from local session history: fires per skill per agent, and the never-fired list (the pure routing/context tax) | Never |
| `eval <skill>` | Default (`--mode inject`): paired baseline/treatment runs, deterministic verifier + optional blind LLM judge, token-cost delta, verdicts via McNemar exact test + paired bootstrap CI. `--mode trigger`: installs the skill instead of injecting it and measures trigger recall / false-trigger rate from the agent transcript | `runs/` locally |
| `bench` | `init` scaffolds a bench directory with a working example task; `check` validates a bench offline (verifier self-tests, mock-arm probes, fixture hygiene, trigger-label coverage); `add --freeze` turns a failure you just watched into a permanent bench task | `init`/`add` after confirmation; `check` never |
| `install` | Managed-block rules (`<!-- SKILLFIT_START/END -->`, idempotent, atomic), skill copy with conflict protection, commit-pinned lockfile, post-install verification | Only after confirmation |

## Bring your own bench

Evals are only as good as their tasks. A bench is just a directory — `bench.json` + fixtures + a deterministic verifier. Scaffold one with `npx skillfit bench init`, freeze a real failure you just watched your agent botch with `npx skillfit bench add <bench> --freeze`, validate offline with `npx skillfit bench check`, and model it on your own production scenarios: [benches/README.md](benches/README.md).

## Our own data

We ran skillfit's harness on 8 popular workflow skills (24 baseline/treatment pairs, Codex CLI, frozen 2026-07 baseline). Only 1 of 8 showed a repeatable benefit:

| Skill | Quality Δ | Input tokens | Verdict |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp test-asset gain (2/3 runs) | +11.7% | **Conditional** — hard bugs only |
| `code-review` | +3.3pp (unstable) | +9.1% | Not enough evidence |
| `tdd` | 0.00pp | +9.2% | No measurable gain |
| `doubt-driven-development` | 0.00pp | +20.7% | No measurable gain |
| `security-and-hardening` | 0.00pp | +27.4% | No measurable gain, highest cost |
| 3 more | 0.00pp | +14.7~17.0% | No measurable gain |

Full methodology and raw manifests: [evidence/](evidence/). Reproduce it yourself with `skillfit eval`.

## Design principles

- **Standards, not formats.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — we write what agents already read.
- **Deny by default.** We install only what a profile explicitly declares, pinned by content hash.
- **Dry-run first.** Every write command prints its plan before touching a file. Backups always.
- **Honest numbers.** Every claim links to a manifest with model version, skill hash, date, and variance. Verdict semantics are frozen in [docs/metrics.md](docs/metrics.md): significance comes from an exact McNemar test over discordant pairs, deltas carry paired-bootstrap CIs, and underpowered runs are labeled *indicative*, never "effective".

## Disclaimer

Not affiliated with Anthropic, OpenAI, Moonshot AI, or any agent vendor. Evaluation results depend on model version, harness, and tasks — treat them as dated evidence, not eternal truth.

## Roadmap

- [x] doctor / eval / install core loop
- [x] Paired A/B harness with blind judging
- [x] Statistical verdicts (McNemar exact + paired bootstrap CI, manifest v2)
- [x] Trigger-rate measurement (`--mode trigger`: recall / false-trigger rate with Wilson CIs)
- [x] Bench scaffolding (`bench init` + `bench check`) and failure freezing (`bench add --freeze`)
- [ ] Bench difficulty calibration runs and git-history importer (`bench add --from-commit`)
- [ ] Trigger capture for Claude Code / Codex (needs verified stream-json shapes)
- [ ] Community bench & evidence submissions (reproducible-config CI re-runs, not trust-me results)
- [ ] Cursor / Gemini CLI / OpenCode adapters
- [ ] MCP server config evaluation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The highest-value contribution is a bench built from your real workflow.

## License

[MIT](LICENSE)
