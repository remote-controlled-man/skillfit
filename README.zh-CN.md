<div align="center">

<img src="docs/assets/skillfit-mark.svg" alt="skillfit 图标" width="96" />

# skillfit

**在自己的任务上测量配置的结果、成本与触发情况。**

为**你的** agent 比较 Skill、规则文件或 MCP 配置与基线的差异——<br/>
再依据记录的证据及其边界决定启用什么。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [简体中文](README.zh-CN.md)

[文档目录](docs/README.md) · [快速开始](#用-npm-开始) · [Bench 指南](benches/README.md) · [评测报告](docs/reference/evaluation-reports.md) · [贡献](#贡献)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.zh-CN.svg" alt="同一个任务分别使用基线组和实验组配置运行，再比较结果、Token 消耗与不确定性" width="100%" />
</p>

---

## 安装

```bash
npx skillfit@0.13.1 --help
npx skillfit@0.13.1 doctor
```

需要 Node.js 22+。npm 可能先下载包；下面的 case 校验和预览不调用模型。以上固定版本命令使用已发布版本；请先[选择构建](docs/README.md#choose-your-build)，区分对应文档和仅源码提供的新功能。

## 用 npm 开始

在项目目录执行，将 `./my-skill` 替换为包含自己 `SKILL.md` 的目录：

```bash
npx skillfit@0.13.1 bench init my-bench --kind command --dry-run
npx skillfit@0.13.1 bench init my-bench --kind command --yes
npx skillfit@0.13.1 bench check ./my-bench --json
npx skillfit@0.13.1 eval ./my-skill --bench ./my-bench --mode installed --agent codex --trials 1 --max-calls 2 --runs-root ./runs --run-group first-eval --json --dry-run
```

测收益前先把教学用 fixture、prompt、verifier 和 oracle 换成真实任务。预览声明两次调用，实际不调用。检查 `plan.evaluation.agentPreflight.status`；离线登录状态仍未知。case 与运行记录分开放。继续阅读[第一次真实评测](docs/guides/first-real-eval.md)。

### 从源码运行

下面固定已审查的源码快照，便于复现这套操作。这些功能也已合入 main；npm 0.13.1 仍是较早的发布版本。开发当前工作树时按 [CONTRIBUTING.md](https://github.com/remote-controlled-man/skillfit/blob/main/CONTRIBUTING.md) 操作。后续 `node dist/cli.js` 示例需要先构建源码：

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
git switch --detach ed5eaff7d222de1c73874ce022785fbe89291017
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node dist/cli.js doctor
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
node dist/cli.js install --agent codex --dry-run
```

校验离线执行；`doctor` 只读，两种预览都只展示计划。适配器覆盖 **Claude Code**、**OpenAI Codex CLI** 与 **Kimi Code**；[当前源码能力表](docs/guides/experiment-workflow.md#executor-capabilities)列出模式、trigger reader、token/cache 限制与验证层级。matrix 声明命令；离线替身不能证明已安装 CLI 的兼容性或登录状态。

当前工作树包含尚未发布的测量功能和修正；文档中标为**当前源码**的新增能力需要构建当前工作树。

其中包括[离线自检协议 1](docs/guides/bench-authoring.md#test-known-controls)和显式选择的 [bench schema 2 / 冻结 measurementScope 1](benches/README.md#claims-and-measurement-scope)。schema 1 保持兼容且未记录声明；声明本身不证明 bench 能测出收益。不支持的 schema 2 目标会在 verifier、oracle 或模型调用前被拒绝。

上面的 npm 0.13.1 命令保留已发布行为。[能力表](docs/guides/experiment-workflow.md#executor-capabilities)说明适配器支持范围；[测量契约](docs/reference/metrics.md#public-model-identity-per-invocation)定义逐调用模型身份和旧数据的未知证据。

配对评测默认**5 次每组**：8 个任务会执行 80 次 agent，尚未包括可选 judge。8×5 是规模/采用下限，不是每项 bench 内精确检验判定的起点，也不保证统计功效。sampling 未固定，目前没有经验证的 MDE 规划器。花费前预览次数并设置 `--max-calls`。参见[有界实验流程](docs/guides/experiment-workflow.md#bound-calls-and-spending)。

## 为什么

安装一份配置，并不能说明它是否有助于你的任务。已有研究说明了测量的必要性：

- 精选 Skill 在 87 个任务、18 种模型与执行框架组合中，平均提升通过率 **+16.6pp**；收益随组合而变化（[SkillsBench v4](https://arxiv.org/abs/2602.12670v4)）。
- LLM 生成的 context 文件未带来统计显著的成功率提升，平均推理成本在 **SWE-bench 上增加 20%、CTXbench 上增加 23%**（[Evaluating AGENTS.md v3](https://arxiv.org/abs/2602.11988v3)）。
- Snyk 在 2026 年 2 月 5 日的研究中发现，扫描的 **3,984 个公开 Skill 中有 36.82% 存在至少一种安全问题**（[ToxicSkills 研究结果](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)）。

skillfit 提供配对 A/B 实验、确定性 verifier、统计判定和触发率测量。这些研究解释了工具的用途，不能验证 skillfit 本身，也不能预测你的任务会获得多少收益。

围绕你自己的任务编写 case：固定初始文件、写下任务请求、定义正确结果必须满足的条件。内置 bench 用来教格式；CLI 负责运行你的 case、对比结果和成本、保存证据。参见[case 编写指南](docs/guides/bench-authoring.md)。

## 你能得到什么

花费前先选定问题；这些输出支持的结论不同：

| 问题 | 测量 | 边界 |
| --- | --- | --- |
| 任务质量是否变化？ | 配对结果、McNemar verdict 与按任务 bootstrap 区间 | `inconclusive` 不证明无效；小样本可能仍无法分辨 |
| 新版本能否降低成本？ | 预声明效率策略：所有调用的 uncached-input token / 成功任务数 | 需要完整用量、独立验证及无已观察回归；不估算美元，也不证明质量等价 |
| 是否观察到已安装 Skill 触发？ | 单臂 trigger 召回率、误触发率与未知覆盖 | 不能建立配对质量/成本收益或因果结论 |

下面这次历史 trigger 运行，在 Skill 已安装但未被点名时观察触发：

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

9 次相关任务执行只记录到 1 次触发。表中的通过数来自同一已安装组，不是无 Skill 基线；这项单臂观测不能说明加载 Skill 是否改善结果。

<sub>2026-09-22 在 Kimi Code 上针对当时的 4 任务 `code-review` bench 抓取。该 bench 之后新增了第 5 个任务；上面四行指标是用那次运行记录的每任务计数重新渲染的——运行是真实的，格式是当前的。</sub>

## 创建自己的 case

生成代码修改教学 case，再替换成真实任务的输入：

```bash
node dist/cli.js bench init my-bench --kind command --dry-run
node dist/cli.js bench init my-bench --kind command --yes
node dist/cli.js bench check my-bench
node dist/cli.js bench check my-bench --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --input workspace --trials 1 --max-calls 2 --dry-run
```

用 `bench add --freeze` 记录失败，或用 `--from-commit` 导入修复。[case 编写指南](docs/guides/bench-authoring.md)说明这两条路径、verifier 要求和离线校验。

真实花费前，当前源码构建可以通过 [bench self-test](docs/guides/bench-authoring.md#test-known-controls) 运行预先声明的正向、有害、零效果和错误 synthetic 对照。它不调用模型，检查的是配对流水线；不能建立模型质量、真实任务的统计功效或采用资格。已发布 npm 0.13.1 尚无此入口。

列出、查看 case 或预览修改。`--yes` 会备份并应用通过验证的变更；移除注册仍保留 case 文件。重复 `--task` 选择较小的运行范围：

```bash
node dist/cli.js bench list my-bench --json
node dist/cli.js bench show my-bench example-task --json
node dist/cli.js bench edit my-bench example-task --set shouldTrigger=true --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --task example-task --input workspace --trials 1 --max-calls 2 --dry-run
```

参见[case 管理](docs/guides/bench-authoring.md)。真实评测在调用前检查[case 完整性](docs/guides/experiment-workflow.md#plan-before-spending)和[Agent 环境](docs/guides/experiment-workflow.md#executor-capabilities)；预览成功本身不代表环境就绪。

### 评估真实开源任务

CLI 使用 `--input workspace` 直接检查和修改磁盘文件。API 执行器需要默认 snapshot 模式。校准与配对评测保持相同输入模式：

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --input workspace --trials 5 --dry-run
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --input workspace --trials 3 --dry-run
```

导入时用 `--prompt-file` 保留 issue 请求，避免修复提交信息泄露答案。参见[真实 OSS 流程](docs/guides/bench-authoring.md)或[固定的 mcp-use 示例](benches/contrib/oss-mcp-use-utf8/README.md)。

### 比较 Skill 修订版本

比较 frontmatter 名称相同、指纹不同的两个完整版本。两组使用相同自然任务请求；修订效果与安装收益分开解释：

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5 --dry-run
```

参见[修订比较与完整 Skill 交付](docs/guides/experiment-workflow.md#plan-before-spending)。

### Agent 评估组件

Agent 调用方可以预览版本 1 JSON 请求，再确认固定的计划执行：

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

[组件契约](docs/reference/eval-component.md)定义质量与效率策略；`accept`、`reject`、`inconclusive` 与统计 verdict 分开。采纳需要完整的独立验证，工具不自动升级。

[实验计划](docs/guides/experiment-workflow.md#plan-before-spending)说明任务选择、组序和计划确认。`spendingBudget` / `--spending-budget` 可选，提供时**五个字段全部必填**；支持的计数、未知用量与在途超线见[花费边界](docs/guides/experiment-workflow.md#bound-calls-and-spending)。校准测基线难度，trigger 测发现能力，两者都不能证明配对收益。

### 测试规则与 MCP 配置

在 `skillfit-experiment.json` 旁准备基线组和实验组项目覆盖层。第一条命令预览，第二条会真实调用 agent；执行前先检查计划并确定调用预算：

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

先用 `skillfit mcp check` 做服务发现与工具目录检查，不调用工具。再按[规则与 MCP 流程](docs/guides/experiment-workflow.md#rules-and-mcp-overlays)测任务结果。Codex MCP 试验用单次运行的信任覆盖加载临时项目配置，不修改用户配置。

## 分享实验结果

先查看已有的合成报告，再换成自己运行打印的 manifest 或目录：

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

Markdown 和 JSON 都能读取 paired、calibration、trigger 记录，包括不完整运行。生成报告不等于可以采纳。[报告参考](docs/reference/evaluation-reports.md)说明结果分享、报告状态和成本覆盖。

把 sealed 运行导出到全新可迁移目录。先预览，`--yes` 才写入：

```bash
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs --verify-only
node ./exports/my-run/reproduce.mjs
```

[可迁移回放](docs/reference/evaluation-reports.md)验证保存的观察并执行可信本地 verifier，不调用模型。[固定输入](docs/guides/experiment-workflow.md#read-share-and-reproduce)保留原 case 与目标。[中断处理](docs/guides/experiment-workflow.md#read-share-and-reproduce)保留可用花费，未知用量仍为未知。

当前源码把任务输入放在 benches，把生成的观测放在显式运行目录。报告、导出和回放使用这些运行记录；旧研究文件留在固定 Git 提交中，不再作为发布前提。

## 可选择的 Codex 配置

先查看 67 个可安装源，再选择与任务相关的 Skill。`--starter` 选择尚未作为集合评测的 13 个 Skill，`--all` 选择全部 67 个。源哈希验证安装完整性，不代表收益。选择上游源需要网络，只有 `--yes` 安装：

```bash
node dist/cli.js setup codex --list
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes
```

[可选择配置指南](docs/guides/selectable-codex.md)说明来源、退役条目和证据限制。

### 可迁移的 Codex 配置

导出至少在两次 Codex 会话中观察到的用户级 Skill 和当前全局指引：

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

完整 65 个 Skill 的上游目录可使用 `--upstream-lock`；其他选项参见[迁移配置](docs/guides/selectable-codex.md)和[源审计](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/codex-upstream-audit.md)。

## 八个命令

| 命令 | 干什么 | 写文件？ |
|---|---|---|
| `doctor` | 检查 agent 配置、无效 Skill、冲突和受支持的 MCP 声明 | 只读 |
| `report` | 汇总观察到的 Skill 使用情况，或读取已保存评测结果 | 只有 `report eval --export --yes` 写入全新回放目录 |
| `eval <target>` | 比较 Skill、规则或 MCP 覆盖层；trigger 模式观察 Skill 触发 | 保存运行记录；真实评测调用 agent/模型 |
| `mcp check <spec>` | 连接 MCP 服务并检查 `tools/list`，不调用工具 | 不写 skillfit 输出文件；会启动或连接服务 |
| `bench` | 创建、查看、修改和校验任务；当前源码另有离线 `self-test` | 修改需要确认；校准/起草调用 agent 并保存输出；普通检查执行本地 verifier |
| `install` | 应用 profile，包含冲突检查、备份、写后验证和失败回滚 | 确认后写入；`--dry-run` 预览，加 `--strict` 让冲突失败 |
| `setup codex` | 选择固定版本 Skill 与全局触发指引，默认预览 | 仅 `--yes` 安装；选择源需要网络 |
| `bundle` | 导出所选本地 Skill 与全局指引，迁移到另一台机器 | 确认后写入；生成的安装器也先预览 |

参数见 `node dist/cli.js --help`，配置选项见[配置指南](docs/guides/selectable-codex.md)。未观察到 Skill 使用不等于无用。离线检查和回放仍会执行可信的本地 bench 代码。安装保留首份 `<file>.skillfit-bak`；回滚处理写入或验证失败，进程突然终止仍可能留下部分安装。

### 自带 bench

bench 包含 `bench.json`、fixtures 和确定性 verifier。参见[Bench 编写指南](docs/guides/bench-authoring.md)与[格式参考](benches/README.md)；内置 case 用于教格式，不是模型质量证明。

## 我们自己的数据

我们用 skillfit 的 harness 测了 8 个流行的工作流 skill（24 组 baseline/treatment 配对，Codex CLI，2026-07 冻结基线）。其中 1 个在 3 次 treatment 中有 2 次出现回归测试资产信号；没有任何一个显示可靠的任务质量增益。这些实验不能验证当前的 67 个 Skill 目录，也不能验证原来的 13 个整套配置。报告标成 indicative 的运行也不是安装建议：

| Skill | 质量差值 | 输入 token | 结论 |
|---|---:|---:|---|
| `diagnosing-bugs` | 回归测试资产 +66.7pp（2/3 次）；任务质量不变 | +11.7% | 有限的历史产物信号 |
| `code-review` | +3.3pp（不稳定） | +9.1% | 证据不足 |
| `tdd` | 0.00pp | +9.2% | 无可测增益 |
| `doubt-driven-development` | 0.00pp | +20.7% | 无可测增益 |
| `security-and-hardening` | 0.00pp | +27.4% | 无可测增益，成本最高 |
| 其余 3 个 | 0.00pp | +14.7~17.0% | 无可测增益 |

这些是所记录任务上的结果，不是对所有工作流声称的检验。回归测试产物不能证明过程顺序，0.00pp 也不能排除未测量的过程效应。基线饱和限制已观察到的质量提升空间，但完整成本且无已观察回归时，不会自动排除该任务的效率比较价值。

参见[原始研究记录](https://github.com/remote-controlled-man/skillfit/blob/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/evidence/README.md)与[已归档调试研究](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/skill-evaluation-evidence.md)，了解各日期报告的范围和可用记录。这些作者运行记录不能建立第三方独立真实复现；离线 replay 验证的是已保存观测。

## 设计原则

- **使用原生配置。** 按各 agent 支持的规则与 Skill 路径写入，包括适用时的 `AGENTS.md`、`SKILL.md` 和 `.agents/skills/`；差异由 agent matrix 统一管理。
- **deny by default。** 只装 profile 显式声明的内容，按内容哈希锁定。
- **dry-run 优先。** 配置变更先预览再应用，替换已有配置时保留备份并验证。新建 bench、run、bundle 通过冲突检查保护已有输出。
- **诚实的数字。** 新的效果投稿需要固定版本且可分享的 manifest；部分旧报告没有可下载的原始 manifest。判定语义冻结在 [docs/reference/metrics.md](docs/reference/metrics.md)：显著性来自不一致对的 McNemar 精确检验，差值带配对 bootstrap 置信区间；低于 8 个任务 × 每组 5 次的运行标为 *indicative*，即使它在该 bench 内达到统计显著。

### 免责声明

与 Anthropic、OpenAI、Moonshot AI 或任何 agent 厂商无关联。评测结果依赖模型版本、harness 和任务——把它们当带日期的证据，不是永恒的真理。

## Roadmap

参见[更新记录](CHANGELOG.md)和[发布流程](docs/maintainers/releases.md)。

当前适配器与 trigger 的验证边界见[能力表](docs/guides/experiment-workflow.md#executor-capabilities)，实施待办见当前工作计划。后续工作包括真实环境验证和增加 Agent 适配器。[原始研究记录](https://github.com/remote-controlled-man/skillfit/blob/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/evidence/README.md)与[调试研究状态](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/skill-evaluation-evidence.md)保留当前结论的限制。67 个 Skill 的目录和 13 个 Skill 的入门集均未作为集合评测。

## 获取帮助

先查阅与你所用构建对应的[文档](docs/README.md)。遇到问题时，[搜索已有 issue 或新建一个](https://github.com/remote-controlled-man/skillfit/issues)，附上命令、预期与实际行为、skillfit 和 Node 版本、操作系统及相关 agent 版本。分享产物前检查私密内容。安全问题按 [SECURITY.md](https://github.com/remote-controlled-man/skillfit/blob/main/SECURITY.md) 报告。

## 贡献

按 [CONTRIBUTING.md](https://github.com/remote-controlled-man/skillfit/blob/main/CONTRIBUTING.md) 贡献真实工作 case、可复现证据和矩阵修正。[安全报告](https://github.com/remote-controlled-man/skillfit/blob/main/SECURITY.md)有独立渠道。

开发接手时，阅读[架构与维护](docs/maintainers/architecture.md)。当前进度记录在仅源码提供的 `docs/work/current.md` 中；npm 包不包含这份计划。

## License

[MIT](LICENSE)
