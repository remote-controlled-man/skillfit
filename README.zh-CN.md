<div align="center">

# skillfit

**Skills 市场告诉你什么最热门，skillfit 告诉你什么真有用。**

在**你的** agent、**你的** 模型、**你的** 任务上实测某个 skill / 规则文件 / MCP 配置到底有没有用——<br/>
然后只装通过实验的那些。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[快速开始](#快速开始) · [Bench 指南](benches/README.md) · [指标协议](docs/metrics.md) · [证据库](evidence/)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.svg" alt="skillfit 用相同任务对比关闭和开启配置的结果，再记录统计判定" width="100%" />
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

支持的 agent：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力矩阵](src/matrix/agents.json)——机器可读、带验证日期、附官方文档链接）。trigger 模式的捕获目前已在 Kimi Code 和 Codex CLI 上验证过。

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

先用 `skillfit mcp check` 验证 stdio 握手和工具目录：它只请求 `tools/list`，检查名称、描述、输入 schema 与 annotations，不会调用工具。然后再跑配对实验，测模型是否选对 server，以及任务结果是否真的改善。详见[规则与 MCP 实验](docs/config-experiments.md)。

在 Codex MCP 试验中，skillfit 会为每次运行传入仅对临时工作区生效的信任覆盖参数，让项目配置正常加载，不修改你的 Codex 用户配置。

## 分享实验结果

先运行下面的合成示例，再把路径替换成自己配对 `eval` 实验输出的 `Manifest:` 路径。报告包含来源、区间、错误和警告，不会再次调用 agent。详见[分享结果指南](docs/sharing-results.md)。

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

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
| `mcp check <spec>` | 启动 stdio MCP server，完成协议握手，请求 `tools/list`，检查工具名称、描述、输入 schema 与 annotations；从不调用工具 | 从不 |
| `bench` | `init` 生成带可运行示例任务的骨架；`check` 离线校验（verifier 自测、oracle/NOP 闸门、mock 臂探针、fixture 体积、触发标签覆盖）；`add --freeze` 把你刚目击的翻车冻成永久 bench 任务，`--decompose` 可让 agent 起草 verifier + 参考解，两道闸门都过才接纳 | `init`/`add` 确认后才写；`check` 从不 |
| `install` | 受管区域规则写入（`<!-- SKILLFIT_START/END -->`，幂等）、skill 复制带冲突保护、内容哈希锁定的 lockfile、安装后校验。写入前先暂存；如果写入或校验失败，会回滚本次改动的目标文件，包括 lockfile。进程突然终止仍可能留下部分安装，可重新运行以协调状态。原文件保留在 `<file>.skillfit-bak`，且首份备份优先，后续更新不会覆盖它。`--dry-run` 会报告冲突并以 0 退出；加上 `--strict` 则让冲突失败（用于 CI 闸门） | 确认后才写 |
| `setup codex` | 列出或安装所选的固定版本上游 Skills、本仓库自写 Skills 和全局触发指引；默认只展示计划 | 仅 `--yes` 写入 |
| `bundle` | `export` 将用过的本地 Skills 和当前全局规则导出为可迁移的 Codex profile | 确认后才写 |

## 自带 bench

实验质量取决于任务质量。bench 就是一个目录——`bench.json` + fixtures + 确定性 verifier。用 `node dist/cli.js bench init` 生成骨架，用 `node dist/cli.js bench add <bench> --freeze` 把 agent 刚翻车的现场冻成任务，用 `node dist/cli.js bench check` 离线校验，照着你自己的生产场景造：[benches/README.md](benches/README.md)。没写过 bench 的话，先看 [docs/bench-authoring.md](docs/bench-authoring.md)——它用一个真实任务把七个步骤从头走一遍，也讲了 bench 会在哪些地方给你一份自信的错数据。

## 我们自己的数据

我们用 skillfit 的 harness 测了 8 个流行的工作流 skill（24 组 baseline/treatment 配对，Codex CLI，2026-07 冻结基线）。其中 1 个在 3 次 treatment 中有 2 次出现回归测试资产信号；没有任何一个显示可靠的任务质量增益。这些实验不能验证当前的 67 个 Skill 目录，也不能验证原来的 13 个整套配置：

| Skill | 质量差值 | 输入 token | 结论 |
|---|---:|---:|---|
| `diagnosing-bugs` | 回归测试资产 +66.7pp（2/3 次）；任务质量不变 | +11.7% | 有限的历史流程信号 |
| `code-review` | +3.3pp（不稳定） | +9.1% | 证据不足 |
| `tdd` | 0.00pp | +9.2% | 无可测增益 |
| `doubt-driven-development` | 0.00pp | +20.7% | 无可测增益 |
| `security-and-hardening` | 0.00pp | +27.4% | 无可测增益，成本最高 |
| 其余 3 个 | 0.00pp | +14.7~17.0% | 无可测增益 |

完整方法论和原始 manifest 见 [evidence/](evidence/)。用 `skillfit eval` 自己复现。

## 设计原则

- **站上标准，不造格式。** AGENTS.md（AAIF）、SKILL.md、`.agents/skills/`、`.mcpb`——只写 agent 本来就读的东西。
- **deny by default。** 只装 profile 显式声明的内容，按内容哈希锁定。
- **dry-run 优先。** 任何写命令先打印计划再动文件，永远有备份。
- **诚实的数字。** 每个结论都链到带模型版本、评测目标哈希、日期和方差的 manifest。判定语义冻结在 [docs/metrics.md](docs/metrics.md)：显著性来自不一致对的 McNemar 精确检验，差值带配对 bootstrap 置信区间，样本不足的运行一律标注 *indicative*，绝不写"有效"。

## 免责声明

与 Anthropic、OpenAI、Moonshot AI 或任何 agent 厂商无关联。评测结果依赖模型版本、harness 和任务——把它们当带日期的证据，不是永恒的真理。

## Roadmap

[2026 年 10 月交付计划](docs/growth-roadmap-2026-10.md)

- [x] doctor / eval / install 核心闭环
- [x] 配对 A/B harness + 盲评
- [x] 统计判定（McNemar 精确检验 + 配对 bootstrap CI，manifest v4）
- [x] 触发率测量（`--mode trigger`：召回率 / 误触发率，带 Wilson 置信区间）
- [x] bench 脚手架（`bench init` + `bench check`）、翻车冻结（`--freeze`）、git 历史挖矿（`--from-commit`）与难度校准（`--calibrate`）
- [x] 使用相同 prompt 的规则与 MCP 工作区 A/B 实验
- [x] 只读 stdio MCP 握手与工具目录审计
- [ ] Claude Code 的触发捕获（卡在账号不可用）
- [ ] 社区 bench 与 evidence 提交（CI 重跑可复现配置，不收无法验证的结果）
- [ ] Cursor / Gemini CLI / OpenCode 适配器
- [ ] Streamable HTTP 与 2026 无状态 MCP 预检
- [ ] 完整已安装 Skill 集合下的路由竞争

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。最有价值的贡献是用你真实工作流造的 bench。发布说明见 [CHANGELOG.md](CHANGELOG.md)，安全问题报告见 [SECURITY.md](SECURITY.md)。

## License

[MIT](LICENSE)
