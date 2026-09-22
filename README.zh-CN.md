<div align="center">

# skillfit

**Skills 市场告诉你什么最热门，skillfit 告诉你什么真有用。**

在**你的** agent、**你的** 模型、**你的** 任务上实测某个 skill / 规则文件 / MCP 配置到底有没有用——<br/>
然后只装通过实验的那些。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[快速开始](#快速开始) · [Bench 指南](benches/README.md) · [指标协议](docs/metrics.md) · [证据库](evidence/)

</div>

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
$ npx skillfit eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
```

9 个该触发的任务里它只被加载了一次——而且不加载也照样全做对。这种结论，应用市场给不了你。

## 快速开始

```bash
# 1. 体检当前配置（只读，安全）
npx skillfit doctor

# 2. 装之前先 A/B 测一个 skill（按名字选内置 bench，或传自己的 bench 路径；
#    也可以用 --agent 驱动本机 agent CLI 而不必配 API key）
npx skillfit eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. 或者测 agent 自己会不会触发这个 skill（以及不该触发时会不会乱触发）
npx skillfit eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. 只装实测有效的最小集（默认 dry-run）
npx skillfit install
```

支持的 agent：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力矩阵](src/matrix/agents.json)——机器可读、带验证日期、附官方文档链接）。trigger 模式的捕获目前已在 Kimi Code 和 Codex CLI 上验证过。

## 五个命令

| 命令 | 干什么 | 写文件？ |
|---|---|---|
| `doctor` | 探测已装 agent，检查规则膨胀、skill 合法性/冲突、MCP 配置可解析性、静默失效坑（比如 Claude Code 根本不会读的 AGENTS.md） | 从不 |
| `report` | 从本地会话历史统计 skill 的真实使用：每个 skill 的触发次数、"从未触发"清单（纯路由/上下文税） | 从不 |
| `eval <skill>` | 默认（`--mode inject`）：配对 baseline/treatment，确定性 verifier + 可选盲评，token 成本差值，判定走 McNemar 精确检验 + 配对 bootstrap CI。`--mode trigger`：skill 改为真实安装而不注入 prompt，从 transcript 机械判定触发召回率 / 误触发率 | 仅本地 `runs/` |
| `bench` | `init` 生成带可运行示例任务的骨架；`check` 离线校验（verifier 自测、mock 臂探针、fixture 体积、触发标签覆盖）；`add --freeze` 把你刚目击的翻车冻成永久 bench 任务 | `init`/`add` 确认后才写；`check` 从不 |
| `install` | 受管区域规则写入（`<!-- SKILLFIT_START/END -->`，幂等原子）、skill 复制带冲突保护、内容哈希锁定的 lockfile、安装后校验 | 确认后才写 |

## 自带 bench

实验质量取决于任务质量。bench 就是一个目录——`bench.json` + fixtures + 确定性 verifier。用 `npx skillfit bench init` 生成骨架，用 `npx skillfit bench add <bench> --freeze` 把 agent 刚翻车的现场冻成任务，用 `npx skillfit bench check` 离线校验，照着你自己的生产场景造：[benches/README.md](benches/README.md)。

## 我们自己的数据

我们用 skillfit 的 harness 测了 8 个流行的工作流 skill（24 组 baseline/treatment 配对，Codex CLI，2026-07 冻结基线）。**8 个里只有 1 个表现出可重复的收益**：

| Skill | 质量差值 | 输入 token | 结论 |
|---|---:|---:|---|
| `diagnosing-bugs` | 回归测试资产 +66.7pp（2/3 次） | +11.7% | **条件性有效**——仅困难 bug |
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
- **诚实的数字。** 每个结论都链到带模型版本、skill 哈希、日期和方差的 manifest。判定语义冻结在 [docs/metrics.md](docs/metrics.md)：显著性来自不一致对的 McNemar 精确检验，差值带配对 bootstrap 置信区间，样本不足的运行一律标注 *indicative*，绝不写"有效"。

## 免责声明

与 Anthropic、OpenAI、Moonshot AI 或任何 agent 厂商无关联。评测结果依赖模型版本、harness 和任务——把它们当带日期的证据，不是永恒的真理。

## Roadmap

- [x] doctor / eval / install 核心闭环
- [x] 配对 A/B harness + 盲评
- [x] 统计判定（McNemar 精确检验 + 配对 bootstrap CI，manifest v2）
- [x] 触发率测量（`--mode trigger`：召回率 / 误触发率，带 Wilson 置信区间）
- [x] bench 脚手架（`bench init` + `bench check`）与翻车冻结（`bench add --freeze`）
- [ ] bench 难度校准运行与 git 历史导入（`bench add --from-commit`）
- [ ] Claude Code / Codex 的触发捕获（stream-json 格式待验证）
- [ ] 社区 bench 与 evidence 提交（CI 重跑可复现配置，不收无法验证的结果）
- [ ] Cursor / Gemini CLI / OpenCode 适配器
- [ ] MCP server 配置评测

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。最有价值的贡献是用你真实工作流造的 bench。

## License

[MIT](LICENSE)
