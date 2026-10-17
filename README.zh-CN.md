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

围绕你自己的任务编写 case：固定初始文件、写下任务请求、定义正确结果必须满足的条件。内置 bench 用来教格式；CLI 负责运行你的 case、对比结果和成本、保存证据。参见[case 编写指南](docs/bench-authoring.md)。

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
npx skillfit@0.11.0 --help
npx skillfit@0.11.0 doctor
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

0.10.1 已包含：Ctrl+C 会停止正在运行的评测进程和后续调用，保留可用输出与用量，封存中止记录后以 130 退出。SIGTERM 对应 143。部分或未知用量仍不完整；中止批次不能获准升级，也不会自行重试。参见[中断与记录保留](docs/evaluation-interruption.md)。

0.10.1 还包含：正式 `eval` 会在任何 agent／裁判调用前离线检查所选 case。硬失败会阻止开跑；警告与未知证据分别报告，并随本批记录保留。预览会标明校验尚未执行，不运行评分器或参考解。它只增加本地校验时间，新增模型调用为零。参见 [case 开跑前校验](docs/eval-case-preflight.md)。

支持的 agent：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力矩阵](src/matrix/agents.json)——机器可读、带验证日期、附官方文档链接）。trigger 模式的捕获目前已在 Kimi Code 和 Codex CLI 上验证过。

## 创建自己的 case

0.10.0 已包含：生成代码修复 case，带有错误的初始文件、受保护的测试、独立行为检查和参考修复。第一条命令预览文件，第二条创建新目录；校验和 eval 预览都不会调用模型。

```bash
node dist/cli.js bench init my-bench --kind command --dry-run
node dist/cli.js bench init my-bench --kind command --yes
node dist/cli.js bench check my-bench
node dist/cli.js bench check my-bench --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --input workspace --trials 1 --max-calls 2 --dry-run
```

这是用于教格式的合成案例，不是 Skill 基准。在衡量收益前，把初始文件、任务请求、评分器和参考修复一起替换为你的真实任务。预览会显示计划调用两次，实际一次也不会启动。不传 `--kind`（或用 `--kind output`）仍生成原来的回复评分模板。已有失败可用 `bench add --freeze` 固定，维护者修复可用 `--from-commit` 导入；参见[编写指南](docs/bench-authoring.md)。

Agent 可以用 `bench check --json` 读取带版本的校验标识、任务 ID、位置、失败原因、处理建议和限长的评分器证据。标准输出只有 JSON，退出码区分通过、校验失败和执行错误。不加 `--calibrate` 时，它仍是离线完整性校验，警告仍需检查。0.11.0还支持独立的 `--calibrate --json --dry-run` 计划；JSON 正式执行前必须明确确认计划哈希。参见 [JSON 契约](docs/bench-check-json.md)。

0.11.0支持给校验器和参考解命令的参数加引号，包括含空格的脚本路径。已识别的评分器加载／运行异常及显式基础设施错误消息会阻止离线校验通过，或记为不参与评分的评测错误，同时保留 Agent 成本。正常任务失败和断言失败仍参与评分。详见[校验命令与错误报告](docs/verifier-contract.md)。

0.11.0 还会在 eval 和基线校准的预览及开跑前检查 Agent 环境：CLI 文件是否可用、能力是否与矩阵声明匹配，以及全局是否存在同名 Skill。已知失败会在 case 探测或模型调用前拦住；登录状态明确标为离线未知。检查结果随运行封存，报告和重放读取当时记录，不探测当前机器。详见 [Agent 环境自检](docs/eval-agent-preflight.md)。

可以列出和查看 case，再预览编辑或移除操作。加 `--yes` 才会备份并应用通过校验的清单变更；移除会保留 case 文件。配对评估、触发率测试和基线校准都可重复 `--task` 只选择部分 case；配对 JSON 请求用 `taskIds`。所选 ID 和顺序会固定到计划中，预算只计算所选 case，小样本仍只作参考。参见 [case 管理](docs/case-management.md)。

```bash
node dist/cli.js bench list my-bench --json
node dist/cli.js bench show my-bench example-task --json
node dist/cli.js bench edit my-bench example-task --set shouldTrigger=true --json
node dist/cli.js eval skills/skillfit --bench my-bench --agent codex --task example-task --input workspace --trials 1 --max-calls 2 --dry-run
```

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

