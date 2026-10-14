<div align="center">

<img src="docs/assets/skillfit-mark.svg" alt="skillfit 图标" width="96" />

# skillfit

**Skills 市场告诉你什么最热门，skillfit 告诉你什么真有用。**

在**你的** agent、**你的** 模型、**你的** 任务上实测某个 skill / 规则文件 / MCP 配置到底有没有用——<br/>
然后只装通过实验的那些。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [简体中文](README.zh-CN.md)

[快速开始](#快速开始) · [Bench 指南](benches/README.md) · [指标协议](docs/metrics.md) · [证据库](evidence/)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.zh-CN.svg" alt="同一个任务分别使用基线组和实验组配置运行，再比较结果、Token 消耗与不确定性" width="100%" />
</p>

---

## 为什么

Agent 配置生态已经解决了**分发**（`npx skills add`、插件市场、MCP 注册中心），但没解决**选型**。现有证据表明，未经验证的配置可能有害：

- 精选 skill 平均提升通过率 **+16.6pp**，但 agent 自生成 skill 反而 **−1.3pp**，聚焦的小 skill 优于大而全的 bundle（[SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670)）
- LLM 自动生成的 context 文件得分 **−3%**，推理成本却上升 20%+（[ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988)）
- 被扫描的公开 skill 中 36% 含 prompt injection（[Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)）

skillfit 补上缺失的测量层：配对 A/B 实验 + 确定性 verifier + 统计判定 + 触发率测量，打包成任何人都能跑的 CLI。

## 你能得到什么

一次真实运行：skill 已安装但没人提醒时，agent 到底**想不想得起来用它**——

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

9 个该触发的任务里它只被加载了一次——而且不加载也照样全做对。这种结论，应用市场给不了你。

<sub>2026-09-22 在 Kimi Code 上针对当时的 4 任务 `code-review` bench 抓取。该 bench 之后新增了第 5 个任务；上面四行指标是用那次运行记录的每任务计数重新渲染的——运行是真实的，格式是当前的。</sub>

## 安装

```bash
npx skillfit@0.8.0 --help
npx skillfit@0.8.0 doctor
```

`npx skillfit` 安装的是已发布的版本，需要 Node.js 22 或更新。下面的快速开始用的是源码检出，这样才能跑本仓库自带的 bench。`npm run build` 之后，`node dist/cli.js` 是这份检出的 CLI。`skillfit` 是从 npm 装上的命令。

## 快速开始

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

两项 bench check 是离线完整性检查，不是 agent 效果评分。`doctor` 只读；上面的 eval 和 install 只打印计划。`codex` 只是示例 agent ID，可替换为你使用的 agent。真正的实验需要你自己的 Skill 与 bench，以及本机 agent CLI 或 API 凭据。下方配置命令在 Bash 和 PowerShell 中都能运行；选择上游 Skills 需要联网，只有加 `--yes` 才会安装。

`eval` 现在默认每组运行 **5 次**。8 个任务的配对实验会调用 agent 80 次。5 次只是起点；任务是否有代表性、基线是否能区分效果同样重要。先看 dry-run 的调用总数，再按[第一次真实评估指南](docs/first-real-eval.md)操作，之后才考虑效果结论。

eval 和基线校准的 `--trials` 必须是 1 到 20 的整数。小数、格式错误或越界的值会在任何实验或 bench 检查开始前被拒绝。

eval 和基线校准可用 `--max-calls <n>` 拒绝超出调用上限的计划（包括启用的裁判调用）。新运行会保留固定计划、调用记录、session 状态和文件哈希；输入或配置变化、执行器失败后停止后续调用。未完成的运行不能支持安装建议。详见[有限且可核查的实验流程](docs/experiment-workflow.md)，其中也说明环境控制的边界。

支持的 agent：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力矩阵](src/matrix/agents.json)——机器可读、带验证日期、附官方文档链接）。trigger 模式的捕获目前已在 Kimi Code 和 Codex CLI 上验证过。

## 评估真实开源任务

