---
name: skillfit
description: Measure whether agent skills, rules, or MCP configs actually help — usage receipts from local session history, trigger-rate measurement, and paired A/B evals with statistical verdicts. Use when the user asks whether a skill is worth installing, whether their installed skills ever get used, wants to A/B-test agent configuration, or wants to build a bench from a real failure.
---

# skillfit driver

Drive the `skillfit` CLI to answer evidence questions about agent configuration. The CLI is the source of
truth for all numbers; your job is to pick the right command, run it, and interpret the output honestly.

## Prerequisites

Check availability with `npx skillfit@0.10.0 --version`, or `node dist/cli.js --version` inside a clone.
If neither works, tell the user to install from https://github.com/remote-controlled-man/skillfit and stop.

## Which command for which question

| User asks… | Run |
|---|---|
| "我的 skill 有没有被用到 / are my skills used at all" | `skillfit report` — read-only, free, instant; start here |
| "这个配置健不健康" | `skillfit doctor` — read-only |
| "这个 skill 值不值得装 / does this skill help" | `skillfit eval <skill-path> --bench <bench> --agent <id> --trials 3` |
| "新版 Skill 是否值得采用 / evaluate a candidate for a Skill evolution workflow" | With npm 0.9.0 or a current checkout, use `eval --request <request.json> --dry-run`; read the [component contract](https://github.com/remote-controlled-man/skillfit/blob/main/docs/eval-component.md) for inputs and acceptance policy |
| "agent 自己想不想得起用它 / does it trigger" | same + `--mode trigger`. Add `--compete-installed` to copy other user Skills; otherwise recall is an upper bound. Codex counts a `SKILL.md` read |
| "这个 MCP 能不能连上 / is this MCP catalog valid" | `skillfit mcp check <probe.json>` — read-only discovery; calls no tools |
| "这个 MCP / AGENTS.md 真的有帮助吗" | `skillfit eval <experiment-dir> --bench <bench> --agent <id> --trials 3`; follow the [configuration experiment guide](https://github.com/remote-controlled-man/skillfit/blob/main/docs/config-experiments.md) |
| "建一个 bench" | `skillfit bench init [dir]` then `skillfit bench check [dir]` |
| "做代码修改 case" | `bench init <dir> --kind command --dry-run`, then apply within the authorized scope; replace the teaching case with the real fixture, prompt, verifier and oracle |
| "给 Agent 看 case 校验失败原因" | `bench check <dir> --json` — offline gate IDs, evidence and remediation; rejects calibration |
| "查看或管理 case" | `bench list <dir> --json`, `bench show <dir> <id> --json`; preview `bench edit <dir> <id> --set field=value --json` or `bench remove <dir> <id> --json` |
| "只测几个 case" | Repeat `eval --task <id>` or set request `taskIds`; preview the selected budget and keep validation independent |
| "把结果交给另一台机器复现" | Preview `report eval <run-dir> --export <new-dir> --json`, then apply within the authorized scope; read the [portable package contract](https://github.com/remote-controlled-man/skillfit/blob/main/docs/replay-packages.md) for matching inputs, stopped costs and sharing review |
| "把这次翻车存成任务" | `skillfit bench add <bench> --freeze --task <id> --prompt "..." --verifier-cmd "<cmd>"` |
| "帮我起草 verifier" | same but `--decompose --agent <id>` — an agent drafts verifier + oracle; admitted only if the NOP + oracle gates pass |

Executor choice: `--agent kimi-code` or `--agent codex` drives the local CLI (no API key needed).
Without `--agent`, eval needs `SKILLFIT_API_KEY`/`OPENAI_API_KEY`. Trigger mode currently verified for
kimi-code and codex only.

## Spend discipline

Real eval runs cost tokens and time. Before any non-dry-run eval:

1. Run with `--dry-run` and show planned calls (selected tasks × trials × conditions, plus enabled judges).
2. State the call ceiling and known cost limits. Continue within existing spending authorization; ask only when the proposed run exceeds it or spending has not been authorized.

## Interpretation discipline (do not skip)

For request-based eval, review the JSON plan and its call ceiling, then execute with
its exact `--plan-sha` within existing spending authorization. Read
`acceptance.decision` and `eligibleForUpgrade`; a zero exit status only means a
report was produced. `reject` and `inconclusive` cannot authorize an upgrade.
`accept` is scoped advisory eligibility, not permission to install or publish.
`automaticUpgrade` is always false. Reproduce saved outcomes and accounting with
`report eval <run-dir> --json --replay`, using trusted verifier code; it calls no model.
This interface is included in npm 0.9.0 and newer; npm 0.8.0 does not include it.
For new cost comparisons, declare `pairOrder: "balanced"` to alternate which arm
runs first while keeping pairs adjacent. Freeze the task set, candidate and policy
before validation; development results and stopped batches stay separate.
The default policy needs a positive quality gain. Explicit policy version 2 with
`objective: "efficiency"` instead tests stable uncached-input savings with no
observed pass/score/check regression. Declare the objective before calls and read
`costs.efficiency`; a tied quality result stays inconclusive and is not equivalence.
Missing usage or an incomplete batch cannot authorize adoption under either objective.
Optional request `spendingBudget` (0.10.0+) sets five whole-batch stop lines;
reaching a line or losing complete final usage stops subsequent calls. An in-flight
call can overshoot; do not treat it as a provider hard cap or retry permission.

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

- `report` and `doctor` are read-only except explicit `report eval --export --yes`,
  which writes a fresh local replay directory. Export calls no model; running
  `reproduce.mjs` executes trusted verifiers. Review project data before sharing.
- `mcp check` starts the configured local server and performs discovery only; it never calls a tool.
- `eval` writes under the declared runs root (`runs/` by default, gitignored).
- `bench init` / `bench add` show a plan before writing; `bench edit/remove` default
  to a plan and apply with `--yes`, with backup and validation. Removal preserves
  files and cannot remove the last registration. Use existing authorization for
  scoped writes; ask only when that authorization is missing.