新的安装式评估会给两组提供相同的原生未跟踪文件 diff 工具。使用 `node _skillfit/native-diff.cjs <file>` 可显示未经输出过滤的补丁。计划和证据固定工具版本及内容；工具被修改会停止后续调用。这修正的是共同评估环境，不是 Skill。旧运行保留原环境，提供工具也不代表 Agent 实际使用了它。

用版本 1 JSON 请求，让 Agent 调用现有 Skill 修订评估引擎。只读预览固定输入和策略，执行时必须提供预览的计划指纹。JSON 结果保留提升、退步、全部调用成本和证据覆盖情况。独立策略返回 `accept`、`reject` 或 `inconclusive`；证据不足不能授权采用，组件也不会升级 Skill。这项接口已包含在 [0.9.0](docs/releases/0.9.0.md) 中，可通过 npm 或构建源码使用。详见[输入输出与验收策略契约](docs/eval-component.md)。

新的成本对比可在请求中设置 `pairOrder: "balanced"`，交替安排两版先运行。计划固定顺序，离线评估核对实际调用记录；配对统计公式保持不变。

默认策略要求证实质量提升。显式声明版本 2 的 `efficiency` 策略后，未观察到正确性退步且未缓存输入成本稳定下降，也可通过验收；质量持平仍保留 `inconclusive` 判定。两种目标都要求独立验证、完整证据和成本覆盖。参见[预先声明的成本示例](docs/examples/eval-request.diagnosing-v2-efficiency.json)。

请求还可通过 `executorTimeoutSeconds` 固定两版的单次时限（默认 600 秒）。改变时限必须声明新计划和新批次；之前的超时及已知花费仍保留在证据中。