配对 CLI 实验可用 `--input workspace` 直接查看和修改磁盘上的文件，不把整个仓库内联到提示中。
基线校准也应使用相同输入模式。默认仍是 `snapshot`；workspace 输入不支持 API 执行器，
与 `--mode trigger` 分开使用。

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --input workspace --trials 5 --dry-run
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --input workspace --trials 3 --dry-run
```

导入修复时，`bench add --from-commit <sha> --prompt-file issue.md` 保留 issue 请求，避免透露修复提交的答案。
报告展示逐项检查结果、使用量覆盖范围和安装决策所缺的证据。单个任务只能说明该任务，不能证明普遍收益。
详见[真实开源评估流程](docs/oss-task-evaluation.md)，或复跑[固定版本的 mcp-use 示例](benches/contrib/oss-mcp-use-utf8/README.md)。

## 比较 Skill 修订版本

在 `--mode installed` 下用 `--baseline-skill` 比较旧版完整 Skill 和修订版。两版的 `SKILL.md` frontmatter 名称必须一致，内容指纹必须不同。baseline 获得旧版，treatment 获得目标新版，两组使用相同的自然任务提示和独立的结果验证器。计划、manifest 与逐次运行记录固定两版身份，覆盖脚本和二进制资源；任一来源变化都会停止后续调用。这项比较测量修订效果；安装收益仍需另做无 Skill 基线实验。详见[版本修订流程](docs/skill-revisions.md)。

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5 --dry-run
```

## Agent 评估组件

用版本 1 JSON 请求，让 Agent 调用现有 Skill 修订评估引擎。只读预览固定输入和策略，执行时必须提供预览的计划指纹。JSON 结果保留提升、退步、全部调用成本和证据覆盖情况。独立策略返回 `accept`、`reject` 或 `inconclusive`；证据不足不能授权采用，组件也不会升级 Skill。这项接口尚未发布，需要构建仓库版本。详见[输入输出与验收策略契约](docs/eval-component.md)。

新的成本对比可在请求中设置 `pairOrder: "balanced"`，交替安排两版先运行。计划固定顺序，离线评估核对实际调用记录；配对统计公式保持不变。

默认策略要求证实质量提升。显式声明版本 2 的 `efficiency` 策略后，未观察到正确性退步且未缓存输入成本稳定下降，也可通过验收；质量持平仍保留 `inconclusive` 判定。两种目标都要求独立验证、完整证据和成本覆盖。参见[预先声明的成本示例](docs/examples/eval-request.diagnosing-v2-efficiency.json)。

请求还可通过 `executorTimeoutSeconds` 固定两版的单次时限（默认 600 秒）。改变时限必须声明新计划和新批次；之前的超时及已知花费仍保留在证据中。

失败的 Codex JSON 调用可从本地数值计数器保留身份匹配的部分用量。导出不包含私有会话正文；部分用量仍不能满足最终成本覆盖或采用门槛。

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

## 测试规则与 MCP 配置

把 `skillfit-experiment.json` 和 baseline/treatment 项目覆盖层放在同一目录。规则实验可以加入 `AGENTS.md`；MCP 实验可以加入 `.codex/config.toml`、`.mcp.json` 或其他受支持 agent 在能力矩阵中声明的路径。skillfit 会为两组复制相同任务 fixture，先生成完全相同的 prompt 快照，再应用各自覆盖层，让本机 agent 通过正常的项目配置加载器发现配置。

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

先用 `skillfit mcp check` 验证 stdio server 或 Streamable HTTP 端点及其工具目录：它只请求 `tools/list`，检查名称、描述、输入 schema 与 annotations，不会调用工具。然后再跑配对实验，测模型是否选对 server，以及任务结果是否真的改善。详见[规则与 MCP 实验](docs/config-experiments.md)。

在 Codex MCP 试验中，skillfit 会为每次运行传入仅对临时工作区生效的信任覆盖参数，让项目配置正常加载，不修改你的 Codex 用户配置。

## 分享实验结果

先运行下面的合成示例，再把路径替换成自己配对 `eval` 实验输出的 `Manifest:` 路径。报告包含来源、区间、错误和警告，不会再次调用 agent。详见[分享结果指南](docs/sharing-results.md)。

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

