# skillfit

**Skill registries tell you what's popular. skillfit tells you what actually works.**

Measure whether a skill, rules file, or MCP setup improves *your* agent on *your* tasks — then install only what survives the experiment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)

[中文 README](README.zh-CN.md)

---

## Why

The agent-config ecosystem has solved **distribution** (`npx skills add`, plugin marketplaces, MCP registries) but not **selection**. The evidence says unverified configuration can hurt:

- Curated skills improve pass rates by **+16.6pp** on average — but agent-self-generated skills score **−1.3pp**, and focused skills beat large bundles ([SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670))
- LLM-generated context files scored **−3%** while raising inference cost by 20%+ ([ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988))
- 36% of scanned public skills contain prompt injection ([Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/))

skillfit is the missing measurement layer: paired A/B experiments with deterministic verifiers and blind judging, packaged as a CLI anyone can run.

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

## Quick start

```bash
# 1. Health-check your current setup (read-only, safe)
npx skillfit doctor

# 2. A/B-test a skill before installing it (bring your own API key)
npx skillfit eval ~/.agents/skills/some-skill --trials 3

# 3. Install only the evidence-backed minimal set (dry-run by default)
npx skillfit install
```

Supported agents: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([capability matrix](src/matrix/agents.json) — machine-readable, dated, doc-linked).

## The three commands

| Command | What it does | Writes? |
|---|---|---|
| `doctor` | Detects installed agents, checks rules bloat, skill validity/conflicts, MCP config parseability, silent-failure traps (e.g. AGENTS.md that Claude Code never reads) | Never |
| `eval <skill>` | Paired baseline/treatment runs against a bench, deterministic verifier + optional blind LLM judge, token-cost delta, verdict: effective / ineffective / inconclusive | `runs/` locally |
| `install` | Managed-block rules (`<!-- SKILLFIT_START/END -->`, idempotent, atomic), skill copy with conflict protection, commit-pinned lockfile, post-install verification | Only after confirmation |

## Bring your own bench

Evals are only as good as their tasks. A bench is just a directory — `bench.json` + fixtures + a deterministic verifier. Model it on your own production scenarios: [benches/README.md](benches/README.md).

## Design principles

- **Standards, not formats.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — we write what agents already read.
- **Deny by default.** We install only what a profile explicitly declares, pinned by content hash.
- **Dry-run first.** Every write command prints its plan before touching a file. Backups always.
- **Honest numbers.** Every claim links to a manifest with model version, skill hash, date, and variance.

## Disclaimer

Not affiliated with Anthropic, OpenAI, Moonshot AI, or any agent vendor. Evaluation results depend on model version, harness, and tasks — treat them as dated evidence, not eternal truth.

## Roadmap

- [x] doctor / eval / install core loop
- [x] Paired A/B harness with blind judging
- [ ] Community bench & evidence submissions (reproducible-config CI re-runs, not trust-me results)
- [ ] Cursor / Gemini CLI / OpenCode adapters
- [ ] MCP server config evaluation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The highest-value contribution is a bench built from your real workflow.

## License

[MIT](LICENSE)
