---
name: skillfit
description: Measure whether agent skills, rules, or MCP configs actually help — usage receipts from local session history, trigger-rate measurement, and paired A/B evals with statistical verdicts. Use when the user asks whether a skill is worth installing, whether their installed skills ever get used, wants to A/B-test agent configuration, or wants to build a bench from a real failure.
---

# skillfit driver

Drive the `skillfit` CLI to answer evidence questions about agent configuration. The CLI is the source of
truth for all numbers; your job is to pick the right command, run it, and interpret the output honestly.

## Prerequisites

Check availability first: `npx skillfit --version` (or `node dist/cli.js --version` inside a clone). If it
fails, tell the user to install from https://github.com/remote-controlled-man/skillfit and stop.

## Which command for which question

| User asks… | Run |
|---|---|
| "我的 skill 有没有被用到 / are my skills used at all" | `skillfit report` — read-only, free, instant; start here |
| "这个配置健不健康" | `skillfit doctor` — read-only |
| "这个 skill 值不值得装 / does this skill help" | `skillfit eval <skill-path> --bench <bench> --agent <id> --trials 3` |
| "agent 自己想不想得起用它 / does it trigger" | same + `--mode trigger` |
| "建一个 bench" | `skillfit bench init [dir]` then `skillfit bench check [dir]` |
| "把这次翻车存成任务" | `skillfit bench add <bench> --freeze --task <id> --prompt "..." --verifier-cmd "<cmd>"` |

Executor choice: `--agent kimi-code` or `--agent codex` drives the local CLI (no API key needed).
Without `--agent`, eval needs `SKILLFIT_API_KEY`/`OPENAI_API_KEY`. Trigger mode currently verified for
kimi-code and codex only.

## Spend discipline

Real eval runs cost tokens and time. Before any non-dry-run eval:

1. Run with `--dry-run` and show the plan (task count × trials = run count).
2. Tell the user the expected cost and ask before running for real.

## Interpretation discipline (do not skip)

- Read the verdict line, the discordant-pair counts, and the CI — not just the delta. `inconclusive` means
  the run cannot tell, not that the skill is useless.
- Anything printed as `indicative` (small benches, few trials) must be reported as indicative.
- A baseline pass rate ≥ 90% warning means the bench cannot discriminate — say so instead of reporting a
  0pp delta as a finding.
- Trigger mode: report recall and false-trigger rate separately, with their CIs. A skill that never fires
  has zero realized value regardless of content quality.
- Always cite the manifest path (`runs/<group>/manifest.json`) so the user can audit.
- Full metric definitions: `docs/metrics.md` in the skillfit repo.

## Safety

- `report` and `doctor` are always read-only.
- `eval` writes only under `runs/` (gitignored).
- `bench init` / `bench add` print a plan and ask before writing; pass `--yes` only when the user has
  explicitly confirmed.