新报告分别列出缓存输入、未缓存输入、输出和耗时，并把失败运行的消耗计入每次成功任务的成本。报告同时展示存活配对和全部 agent 调用；超时导致的用量不完整或缺失会单独标记，不会当作零。旧 manifest 会显示这些字段未记录。详见[成本统计](docs/eval-costs.md)。

最新的[调试开发记录](evidence/2026-10-13-debugging-completed-development.md)保留了被拒绝的候选、一个具体修复和增加的总成本；[中止批次](evidence/2026-10-13-debugging-development-stops.md)保留了错误和部分消耗。两者都没有证明稳定提升，也不能授权升级。

[已知退步对照与首次验证中止记录](evidence/2026-10-13-debugging-controls-and-sleep-stop.md)保留了 LRU 的成本下降点估计、normalize-url 的成本退步和已查明的睡眠间隔。16 次完整交付均可离线重放；中止调用保留部分成本、不予评分。新的固定验证批次独立保留。

[已完成的独立验证](evidence/2026-10-14-debugging-independent-validation.md)保留了 80 次真实执行：两个版本均通过 40/40 次，compact v4 的未缓存输入总量下降 16.82%、输出下降 16.64%、耗时下降 17.48%。未缓存输入的 95% 区间支持下降 7.69%–26.26%，保守边界仍未达到声明的至少 10%。验收保持 `inconclusive`，不具备升级资格。各任务的成本增加、全部 125 次研究调用以及零模型调用的离线复算均保留。

[前瞻性后续任务](benches/contrib/oss-skill-followup/README.md)固定了三个新仓库的八个不同缺陷，具备原始失败、完整维护者修复通过和受保护的回归证据。[单独声明的有界方案](docs/plans/2026-10-14-skill-followup.md)保持 v4 和至少 10% 的要求不变，将本轮上限设为 80 次调用、累计消耗上限设为 205 次，并且不合并以前的正确性结果。离线完整性检查证明任务有效，不能证明 Skill 提升。

[后续批次中止记录](evidence/2026-10-14-debugging-followup-routing-stop.md)保留了 46 份精确离线复算、第 47 次调用的 CLI 路由失败及 33 份未调用记录。计时和供电正常，但失败调用的 token 成本仍然未知；已完成的前缀不能授权升级。各任务的成本增加和累计 172 次执行调用均保留。

[之后的消耗控制中止记录](evidence/2026-10-14-debugging-spending-stop.md)保留了单独的恢复检查及一次按用户要求中止的恢复批次调用，实际累计消耗为 174 次，其余 79 份记录未调用。离线归档复算部分成本下限，并将未独立核实的本地恢复检查计数单独保留；不声称新增正确性提升、升级资格或自动升级。

## 可选择的 Codex 配置

新用户克隆仓库后，可用 `--list` 查看 67 个可安装 Skills 的来源目录，再重复 `--skill` 只选择与自己任务相关的项目；另有 7 个已退役的本机 Skills 会列出原因。`--starter` 保留原来的 13 个供旧用户沿用，整套尚未验证；`--all` 选全部 67 个，不是推荐默认配置。目录验证的是来源和安装，不是效果：其中仅 8 个有有限的历史配对实验，没有任何一个已证明其当前锁定版本对当前 Codex 模型有效。配置命令从作者仓库的固定提交下载所选第三方 Skills，校验 SHA-256，并规划全局 `AGENTS.md` 受管规则块。两份自写 Skills 直接放在本仓库。详见[选择安装指南与证据摘要](docs/selectable-codex.md)。

```bash
node dist/cli.js setup codex --list
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes
```

## 可迁移的 Codex 配置

导出至少在两个 Codex 会话中用过的用户级 Skills 和当前生效的全局规则。把生成的目录带到新机器后安装即可。范围与选项见[迁移指南](docs/portable-codex.md)。

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

要导出完整的 65 个上游 Skills 来源目录，可加 `--upstream-lock ./profiles/codex-upstream-sources.json`。新环境会按固定提交下载并逐文件校验；自己写的 Skills 仍随包携带。较小的新环境可用上面的选择安装流程。详见[来源核查](docs/codex-upstream-audit.md)。

