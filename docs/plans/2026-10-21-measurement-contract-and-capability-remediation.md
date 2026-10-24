# skillfit 测量正确性、能力契约与评测可用性整改计划

修复会产生错误测量或阻断已声明能力的缺陷，让文档、证据身份和报告边界与实现一致，再补齐零模型调用的完整演练。MDE、批量任务采集、过程测量和第三方复现分别形成有验收条件的后续设计，不把研究结论、外部参与或计划编写计作功能完成。

## 当前执行状态

> **原始调查基线：** `8087e05173d673610d05090a52dd548e00c17517`，package `0.13.1`，调查环境 Node `24.21.0`。
>
> **当前做到：** F1–F8 的本地实施及验收已完成；F8 在 A4/A5/V1 最终工作树完成问题 1–21 覆盖与实际包/回放收尾。F3 原三系统/Node 验收与 F5 结果保持其原提交范围；PR #55 已合并，其实际 main push CI 8/8 通过；收据与记录集成状态见治理计划 M4–M6。R1–R4 保持待办，不宣称全部 21 个问题都已实现产品功能。
>
> **进度：** 计划准备 P1–P3 为 3/3；实施 F1–F8 为 8/8，F8 本地验收完成；后续设计 R1–R4 为 0/4。
>
> **本轮授权：** 2026-10-24 用户追加授权合并 PR #55、检查/修复合并后 main CI 并同步原计划。唯一交付顺序和进度见[治理计划 M4–M6](2026-10-22-documentation-governance-and-architecture.md#pr-55-合并与主分支验收2026-10-24)；此前 N1–N3 结果保持，不启动 R1–R4、真实 Agent/model 调用、用户配置修改或发布。
>
> **下一步：** PR #55 已合并为 main `c1c23bb087e6927e0137e6bcc7b08c10ef3163a7`，[main CI 40103002073](https://github.com/remote-controlled-man/skillfit/actions/runs/40103002073) 8/8 及八份收据核验通过；M4–M6 的合并、源验收和记录内容为 3/3，记录自身的 PR/最终 main 集成结果由治理计划中的动态链接呈现。原 F8/历史证据及 R1–R4 的 0/4 保持。
>
> **最近更新：** 2026-10-24，Asia/Shanghai。

## 目标、范围和完成含义

F1–F5 修复计算、检测、兼容、身份记录和当前契约。F6–F7 增加明确隔离的离线对照与 bench 结论范围；这些是新接口，不作为既有缺陷修复的隐含副作用。F8 对已实施范围做整体验收。R1–R4 的本阶段产物是设计、分析或复现规范，后续代码工作需有对应实施方案；第三方是否实际运行不属于本地代码的可保证交付。

保持零运行时依赖、ESM/NodeNext、离线测试和现有配置写入保护。统计公式、显著性阈值、两臂排除规则、既有 policy 1/2 的阈值与哈希归一化均保持；F1 修复公式的数值实现，F2 改善新观测的识别准确性。新增字段、schema 和诊断的兼容方案见各阶段，不能用笼统的“保持所有输出不变”掩盖必要变更。

本计划不包含降低采用门槛、把五字段预算改成部分可选、把未知计数补零、自动安装/升级 Skill、真实付费校准、恢复已关闭研究的 live-call 预算或 npm 发布。当前 package 版本不因编写计划而改变。历史计划中的授权和完成记录不转移到本轮。

## 问题对应与已核实起点

编号 1–19 对应用户原始清单；20–21 是只读调查中新确认的问题。表中的“已处理”仅表示基线已有修复，不表示本计划实施过修复。

| 问题 | 当前判断与约束 | 对应任务 |
| --- | --- | --- |
| 1 Claude trigger 不可达 | matrix 缺少 streamJson；已有 content-block 解析测试，不能据此声称完整入口可用 | F2、F5 |
| 2 spendingBudget 五字段 | 确实全必填；专门契约已写明，入口说明不一致 | F5；保持现行校验 |
| 3 严格 token 预算能力 | 当前 CLI 适配器中 Codex 具备所需读数；Kimi 缺缓存划分，Claude reader 缺 token 读数；API 实际覆盖取决于响应 | F2 能力核对、F5 能力表 |
| 4 servedModel 未记录 | plan 硬编码 unrecorded；API 未保留响应模型；不能用配置模型充当服务方报告模型 | F4 |
| 5 driver skill 旧版本 | 基线已统一到 0.13.1，并有发布文档一致性检查 | F5、F8 保留防回归；不重复整改 |
| 6 metrics 修正案堆叠 | 已确认竞争 Skill、trigger 分类等状态互相矛盾 | F5 |
| 7 完整 mock 对照入口 | 已有 runner/mock 测试，缺用户可运行、期望明确的完整演练 | F6 |
| 8 MDE 缺失 | 现有 bootstrap 半宽不是 MDE | R1 |
| 9 bench 无结论范围 | schema 1 无此字段；不能仅加类型而遗漏计划、报告、选择和管理命令 | F7 |
| 10 过程测量 | 已能检查回归测试等可见产物，尚无轨迹级测量 | F5 披露、R3 |
| 11 批量 harvester | 当前为单 commit 导入；文件/体积/来源保护不是待删除缺陷 | R2 |
| 12 饱和任务 | 当前为 WARN，未直接淘汰；efficiency policy 可使用质量持平任务 | F5、F7 |
| 13 Node 26 | loader 使用 Node 26 已移除的 transform；新解析器可 strip，22.13/22.14 需能力探测后兼容 transform；不引入转译依赖 | F3 |
| 14 归档与包体积 | 基线已有固定来源恢复、哈希、包清单和大小上限 | F3、F8 验证；不重做分发 |
| 15 调用成本 | 8×5 是现行采用规模下限，不是所有 within-bench verdict 的硬门槛 | F5、R1 |
| 16 任务稀缺/转移 | 共享 OSS 任务存在；区分度取决于模型和环境，不能宣称完全不可转移 | R1、R2 |
| 17 sampling | 现有适配器未发送控制参数；withSampling 会保留已有值，不能把随机性认定为无效的已证根因 | F5、R1 |
| 18 外部独立复现 | 仓库内未找到明确第三方 live reproduction；作者独立任务集、异地安装与第三方运行须分开 | R4 |
| 19 README 的预期 | 单臂 trigger、质量判定、效率采用和一般化范围需要分开说明 | F5 |
| 20 McNemar 数值下溢 | 600/600、601/599 被现有实现算成 p=0，后者可造成错误 effective | F1 |
| 21 trigger 子串误报 | 目标 review 会误认 review-extra，也会误认其他 Skill 参数中的 review | F2 |

关键实现依据：[统计计算](../../src/harness/stats.ts)、[报告复算](../../src/harness/eval-manifest.ts)、[CLI 适配器](../../src/harness/executors/cli.ts)、[能力矩阵](../../src/matrix/agents.json)、[模型计划记录](../../src/harness/experiment-session.ts)、[mock](../../src/harness/executors/mock.ts)、[bench loader](../../src/harness/bench.ts)、[采用规则](../../src/harness/eval-acceptance.ts)。公开契约以 [metrics](../metrics.md)、[预算与评测组件](../eval-component.md)、[Agent preflight](../eval-agent-preflight.md)、[成本口径](../eval-costs.md) 为对照。

## 执行顺序与唯一进度清单

实施授权到位后，建议顺序为 **F1 → F2 → F3 → F4 → F5 首次同步 → F6 → F7 → F5 最终同步 → F8**。这是便于审查的串行交付顺序；硬依赖见下表。F5 首次同步只纠正当前事实，不能因此整项勾选；F6/F7 不依赖 F5 整项完成，最终同步也不反过来阻塞它们。R 项不阻塞纯缺陷修复，不能因后续研究延长而把 F1–F5 绑定为不可交付的大改动。

每项仅在改动及该项验收均完成后勾选；部分完成写明剩余项。此处是唯一勾选清单，后文验收表和记录不另建重复进度。

### 计划准备

- [x] P1 核对原始 19 项、两个新缺陷、仓库规则、现有计划格式和保护边界。
- [x] P2 保存详细计划，完成依赖、接口、兼容、问题覆盖和验收条件的自审并修正发现。
- [x] P3 检查本计划链接/锚点、事实、Markdown 和 diff，记录实际检查及未执行项。

### 实施阶段