0.10.0 已包含可选 `spendingBudget`，设置五项整批预算停止线。触线或缺失完整最终用量时停止后续调用并保留花费；正在运行的一次仍可能越线。详见[预算检查契约](docs/eval-component.md#input-and-execution)。

0.11.0统一了普通配对／触发率 eval 和配对 Agent 请求的计划生成。普通 eval 也支持 `--json`、`--spending-budget <file>`、`--executor-timeout-seconds`、`--runs-root` 和 `--run-group`，配对实验另可设置 `--pair-order`；JSON 执行必须确认预览指纹。请求可用 `baselineSkill: null` 表示 baseline 不由 harness 安装 Skill，与普通 installed eval 省略 `--baseline-skill` 对应。这能测量安装收益，但不能授权采用某个修订版本。详见[统一设置与确认流程](docs/eval-planning.md)。

0.11.0 还为基线校准和触发率测试提供 JSON 预览、固定任务选择、调用／消耗上限及每次调用的超时。预览不执行评分器、参考解或 Agent；case 或环境硬失败会阻止正式开跑。JSON 执行必须指定新的批次名，并提交准确的预览哈希（校准用 `plan.planSha256`，eval 用 `plan.sha256`）。校准测基线难度，触发率测试测发现能力，两者都不能证明配对的 Skill 收益或授权采用。

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

0.10.1 中，普通报告和 JSON 都接受同样的 manifest、原生运行目录或复现包，包括中止和未完成批次。两者都会核查已存证据，并把采用决定与质量判定分开解释。`--replay`、`--records` 和 `--policy` 两种格式都能用；成功生成报告不代表获准升级。参见[报告输入和状态](docs/evaluation-reports.md)。

0.11.0还支持用两种格式读取校准目录／`_calibration.json` 和触发率 manifest。已完成的校准保持完成状态，展示基线难度；触发率报告展示召回率、误触发率、精确率、F1 和检测覆盖情况。新封存的单组运行支持原生证据审计、离线交付结果重放和便携导出；独立的历史摘要仍未验证。这两种报告不能授权采用，也不能使用配对采用策略选项。参见[报告类型](docs/evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101)。

新报告分别列出缓存输入、未缓存输入、输出和耗时，并把失败运行的消耗计入每次成功任务的成本。报告同时展示存活配对和全部 agent 调用；超时导致的用量不完整或缺失会单独标记，不会当作零。Chat completions API 明确返回的缓存输入计数（包括零）会被保留；缺失或非法值仍记为未知。旧 manifest 会显示这些字段未记录。详见[成本统计](docs/eval-costs.md)。

0.11.0用 `invocationCosts` 分别记录 Agent、裁判和合计消耗，保留失败、部分和未知用量。可选裁判的消耗计入同一批次停线；显式启用 API 裁判却缺少凭据会报错，不会静默关闭。历史缺失的裁判记录仍标未知。参见[成本统计](docs/eval-costs.md)。

npm 0.11.0 之后的源码也会读取普通 Codex 评测和 CLI 裁判的 JSON 用量，不再要求启用触发检测。离线 `USAGE_CAPABILITY` 检查会在花费前拒绝已知缺少必要计数的 Agent／裁判严格预算组合。API／注入执行器的覆盖情况仍标未知，需要运行时检查；缺失成本不会补成零。

这份源码也会在 API 回答格式或 HTTP 状态异常时保留接口已报告的用量。可用计数与原始响应一起保存；缺失字段仍标未知。调用仍属于执行异常并停止后续调用，不会因此丢掉已有成本证据。

同一份源码可把受支持且已封存的原生配对、校准和触发率实验（包括带有新裁判记录的配对实验）导出为独立目录，包含原始记录、匹配的输入、当时的编译版 CLI、校验清单和重放入口。默认只预览；缺输入、缺少必需的调用记录／原始运行时支持或目标目录已存在就停止。整个目录可搬到另一台机器，重放不调用模型，保留中止状态和未知成本，也不能授权升级。分享前检查项目数据，参见[可搬走的复现包](docs/replay-packages.md)。

0.10.1 会在调用前封存输入副本：原始 Skill、bench 或请求之后被修改、删除，也不影响导出和重放。计划会记录快照校验信息、本地复制耗时和存储量；已声明的快照损坏就拒绝使用。历史记录仍需找回匹配的原始输入。参见[评测输入封存](docs/evaluation-input-snapshots.md)。

npm 0.11.0 之后的源码支持把 bench 放在 Git 仓库根目录：指纹和快照统一排除 Git 元数据。预览会拦住位于 bench、Skill／配置输入、编译运行时或 Git 元数据内部的输出，目录别名也不能绕过。输入与结果应放在同级目录，例如 `--bench ./my-bench --runs-root ./runs`。

```bash
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs --verify-only
node ./exports/my-run/reproduce.mjs
```

[Skill 实验证据索引](docs/skill-evaluation-evidence.md)保留各批次、失败和成本限制。当前累计 195 次执行器调用，七份历史最终用量仍未知；没有候选版本满足采用条件。最新的[接收者机制验证](evidence/2026-10-15-receiver-mechanism-stop.md)在一次候选失败后停止，没有运行对照。已发布的失败均保留离线重放入口。这些针对具体任务的结果不能证明 Skill 普遍有效。

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
- **dry-run 优先。** 配置变更先预览再应用，替换已有配置时保留备份并验证。新建 bench、run、bundle 通过冲突检查保护已有输出。
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
- [x] 已发布到 npm（`skillfit@0.11.0`），并通过 [CLI/OIDC 发布与注册表安装验收](docs/releases/0.11.0-verification.json)。`npx skillfit` 安装的是这个版本。克隆后 `npm ci` 再 `npm run build` 仍然可用。
- [x] 社区 bench 与 evidence 提交。bench 放在 `benches/contrib`；证据用 Evidence submission issue 模板。CI 只跑离线检查，不调用 agent。
- [ ] Cursor / Gemini CLI / OpenCode 适配器
- [x] Streamable HTTP MCP 预检（`mcp check` 的 `http` 传输）。不会调用工具。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。最有价值的贡献是用你真实工作流造的 bench。证据投稿用 Evidence submission issue 模板：固定版本的 bench、`bench check` 摘要、确切命令，以及审过的 manifest。无法复核的百分比不会被接收。发布说明见 [CHANGELOG.md](CHANGELOG.md)，安全问题报告见 [SECURITY.md](SECURITY.md)。

## License

[MIT](LICENSE)