## 八个命令

| 命令 | 干什么 | 写文件？ |
|---|---|---|
| `doctor` | 探测已装 agent，检查规则膨胀、skill 合法性/冲突、MCP 声明是否存在及受支持格式的 JSON 语法，并检查静默失效坑（比如 Claude Code 根本不会读的 AGENTS.md） | 从不 |
| `report` | 从保留的本地会话历史统计 skill 使用：每个 skill 的触发次数、未观察到触发的候选项，以及 agent 限制前的原始目录规模。未观察到不等于无用，只是排查优先级信号。也可用 `report eval` 把已有实验清单渲染为 Markdown。 | 从不 |
| `eval <target>` | 对 Skill、规则覆盖层或 MCP 覆盖层做配对 baseline/treatment；包含确定性 verifier、可选盲评、token 成本、McNemar 精确检验、配对 bootstrap CI 和 facet 分数。`--mode trigger` 专门测 Skill 的触发召回率与误触发率 | 仅本地 `runs/` |
| `mcp check <spec>` | 与 stdio MCP server 或 Streamable HTTP 端点握手，请求 `tools/list`，检查工具名称、描述、输入 schema 与 annotations；从不调用工具 | 从不 |
| `bench` | `init` 生成带可运行示例任务的骨架；`check` 离线校验（verifier 自测、oracle/NOP 闸门、mock 臂探针、fixture 体积、触发标签覆盖）；`add --freeze` 把你刚目击的翻车冻成永久 bench 任务，`--decompose` 可让 agent 起草 verifier + 参考解，两道闸门都过才接纳 | `init`/`add` 确认后才写；`check` 从不 |
| `install` | 受管区域规则写入（`<!-- SKILLFIT_START/END -->`，幂等）、skill 复制带冲突保护、内容哈希锁定的 lockfile、安装后校验。写入前先暂存；如果写入或校验失败，会回滚本次改动的目标文件，包括 lockfile。进程突然终止仍可能留下部分安装，可重新运行以协调状态。原文件保留在 `<file>.skillfit-bak`，且首份备份优先，后续更新不会覆盖它。`--dry-run` 会报告冲突并以 0 退出；加上 `--strict` 则让冲突失败（用于 CI 闸门） | 确认后才写 |
| `setup codex` | 列出或安装所选的固定版本上游 Skills、本仓库自写 Skills 和全局触发指引；默认只展示计划 | 仅 `--yes` 写入 |
| `bundle` | `export` 将用过的本地 Skills 和当前全局规则导出为可迁移的 Codex profile | 确认后才写 |

## 自带 bench

实验质量取决于任务质量。bench 就是一个目录——`bench.json` + fixtures + 确定性 verifier。用 `node dist/cli.js bench init` 生成骨架，用 `node dist/cli.js bench add <bench> --freeze` 把 agent 刚翻车的现场冻成任务，用 `node dist/cli.js bench check` 离线校验，照着你自己的生产场景造：[benches/README.md](benches/README.md)。没写过 bench 的话，先看 [docs/bench-authoring.md](docs/bench-authoring.md)——它用一个真实任务把七个步骤从头走一遍，也讲了 bench 会在哪些地方给你一份自信的错数据。

## 我们自己的数据

我们用 skillfit 的 harness 测了 8 个流行的工作流 skill（24 组 baseline/treatment 配对，Codex CLI，2026-07 冻结基线）。其中 1 个在 3 次 treatment 中有 2 次出现回归测试资产信号；没有任何一个显示可靠的任务质量增益。这些实验不能验证当前的 67 个 Skill 目录，也不能验证原来的 13 个整套配置。报告标成 indicative 的运行也不是安装建议：

| Skill | 质量差值 | 输入 token | 结论 |
|---|---:|---:|---|
| `diagnosing-bugs` | 回归测试资产 +66.7pp（2/3 次）；任务质量不变 | +11.7% | 有限的历史流程信号 |
| `code-review` | +3.3pp（不稳定） | +9.1% | 证据不足 |
| `tdd` | 0.00pp | +9.2% | 无可测增益 |
| `doubt-driven-development` | 0.00pp | +20.7% | 无可测增益 |
| `security-and-hardening` | 0.00pp | +27.4% | 无可测增益，成本最高 |
| 其余 3 个 | 0.00pp | +14.7~17.0% | 无可测增益 |

