# skillfit

**Skills 市场告诉你什么最热门，skillfit 告诉你什么真有用。**

在**你的** agent、**你的** 模型、**你的** 任务上实测某个 skill / 规则文件 / MCP 配置到底有没有用——然后只装通过实验的那些。

[English README](README.md)

---

## 为什么

Agent 配置生态已经解决了**分发**（`npx skills add`、插件市场、MCP 注册中心），但没解决**选型**。现有证据表明，未经验证的配置可能有害：

- 精选 skill 平均提升通过率 **+16.6pp**，但 agent 自生成 skill 反而 **−1.3pp**，聚焦的小 skill 优于大而全的 bundle（[SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670)）
- LLM 自动生成的 context 文件得分 **−3%**，推理成本却上升 20%+（[ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988)）
- 被扫描的公开 skill 中 36% 含 prompt injection（[Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)）

skillfit 补上缺失的测量层：配对 A/B 实验 + 确定性 verifier + 盲评打分，打包成任何人都能跑的 CLI。

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

## 快速开始

```bash
# 1. 体检当前配置（只读，安全）
npx skillfit doctor

# 2. 装之前先 A/B 测一个 skill（需要自带 API key）
npx skillfit eval ~/.agents/skills/some-skill --trials 3

# 3. 只装实测有效的最小集（默认 dry-run）
npx skillfit install
```

支持的 agent：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力矩阵](src/matrix/agents.json)——机器可读、带验证日期、附官方文档链接）。

## 三个命令

| 命令 | 干什么 | 写文件？ |
|---|---|---|
| `doctor` | 探测已装 agent，检查规则膨胀、skill 合法性/冲突、MCP 配置可解析性、静默失效坑（比如 Claude Code 根本不会读的 AGENTS.md） | 从不 |
| `eval <skill>` | 配对 baseline/treatment 跑 bench，确定性 verifier + 可选盲评，token 成本差值，判定：有效 / 无效 / 不确定 | 仅本地 `runs/` |
| `install` | 受管区域规则写入（`<!-- SKILLFIT_START/END -->`，幂等原子）、skill 复制带冲突保护、内容哈希锁定的 lockfile、安装后校验 | 确认后才写 |

## 自带 bench

实验质量取决于任务质量。bench 就是一个目录——`bench.json` + fixtures + 确定性 verifier。照着你自己的生产场景造：[benches/README.md](benches/README.md)。

## 设计原则

- **站上标准，不造格式。** AGENTS.md（AAIF）、SKILL.md、`.agents/skills/`、`.mcpb`——只写 agent 本来就读的东西。
- **deny by default。** 只装 profile 显式声明的内容，按内容哈希锁定。
- **dry-run 优先。** 任何写命令先打印计划再动文件，永远有备份。
- **诚实的数字。** 每个结论都链到带模型版本、skill 哈希、日期和方差的 manifest。

## 免责声明

与 Anthropic、OpenAI、Moonshot AI 或任何 agent 厂商无关联。评测结果依赖模型版本、harness 和任务——把它们当带日期的证据，不是永恒的真理。

## Roadmap

- [x] doctor / eval / install 核心闭环
- [x] 配对 A/B harness + 盲评
- [ ] 社区 bench 与 evidence 提交（CI 重跑可复现配置，不收无法验证的结果）
- [ ] Cursor / Gemini CLI / OpenCode 适配器
- [ ] MCP server 配置评测

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。最有价值的贡献是用你真实工作流造的 bench。

## License

[MIT](LICENSE)