- [x] F1 修复统计数值实现及受影响旧报告的诊断，保持冻结公式。（2026-10-21 完成；63/63 相关测试、913/913 全量测试及 1,200 对离线链路验证通过）
- [x] F2 修复 trigger 身份识别与可观测性，验证后接通 Claude Code 入口。（2026-10-21 完成；117/117 相关测试、934/934 全量测试、skillfit CLI dry-run 入口及冻结包 reproduce 入口通过离线验收）
- [x] F3 修复活动 LRU loader，补 Node 兼容检查和 CI 证据标识。（2026-10-23 远端验收完成；[CI 39906699174](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 8 jobs 通过；原本地、最低能力诊断及冻结历史结果保持，完整计数与 Windows 原有 skip 见补记）
- [x] F4 贯通逐调用模型身份、覆盖情况、报告与 portable replay。（2026-10-22 本地完成；198/198 相关测试、950/950 全量测试，Node 22.13/26 专项各 12/12；无真实模型调用）
- [x] F5 整理当前契约、能力表与双语入口，最终同步 F6/F7 接口。（2026-10-23 整项完成；此前内容同步及 review 已交付，F3 远端条件由 [CI 39906699174](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 实际满足；未推定真实 CLI/模型认证）
- [x] F6 增加明确预期的离线完整对照，保持 synthetic 隔离。（2026-10-22 本地完成；245/245 相关测试、1003/1003 全量测试，实际 npm 包内四类对照与迁移 replay 通过）
- [x] F7 增加版本化 bench 结论范围及按目标区分的诊断。（2026-10-22 本地完成；相关回归及最终范围专项 35/35、npm test 1041/1041；schema 1 兼容，schema 2 原生与 portable 声明冻结/拒答通过）
- [x] F8 对实际实施范围完成回归、独立包验证、最终 review 和交付说明。（2026-10-24；A4/A5/V1 最终输入 npm test 1079/1079；四个本地 Node 能力面分别验证；实际包/5 文档/30 回归/7 基础组/5 portable replay、19+1,583 恢复及原 18+1 历史验收通过；21 项覆盖均有归属，R1–R4 不追认为已实施；见 F8 记录）

### 后续设计任务

- [ ] R1 提交功效/MDE、预算分配与 sampling 能力的设计和离线验证结论。
- [ ] R2 提交批量采集漏斗、来源保护、成本边界及验证集独立性的设计。
- [ ] R3 提交一个确定性过程测量试点的事件契约、反例和可观测性边界。
- [ ] R4 提交第三方复现规范与最小复现包设计，明确外部运行依赖。

| 阶段 | 硬依赖 | 主要触达面 | 本阶段交付边界 |
| --- | --- | --- | --- |
| F1 | P2/P3 完成及实施授权 | stats、report/eval-manifest、组件错误、对应测试、metrics | 数值修复与明确旧记录诊断 |
| F2 | F1 的统计回归可用 | matrix/schema、agents 类型、CLI executor、trigger/report、preflight、测试 | 新检测协议与离线接通；无真实机器 attestation |
| F3 | 实施授权；不依赖 F2 | 活动 LRU loader/provenance/verifier、LRU/下限 tests、CI/ci-scope/发布消费者、scaffold 与活动准备示例的输出排空、Node 文档 | 当前 runtime 兼容；冻结历史副本不动 |
| F4 | F2 的结构化事件边界稳定 | ExecutorResult、API/CLI、runner/trigger/judge、解析/审计/export/schema | 新元数据完整贯通；不新增身份采用门槛 |
| F5 | 最终验收依赖 F1–F4、F6、F7 | metrics、指南、READMEs、driver skill、文档检查 | 当前契约与可见行为一致 |
| F6 | F1；需要 trigger 对照时依赖 F2 | CLI/bench 控制入口、控制清单、注入 executor、正常执行/审计/replay | paired 自检先交付；trigger 覆盖单列，不冒充真实发现能力 |
| F7 | F1/F2 确定语义；F6 对照接口稳定 | bench/schema、管理/导入、计划、preflight、报告和 replay | 新 schema opt-in；旧数据不追认新声明 |
| F8 | F1–F7 全部完成 | 离线测试、bench、文档、包与导出验收 | 不含发布和第三方 live 运行；仅授权子集时另记阶段验收，不将 F8 勾为完成 |
| R1/R2/R3/R4 | 各自以下定义；互不强制串行 | 独立设计记录与离线分析 | 设计完成不等于后续产品功能完成 |

## 接口与兼容方案总表

以下为已接受的实施方案。新增接口均未在调查基线中实现；当前完成状态以上方唯一清单为准，实际本地及远端结果在各阶段记录中保留。版本变化只作用于其所属对象，不把 bench schema、统计协议、观测协议和 policy 版本混为同一个版本。

| 对象 | 新方案 | 旧数据/调用方式 | 不允许的兼容捷径 |
| --- | --- | --- | --- |
| 统计计算与报告 | 函数签名及 manifest 4 保持，新增受控数值错误诊断 | 合法旧数值照常校验；旧错误单独诊断，原件/冻结解释保留 | 放宽容差、静默替换旧 verdict |
| trigger 观测 | 可选 triggerDetection 子版本 2 与逐次 evidence | 无字段显示 legacy，保留原 counts | 用新 parser 重新定义旧 fired 数或混合观测版本 |
| 模型身份 | 可选 modelIdentity 子版本 1，现有 descriptor 不变 | 缺失为 unrecorded；新字段贯穿解析与导出 | 配置值冒充 reported、响应后修改 plan |
| 请求/采用 policy | request 1、policy 1/2 及归一化哈希保持 | 原有门槛和解释保持 | 添加不被 parser 接受的 objective，暗加身份采用门槛 |
| Bench | loader 读 schema 1/2；schema 2 明确 opt-in | schema 1 维持原行为并披露未声明；不自动迁移 | 改旧 bench 或今天补声明后追认旧结果 |
| 结论范围 | 可选 measurementScope 子版本 1 | 历史缺字段为未记录 | 未冻结的声明参与历史采用判定 |
| 离线自检 | 新命令和独立 bench-self-test 结果版本 1 | 原 bench check/mock marker 行为保持 | 把 synthetic 结果包装成真实 efficacy/adoption |
| 固定历史资产 | 原字节、路径和 recipe 环境保持 | 继续使用冻结 runtime/明确 Node 环境 | 更新历史 catalog 哈希来掩盖文件改动 |

新 reader 对出现但不支持的子对象版本明确报 unsupported，不把它当字段缺失或 legacy；旧 reader 可能忽略附加字段，不因此获得验证这些新字段的资格。F6 当前可用下限标为“实现 bench-self-test protocol 1 的源码构建”，已在实际本地 npm 包中验证；正式发布版本由后续发布流程指定，不能把未发布源码追认到 npm 0.13.1。F7 交付时同样明确可用性。

## F1：统计数值与历史读取

修正 `mcnemarExactP` 从 `0.5 ** n` 起步导致的下溢，采用稳定的二项尾概率计算；不新增运行时依赖，不改两侧检验公式、0.05 阈值或最少六个 discordant pair 的语义。实现选择需有数值误差和适用规模说明，不能靠提高容差、钳制平衡样本 p 值或减少支持样本数掩盖问题。

接口保持 `mcnemarExactP(improved, regressed): number` 和现有 verdict 枚举。正常 v4 manifest 和组件 schema 不因本修复整体升级。计算正确且极小的 p 仍可因浮点表示下溢为零；检测旧缺陷依据重算差异或 verdict 差异，不能把所有大样本 p=0 一概当作损坏。

兼容分三类：未受影响的旧记录按既有容差和规则读取；新记录只接受稳定算法结果；旧数值错误记录保留文件和冻结 runtime，当前读者给出专门的 `RECORDED_STATISTICS_NUMERIC_ERROR` 诊断，不静默重写旧 p/verdict、不授权采用。JSON 沿用现有 eval-error 外形，错误详情区分 recorded/computed 值；如同时展示成本，只使用可独立核验的原始 receipts。现有 portable 包仍按其冻结实现复现历史解释，新更正报告另存并链接原件。

**验收：** 6/0→0.03125，600/600→1，601/599→约 0.9769718547313974；覆盖下溢边界前后、对称性、范围、单侧 discordance 单调性及接近 0.05 的判定。参考值来自独立高精度/整数二项计算，不用新函数生成自己的 expected。通过正常 runner→manifest→report 验证近乎平衡结果不再 effective，合法记录仍可读，伪造统计仍被拒绝；旧错误样例有专门诊断，原文件哈希不变。重点复用 stats、report、runner、eval-report 与 eval-component 测试。

**实施结果（2026-10-21）：** 单方向 discordance 使用精确恒等式 `2^(1-n)`；其余 n≤1022 保留原递推，n>1022 从二项分布众数开始累加递减的相对权重，以对称性归一化，避免端点质量下溢。常量额外空间、最坏 O(n) 时间，输入及总数须为非负安全整数；没有运行时新依赖。独立 BigInt 二项参考覆盖奇偶、1022/1023 和 1074/1075 两个边界、20,000 对及 100,000 对的近平衡样例，断言绝对误差 <5e-13；要求值 601/599 误差 <5e-15。单侧极小尾概率使用独立闭式参考，覆盖 subnormal 和真正舍入到零；两项尾概率边界样例误差不超过一个最小 subnormal 单位。这些是实际覆盖规模和数值检查，不是任意安全整数规模的性能或任意精度保证。既有小样本断言未放宽，六对/0.05/CI/policy 未变。

专门诊断限定于 n≥1075、保存 p=0、保存 verdict 与旧零质量算法相符，且稳定重算 p 非零或 verdict 不同的模式；即使非零 p 低于通用 1e-9 比较容差，也不能把丢失值当作真正的零。普通矛盾继续走原错误，正确重算为零的极小 p 不被一概拒绝。`error.details.discordant` 为 improved/regressed，recorded/computed 各含 mcnemarP/verdict；JSON 仍为 eval-error 1，exit 2，acceptance=inconclusive、eligibleForUpgrade=false、automaticUpgrade=false；文本读取 exit 1。错误不附未经独立验证的成本报告。schema 仅在此错误码下约束新增 details，普通错误的扩展空间保留。文件字节不变检查通过，等价保证原文件哈希不变；未改写任何公开历史资产或冻结 runtime。详细结果见文末 F1 验收记录。

## F2：检测准确性与 Claude Code 可达性

先让矩阵的 `wireShape` 和 Skill 参数键驱动解析，解析结构化 arguments 的指定身份字段；仅接受冻结目标的完整允许身份，不搜索整个 JSON。`CliExecutorOptions` 增加可选 wireShape/triggerSkillKey，工厂从 streamJson.wireShape 和 sessions.skillKey 传入；直接构造的旧调用未提供时只从可识别事件判断格式，不能把任意 JSON 当作完整流。目录名/frontmatter 名及合法命名空间别名仅按已验证规则构建允许集合。未知格式、身份解析失败或缺失正事件且观测不完整时保留 unknown/error，不能把缺失证据算作未触发；已明确观察到的正事件可保留 true，执行错误仍按原规则排除。

Codex 继续是机械代理信号：识别指向目标 SKILL.md 的读命令观测，不声称证明完整加载或按 Skill 行事。仅出现路径的 echo、注释或搜索文本不能自动算作目标读取；不能可靠解释的 shell 表达式保持 unknown。正常终结且可完整观察的未触发事件才计入 false。超时/执行错误保持既有错误排除与成本保留。

新 trigger 记录增加可选 `triggerDetection`，子对象 `schemaVersion: 2`，含 wireShape、method（skill-tool-argument 或 skill-file-read-command）、identityMatch（exact-registered-identity）；各 trial、plan 和汇总的这些声明一致。逐次 `triggerEvidence` 另存 status（observed/not-observed/unknown）、complete、matchedIdentity 或 null，以及从 1 起算的原 transcript eventLines；实际观测不回填 plan。旧记录缺字段时显示 legacy detection，按原有已保存 counts 解释，不用新解析器重写历史 fired 数。更正需新日期化记录，禁止混池。检测规则变更是观测定义的更正，不是显著性公式变更。

随后补 Claude 的 streamJson 模板及官方文档链接，更新 matrix `verifiedAt`。由于工厂在普通模式也优先选择 streamJson，需一起验证 inject、installed、trigger、calibration 和 judge。正文解析、terminal error、usage 完整性分别判断；接通 stream 不自动宣称已获得 Claude token/cache reader。能力表仍由适配器实际实现决定，认证仍为 offline UNKNOWN，dry-run 不运行 CLI。官方依据为 [Claude headless](https://code.claude.com/docs/en/headless) 和 [CLI reference](https://code.claude.com/docs/en/cli-reference)，实施时复核版本差异。

**验收：** 目标 review 的精确调用为 true；review-extra、其他 skill 的 args 含 review 均不能误报；命名空间、转义路径、无关路径、无 Skill、损坏参数、截断和失败分别有确定预期。使用 Node-only 假子进程测试真实工厂选参及全链路计数，不调用真实 Agent；Codex/Kimi 现有正文、usage、超时和中断检查不回归。Claude dry-run 不再因缺 streamJson 被阻断，但测试不能伪造本机 CLI/认证通过。文档明确“离线适配验证”与“真实机器验证未执行”。

**实施细化与核对范围（2026-10-21；不改变以上验收）：** 声明中补充冻结的 `identities` 和 `skillPaths`，以便计划、executor、trial 和汇总核对同一允许集合；不是只记录“exact”标签却在执行时猜别名。Claude 根据 matrix 的 directory-and-frontmatter 能力登记完整目录名/合法完整 frontmatter 名，命名空间必须显式登记完整身份，禁止按冒号后缀放行。Codex 的项目相对路径来自 matrix，运行时只对当前 disposable workdir 下的目标路径识别 literal cat、sed -n 数字范围、Get-Content/type 及其支持的 shell 包装；echo/搜索不是正证据，复杂表达式、展开和不能可靠解释的命令保持 unknown。eventLines 是从 1 起算的正证据行，未见正证据时为空；complete 指全流可解释且正常结束，不能以子进程 exit 0 代替流终结校验。生产工厂固定 wireShape 后声明 v2；保留直接构造的旧调用按可识别事件推断格式，未声明固定 wireShape 的自定义/旧 executor 不被伪装成具有冻结 v2 契约。旧历史/自定义记录显示 legacy/unversioned，不追认新协议。相关文档与 schema 交付这些字段；验收记录须逐项列出身份、观测、矩阵、全链路、历史兼容、错误/成本保留和用户入口证据，未完成项不能用此细化说明豁免。

**实施结果与逐项验收（2026-10-21）：** 全部采用 Node-only 假子进程、注入 executor、临时 home/fixture/run，未运行真实 Agent CLI。检测子版本为 2，外层 trigger manifest 1 和单臂 report 1 保持。相对安装路径来自 matrix；已有内部显式 installDir 覆盖会冻结实际路径，路径不一致在执行前拒绝。Claude argv 为 `claude -p --output-format stream-json --verbose`，matrix verifiedAt 更新为 2026-10-21，并附官方 CLI 文档链接；没有增加 Claude token/cache reader，也没有把离线适配检查升级为真实 CLI/认证通过。

| F2 验收项 | 最终输入上的已执行证据 | 结果及解释边界 |
| --- | --- | --- |
| 指定字段、精确身份及别名 | [身份/观测回归](../../src/harness/trigger-detection.test.ts) 对 content-blocks、flat-tool-call 断言 review、JSON arguments、review-extra、其他 Skill 的 args 含 review、完整命名空间、显式允许别名及其他命名空间；[工厂链路](../../src/commands/eval-trigger-observation.test.ts) 将 Kimi 矩阵 key 改为 id、tool 改为 InvokeSkill 的隔离副本并验证真实工厂转发，结束后恢复 | 精确目标为 observed；前缀/其他字段/未登记命名空间为 not-observed；损坏或缺失身份为 unknown，不再搜索整个 JSON |
| 完整、未知、截断和失败 | 同一身份/观测回归及 [CLI adapter 回归](../../src/harness/executors/cli.test.ts) 检查任意 JSON、缺起始/终止证据、混合格式、损坏 arguments、截断、finish_reason=length、正事件后失败；完整 Claude/Codex 阴性要求 init/thread start 及正常终结，Kimi 要求最终无 tool_calls 的 Assistant 正文 | 缺失观测不变成 false；已见正事件可保留 true/complete=false；执行错误继续排除，不改变统计公式和 rate 分母规则 |
| Codex 读命令与路径 | 身份/观测回归检查 literal cat、sed -n、PowerShell Get-Content/Windows type、shell 包装、引号、空格/转义、物理 workdir alias、其他目录、同名前缀、echo/搜索/行内及整行注释、复杂表达式、~/%/父目录跳转；工厂链路验证默认路径及内部显式安装路径 | 只有注册目标路径的可解释读命令为正信号；不把 POSIX type 当文件读取，不靠 lexical normalize 消除展开/潜在 symlink 的歧义；仍只是读命令观测，不证明成功加载或 Skill 行为 |
| 计划→trial→summary→report | 工厂链路正常执行 8 个 Claude 控制任务，覆盖 exact、alias、prefix、other、negative、malformed、truncated、failed；核对 reviewed/native plan、executor、逐次 receipt、summary 的声明与 eventLines（含空行的原始第 3 行），正样本 fired=2/runs=2、负样本 fired=0/runs=3，另有 2 unknown 和 1 error | Markdown/JSON 读者显示 v2；failed 为最后一项以保留原有失败即停的 session 规则，状态 stopped 不冒称 completed；所有结果保持单臂，不授权升级 |
| 版本隔离与历史兼容 | 工厂链路对重新 sealed 的错误 receipt/receipt.executor 协议、缺协议、相反 boolean、越界 eventLines 检查 unverified 和禁止 export；对 summary v3 检查 Unsupported；历史/自定义无声明 summary 保留原 metrics 并显示 legacy/unversioned；[trigger 回归](../../src/harness/trigger.test.ts) 拒绝目标/label/path/竞争别名冲突且零调用 | 不混版本、不重判旧 fired、不修改历史原件；普通自定义旧 executor 继续走未版本化兼容，不冒充已冻结 v2 |
| 正文、usage、超时和中断 | 工厂链路实际运行 Claude inject、installed、calibration、judge 假进程；public terminal error 即使 exit 0 仍拒绝；Codex 假工厂保留 input/cache/output，CLI adapter 失败路径保留 10/4/2 partial counters 和原 transcript；全量覆盖既有 Kimi usage、超时、进程树和中断检查 | Claude 无 token/cache 值可读时保持 unknown；错误 receipts 和 spending 保留，采用阈值不变；没有把 stdout 接通当成计费或认证能力 |
| 用户入口与冻结包 | 工厂链路直接运行 `node dist/cli.js eval … --agent claude-code --mode trigger --dry-run --json`：planned、MATRIX_CAPABILITY=PASS、真实 CLI 缺失时 CLI_AVAILABLE=FAIL、认证 UNKNOWN、modelCalls/cliInvocations=0、不创建 run；export 后删去假 CLI 脚本，再通过当前 reader 及导出包自身 `node reproduce.mjs` 重放 | 新 v2 字段在实际用户入口/冻结运行时中可用；portable 回放 verified 且 modelCalls=0，summary 与导出前一致，native 原文件哈希不变；无真实 CLI 兼容/认证 attestation |
| 文档、格式和 scope | metrics、report/preflight 指南、新 detection schema、single-arm schema、matrix schema及双语 README 同步当前事实；活动文档加本计划共 46 文件链接/锚点零错误，80 runtime 模块零依赖违规；新/改 schema JSON 与本地引用检查通过，diff 无空白错误 | 没有引入依赖、变更 package 版本或改历史 evidence/archive/release/bench 字节；schema 语法/引用检查不等于引入完整 JSON Schema 验证器；F3–F8 仍待实施 |

## F3：Node 与冻结历史环境

活动 `benches/contrib/oss-lru-cache/` 的 loader 优先改用 strip，并同步活动 provenance 中的适配说明；上游源码及许可证字节不改。检查前后臂和三个 fixture 的入口，不能只修 fetch-lifecycle 的单个调用点。避免低版本在导入未提供的 named export 时先崩溃，使不依赖 TS 的路径仍可用；TS 路径缺少能力时给出明确 Node ≥22.13 要求。

保持 package `engines >=22`；将 CLI 核心下限和该 TS replay 的下限区分说明。现有三系统 Node 22 required job 身份保留，新增 Linux 22.13、22.14、24、26 的完整离线兼容 job，并增加 Node 22.0 核心帮助/只读路径与不支持 TS case 的明确诊断检查。如果核查发现核心也不支持声明下限，记录具体调用与失败，先修订兼容方案；不悄悄收紧 engines，也不跳过应通过的 case。新增 job/artifact 名同时区分 job、OS、Node，ci-scope 记录实际 Node 版本，检查消费者是否依赖旧命名。

冻结 evidence、archive catalog 的固定支持文件、历史 recipe 和 release 收据不改。历史执行验证维持其明确的 Node 24.21.0/POSIX 环境，不用 Node 26 兼容目标改写历史实现。依据 [Node TypeScript 支持](https://nodejs.org/api/typescript.html#typescript-features) 与 [stripTypeScriptTypes](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options)，实施时核对最低版本。

**兼容核查补正（2026-10-22，保留全部验收）：** 本机实测 Node 22.13.0 与 22.14.0 的旧解析器拒绝纯类型 namespace 的 strip（分别使用 ERR_INVALID_TYPESCRIPT_SYNTAX 与 ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX），Node 26.0.0 拒绝 transform。活动 loader 先以纯类型 namespace 探测 strip 能力；仅在旧解析器的特定不支持错误下使用其仍提供的 transform，不捕获任意源码错误后静默降级。Node 22.14 额外进入 CI，覆盖旧解析器错误码变化的回归；Node 24/26 继续 strip；CJS loader 路径不要求 TS API；完整 bench 门禁的可信 test reporter 也需要 Node ≥22.13，不能把 Node 22.0 的 loader 成功写成完整门禁成功。活动 verifier 保留 probe 的明确错误，使 CLI bench check 的 TS 失败证据含 Node ≥22.13 诊断。另追查 Node 22.13 全量测试揭示的 noisy verifier 尾部输出缺失，已定位为活动 scaffold 和 `docs/examples/prepare-native-diff-probe.mjs` 在大段输出后立即 process.exit 导致管道未排空；修正正常结束的退出方式，保持完整 JSON/facet 断言。这一补充只涉及活动生成器/准备示例，不改冻结 recipe。版本下限、门禁和冻结资产约束不变。

**实施接口补充（2026-10-22，验收不变）：** CI 收据保持 schemaVersion 1，新增 job、nodeTarget 与实际 nodeVersion；现有三系统 `test (OS)` job 身份不变。新增兼容 job 强制全量离线检查，Node 22.0 job 只执行明确列出的下限 smoke/能力拒绝检查，不能伪装成全量重放。新 artifact 名包含 attempt/job/OS/Node target；活动发布消费者根据精确名称选择本次 artifact，同时接受历史旧名，重复、缺失或过期产物拒绝；新格式收据必须是 test/Node 22 的完整结果，兼容/minimum 结果不能替代发布门禁。下载的官方 Node 运行时仅放临时目录、核对官方 SHA-256，不改默认运行时或依赖。远端多系统 CI 未执行时单列待验收。

**验收：** 各支持环境下原始缺陷仍按预期失败，完整 oracle 通过，空洞/无关回归测试、保护资产篡改、提前 exit 等反例继续被拒绝。低版本的预期能力拒绝有独立断言，不算成功重放。执行相关 bench check 与全量 npm test；区分新 CI 实际结果和本地未具备的 Node 环境。归档字节/支持文件哈希保持，原历史 recipe 在原环境通过，不以重写 catalog 消除失败。

### F3 本地交付及验收记录（2026-10-22）

活动改动冻结后，已顺序执行最终代码在 22.13.0、22.14.0、26.0.0、24.21.0 上的完整 `npm test`：每个版本均为 939/939，0 fail/skip/cancelled。运行时仅从 Node 官方下载到临时目录并按对应 SHASUMS256 校验。所有版本均在本机 macOS arm64 执行，设置对应运行时的 PATH，使 verifier 子进程也使用目标 Node；早期仅显式指定父进程 Node 的 bench 探针不计作多版本验收。

| 原验收项 | 本地证据与结果 | 边界 / 状态 |
| --- | --- | --- |
| 活动 loader 与两臂 | 根 loader 与三个 fixture loader 同步；先探测纯类型 namespace 的 strip，仅对两种已复现的 namespace 不支持错误启用旧 transform；CJS 不依赖缺失 TS export；前后两臂源码/许可证哈希校验沿用原回归 | 四份 loader 行为一致；上游源及许可证未改；Node 22.14 独立能力回归 3/3 |
| 原缺陷、oracle、反例 | 相关回归 37/37 已在 Node 22.13 执行，覆盖原缺陷、完整 oracle、空洞/无关回归、保护资产篡改和提前 exit；保留所有原断言 | 最终四版本完整套件均 939/939，均含上述门禁；四版本 CLI bench check 均 passed（11 PASS / 3 WARN / 3 INFO / 0 FAIL）；既有 3 WARN 是 facets 数、fixture 大小与缺 trigger-negative；不以能力拒绝计成功重放 |
| CLI 核心下限 / TS 拒绝 | Node 22.0.0 独立回归 3/3：真实 built CLI help、保存 synthetic report、四 loader 的 CJS 两臂，以及 loadCache 和 CLI bench check 的 Node ≥22.13 明确诊断；`ci-scope minimum → record` 实际收据 scope=minimum、nodeVersion=v22.0.0 | 核心 engines >=22 不变；完整 bench 门禁的 reporter 与 TS case 需要 >=22.13；没有把整个 Node 22.0 bench check 记为通过 |
| 旧 Node 大段输出 | 活动 bench scaffold 正常结束使用 exitCode，活动准备示例先等待 stdout 排空；既有 noisy verifier 仍验证完整 4 facets，准备示例仍解析完整 JSON 并验证 dry-run 零写入、输入复制和冲突保护 | Node 22.13 初轮 935/939 的四个失败均保留日志；原因是 namespace 两处与提前退出丢输出两处；没有缩小断言或跳过 case |
| CI / 收据 / 消费者 | 现有三系统 test job 身份保留；新增 Linux 22.13/22.14/24/26 全量兼容和 22.0 minimum；记录 job/OS/target/实际 Node；实际临时 Git diff 验证 records 变更在兼容任务仍强制 full；新旧 artifact 的完整读取及缺失/过期/重复/跨 attempt/缺 metadata/错误 job 或 Node 反例均覆盖 | 离线测试通过只证明本地实现；远端 GitHub Actions 的 Linux/Windows/三系统 required jobs 未运行，保持待验收；minimum/compat 不能替代发布门禁 |
| 冻结历史与分发 | 原 Node 24.21.0/POSIX 历史 recipe 验证全部 19 个归档，38 个过程日志；modelCalls=0、agentCliCalls=0；1,688 个 evidence/releases 文件逐一与修改前 SHA-256 对照一致 | catalog、固定支持文件、历史 loader/recipe、release 收据均不改；无依赖/版本/engines 变更；不恢复或覆盖任何发布资产 |
| 文档 / review | LRU README/provenance 和 scripts 导航同步兼容边界；本计划先补兼容方案再实施；活动文档、计划与 LRU README 共 47 文件链接/锚点检查零错误，diff 无空白错误 | 最终 diff review 未发现剩余本地阻断项；80 runtime 模块架构检查零违规；尚无远端 CI attestation |

本地日志位于 `/private/tmp/skillfit-f3-*`，最终逐版本收据为 `/private/tmp/skillfit-f3-final-results.json`；这些是开发验证记录，不是新的发布证据。当前 F3 保持未勾选，F1–F8 进度仍为 2/8，仅等待远端 CI 验收；F4–F8 未实施。

### F3/F5 远端验收补记（2026-10-23）

以上 F3 本地交付记录保留其当时状态。追加授权后，[PR #53](https://github.com/remote-controlled-man/skillfit/pull/53) 的源提交 `5078262b37c2c5c5ffde2cb88aff09e3bf0b891d` 通过 [CI 39906699174 / attempt 1](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 全部 8 jobs。收据共同记录被测 PR merge `a822bc0ce72c4a81da6ac4c63773f468d90c5248`，与源 head 区分；这是 PR 验证，不冒充 main push 的发布门禁。

| Job / OS / target | 实际 Node | scope | pass/tests | skipped |
| --- | --- | --- | --- | --- |
| node-compat / ubuntu-latest / target 22.13.0 | v22.13.0 | full | 1063/1063 | 0 |
| node-compat / ubuntu-latest / target 22.14.0 | v22.14.0 | full | 1063/1063 | 0 |
| node-compat / ubuntu-latest / target 24 | v24.21.0 | full | 1063/1063 | 0 |
| node-compat / ubuntu-latest / target 26 | v26.12.1 | full | 1063/1063 | 0 |
| node-minimum / ubuntu-latest / target 22.0.0 | v22.0.0 | minimum | 3/3 | 0 |
| test / macos-latest / target 22 | v22.23.3 | full | 1063/1063 | 0 |
| test / ubuntu-latest / target 22 | v22.23.3 | full | 1063/1063 | 0 |
| test / windows-latest / target 22 | v22.23.4 | full | 1059/1060 | 1 |

八份实际收据全部为 passed、0 fail、0 cancelled；Windows 唯一 skip 是原有的 POSIX escaped-descendant pipe 测试，不计为通过；Windows 的 IPC 两信号、进程树及新路径检查实际执行。Minimum 的 3/3 只证明所列核心/能力拒绝，不算全量 TS replay。两个先前失败运行、根因、修复及包/历史兼容结果在[治理计划 C4](2026-10-22-documentation-governance-and-architecture.md#本次-review-与提交交付2026-10-23)保存，没有重写旧结果或放宽断言。

F3 的剩余远端条件现已满足；F1/F2/F4/F6/F7、F5 的内容同步/review 与相应验收均已记录，故 F5 整项完成。F8 尚需其原定逐项交付覆盖收尾，继续未勾选；R1–R4 及真实第三方/模型运行没有因此完成。后续仅同步这两份活动计划，最终记录提交的检查由 [PR checks](https://github.com/remote-controlled-man/skillfit/pull/53/checks)直接显示；不为记录自己的提交再次生成递归收据。完整下载收据暂存 `/private/tmp/skillfit-delivery-ci-final-source/`，本节保存长期版本、scope、计数和远端身份。

## F4：逐调用模型身份

在现有 `ExecutorResult` 增加可选 `modelIdentity`，新子对象版本为 1：

| 字段 | 定义 |
| --- | --- |
| `configured` | 已有允许配置面提供的模型名或 null；不新增私有配置/凭据扫描 |
| `requested` | 此次调用明确发送的模型标识或 null；CLI 默认配置不能冒充显式参数 |
| `reportedModels` | 去重的 `{ id, source, location }` 数组；source 为 api-response-model 或 cli-public-event，location 是原响应/事件的字段位置 |
| `status` | reported 或 unrecorded；reported 仅表示至少一个公开标识，不保证列尽内部路由/子模型，也不证明供应方后端身份 |

**实施接口补充（2026-10-22，保留原验收）：** executor descriptor 可选 `modelIntent` v1 固定 configured/requested；逐调用 `modelIdentity` v1 保留响应证据，不能反写 intent。API location 使用 `/model`；CLI 使用 `jsonl:<原始1起始行号>:/message/model`，仅接受 matrix 声明的 Claude assistant message model，其他尚无已确认公开响应字段的 CLI 保持 unrecorded；不把 init 的配置名当作响应身份。独立 `modelIdentities` v1 汇总按 primary/judge/drafter 分角色，包含 invoked/reported/unrecorded、模型集合及每个相对 receipt 路径和原身份来源；guard 拒绝不进入分母，历史缺字段整体显示未记录。审计从 sealed transcript 或 judge rawOutput 重算身份，校验 intent、汇总与调用收据；原 preview/plan/descriptor 不随响应变动。drafting 在实际执行准备后保存 matrix 版本探针结果，dry-run 不启动 CLI。drafting 沿用既有 authoring record kind：身份写入可由共享 parser 校验的 `_result.json`/`_summary.json`，当前 authoring 文档已明确 report eval/export/replay 面向 evaluation records；F4 不增加将 draft 当 evaluation 的入口。已有 paired/trigger/calibration 的当前与 portable 读者均贯通身份。新增字段沿用外层可选扩展，不改变 policy/统计/预算解释。

无公开身份时数组为空、status 为 unrecorded，不能从文本自述、日期或 requested 值补出 reported。多次调用出现不同标识时汇总保留集合和各调用来源。按 primary/judge/drafter 分开汇总实际 invoked 次数、已报告身份次数和未知次数；未 dispatch 的条目不进入分母。统计覆盖与 token final/partial 覆盖相互独立。

`describe().model`、冻结 preview 和 `_plan.json` 的现有字段不在响应后改变；配置/请求意图在计划中，reported 身份在调用结果和 receipts 中。旧 servedModel 字段不被事后回填。新数据贯穿 runner、trigger、calibration、judge、drafting、失败/中断、report parser、审计、schema、Markdown/JSON、export 和迁移后 replay。报告不能只保存 raw 字段而在解析时丢失；所有新身份声明须与原响应/事件证据及文件完整性绑定。API 成功路径目前不返回 rawOutput，需与失败路径一样保留响应正文，CLI 保留相应原事件，并校验 location 能解析出记录的 id；旧记录没有这些证据时继续 unrecorded，不扫描今天的环境补全。不保存 Authorization 等请求头或凭据，响应正文分享仍遵循既有导出审查。

版本策略为现有外层 schema 的可选附加字段及版本化子对象；缺失仍是历史 unrecorded，不导致旧文件无法读取。新增身份完整性检查只核对新字段的来源和一致性，不把未知身份变成 policy 1/2 的新采用门槛。若将来要求身份完整才能采用，另开 policy 版本，不能改历史解释。CLI versionArgv 仅由 matrix 声明，正式执行准备时记录；offline preview 不启动 CLI，测试注入版本读数。

**验收：** 请求名与响应名不同、多模型、身份缺失、失败后有响应、响应损坏、部分输出和 judge/drafter 的来源均保留；畸形新字段或篡改的来源被拒绝。legacy 缺字段可读；plan/executor descriptor 哈希不因响应变化；导出移动并移走原目录后身份与覆盖保持一致。身份披露不改变质量 verdict、成本总数、policy hash 或自动升级状态。

### F4 实施结果与逐项验收（2026-10-22）

实现与原外层格式兼容：`ExecutorResult.modelIdentity` 和 descriptor 的 `modelIntent` 都是可选 v1 子对象，历史缺失保持未记录。调用响应只写收据/汇总，不回填既有 `servedModel`、preview、plan 或 descriptor。CLI 的 argv 在实例化时复制，API intent 由实际发送的 model 固定，响应不会修改它们。新 native plan 使用 modelIdentityProtocol=1，实际调用必须保留身份对象（允许明确 unrecorded）；没有调用的 setup/guard 拒绝不被要求提供调用身份、不进入覆盖分母。

| 原验收项 | 执行证据 | 结论 / 限制 |
| --- | --- | --- |
| API 请求名/响应名、缺失/失败/部分响应 | [identity 回归](../../src/harness/model-identity.test.ts) 验证请求别名与 `/model` 不同、未知/损坏/非字符串 model、HTTP 500 的响应与 counters 保留、body 中途断开保留 bytes 而不猜 ID；成功路径同样保留响应正文；只保存 body、不保存请求头/API credential | 公开响应标识和 intent 分开；完整 JSON/事件以前的截断字节不能建立 model；usage final/partial/unknown 规则不被身份覆盖替代 |
| CLI 多模型、起始配置与模型缺失 | matrix 声明 Claude assistant 模型字段；从原始行 `jsonl:N:/message/model` 提取，保留空行索引、多模型和完整事件后出现的截断/terminal failure/timeout；init 配置和正文自述不计 reported；Codex/Kimi 无已确认响应字段时仍 unrecorded；[session 回归](../../src/harness/experiment-session.test.ts) 验证配置别名只进入 configured、无 secret、冻结计划/descriptor 原字节保持 | 实现依照公开 CLI/SDK 形状及离线替身验证，未运行真实供应方模型/CLI attestation；public ID 不证明 backend 或全部内部模型 |
| primary / judge / calibration / trigger / drafter | runner、judge、trigger、calibration 与 drafting 的成功、失败收据及 machine summary 贯通 modelIdentity/modelIdentities；[正常工厂链路](../../src/commands/eval-trigger-observation.test.ts) 真实执行 fake Claude，trigger 8 次调用均保留 model，inject/installed 两臂、calibration 及 judge 均核对覆盖；[draft 回归](../../src/commands/bench-draft.test.ts) 验证 drafter 来源、相对路径、成本与 matrix versionProbe 一次，dry-run 原有零调用断言保留 | drafting 沿用既有 authoring machine record 与共享 identity parser；不扩展 eval report/export 的 kind；versionProbe 只在实际 CLI 准备阶段，测试注入版本值 |
| 严格读者与证据绑定 | [native/portable 回归](../../src/commands/eval-model-identity.test.ts) 重新 sealed 后改变 model ID、location、requested 或删除实际调用身份，native evidence 仍拒绝且禁止 export；错误覆盖/未知版本/非法来源/重复 receipt/越界路径由 parser 拒绝；primary/judge 从 sealed transcript/rawOutput 重算、汇总与 ledger/receipts 对照 | 未知身份本身不拒绝 policy；新声明不一致/缺失是证据完整性问题。坏 ledger 不建立完整身份覆盖，missing/invalid receipts 不能制造正模型观察；已知成本保留规则不变 |
| portable export / relocation | 正常 API primary 的 served-a/served-b 与独立 judge served-judge 经当前 reader、移动 portable 目录/移走原 run 后的 replay，以及导出包自己的 reproduce.mjs 保持一致；native 文件哈希不变；Claude trigger 包删除 fake CLI 后仍可重放；calibration 包隐藏 fake CLI 后仍保留已知身份和覆盖 | 冻结运行时、相对 receipt 路径与原响应来源可迁移；replay 零模型调用、不读当前配置，不重判旧模型身份 |
| legacy / 冻结语义 | 缺新字段的 manifest 仍可解析，既有 synthetic example 的真实 CLI JSON/Markdown 入口通过且不推断 model、不授权采用，Markdown 明示 legacy/incomplete 未记录；保留原统计 verdict、costs、policy hash 归一化与自动升级状态；新增信息前后 overall 相同，API+judge 的 known input 仍为 26；停止的 primary/judge 来源仍可读、错误记录不能授权采用 | 不从现有环境、请求名或文本回填历史 servedModel；首次全量 948/949 的唯一失败是无调用 setup 被误要求身份，修正到实际调用后原测试通过，未改其预算/零调用断言 |
| 最终测试、文档、review | 最终相关 13 个文件 198/198；本机 Node 24.21.0 npm test 950/950，0 fail/skip/cancelled；Node 22.13.0、26.0.0 专项各 12/12（identity/native replay/核心下限）；47 文档链接/锚点零错误，36 本地 schema 引用可解析、JSON 语法有效，82 runtime 模块零依赖违规，diff 无空白错误 | schema 语法/引用检查不冒称完整外部 JSON Schema 验证器；原 1,688 个冻结文件 SHA-256 不变；F3 远端 CI 未执行，仍不勾选；没有新依赖、版本或 engines 变更 |

当前 `model-identity` 与 `model-identities` schema、metrics、evaluation reports 和 authoring records 文档已同步。最终本地日志：`/private/tmp/skillfit-f4-related-final.log`、`/private/tmp/skillfit-f4-npm-test-final.log`，兼容专项为 `/private/tmp/skillfit-f4-compat-{22.13,26}.log`。这些为本地开发验收记录，不是公开实测证据或真实服务兼容/认证证明。F4 按原验收完成，F3 保留远端 CI 待验收，整体 F1–F8 为 3/8；F5–F8 未开始。

## F5：当前契约与入口说明

### 首次同步边界与锚点迁移（2026-10-22，实施前记录）

本轮只同步已实现行为；不改统计、policy、matrix、公开输出或包版本，不添加 F6/F7 提案接口。能力表放在 Agent preflight 指南，README/driver/文档导航链接到同一来源。旧版 npm 0.13.1 的发布记录不追认 F1–F4 工作树新增能力；新增行为标记为当前源码、尚未发布。历史修订说明新增在 docs 下，不移动或改写 evidence、固定副本和 release records。

| 原 metrics 章节/锚点 | 首次同步后的入口 | 保留方式 |
| --- | --- | --- |
| 文件标题 `skillfit-metrics-v2-frozen-2026-09-23` | 当前契约开头 | 保留原标题；冻结的是 v2 统计规则，不代表新增能力已发布 |
| `unit-of-analysis`、L0–L4、`facet-scores-graded-outcome-signal` | 分析单位与测量层 | 保留原章节锚点；删去矛盾状态，操作修订移入历史说明 |
| `verdict-protocol-what-effective-means`、`numerical-integrity-correction-2026-10-21` | 判定及数值完整性 | 原锚点及公式保留 |
| `bench-composition-guidance-for-authors-and-the-upcoming-scaffolding-tooling` | 当前 Bench composition guidance | 显式旧锚点别名；不再称已存在的 scaffolding 为 upcoming |
| `workspace-configuration-experiments`、`public-model-identity-per-invocation` | 交付与逐调用身份 | 原锚点保留；成本与 guard 归入单独当前章节 |
| `non-goals-v1` | 当前 Non-goals and known limitations | 显式旧锚点别名；披露无 MDE/过程测量等 |
| `explicit-efficiency-acceptance-policy-version-2-unreleased`、`explicit-efficiency-acceptance-policy-version-2-since-090` | 显式 efficiency policy 2 | 两个旧锚点均保留，阈值、算法和历史解释不变 |

逐条检查冻结公式、配对排除、成本分母、8×5 与独立验证、预算全字段、sampling、trigger、模型声明及 unknown；双语 badges/代码块/demo 原字节保持。首次同步通过不勾选 F5，最终同步仍等待 F6/F7 和 F3 远端验收。

将 metrics 的当前规范按分析单位、测量层、判定、成本/预算、证据与已知限制组织；修订历史移入独立历史说明，保留旧文件入口与显式锚点。先列旧章节/锚点到新位置的对应表，防止“整理”时遗漏冻结条件。当前规范保留 why、公式和必要理由，历史追加过程不再压在入口之前。公开历史报告、固定 replay 和 release records 不随之改写。

双语 README 按章节对应，badges、代码块和原 demo console 保持要求的逐字一致；新示例另设并标来源、日期与范围。单臂 trigger 只能解释发现/触发观测，不能据此声称 paired 改善或“安装前后”因果比较。质量无显著收益不等于证明无效，质量持平不等于等价；efficiency policy 是无已观察回归等条件下的成本采用判断。成本主终点是 all-invocation uncached-input per success，不等同美元账单或显著延迟收益。

入口能力表至少列 agent/mode、触发观测、token/cache reader、严格 spendingBudget 可用性、CLI/模型身份、验证层级；以实现为源核对，避免独立维护第二套 agent 常量。明确 spendingBudget 整体可选、一旦提供五字段全必填，达到线阻止下一次调用、单个在途调用可超线；未知/部分计数停机。说明 8×5 的采用规模、within-bench verdict、独立验证及 sampling 限制。保留现有 0.13.1 命令版本检查，正式新版本由后续发布任务统一处理。

**验收：** 原始问题 1–6/10/12/15/17/19 均有直接可达的当前说明；实现与规范逐条对照，无“同时已实现/未实现”；旧锚点和双语对应检查通过。新写的可执行示例用离线替身验证；未实现的提案命令只出现在本计划等明确标识处。F6/F7 验收后再完成本项最终同步。

### 首次同步交付与 review（2026-10-22）

| 验收面 / 原始问题 | 已交付结果与实际证据 | 边界 / 剩余项 |
| --- | --- | --- |
| 当前契约与修订史（6） | [metrics](../metrics.md) 入口改为当前契约及目录，按分析单位、L0–L4、判定/policy、成本/停止、证据/身份、限制组织；旧追加说明及设计理由保存在 [修订史](../metrics-history.md)。v2 公式、排除规则和 policy 2 算法/阈值保留；源实现的 2,000 次/seed 20260919 与独立 10,000 次/seed 20261013 明确区分 | 不改历史报告、原 replay/runtime 或 release records，不将源代码未发布行为追认到 npm 0.13.1 |
| 能力与身份（1/3/4） | [统一能力表](../eval-agent-preflight.md#current-source-capability-table) 对照 matrix、preflight、API/CLI 与 identity reader：模式、精确 trigger 观测、token/cache、严格预算、CLI/模型身份和验证层级齐备；双语 README、driver、first-run 与文档导航直接链接 | Codex 是当前唯一具备完整预算读数的 CLI reader；API 离线 UNKNOWN，Kimi 缺 cache、Claude 无 token reader；Claude 入口仅离线验收，reported ID 不是 backend attestation，judge 无独立 CLI 版本探测 |
| 预算与版本入口（2/5） | READMEs、driver、planning/cost/drafting/first-run 均明确对象整体可选但一旦提供五字段全必填、在途超线、未知/部分最终用量停止；现有 0.13.1 命令 pins 保留，5 个 release-document 入口一致性通过 | 未改预算校验/CLI、包版本或依赖；不把缺计数补零，不提供 duration-only 捷径 |
| 判定与研究边界（10/12/15/17/19） | 双语入口分开质量、效率和单臂 trigger；移除由 installed 单臂 PASS 推断无 Skill 基线的解读，保留原 demo；补齐 8×5 是规模/采用下限而非普遍 verdict 起点或功效保证、无 MDE、sampling 未固定、产物不证明过程、0pp 不排除未测过程、饱和任务仍可能支持成本比较及缺独立第三方 live reproduction | efficiency 主终点仍为所有调用 uncached input / 成功任务数，不等同美元或显著延迟收益；保留既有 code 的饱和 WARN，未提前实现 F7 诊断 |
| 旧锚点与双语兼容 | 修改前快照逐项比较：metrics 全部 16 旧锚点保留，README 中英各 22 旧锚点保留；旧 bench-composition、non-goals 和 unreleased efficiency 别名继续可达。两个 README 原 badges、全部 fenced code/demo 各自逐字不变；章节层级和中英代码块一致 | 未新增可执行命令示例；F6/F7 的提案接口只保留在明确标识的计划，不在当前入口冒充能力 |
| 检查与用户入口 | 最终文档/release-docs 相关测试 11/11；npm test 950/950，0 fail/skip/cancelled，Node 24.21.0；48 文档本地链接/锚点零错误，82 runtime 模块零依赖违规；两个 bundled bench 的实际 CLI check 均 exit 0、0 FAIL；旧 synthetic report 的真实 JSON 入口可读、身份缺失保持 absent、inconclusive/eligibleForUpgrade=false | CLI checks 只验证离线本地入口，无模型执行；旧 demo 是已记录历史运行，本轮未重跑它 |
| Driver / 冻结资产 / review | skill-creator quick_validate 通过；默认 Python 缺 PyYAML，仅在临时目录装载固定 PyYAML 6.0.2 执行原校验器，未更改项目依赖或用户 Python。原 1,688 冻结文件 SHA-256 全不变；diff 检查通过。逐条对照当前实现后修正普通 check 的 ORACLE WARN 与 live preflight UNKNOWN 区分、per-task 也有 exact verdict、judge 版本探测边界等歧义 | 文档整理未改统计/执行代码、matrix 或 schema；F3 远端 CI 未执行，F5 整项不勾选，F6/F7/F8/R1–R4 未开始 |

本轮首次同步完成，整体仍为 3/8（F1/F2/F4）。F5 **最终同步待办**：F6 交付后补入实际 self-test 命令/控制清单/合成隔离/portable 入口及最低可用 CLI 版本；F7 交付后补入实际 schema 2/claims/measurementScope/目标相关诊断及 legacy 说明，再对能力表、metrics、指南、双语 README、driver 和可执行示例完成最终逐项核对。它们完成前，本项保持未勾选。

本地检查日志：`/private/tmp/skillfit-f5-npm-test.log`、`/private/tmp/skillfit-f5-{code-review,debugging}-check.log`；修改前锚点/README 字节快照为 `/private/tmp/skillfit-f5-docs-before.json`。这些为本地开发验收，不是新的公开实测证据或远端 CI 结果。没有真实 Agent/model 调用、实际用户配置写入、commit、推送或发布。

### 最终内容同步边界（2026-10-22，实施前记录）

本轮按已交付 F6/F7 同步当前契约、能力表、指南、双语 README 和 driver；自检协议 1、显式 bench schema 2、measurementScope 1 仍标 current-source-only，不虚构最低已发布 npm 版本。保留所有旧路径/锚点、原 README 代码/演示/徽章和固定历史证据，新增示例只在隔离目录离线验证。D2 同轮完成权威映射、导航和去重收尾，验收见其独立计划。

本轮不改变 F5 原完成条件：源码内容同步可交付并解锁 D2 的语义依赖，但 F3 远端 CI 未验收时，F5 整项继续未勾选，不将“内容同步”冒充远端兼容性证明。F8 和其余研究/架构实施不自动启动。

### 最终内容同步交付与 review（2026-10-22）

F6/F7 源码内容同步完成；这只完成 F5 的内容工作，不豁免上文保留的 F3 远端验收条件。D2 的依赖是此语义同步，不是 F5 整项勾选；其收尾和独立进度见[治理计划](2026-10-22-documentation-governance-and-architecture.md#d2-最终收尾与-review-记录2026-10-22)。

| 原验收面 | 实际交付与验证 | 适用边界 |
| --- | --- | --- |
| F6/F7 当前契约 | 能力表增加跨适配器的 self-test/claims/保存范围导航；metrics 解释声明与离线对照的测量边界；request/result、planning、reports、replay 和管理指南各自承载接口用法，字段与目标规则仍由 bench-claims 唯一拥有 | self-test 1、bench schema 2 / measurementScope 1 仅当前源码；未分配最低已发布版本，npm 0.13.1 pins/发布记录不变；schema 1 未声明，新 metadata 不能补入历史 |
| 入口与 driver | 双语 README、入门、流程、自检与 driver 同步；修正入门“schema 2 pending”和 self-test“bench claims unsupported”两个过时陈述；明确 null 诊断目标、正负 trigger 标签、不支持目标先拒绝、policy override 不扩张结论、synthetic 不可采用 | 声明不是效度、功效或过程测量；严格预算与观测/身份/独立验证条件未放宽；三类 reader 的范围与当前/pinned replay 区分保留 |
| 可执行示例 | 新 claims 代码块 3 条命令在隔离临时 checkout 视图按原文执行；schema 2 check/edit 通过；driver/self-test 预览无输出目录，确认后四类对照均匹配，27 次模拟执行、harnessModelCalls=0；单 suite 导出移走原输入/run 后当前 replay 和 pinned reproduce 均验证且 eligibleForUpgrade=false | 只启动本地受信 verifier/oracle；无 Agent/API/judge/drafter 调用或真实配置写入。默认 Python 无 PyYAML，复用前阶段临时 PyYAML 环境执行原 skill-creator 校验器，未改项目依赖 |
| 测试与整合 review | 相关 docs/registry/release/CLI/claims/self-test 检查 94/94；npm test 1041/1041，0 fail/skip/cancelled，约 69 秒；最终文档/登记/发布/实际包复核 30/30；OpenCodeReview delegate 1.13.3 + Codex 一次整合 review 覆盖本轮 20/20 文件，19 Markdown 含默认过滤文件人工核对，153 项既有改动排除（清单 173 项，本轮 100%，工作区 11.6%） | 非独立第二 reviewer 或外部模型。定点复核修正诊断 scope 不要求目标但 schema 2 仍需合法 claims 的歧义，以及两处无关 JSON Unicode 转义；无剩余阻断项；F3 远端 CI 未运行 |
| 文档/历史保护 | 70 maintained / 128 registered / 53 topics，198 个旧锚点全保留、变更全部有影响映射；中英 README 各 15 个原代码块（含 demo）、4 条 badge 行及 22 标题原字节保留；六条读者路径通过；2,909 个公共文件中仅 19 Markdown + 1 登记 JSON 变化，其余 2,889 文件不变，无增删 | 原业务源码、脚本、schema、matrix、统计/policy、版本、依赖及 evidence/归档/catalog/固定 recipe 均不改；D2 导航/登记不是新功能或远端兼容性证据 |

本轮长期验收由上表、当前契约、D2 兼容映射和实际 diff 提供，不以临时日志为唯一依据。临时原始输出为 `/private/tmp/skillfit-f5d2-{related,npm-test,examples}.log`，范围/锚点/README/导航核对为 `/private/tmp/skillfit-f5d2-audit.json`。没有真实模型调用、项目提交、推送、远端 CI 或发布；F5 维持未勾选。

## F6：离线完整对照接口

### 实施前接口细化（2026-10-22）

首版复用 prepareEvalPlan/runEval、native audit 和现有 export/reproduce，不另写统计或 verifier 链路。self-test 固定注入 kind=mock 的专用 executor、judgeExecutor=null 和空的 session 环境，不解析 API key、探测 CLI 或读取真实用户配置。suite 中 agent 只选择 matrix 安装布局，不是调用授权。固定 workdir→task/arm/trial 映射同时覆盖 installed；动作由 controls 冻结，不能由提示词或 Skill 标记猜测。

为让错误对照保留真实停止前缀，增加仅供该 mock self-test 使用的内部 stopOnExecutionError：normal runner 写完首个 errored receipt 后抛出并由现有 session 封存，不创建其余队列的拒绝 receipt；普通 eval 默认流程不变。stopped suite 的 graded/passes/errors 仅统计已有 receipt 的实际状态，不补齐、配对或生成未运行任务的假观察，statisticalVerdict/p 均为 null。每个声明 task 仍在 self-test 比较表中，未到达者为零次 receipt。

controls 的 schema 与严格 reader 一起交付；所有路径按 bench 相对路径解析，拒绝 Git 元数据、父目录、绝对路径、符号链接和非普通文件；完整 bench 在 preview 先验证可封存。选定 suite 按文件顺序，任务按 bench 顺序；未选 suite 仍须语法/资源有效，不因选择而隐藏坏清单。新增资源只在活动 benches 下，旧 mock markers 不动。额外提供 code-review 固定答案副本和 controls，保留 summarize-s1 有害臂，按原 marker 输出以一轮 3 改善/1 退步得到 inconclusive。

外层 plan 固定 suite 顺序、每个共享 eval plan、controls/bench/implementation hash 和 stop-on-first-mismatch 策略。JSON 执行必须显式 run-group 与匹配 plan.sha256；text 支持匹配哈希或确认/--yes。decline 返回 planned 且不写；无清单返回 not-configured/exit 1；格式/参数错误返回独立 self-test error/非零。输出 collision 在任何 suite 运行前拒绝整个父目录。执行时的输入漂移仍由共享计划检查和 session guard 拒绝，不能重新冻结后追认。

不伪造 token 或供应方耗时：simulatedUsage 明示未提供 token/provider duration，localDurationMs 单独记录实际本地耗时，native 成本保留 unknown token 与本地 elapsed；harnessModelCalls=0 只保证 harness 不分派 Agent/API，不把本地受信任脚本当网络沙箱。F6 文档只说明已落地的新入口，F5 的最终双语/全指南同步仍留待 F7 后。

顶层无法保留完整结果的通用错误（例如落盘失败）不能猜测“实际模拟调用为 0”：该错误 envelope 的 simulatedExecutorInvocations/localDurationMs 为 null，已保留 suite receipts 仍是事实来源；正常预览、not-configured 和可封存执行继续给实际计数。schema 同步允许这个明确 unknown，不把本地 I/O 错误冒称零成本。

以下为已批准接口，本轮已在当前源码实现，尚未发布至 npm。采用独立子命令 `skillfit bench self-test <dir>`，不把普通 bench check 的所有 INFO 改成强制有效性门禁。复用 `--json`、`--dry-run`、`--runs-root`、`--run-group` 和既有预览确认方式；新增 `--controls <file>`、可重复 `--suite <id>`。文本确认/--yes 与 JSON plan-sha 规则沿用共享 eval 规划，dry-run 不执行 verifier/oracle/executor、不建输出目录。默认 controls 文件为 bench 根的 `controls.json`；路径必须在该 bench 内。

`controls.json` 版本为 1，含唯一 suite id、taskIds、trials、每个任务的 baseline/treatment 动作和 expected。动作只允许 output-file（bench 内固定答案）、oracle（已注册本地 oracle）、fixture（保持初始文件，返回非空合成说明）或 error（注入确定错误）。未知字段、重复 suite/task、越界路径、符号链接和缺失资源在创建 run 前拒绝。控制文件及引用资源进入计划与 bench 输入哈希；不写入源 bench，也不自动修改旧 mock marker。

suite 的 `mode` 只接受 inject/installed；installed 的 `agent` 是 matrix 中的安装布局标识，inject 时为 null。这里不启动该 Agent。trigger、rules/MCP target、judge 和 drafting 暂不在此新命令的支持面；冲突选项在预览阶段拒绝，不能回退到普通 live eval。专用合成 Skill 随包放在新增的 `benches/_self-test/target/SKILL.md`，仅用于可重复的注入/安装输入，不使用用户 Skill，不加入安装推荐；该小资源已加入包必需清单。每个 suite 使用新建的 `runs-root/run-group/suite-id` native 目录，汇总置于其上层，任一已有输出阻止整个新计划。只接受 controls 内已声明且模式匹配的任务，未列出的任务不混入该合成 cohort；报告显示完整 bench hash 和实际选择。

控制文件的具体字段示意如下；已实现的完整教学 bench 与执行方式见 [self-test 指南](../bench-self-test.md)，不能单独拿下面片段冒充完整 bench。output-file 动作另带 `path`，error 动作另带受控的 `code`；fixture/oracle 不接受额外动作参数。每任务的 `graded/passes/errors` 为预期统计数，p 范围使用包含下界/不包含上界。选择 suite 时保持文件顺序，trials 沿用现有 1–20 范围。

output-file 仅用于 output task，读取固定 UTF-8 答案作为 executor 输出；fixture/oracle 仅用于 command task，都返回非空合成说明避免被当作未参与。oracle 动作需有已注册 oracle，执行失败不能照常进入期望 pass。error 的首版 code 仅允许 SIMULATED_EXECUTOR_FAILURE，expected 可用 errorCode 核对该受控错误。动作与 verifierKind 不匹配在预览阶段拒绝，不用隐式转换猜测作者意图。

```json
{
  "schemaVersion": 1,
  "suites": [{
    "id": "known-benefit",
    "purpose": "benefit",
    "mode": "installed",
    "agent": "codex",
    "taskIds": ["example-task"],
    "trials": 6,
    "arms": {
      "example-task": {
        "baseline": { "kind": "fixture" },
        "treatment": { "kind": "oracle" }
      }
    },
    "expected": {
      "status": "completed",
      "statisticalVerdict": "effective",
      "mcnemarPRange": { "minInclusive": 0, "maxExclusive": 0.05 },
      "tasks": [{
        "taskId": "example-task",
        "baseline": { "graded": 6, "passes": 0, "errors": 0 },
        "treatment": { "graded": 6, "passes": 6, "errors": 0 }
      }]
    }
  }]
}
```

expected 明确 session 状态、统计 verdict 或 null、可选 p 值范围、每 task 的两臂 pass 数/错误数。purpose 允许 benefit、harm、null、error、custom，仅标识对照目的，不是由名称推导的硬编码真值；都按声明的实际 expected 检查。没有控制清单时 self-test 返回 not-configured 和退出码 1；清单或参数无效也非零，且不创建 run；普通 bench check 不因此从通过变失败。已有有效清单却不匹配时退出码 1，不能降级 INFO；所有选中 suite 匹配返回 0。预期注入 error 的 suite 如准确产生声明的 stopped/error 状态可通过自检，但其内部 eval 仍为 stopped，不能伪装完成；真实 SIGINT/SIGTERM 不算通过，保留既有信号退出语义。

stopped suite 的 statisticalVerdict 必须为 null，不声明 p 范围；已运行条目的预期只与保留 receipt 前缀比较，不生成完整队列的虚假 pass 数。有效计划如未匹配 expected，保留整次自检和各 native session 的原始失败，后续 suite 是否继续由预先冻结的 suite 顺序/停止策略决定；首版固定为遇到非预期错误或预期不匹配即停，不动态挑剩余 suite 取得整体通过。

使用专用 injected executor，以冻结计划的 workdir→task/arm 映射决定动作，不搜索提示词。output 和 command case 走正常 runner、verifier、receipt、manifest、审计与 replay；oracle 只在 disposable workspace 修改文件。installed 模式仅证明安装副本/哈希及执行链路，不能声称真实 Agent 发现 Skill。primary/judge/drafter 不允许回退到真实 CLI/API；不解析进程中的真实 API key，测试使用临时 home 和受控环境。异常、超时、取消、输出碰撞沿用现有保护。

结果使用独立 `kind: skillfit.bench-self-test`、schemaVersion 1，status 取 planned/passed/failed/not-configured/interrupted/error；含可用的 plan/input hash、suite 明细、simulatedExecutorInvocations、harnessModelCalls=0、synthetic=true 和 adoption 禁止原因。零调用字段专指 harness 不分派 Agent/API；verifier/oracle 仍是受信任的本地可执行代码，需保持离线，不声称为任意脚本提供网络隔离。合成 token/时间与实际本地执行时间分别命名，不能把估算数当真实供应方成本。内部 native manifest 的 mock/synthetic 属性保留；合成 effective 永不使 eligibleForUpgrade 为 true。

**验收：** 至少覆盖预期 effective 的正对照、ineffective 的有害对照、inconclusive 的零效果和 stopped 的错误对照，包含能使 p<0.05 的已知合成配对。现有 code-review 故意退步负例仍按其预期 inconclusive 通过演练，不删负例换绿色。验证控制缺失/错误、所有执行模式明确支持或拒绝、installed 臂识别、无模型回退、JSON 单结果、预览纯度、中断清理、输出碰撞、完整成本未知语义、合成证据无法采用，以及导出迁移后的复现。单臂 trigger 自检若未交付需显式标 unsupported，不能把 paired 自检宣称为全模式发现验证。

### 实施验收与最终 review（2026-10-22）

| 验收面 | 已执行结果 / 证据 | 边界与兼容 |
| --- | --- | --- |
| CLI / 严格控制契约 | [命令编排](../../src/commands/bench-self-test.ts)、[controls reader](../../src/harness/bench-controls.ts)、[专用 executor](../../src/harness/executors/control.ts) 已接入；controls/result 独立 schema v1；复用 reviewed eval plan/context、runner、verifier、native report/audit 和 portable export | 显式支持 inject/installed，matrix agent 仅选布局；trigger、rules/MCP、judge、drafting 及执行参数覆盖均在预览前拒绝，没有真实执行器回退 |
| 四类完整对照 | [教学 controls](../../benches/_self-test/example/controls.json)：6 对正向为 effective、p=0.03125；6 对有害为 ineffective、p=0.03125；1 对零效果为 inconclusive、p=1；错误对照实际仅 1 次、status=stopped、无 manifest/统计 verdict、无假 partner receipt。总计计划 28、实际 27 次模拟执行 | 外层 self-test passed 只表示吻合 expected；不把原生 stopped 伪装 completed，不扩大统计/功效结论 |
| 真实入口 / 无回退 / 安装臂 | Node CLI JSON 预览/匹配 hash 执行、missing/invalid 参数只输出一个 JSON；--yes 不绕过 JSON 哈希，缺 group/stale SHA 拒绝；三种 matrix 安装布局均用 mock 完成，primary 无 CLI version/config 读取；测试对 API/CLI factory/run/fetch 设拒绝替身并确认零调用 | 固定 workdir→task/arm/trial 决定动作，提示词故意含 treatment 标记也不改臂；installed baseline 无 target、treatment 全资源哈希相同，不声称真实发现 |
| 格式 / 路径 / 预览 / 漂移 / 碰撞 | 未知/非字符串枚举、字段/版本、重复 suite/task、缺/错资源、错误 agent/action/kind、缺 oracle、UTF-8 错误、路径越界/Git/符号链接/目录等均拒绝；未选 suite 的坏资源也不隐藏。预览不执行附标记的 verifier，不创建 runs；拒绝确认、确认期间输入漂移及任一已有父输出均不执行/覆盖 | task/suite 按冻结文件顺序选择，不用挑剩余项获取通过；默认普通 bench check 不增加控制门禁 |
| 停止 / 异常 / 未知成本 | 首个 errored receipt 后立即停止该原生 suite；错误、timeout 不代替已知 injected error；首个 mismatch/unexpected error 使后续 suite not-run。SIGINT/SIGTERM 活跃 verifier/后代被终止、heartbeat 停止，返回 130/143、self-test interrupted、原生 stopped 和 hashes 保留 | 不重试、不补样本。模拟 token/provider duration 为 null；native tokens unknown/比较抑制，localDurationMs 与本地 elapsed 单列；无法保留结果的通用错误计数为 null，不冒称零花费 |
| synthetic / portable / 历史负例 | 完成和 stopped suite 经正常 export、迁移、移除原 bench/run 后，当前 reader 与导出包自己的 reproduce 均保留原统计/未知成本/eligibleForUpgrade=false，原生 mock/injected 不丢失；code-review 保留 summarize-s1 退步，3 improved/1 regressed、p=0.625、inconclusive，按预期 passed | 5 个原 marker 字节不变，10 份固定答案与原 output 字节相同；活动 bench 因加 controls 改变完整 hash，历史必须使用原 sealed inputs，未重写旧结果 |
| 实际 npm 包 | requiredFiles 增加专用 target、控制清单、三个 runtime 模块、指南/schema；现有实际 offline pack/extract 测试从解出的 CLI 跑完四类对照，27 次模拟调用、0 harness model calls、无采用资格；仍通过原 4 MiB/19 MiB 上限、六个历史 recipe tests、19 archive/1,583 support 的检查 | package/version/engines/运行依赖均未改变；未发布的新功能只标 source build / protocol 1，不冒称已在 npm 0.13.1 发布 |
| 最终测试 / 文档 / review | Node 24.21.0 最终相关 11 个文件 245/245；npm test 1003/1003，0 fail/skip/cancelled；教学/code-review CLI bench check 分别 10/27 PASS、0 WARN/FAIL；49 文档链接/锚点零错误，85 runtime 模块零依赖违规。JSON Schema 2020-12 原校验器验证两套控制和实际 planned/passed/failed/error 输出 6 个正例，并拒绝 6 个错误/不安全反例；原 1,688 冻结文件 SHA-256 未变 | 独立 schema 校验器仅装在临时目录，不是项目依赖；旧 metrics 16 锚点、README 中英各 22 锚点/原代码块保留；review 修正上下文 hash、枚举类型 coercion、空 plan-sha 及未知错误计数，没有更改冻结公式或弱化原测试 |

本地最终日志：`/private/tmp/skillfit-f6-related-final.log`、`/private/tmp/skillfit-f6-npm-test-final.log`、`/private/tmp/skillfit-f6-schema-validation.log`、`/private/tmp/skillfit-f6-{example-bench,code-review}-check.log`。第一次 smoke 因执行端遗漏 self-test context 正确阻断、0 模拟调用，补齐共享 context 后四类对照通过；初次新测试唯一失败是把 costChanges 的对象形状误写为 null，改为验证 exact=false/变化抑制/knownLowerBound 这些实际契约；随后 review 再补类型和空哈希边界，以上均为最终代码结果，没有删断言或跳过测试。额外文本格式探针最初将 8 份原本无末尾换行的固定答案误报为 EOF 错误；答案按原 marker 字节核对，源码/文档按文本格式核对，未为格式统一而修改答案字节。

F6 按本阶段验收完成，F1–F8 为 4/8（F1/F2/F4/F6）。F3 远端 Linux/Windows/required CI 未执行，仍待验收；F5 最终同步继续待办；本轮未开始 F7/F8/R1–R4。没有真实模型调用、实际用户配置修改、commit、推送或发布。

## F7：bench 结论范围与目标相关诊断

采用显式 opt-in 的 bench schema 2；loader 同时读 1/2，schema 1 的行为保持。schema 2 每个 task 必须提供非空、去重的 `claims` 数组，允许 quality、efficiency、activation；暂不接受 process。声明仅表示设计支持面，不能取代 NOP/oracle、对照、覆盖、样本量和独立验证门槛。旧 task 无 claims 时是 legacy-unrecorded，不能从文件名、trigger 标签或历史好结果推断声明。

quality 仅指这些 fixture/prompt 和确定性 verifier/check 所定义的结果，不是“所有安全/性能/设计质量”或流程改善的统称。首版不增加可任意授予证明力的领域标签；报告继续展示实际任务、命名 checks 和适用环境。需要更细的领域结论时先定义对应观测与验收，不能用 claims 声明代替。

请求目标派生规则固定：trigger→activation，显式 policy 2→efficiency，policy 1 或普通 paired eval→quality；calibration 与 synthetic self-test 的 requestedClaim 为 null，仅输出诊断。既有 request schema 1 不增加一个会被严格 parser 拒绝的新 objective 字段。对选中 task 求 claims 交集，仅 schema 2 对本次非空目标执行强门禁；缺支持在 verifier/oracle/agent 调用前给 `BENCH_CLAIM_UNSUPPORTED`。不得为通过门禁按 claims 自动删除选中任务。schema 2 声明 activation 的 task 必须有 shouldTrigger 布尔标签；正负任务都需支持 activation。schema 1 保留旧跳过/选择行为并披露未声明，不追溯改变历史采用资格。quality 数字在 efficiency 运行中仍可作为观察值记录，但不升级为未支持的结论。

新 preview、native plan 和 manifest 以可选版本化 `measurementScope` 子对象记录 benchSchemaVersion、按任务顺序排列的 taskClaims、requestedClaim 和 assessment；assessment 只取 supported、unsupported、legacy-unrecorded、not-applicable，calibration/self-test 用最后一种。报告/审计/replay 用冻结内容，不能读取今天已修改的 bench 补声明。新字段不匹配或与所选任务/模式/policy 矛盾时拒绝证据。旧外层 manifest 4、request 1、policy 1/2 保留；新子对象 schemaVersion 为 1，JSON schemas 同步，缺失不追认。

**实施接口细化（2026-10-22，原验收不变）：** `taskClaims` 为非空有序 `{ taskId, claims }[]`，schema 2 的 claims 是上述非空去重数组，schema 1 用 null 表示未声明（即使旧文件有被旧 loader 忽略的同名附加字段，也不推断支持面）。新共享模块 `harness/measurement-scope.ts` 负责解析、计算、目标门禁和冻结一致性。预览可展示 unsupported 及原因；执行在任何 verifier/oracle/agent 调用前以 `BENCH_CLAIM_UNSUPPORTED` 拒绝，不自动缩减 task。schema 2 scaffold 默认示例仅声明 quality；`--claim` 仅用于 schema 2 add，不隐式升级 schema 1。原 self-test 的 mock-only stopOnExecutionError/冻结 controls context 标识诊断运行，requestedClaim=null；其他普通 mock 运行仍按正常目标检查。声明缺失的新旧兼容只表示未记录，不新增历史采用门槛；出现的坏版本/矛盾字段则拒绝。冻结 scope 与 native/reviewed plan、原 sealed bench 及所选顺序对齐，不能拿 report 的 policy override 回填或篡改原目标。

管理/写入接口同步：bench init 默认仍为 schema 1，可用新增 `--schema-version 2` 选择；schema 2 的 bench add 用可重复 `--claim` 明确新任务支持面，缺声明拒绝写入；bench edit 的 claims 用 JSON 数组值校验。list/show 显示声明与旧数据状态。所有新注册、编辑、选择、freeze/from-commit 导入保留既有 dry-run、备份/回滚、碰撞、文件和体积限制；没有用户明确 opt-in 不自动升级现有 bench 或改写冻结输入。

诊断区分 ceiling/floor、quality headroom、efficiency eligibility 和 activation coverage。calibration 本身仍只测 baseline，不因 baseline 100% 就断言成本对比适合或证明质量等价。原始 pass 数与比率不改；饱和对 quality 提升有局限，对 efficiency 仅提示另查成本方差、覆盖和回归。缺少目标时显示多维诊断，不默认用“cannot discriminate skill effects”概括全部目标。

**验收：** schema 1 仍可读/编辑/运行且显示未声明；schema 2 缺/未知/重复 claims 被拒绝。选择子集按原 bench 顺序求支持交集，空或不支持目标在 verifier/agent 启动前拒绝。普通/request、paired/trigger/calibration、导入/管理、JSON/Markdown、native/portable 覆盖；固定输入篡改继续拒绝。质量饱和且成本完整的合成样例可满足 efficiency 的成本统计子条件，但整体仍被 synthetic 门禁拒绝采用；成本缺失或出现命名 check 回归时相应门禁也继续生效。不改 policy hash、阈值或历史 verdict。

## R1–R4：有明确产物的后续设计

| 任务 | 输入与研究边界 | 完成条件及后续实施边界 |
| --- | --- | --- |
| R1 功效/MDE/预算 | 以 F1 稳定计算和现行判定规则为基础，分开 quality 与 efficiency 终点；考虑改善/退步概率、任务异质性、同任务重复相关、失败/缺失和缓存/顺序；sampling 参数仅记录适配器实际发送值 | 形成预声明假设、固定预算下任务数/重复数的情景比较、零效应假阳性检查和不同效应的功效/区间；用独立精确值或模拟参考验证，不把 post-hoc power/CI 半宽叫 MDE。数据不足输出范围或无法估计；未验证的 planner 不宣传 power guarantee。文档先定义版本化输入/输出，再另列代码任务；不降低现有 8×5 门槛，不见 p 值加样本直到显著 |
| R2 Harvester | 复用现有单 commit 导入与来源保护，从明确本地 repo/ref 候选开始；保留许可证、parent/fix/test 关系、去重及拒绝原因；原始请求不得泄漏修复答案 | 设计 commit→候选→NOP/oracle→目标相关筛选→可选有预算 calibration 的漏斗、清单和恢复策略；离线阶段不调用模型，校准另授权。validation 按缺陷/来源去重并预先隔离，不能看 treatment 结果挑选。10–90% 不用于淘汰所有 efficiency case；不移除 200 文件/1 MiB、submodule、路径保护 |
| R3 过程试点 | 选择一个事件可验证的试点，如 test-write→test-fail→production-edit→test-pass；区分结果产物、读命令代理信号与实际时序证据 | 写出事件 schema、来源/顺序/完整性定义、缺事件与并发处理及故意违规反例；确定能观测什么、缺失时如何拒答。离线合成轨迹验证后才提真实采集方案，未知观测不能判定过程失败；不采集隐藏推理、不把 LLM 主观流程评分并入质量 verdict |
| R4 外部复现 | 区分作者运行、独立任务集、第三方离线 replay 和第三方 live reproduction；固定输入/实现/可用模型身份及环境要求 | 设计无原始 checkout 的最小复现包、隐私审查清单和结构化差异报告。离线包可本地验证；第三方 live 结果、费用与是否参与是外部条件，不能由维护者自跑冒充。包验收与参与记录分开，不承诺第三方会运行，不主动联系或发布 |

R 项可以读取公开历史数据，但不得自动恢复零余额研究或合并不同 cohort。每项设计结论需说明证据、假设、未解决限制及下一阶段的接口/验收；只写“未来增加 MDE/harvester”不算完成。

## F8：验证矩阵与交付条件

遵循 [AGENTS](../../AGENTS.md)、[贡献规则](../../CONTRIBUTING.md)、[bench authoring](../bench-authoring.md)、[现有 CI](../../.github/workflows/ci.yml) 和 [包策略](../package-contents.md)。下面均为已存在的命令；本计划中的新接口说明不冒充当前可执行命令。

```bash
npm test
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node scripts/check-contrib-benches.mjs
node scripts/check-docs.mjs
node scripts/check-architecture.mjs
```

| 验证面 | 必查行为 | 通过的含义 |
| --- | --- | --- |
| 数值/判定 | F1 参考值、阈值边界、完整 runner/report、legacy 错误诊断 | 不能产生已确认的假显著，也未弱化完整性检查 |
| 适配与观测 | 三类 wire shape、F2 正反例、正文、usage、错误、signal、全执行模式 | 离线适配与工厂可达性；不等于真实 CLI/认证 attestation |
| 环境兼容 | F3 指定 Node/OS、最低能力诊断、活动/冻结环境分开 | 每个实际执行环境有单独结果，不能以本地 Node 24 代替 Node 26 |
| 身份与成本 | 各角色、成功/失败/中断/缺 receipts，F4 字段与覆盖 | 未知仍未知；全调用成本不因排除或损坏丢失 |
| 合成/声明 | F6 每 suite 期望；F7 schema 1/2、子集、目标拒答 | 对照敏感性及声明约束；不是实际 Skill efficacy 或一般化证据 |
| portable/打包 | 从临时实际 npm 包独立运行；正常导出迁移、移走原输入再 replay；篡改与碰撞 | 不从源码 checkout 补缺，旧包和新元数据边界均验证 |
| 文档/依赖 | 新计划显式加入链接检查，活动入口、旧锚点、双语和版本一致性；编译模块方向 | 检查实际变更；本地链接检查不能证明事实陈述正确 |

重点回归现有 stats/report/runner/executor、eval-report/component/export、single-arm、budget/interruption、LRU、bench 管理、CLI/schema、package/release-docs 测试。新测试放入现有 node:test 体系，针对可观察风险，不制造与实现同构的断言。每次代码/build 改动交付或提交前运行 npm test；相关检查通过后仅在有新改动、失败或未解风险时重跑。

独立 npm 包验证沿用 package-contents 的实际打包/清单流程和现有 installed-feature recipes；需要新字段覆盖时增加活动验证，不能修改固定版本 recipe 的原字节。归档完整性检查沿用现有 check-archives/check-package 测试，历史执行只在原声明环境。4 MiB 压缩/19 MiB 展开上限不为新代码自动上调；所需控制数据优先小型确定性资源，不能再带入大量运行产物。当前对照与接口要在实际包中可用，不能只在源码测试里成立。

F8 完成需有：F1–F7 全部完成、问题→任务→实际结果的覆盖核对、每阶段 targeted 和全量结果、未执行/不可用检查、旧数据保护、scope 内 diff review、剩余限制。若之后只获授权实施部分 F 阶段，应单独交付该子集的验收记录，F8 及剩余阶段不勾选。R 项或第三方结果未完成时逐项列出，不写“19 个问题全部解决”。任何远端 CI、PR/merge、发布和真实评测结果只在后续明确授权且实际发生后记录。

### F8 实施验收与问题覆盖（2026-10-24）

以下保留提交前的本地 F8 验收快照；后续交付和跨系统 CI 结果见治理计划 N1–N3。

本轮按 A4→A5→V1→F8 执行，在最终工作树验收 F1–F7 已交付范围。基线为 main `496ad13077a9dc5beb1b3aa25a26b115849868c1`；44 个非计划变更文件 overlay SHA-256 为 `5f30a178d4fbc6cf2bcd5e13bf85aa46cfc79400ed464696780f373419a1b153`。完整环境/输入/各项计数和复用边界只在[治理计划 V1 记录](2026-10-22-documentation-governance-and-architecture.md#v1-最终验收记录2026-10-24)维护；本节负责原问题→阶段→实际结果的覆盖，不复制另一份进度清单。

| 原问题 | 归属 | 已执行证据与结论边界 |
| --- | --- | --- |
| 1 Claude trigger 不可达 | F2/F5 | 最终全量覆盖 matrix 工厂、三种 wire shape 与 trigger 正反例；静态接线/离线解析已验证，未推定真实 Claude 登录或模型行为 |
| 2 五字段 spendingBudget | F5 | 原 parser、成本/停止负例及实际包工作流通过，五字段仍必填；不是减字段修复 |
| 3 严格 token counters | F2/F5 | CLI/API usage 与失败/部分 usage 回归通过；Codex/Claude/Kimi 的声明边界保持，未提供的计数仍 unknown，不用 0 填充 |
| 4 servedModel 身份 | F4 | agent/judge/drafter 身份、失败/缺 receipts、report/export/replay 回归通过；响应观测与配置 intent 分开，未记录字段不补造 |
| 5 driver 旧版本 | F5/F8 | 当前候选实际安装后 README 双语、Skill、first-run、archive 五文档版本/固定引用检查通过；字段 0.13.1 不等于本轮候选已发布 |
| 6 metrics 修正案冲突 | F5 | 复用未变的权威 metrics/分流与公开样例；文档门禁 70 页、122 旧锚点通过，统计/观测回归通过，无新竞争定义 |
| 7 完整 mock 对照入口 | F6 | 最终全量含实际包四 suite、正向/有害/零效果/错误期望及停止收据；source/installed 预览和 synthetic 拒绝采用保持，零真实模型调用 |
| 8 MDE 缺失 | R1 待办 | 当前 bootstrap 区间不标成 MDE；本轮没有实现功效分析，R1 保持 0/1 |
| 9 bench 结论范围 | F7/A4 | schema 1/2、claims、激活标签、子集/目标拒答及 portable 冻结回归通过；实际包 schema 2 starter/freeze/edit/remove 通过，旧 bench 不自动升级 |
| 10 过程测量 | F5/R3 待办 | 当前只检验可见结果，未声称具备轨迹指标；架构 AST 门禁不是新增过程测量能力，R3 未实施 |
| 11 批量 harvester | R2 待办 | 原单 commit 导入的 parent/submodule/test-only/test-less、许可证/provenance 与 200 文件/1 MiB 保护回归保持；未实现批量漏斗 |
| 12 饱和任务 | F5/F7 | 原 WARN 和 quality/efficiency/activation 的目标相关诊断、拒答及 adoption 回归通过；不把饱和直接当成一般化有效结论 |
| 13 Node 26/旧 loader | F3/F8 | 本地真实 Node 22.13.0/22.14.0/26.0.0 周边各 172/172、LRU bench check；最终架构策略各 16/16；22.0 minimum 3/3。F3 原跨 OS 全量记录继续保留，本轮未用 darwin 结果代替新 Linux/Windows CI |
| 14 归档/包体积 | L3/F3/F8 | 实际包 1,174 files，压缩 1,227,266 B / 展开 5,731,706 B，原上限未改；offline 19+1,583 全部 hash 及碰撞/零网络验证，冻结原件无变化 |
| 15 调用成本/采用规模 | F5 | 8×5 采用条件与 within-bench verdict 分开；paired 成本总体、缺失/错误、ledger 和严格预算回归通过，未降低阈值 |
| 16 稀缺任务/外部转移 | F5/F7、R1/R2 待办 | 固定任务集、声明范围和可识别结论保留；本地 mock/历史 replay 不能证明跨仓库或未来模型可转移，后续研究未实施 |
| 17 sampling | F5/R1 待办 | 当前参数实际发送与 descriptor/withSampling 的边界保持；未新增 seed/temperature 能力，也未把随机性认定为已证根因 |
| 18 第三方复现 | R4 待办 | 本地移走原输入后的 5 portable replay、18 个冻结原程序和 1 export-index 验收通过；它们不是第三方 live reproduction，R4 未实施 |
| 19 README 预期过强 | F5/F8 | 双语结构/代码/徽章及实际包五文档通过，single-arm、quality、efficiency/adoption 和一般化边界仍分开；没有追加 efficacy 声明 |
| 20 McNemar 下溢 | F1 | 最终全量包含独立 BigInt/闭式参考、600/600 与 601/599、阈值/对称性及 runner/report/legacy 错误诊断；原公式、门槛、旧原件和冻结解释保持 |
| 21 trigger 子串误报 | F2 | 完整身份、命名空间、非目标参数、注释/展开/无关路径及 Windows 字面短路径正反例通过；纯元数据解析迁移与原声明 AST 一致，未知观测不冒充未触发 |

最终本地 full `npm test` 1079/1079（0 fail/skip/cancel，64.099s）；Node 24.21.0/macOS arm64。Node 22.13/22.14/26 的上述计数是 targeted，22.0 是 minimum。原 F3 在三系统及 Linux Node 矩阵完成的结果，属于原提交和 CI 链接；本轮不声称新的跨 OS CI、真实 CLI/API 认证或新 npm 发布。

最终未发布候选包 SHA-256 为 `1645bb01394703b112e9646fdced1bef889fcea84004a4f8fff80f9efe347040`。当前包重新验证安装/authoring/半写入回滚、5 文档、30 retained tests、7 foundation groups、5 移动后 replay、19 archives +1,583 support。历史 18+1 在本轮首份 V1 包执行成功；最后候选只改 init JS 与架构 owner 文字，历史 catalog/fetcher/recipe/全部输入逐字节同一，复用原程序执行证据，未为同输入重复全套历史或联网下载。此前一次未定位的偶发失败记录仍保留，不能宣称其根因已修复。

本轮初次迁移的 drafting 失败 summary 遗漏由既有回归发现并修复；最终整合 review 的 init 半写入所有权和过宽安装事务依赖两项已先红后绿，并在当前全量/实际包或策略负例上复验。46/46 文件全部 review（含被 OCR 过滤的文档和测试），0 skip、无剩余阻断。1,685 个受保护 evidence/release 原件 SHA 前后一致；公开发布数据、源 catalog、原 recipes/runtime/receipts 和统计协议未改；未读取私有实验室。

F8 完成指已实施缺陷/能力的本地验收和交付覆盖完成，**不是 21 项全部产品化**：MDE/采集/过程指标/第三方 live 依赖继续属于 R1–R4。以上为 F8 本地验收时的结果，没有真实模型调用、真实用户配置写入或外部发布。随后授权的提交、PR 与新源 CI 实际结果统一见治理计划 N1–N3；发布仍未执行。

## 实施边界、失败处理与决策规则

每阶段保持可独立审查的 diff，不能为实现新功能顺手重构安装事务、改变配置路径或移除包保护。源文件变动通过 Git diff 和检查保护；配置 writer 的真实用户配置备份流程不用于普通仓库文档编辑。新 run/export 目录必须新建且位于 bench 外，重复目录拒绝，不能覆盖旧结果；自检生成的输出不进入 bench 内容哈希。

失败先保留原始诊断、错误 receipts 和成本，再修本阶段原因；不得删断言、降 FAIL 为 INFO、替换失败样本或忽略中断。撤回时只撤回本阶段自己的变更，保留用户工作和历史证据，不用整树 reset 或 git clean。`workspace4skills/` 不读取、不修改、不进入 CI/包。没有新增 Agent/model 真实调用，全部测试隔离实际 home 与凭据。

以下技术决定已作为本计划的提案写明，实施前需确认用户授权范围覆盖相应接口变更：F1 专门错误而非静默纠正旧结论；F2 版本化观测；F4 可选身份元数据且不改变采用门槛；F6 独立 self-test 命令；F7 opt-in bench schema 2。若调查推翻某项可行性，先更新该项接口、依赖和验收，再继续相关工作；常规实现细节可自行处理，不制造逐步骤审批。写完计划本身不构成代码实施授权；本轮 2026-10-24 用户已明确授权 A4/A5/V1/F8 收尾，前置 F1–F7 已分阶段实际验收，当前状态以上方唯一清单为准。R1–R4 的设计/实施及其他外部交付条件保持。

## 计划复核与验证记录

本节区分调查结果、计划文档检查和实施验收。P1–P3 及前置探针记录保留调查时的基线快照；F1/F2 行分别记录各自交付时的结果，不反向改写先前阶段的快照。调查读数来自本轮会话的只读探针，不是第三方复现；历史记录计数不是独立实验数。

| 工作 | 已执行结果 | 限制/下一步 |
| --- | --- | --- |
| 基线核对 | HEAD 8087e05，package 0.13.1，Node 24.21.0，初始工作区干净 | 实施时重新核对漂移与用户改动 |
| 数值复现 | 当前 600/600、601/599 都返回 p=0；独立整数二项参考分别为 1、约 0.9769718547313974 | 尚未修改算法或跑新实现 |
| 公开记录盘点 | 读取 258 个公开 JSON、19 个 catalog 归档及 1 个嵌套归档，识别 33 处统计汇总，最大 discordant=2，无达到 1075 的记录 | 不覆盖未公开运行；未发现不等于所有历史/外部记录安全 |
| strip 探针 | Node 24.21.0 上前后两臂的 index/perf/diagnostics-channel 共 6 源码均可 strip | 未进行 Node 26 全链路验证；不是 loader 修复验收 |
| trigger 探针 | Node-only 假子进程确认 review-extra、other skill 的 args 含 review 都误报目标 review | 未调用真实 Agent；F2 尚未实施 |
| 既有只读检查 | 活动文档 45 个，本地链接/锚点错误 0；现有 dist 79 个活动模块，依赖违规 0 | 不代表新计划已纳入默认扫描，也不代表源码重建或全量测试通过 |
| 计划首次落盘 | 已写明 21 项覆盖、硬依赖、接口、兼容、验收、研究产物和授权边界 | 待 P2/P3 review 与显式计划文档检查 |
| P2 内容 review | 已修正 F5 首次/最终同步的顺序，明确 F8 完整验收范围；补齐自检专用输入、控制 JSON、模式/动作限制、错误与停止规则；补齐 API 成功原证据、观测版本和兼容总表 | 不把计划 review 通过当成实施授权；待 P3 最终检查 |
| P3 文档与范围检查 | 显式检查本计划及 45 个活动文档，共 46 个文件，本地链接/锚点错误 0；1–21 问题映射完整且唯一；8 个 F/4 个 R 任务全部未勾选；控制 JSON 示例解析通过；围栏、空白和 EOF 检查无问题。新文件 no-index diff 检查没有空白诊断，返回 1 表示与空文件不同 | 默认文档扫描不包含 plans，因此本次显式加入；检查时唯一工作区变更为本计划。没有把格式检查当实现验收 |
| F1 数值/读取回归 | `node --test dist/harness/stats.test.js dist/harness/report.test.js dist/commands/eval-report.test.js` 为 63/63，通过普通旧记录、稳定大样本、旧错误诊断、任意统计篡改拒绝、文本/JSON 出口与原文件不变检查；TypeScript 构建通过 | 新增 10 个离线回归用例；参考来自独立整数二项和闭式计算，不以待测函数生成 expected |
| F1 完整离线链路 | 正常 `runExperiment` 使用注入 mock，60 个任务×20 trials，共 1,200 对/2,400 次 synthetic 执行；前 30 任务全部改善，第 31 任务仅首对改善，其余退步，得到 improved=601/regressed=599、p=0.9769718547313975、inconclusive；保存后 parse/Markdown/CLI JSON 均通过，CLI exit 0，eligibleForUpgrade=false，manifest 原字节不变；耗时约 306 秒 | 零真实模型调用；临时 fixture/run 清理完毕；一次性大规模检查不加入每轮默认测试的 2,400 次进程开销。持续回归由数值、读取/CLI 测试及全量中原有正常 runner 测试覆盖 |
| F1 全量测试 | 首轮 `npm test` 为 912/913，唯一失败是已有 MCP HTTP 测试监听 127.0.0.1 被沙箱拒绝（EPERM）；获本机测试权限后原样重跑为 913/913，0 fail/skip/cancelled，耗时约 56 秒 | Node 24.21.0；没有改断言、跳过测试或引入真实外部服务。Node 22/26 验证属于 F3，本轮未执行 |
| F1 文档/结构检查 | 46 个文档的本地链接/锚点错误 0；eval-result schema JSON 及 3 处本地 schema 引用有效；79 个活动模块，依赖违规 0；tracked diff 无空白错误 | 不把 schema 语法/引用检查称为完整 JSON Schema 验证器运行；未增加验证器依赖 |
| F1 最终 review | 核对算法奇偶归一化、正常/次正常边界、普通与专门错误区分、极小真零、采用隔离、JSON 兼容、历史字节保护和 scope；补正单侧极小尾舍入、低于通用容差的失值诊断及仅对专门错误限制 details，未发现剩余阻断项 | F1 完成；F2–F8/R1–R4 未完成。不以阶段交付冒称 19 项全部解决 |
| F2 相关测试 | `npm run build` 后运行 trigger-detection、executors/cli、trigger、eval-agent-preflight、evaluation-report、eval-export-modes、eval-trigger-observation 七个编译后测试文件，最终 117/117，0 fail/skip/cancelled | 新增 21 个离线测试；已有行为断言未降级，补齐正常 header 的阴性 fixture，并另测无 header 保持 unknown；逐项证据见 F2 验收表 |
| F2 全量测试 | 初轮 npm test 934/934；review 补正路径展开/父目录消除、POSIX type、缺起始证据，并补导出包自身 reproduce 入口后，在最终交付代码与测试上再次 npm test：934/934、0 fail/skip/cancelled，约 53 秒 | Node 24.21.0；沿用 F1 已获准的本机回环监听权限以运行既有离线 MCP 测试，不访问真实模型服务。Node 22/26 及真实 CLI/认证未执行；前者属于 F3，后者按本轮边界不做 |
| F2 文档/结构与最终 review | 最终核对 46 文档链接/锚点，80 runtime 模块依赖，新/改 schema JSON 及 15 处本地引用；核对最终用户 dry-run、normal runner、JSON/Markdown、native audit、portable reader 和 frozen reproduce 入口，未发现本阶段剩余阻断项 | F2 按原验收完成；保留 F1 改动，未开始 F3，未改 immutable evidence/bench/release 资产。整体计划仍为 2/8，不把未做的阶段或真实环境验证写成已完成 |
| F3 最终兼容回归 | 最终冻结代码按顺序在本机 macOS arm64 的 Node 22.13.0、22.14.0、26.0.0、24.21.0 执行 npm test，各 939/939，0 fail/skip/cancelled；四版本 LRU CLI bench check 均 0 FAIL，Node 22.0 下限/TS 明确拒绝 3/3 | 旧解析器两种错误码均有实际环境验证；没有用父进程版本冒充 verifier 的实际 PATH；完整日志与本地收据位于 /private/tmp/skillfit-f3-*；远端 Linux/Windows/required CI jobs 未执行 |
| F3 冻结历史与最终 review | 原环境 Node 24.21.0/POSIX 的 19 个归档与原 recipe 全部通过，38 日志；1,688 冻结文件（含 catalog 的全部 19 archive 与 1,583 support files）SHA-256 均与修改前一致；47 文档链接检查和 80 runtime 模块架构检查通过，diff 无空白错误 | 未改上游源码/许可证、catalog/support、历史 recipe/loader、release 收据、依赖、版本或 engines；F3 本地交付完成但保留未勾选，总进度 2/8，等待远端 CI；未开始 F4 |
| F4 模型身份最终验收 | 最终相关测试 198/198，npm test 950/950，Node 22.13/26 专项各 12/12；正常调用、失败/中断、三类 evaluation reader 与 pinned reproducer、authoring machine records、guard 零分母、旧字段兼容和 tamper 拒绝均验收；文档、schema 本地引用、架构与 diff 检查通过 | 仅公开响应/事件 ID；无 backend 或真实 CLI attestation；原 1,688 冻结文件未改，F3 远端 CI 仍待验收，无真实模型调用/推送/发布；F4 完成后不自动开始 F5 |
| F5 首次同步验收 | 当前契约/修订史、统一能力表、双语 README/driver/指南已同步；相关检查 11/11、npm test 950/950、48 文档链接零错误、82 模块零违规；全部旧 metrics/README 锚点、原 badges/code/demo 和 1,688 冻结文件保留；两 bundled bench check 及旧 JSON report 入口通过，最终 review 未留首次同步阻断项 | 只完成首次同步；F5 不勾选，最终同步等待 F6/F7 实际交付，F3 远端 CI 继续待验收；无真实模型调用/推送/发布 |
| F6 完整离线对照验收 | 最终相关 245/245、npm test 1003/1003；正向/有害 p=0.03125、零效果 p=1、实际一调用错误前缀均匹配；CLI JSON/hash、三布局、无 live fallback、异常/timeout/信号/碰撞/资源拒绝、未知成本/不可采用和迁移 reproduce 通过；实际 offline npm 包内四类对照通过；49 文档、85 模块、schema 正反例和冻结资产检查通过 | 本阶段只支持 paired inject/installed；trigger/rules/MCP/judge/drafting self-test 显式 unsupported；原统计/policy/旧 evidence 不改；F6 完成但 F3 远端 CI、F5 最终同步仍待办，未开始 F7 |
| F7 声明与调用门禁 | schema 1 原行为及 ignored claims 保留为未声明；schema 2 严格校验每 task claims、activation 正负标签和选择顺序；普通 quality、policy 2 efficiency、trigger activation 的不支持目标在 verifier/oracle/executor 前拒绝，诊断 self-test/calibration 为 null；init/add/freeze/from-commit/edit/list/show 均贯通 | 不自动升级或筛选任务；声明不是效度、功效或采用资格；当前契约见 [bench claims](../bench-claims.md)，现有 request/manifest 外层版本、policy 哈希和统计阈值不变 |
| F7 冻结/读取/replay | measurementScope v1 贯通 preview、reviewed/native plan、paired/trigger/calibration summary、JSON/Markdown 与审计；新 scope 对齐 sealed bench 和选中顺序，篡改或遗失冻结声明拒绝；policy override 不改原目标，缺声明的目标阻止采用；schema 2 paired/正负 trigger/calibration 导出移走原输入后，当前 reader 和包内 pinned reproduce 仍保留声明 | 真正旧记录不补声明，不新增历史采用门槛；新 scope 不能借 legacy input recovery 改用今天的声明；synthetic self-test 继续隔离，饱和成本统计通过仍不可采用，缺成本/命名 check 回归仍阻断 |
| F7 相关与全量测试 | 兼容/导出/CLI/打包相关 119/119、bench JSON 专项 15/15；补齐目标 override 和登记后，最终 claims/多模式/CLI/JSON/registry 专项 35/35；最终 npm test 1041/1041，0 fail/skip/cancelled，约 68 秒；实际离线 npm 包验证含 schema 2 init/list/check、四类 self-test、19 archive/1,583 support 恢复及零网络尝试 | Node 24.21.0/macOS arm64；沿用既有本机回环监听权限。前两轮全量分别 1034/1040、1034/1041，暴露 scope 透传、旧夹具、文案/登记表及可选字段断言问题，均修复后重跑；未删 gate、跳过用例或弱化未知成本/历史保护 |
| F7 schema/入口/文档/结构 | 复用临时目录 JSON Schema 验证器检查 6 份 schema 定义，10 个真实输出正例通过、13 个反例拒绝；paired/trigger/calibration 实际 CLI 的 Markdown/JSON 各 3 个入口通过；code-review/debugging bench check 分别 27/36 PASS，0 WARN/FAIL；70 maintained/128 registered/53 topics 文档、原 93 个锚点和 92 个 runtime 模块依赖检查通过 | 未增加项目依赖；所有 F7 变更均有文档影响映射，双语入口和旧锚点保持；只同步 F7 必需契约，不替代 F5 最终同步或 D2 收尾 |
| F7 整合 review 与保护 | 按 OpenCodeReview delegate 1.13.3 解析文件规则，由 Codex 对照原 F7 验收及仓库标准做一次整合 review；工作区清单 171 项，本轮 48 项全部 review（含默认过滤的 15 项文档/测试），123 项既有改动排除；本轮覆盖 100%，工作区覆盖 28.1%，无剩余阻断项；修改后的输入/依赖已定点复核 | 非外部模型或独立第二 reviewer。以实施前 2,902 个公开文件快照保护既有工作，最终 2,909 个文件含本轮 7 个新增；48 个授权文件外逐字节不变，零删除，原 evidence/catalog/archive/recipe 及架构治理计划不改；本轮 diff 无空白错误 |

计划准备阶段未运行 npm ci/npm test；F1/F2/F4/F6/F7 已交付，F3 本地交付并继续等待远端 CI。F5 首次与最终内容同步均已交付，D2 文档收尾完成；F5 整项仍保留远端条件，未实施 F8/R1–R4。没有真实模型调用、实际用户配置写入、项目 commit、推送或发布。当前执行状态、唯一清单与逐项验收记录已同步；F1–F8 仍为 5/8（F1/F2/F4/F6/F7），F3/F5 保留未勾选。