已发表的报告见 [evidence/](evidence/)。部分历史原始 manifest 仍保留在当时的本地运行环境；证据索引说明了这些限制。可用 `skillfit eval` 在自己固定版本的 Skill、agent 与 bench 上复现。

## 设计原则

- **站上标准，不造格式。** AGENTS.md（AAIF）、SKILL.md、`.agents/skills/`、`.mcpb`——只写 agent 本来就读的东西。
- **deny by default。** 只装 profile 显式声明的内容，按内容哈希锁定。
- **dry-run 优先。** 任何写命令先打印计划再动文件，永远有备份。
- **诚实的数字。** 新的效果投稿需要固定版本且可分享的 manifest；部分旧报告没有可下载的原始 manifest。判定语义冻结在 [docs/metrics.md](docs/metrics.md)：显著性来自不一致对的 McNemar 精确检验，差值带配对 bootstrap 置信区间；低于 8 个任务 × 每组 5 次的运行标为 *indicative*，即使它在该 bench 内达到统计显著。

## 免责声明

与 Anthropic、OpenAI、Moonshot AI 或任何 agent 厂商无关联。评测结果依赖模型版本、harness 和任务——把它们当带日期的证据，不是永恒的真理。

## Roadmap

[2026 年 10 月交付计划](docs/growth-roadmap-2026-10.md)

- [x] doctor / eval / install 核心闭环
- [x] 配对 A/B harness + 盲评
- [x] 统计判定（McNemar 精确检验 + 配对 bootstrap CI，manifest v4）
- [x] 单个 Skill、旁边没有其他 Skill 时的触发率（Kimi Code 与 Codex CLI 的 `--mode trigger`：召回率、误触发率，带 Wilson 置信区间）。在它和真实已装集合竞争之前，召回率是上限。Codex 的检测是读了 `SKILL.md`，不是一次 Skill 调用事件。
- [x] bench 脚手架（`bench init` + `bench check`）、翻车冻结（`--freeze`）、git 历史挖矿（`--from-commit`）与难度校准（`--calibrate`）。`bench check` 是离线完整性检查，不是 agent 效果分数。
- [x] 使用相同 prompt 的规则与 MCP 工作区 A/B 实验
- [x] 只读 stdio MCP 握手与工具目录审计
- [ ] Claude Code 的触发捕获，并在真机上验证（卡在账号不可用）
- [x] 正例任务可选 `triggerClass`（`explicit`、`implicit`、`contextual`）。没标类别的任务仍只进汇总召回率。
- [x] `--compete-installed` 把其他用户级 Skill 复制进 trigger 试验。矩阵目录之外的系统 Skill 和插件不会被复制。`installed` 把「读了长正文」和任务结果分开报告；这次读取不是 trigger 召回率。
- [ ] 安装建议。2026 年 7 月的 8 个 Skill 实验没有可靠的任务质量增益。67 个 Skill 目录和 13 个入门套装都没有作为一组被评过。
- [x] 已发布到 npm（`skillfit@0.8.0`）。`npx skillfit` 安装的是这个版本。克隆后 `npm ci` 再 `npm run build` 仍然可用。
- [x] 社区 bench 与 evidence 提交。bench 放在 `benches/contrib`；证据用 Evidence submission issue 模板。CI 只跑离线检查，不调用 agent。
- [ ] Cursor / Gemini CLI / OpenCode 适配器
- [x] Streamable HTTP MCP 预检（`mcp check` 的 `http` 传输）。不会调用工具。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。最有价值的贡献是用你真实工作流造的 bench。证据投稿用 Evidence submission issue 模板：固定版本的 bench、`bench check` 摘要、确切命令，以及审过的 manifest。无法复核的百分比不会被接收。发布说明见 [CHANGELOG.md](CHANGELOG.md)，安全问题报告见 [SECURITY.md](SECURITY.md)。

## License

[MIT](LICENSE)
