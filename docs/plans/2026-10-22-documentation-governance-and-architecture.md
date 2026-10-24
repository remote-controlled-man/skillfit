# skillfit 文档治理与架构边界整改计划

让当前文档有明确分工、权威来源和维护路径，让规划、执行、证据、计算与展示的边界可解释、可检查。沿用现有 CLI、数据合同与离线验证体系，分阶段迁移；不以增加目录、文件数量或测试数量作为整改完成标准。

## 当前执行状态

> **原始设计基线：** HEAD `8087e05173d673610d05090a52dd548e00c17517`，package `0.13.1`，Node `24.21.0`；实际设计输入是当时含 F1–F6 已交付改动的工作区，不能只检出 HEAD 就声称复现了本计划的基线。
>
> **当前做到：** D1–D3、A1–A5、V1 已完成本地实施及综合验收；A4 保留原 authoring/确认合同，A5 门禁接入既有 npm test/full CI。实际包、原始历史回放与保护哈希通过，所属测量计划 F8 的 21 项覆盖收尾也已完成；此前 L/C/M 交付保持。
>
> **进度：** 计划准备 P1–P3 为 3/3；原实施 D1–D3、A1–A5、V1 为 9/9；L1–L4 为 4/4，合计 13/13。C1–C4、M1–M3 已交付；此前 N1–N3 已交付；本轮 M4–M6 的合并、源 CI 验收及记录内容为 3/3，记录自身的远端集成状态由下方动态链接呈现；F8 由所属计划判定，R 研究不计入本计划完成数。
>
> **本轮授权：** 2026-10-24 用户追加授权合并 PR #55、检查/修复合并后 main CI 并更新原计划。按下方 M4→M5→M6 交付；此前 N1–N3 的 review、提交和 PR CI 保持其实际输入范围。不发布、不执行真实模型或 R1–R4，不修改冻结历史原件。
>
> **下一步：** PR #55 已合并为 main `c1c23bb087e6927e0137e6bcc7b08c10ef3163a7`，实际 [main CI 40103002073](https://github.com/remote-controlled-man/skillfit/actions/runs/40103002073) 8/8 通过并核验八份收据；M4–M6 的合并、源验收及记录内容已完成，记录自身的 PR/最终 main 集成结果由下方动态链接呈现。
>
> **最近更新：** 2026-10-24，Asia/Shanghai。

### PR #55 合并与主分支验收（2026-10-24）

顺序与验收：M4 只合并匹配已复核 head 的 PR #55；M5 跟踪真实合并 SHA 的 main push CI，八个 jobs 成功并核对实际收据的 SHA、Node、full/minimum 范围及计数，失败则定位、最小修复和重验；M6 将实际结果写回现有两份计划，经记录 PR、required checks 和正常合并交付，再核对最终 main CI。记录使用固定源结果加动态记录 PR/main 检查链接，避免为记录自身 SHA 循环提交；原历史证据/回放验收和 R1–R4 边界保持。

- [x] M4 合并 PR #55。（2026-10-24T14:33:03Z；匹配已复核 head `ff417da1ace6ef3210981df6f10db53abe2d2d15`，8/8 CI 和安全检查成功，普通 merge 得到 `c1c23bb087e6927e0137e6bcc7b08c10ef3163a7`；合并树与被 review 的 head 无文件差异）
- [x] M5 验收合并后 main CI。（2026-10-24；[CI 40103002073](https://github.com/remote-controlled-man/skillfit/actions/runs/40103002073) attempt 1，8/8 jobs 成功；八份收据匹配真实 main push SHA `c1c23bb087e6927e0137e6bcc7b08c10ef3163a7`、实际 Node/范围/原始日志计数，既有 main/full 源 CI 验证器通过；无失败、无重跑、无代码修复）
- [x] M6 完成计划状态与验证结果记录。（2026-10-24，记录内容完成；只修改现有两份计划。提交前 npm test 1079/1079、0 fail/skip/cancel，70.188s；70 页文档、80 个旧锚点与 diff 检查通过；2/2 文件整合 review 无剩余问题，0 skip。记录 PR/required checks、正常合并及最终 main CI 按下方动态链接逐项核对，全部实际检查通过后结束，不追认记录 CI 为源 full CI）

M5 实际 main 验收收据（2026-10-24；run `40103002073` / attempt `1`，全部 0 fail / 0 cancelled）：

| 作业 | 实际 Node | 范围 | tests / pass / skip |
| --- | --- | --- | --- |
| macos-latest required | 22.23.3 | full | 1079 / 1079 / 0 |
| ubuntu-latest required | 22.23.3 | full | 1079 / 1079 / 0 |
| windows-latest required | 22.23.4 | full | 1076 / 1075 / 1 |
| node-compat 22.13.0 | 22.13.0 | full | 1079 / 1079 / 0 |
| node-compat 22.14.0 | 22.14.0 | full | 1079 / 1079 / 0 |
| node-compat 24 | 24.21.0 | full | 1079 / 1079 / 0 |
| node-compat 26 | 26.12.1 | full | 1079 / 1079 / 0 |
| node-minimum 22.0.0 | 22.0.0 | minimum | 3 / 3 / 0 |

Windows 唯一 skip 是既有 POSIX escaped-descendant stdout 检查；信号、后代清理、短路径与完整包自检实际执行，未新增跳过。合并树与 PR #55 已 review 的最终 head 完全一致，复用相同输入上通过的 18+1 历史验收、19+1,583 恢复和实际包证据；1,685 份 evidence/release 原件 SHA 保持。原未定位偶发回放失败的限制说明保留，不声称其根因已修复。八份实际收据、原日志和验证摘要在 `/private/tmp/skillfit-merge55-main-ci/`；长期结果由本表及固定 CI 链接保留。

M6 只修改现有两份计划。记录交付的 required checks 通过后按仓库规则正常合并，再验收最终 main CI；[记录分支 PR](https://github.com/remote-controlled-man/skillfit/pulls?q=is%3Apr+head%3Acodex%2Fpr55-main-verification)与[main CI](https://github.com/remote-controlled-man/skillfit/actions?query=workflow%3ACI+branch%3Amain)呈现记录自身的实际集成结果，不为记录自身 SHA 循环追加提交。records 范围只证明记录检查，四个 Node compatibility 仍跑 full，不能把它们或 minimum 互相冒充。npm 未发布，R1–R4 保持待办。

### A4/A5/V1/F8 提交与 PR 验收（2026-10-24）

本节保留 PR #55 合并前的验收快照；后续合并/main 结果与本轮授权由上方 M4–M6 维护。

本轮只在此维护交付进度；测量计划引用本节。顺序为 N1 → N2 → N3。计划 review 已确认授权、依赖和验收方式明确，保留先前失败记录与 R1–R4 待办。

- [x] N1 复核最终改动和保护证据。（2026-10-24；46/46 文件统一 review，0 skip，无新阻断；35 个迁移声明重新比对 AST 一致。提交前 npm test 1079/1079，0 fail/skip/cancel，69.186s；70 页/122 旧锚点与 diff 检查通过。1,685 原件 SHA 保持；当前 1,174 个包文件逐字节匹配已验收候选，19 归档/1,583 支撑及 catalog/fetcher/recipe 与原 18+1 成功回放的输入一致，复用同输入实际执行结果；原未定位偶发失败记录保持）
- [x] N2 提交、推送并创建 PR。（2026-10-24；源提交 `f295149d779de7343b5f957d1a3779c0c150d19f`，分支 `codex/authoring-boundaries-closeout`，[PR #55](https://github.com/remote-controlled-man/skillfit/pull/55) 已创建并附加到当前任务。46 文件范围与复核清单一致，未直接写 main；PR 包含行为/验证/AI 披露及历史限制）
- [x] N3 验收实际 PR CI 并更新记录。（2026-10-24，源验收及记录内容完成；[CI 40100544026](https://github.com/remote-controlled-man/skillfit/actions/runs/40100544026) attempt 1，八个 jobs 全通过、八份实际收据已核对。源 head `f295149d779de7343b5f957d1a3779c0c150d19f`，实际测试合成 SHA `2b86a01c7b6d5a8c595f3723ae0945a0a039f558`；无失败、无重跑、无新增代码修复。记录提交前 npm test 1079/1079，0 fail/skip/cancel，69.056s，70 页/旧锚点与 diff 检查通过；两份计划的受影响内容复核无问题。记录自身最终 head 的实际检查仍在下方动态链接核对，不冒充固定源运行）

N3 固定源验收：上述 CI 属于 PR #55 的实际合成测试，不是 main push 或发布源验收。全部 0 fail / 0 cancelled；实际环境/范围如下。

| 作业 | 实际 Node | 范围 | tests / pass / skip |
| --- | --- | --- | --- |
| macos-latest required | 22.23.3 | full | 1079 / 1079 / 0 |
| ubuntu-latest required | 22.23.3 | full | 1079 / 1079 / 0 |
| windows-latest required | 22.23.4 | full | 1076 / 1075 / 1 |
| node-compat 22.13.0 | 22.13.0 | full | 1079 / 1079 / 0 |
| node-compat 22.14.0 | 22.14.0 | full | 1079 / 1079 / 0 |
| node-compat 24 | 24.21.0 | full | 1079 / 1079 / 0 |
| node-compat 26 | 26.12.1 | full | 1079 / 1079 / 0 |
| node-minimum 22.0.0 | 22.0.0 | minimum | 3 / 3 / 0 |

Windows 唯一 skip 是既有 POSIX escaped-descendant stdout 检查；未新增跳过，信号/后代清理、短路径和包自检实际执行。当前只追加两份计划的交付记录，运行时代码、政策、包与冻结历史均与源 CI 相同。八份收据及核验摘要保存在 `/private/tmp/skillfit-pr55-source-ci/`；固定 CI 链接和本表保留长期结果。

本轮记录统一追加一次；最后记录提交的远端集成结果由 [PR #55 checks](https://github.com/remote-controlled-man/skillfit/pull/55/checks) 和[本分支 CI](https://github.com/remote-controlled-man/skillfit/actions?query=workflow%3ACI+branch%3Acodex%2Fauthoring-boundaries-closeout)呈现。提交/推送后检查实际最终 head，不为写入记录自身 SHA 再提交一轮。PR 保持待合并，npm 未发布；R1–R4 仍待办。

## 目标、范围与完成含义

本计划负责两件事：建立可持续的文档管理规则；在不改变测量语义的前提下调整内部职责及依赖。产品能力、统计修复、bench schema 2 和结论范围仍由[测量整改计划](2026-10-21-measurement-contract-and-capability-remediation.md)负责。此前[文档与架构清理](2026-10-20-docs-architecture-cleanup.md)及[安装事务与归档交付](2026-10-20-install-transactions-and-archive-delivery.md)是已发生的工作记录，不重开、不覆盖其验收。

完成必须同时体现：读者能找到当前权威说明；一次行为变化能定位应更新的文档及检查；新增依赖不能绕过明确边界；迁移后的公开入口、历史数据和独立包仍可用。文件变短、零循环、链接通过或全量测试通过，分别只证明各自检查范围，不能单独代替上述验收。

范围包括活动文档登记与导航、计划/决策/证据的分工、文档门禁、架构说明和决策记录，以及评测规划、共享执行机制和 bench authoring 的内部迁移。保持零运行时依赖、Node >=22 核心要求及既有 case 特定能力限制、ESM/NodeNext、英文 CLI 输出和双语 README 规则。优先使用 Node 内置模块及已有 TypeScript 开发依赖，不引入文档站框架、DI 容器、新 schema 库、微服务或整库搬目录。

不改变统计公式/阈值、采用门槛、未知成本处理、模型身份含义、trigger 观测协议或 synthetic 隔离；不扩展到 R1–R4 的研究功能、安装事务重写或真实评测。2026-10-22 用户追加授权的 L1–L4 将目录治理和未来 npm 的冻结支撑按需交付纳入本计划；它不重写历史归档或已发布包，也不重开此前交付。发现必要的公开行为变更时，先修改范围、接口与验收并取得对应授权，不能混入“纯重构”。

## 已核实起点与问题覆盖

| 编号 | 事实与证据 | 整改归属及判断边界 |
| --- | --- | --- |
| G1 | [文档目录](../README.md)已有用户路径和历史记录说明，但版本适用、权威主题、维护角色及代码变更影响没有统一登记 | D1/D2；不将已有目录说成不存在 |
| G2 | [默认文档扫描](../../scripts/check-docs.mjs)检查固定入口及 docs 根目录；[CI records 检查](../../scripts/ci-scope.mjs)另外显式检查本次变更的计划/记录 | D3；补齐独立检查与 CI 的一致性，不误称所有计划均不受检查 |
| G3 | 目录/路线图复制 F 阶段进度，当前计划已有 F6 完成记录；部分入口同步按原授权待 F5 最终阶段 | D2 与 F5；消除重复状态来源，不将已明确延后项追认成 F6 违约 |
| G4 | 当前测量计划同时承载接口、进度和长验收记录；当前架构决定散在专项指南及计划中 | D2/A1；现有记录保留，新工作明确分工，不大改历史文本 |
| G5 | [架构说明](../architecture.md)已有工作流和顶层方向，但缺少完整的内部允许依赖、接口和质量场景索引 | A1/A5；补可执行边界，不以采用某个模板作为认证 |
| G6 | [prepareEvalPlan](../../src/commands/eval-plan.ts)调用 runEval 的 dry-run 分支并通过 onPlan 取回计划；[eval](../../src/commands/eval.ts)混合规划、展示和调度 | A3；拆开查询和执行，保留安全复核与公开结果 |
| G7 | [runner](../../src/harness/runner.ts)同时包含 process/verifier/workspace、trial、统计汇总和 experiment；[control executor](../../src/harness/executors/control.ts)为 oracle 导入 runner | A2；共享机制不再依附高层编排，不盲目统一不同模式的统计语义 |
| G8 | [bench 命令](../../src/commands/bench.ts)仍包含模板生成、起草、写入、Git 调用及 commit 导入准备 | A4；按业务接口迁移，不按行数拆分 |
| G9 | [架构检查](../../scripts/check-architecture.mjs)检查 emitted JS 的运行时循环及 harness/install 到 commands 的反向依赖 | A5；保留已有检查，增加所选内部边界及类型依赖检查 |

调查时默认文档检查为 47 文件、0 断链，架构检查为 85 活动模块、0 已定义违规；src 非测试 TypeScript 约 15,187 行。它们是工作区快照，不是整改后的目标数或质量评分。冻结 evidence、版本化 release recipes 和私有实验室不计为活动模块。

## 与 F1–F8 的衔接与依赖

两份计划各自维护自己的唯一实施清单。本计划只引用 F 状态，不复制其勾选项、不重算其进度；F 计划继续拥有 F3 远端验收、F5/F7/F8 和 R1–R4 的完成判定。本轮获继续授权，在 F 计划记录 F5 内容同步，在本计划记录 D2 收尾；既有验收历史和未满足的远端条件保持，不反向修改旧阶段结果。

| 原阶段 | 本计划如何使用 | 不允许的替代 |
| --- | --- | --- |
| F1/F2/F4/F6 已本地完成 | 建立数值、观测、身份、自检与 replay 的兼容样本；迁移时保留并复跑相关验收 | 重构通过不能充当新的真实模型验证，也不重新计作 F 阶段交付 |
| F3 Node/OS 兼容验收（状态见 F 清单） | 保留 Node/OS、full/records/minimum 的范围标识和固定历史环境 | 本地检查或文档修改不能代替 F3；本轮 C4 按 2026-10-23 的追加授权执行并记录远端 CI |
| F5 内容同步与整项验收（状态见 F 清单） | F5 负责 F6/F7 新接口的事实和语义；D2 负责文档分工、去重、导航与锚点迁移 | D2 不绕过 F7 宣称最终接口已稳定；不要求另一份计划重复维护同一事实 |
| F7 本地已交付，按其当前合同消费 | A3/A4 硬依赖 F7 本地验收和 F5 最终语义同步；消费其 measurementScope、claims、schema 1/2 和目标拒答 | 不在架构重构中另造 objective、schema 或默认升级；本计划不授权 F7 |
| F8 未实施 | 原完成条件不变。若架构改动先进入工作树，F8 在最终合并工作树重跑受影响验收；若 F8 先完成，本计划另外记录后续回归 | V1 不代替 F8；F8 不自动扩展为本计划全部完成 |
| R1–R4 未实施 | 后续设计按 D2 的分工登记；可引用已接受的架构接口 | 不将 ADR、文档登记或本地 replay 算作 MDE、harvester、过程测量、第三方运行 |

推荐在分别获得实施授权后，按 **D1 → A1 → D2（当前事实部分）→ D3 → A2 → F7 → F5 最终同步 → D2 收尾 → A3 → A4 → A5 → V1** 交付。F3 远端验收保持所属计划的独立条件，由本轮 C4 记录实测结果；F8 的实际排期按上表处理。D2 未收尾不反向阻塞 F7/F5，D3 可基于已登记的当前文档先实施；不把这个推荐顺序误当成全部硬依赖。

这里的“F5 最终语义同步”特指文档已按 F7 的本地实现同步，并如实披露 F3 远端 CI 待验收；不要求提前勾选 F3 或改变原计划对 F5 整项完成的条件。F5 的内容同步不依赖 A3/A4 或 D2 收尾，因此没有互相等待的环。若 F7/F5 暂未获实施授权，可交付 D1/A1、D2 当前事实部分、D3/A2，A3/A4 保持待办，不能自行删掉前置条件绕过。

| 阶段 | 硬依赖 | 主要产物 | 完成所需证据 |
| --- | --- | --- | --- |
| D1 文档登记 | 本阶段实施授权；当前工作区快照 | 治理规则、文档登记与主题权威表 | 公共文档分类完整，权威和角色明确 |
| A1 架构契约 | D1 的维护职责已定义 | 当前/目标边界、运行场景、接口表、ADR 索引 | 每条迁移对应模块、风险及可测结果 |
| D2 文档迁移 | D1/A1；最终收尾依赖 F7 本地完成及 F5 最终同步 | 精简入口、当前说明、历史/计划/决策分工及迁移表 | 权威来源唯一，旧路径/锚点和双语入口可用 |
| D3 文档门禁 | D1/A1 的登记与规则定稿，不依赖 D2 整项完成 | 扩展现有 docs 检查及 CI 适配 | 正反例证明覆盖与安全边界，未知变更用 full |
| A2 共享执行机制 | A1/D3 | process/verifier/workspace 和纯汇总的职责拆分 | 子进程、超时、中断、oracle、审计一致 |
| A3 规划与执行应用接口 | A1/A2；F7 本地完成及 F5 最终语义同步 | 独立 resolve/build/execute 接口及薄适配器 | 不靠执行命令的 dry-run 分支生成计划，哈希与复核正确 |
| A4 bench authoring 接口 | A2/A3；F7/F5 同上 | prepare/apply authoring 服务及兼容入口 | 所有原 authoring 保护与新 claims 行为一致 |
| A5 架构门禁 | A1–A4；D3 | 完整模块归属、允许依赖与临时例外、CI 检查 | 迁移范围无未解除例外，越界正反例通过 |
| V1 综合验收 | D1–D3、A1–A5 完成 | 最终工作树验收、实际包与迁移 replay、交付 review | 每项要求对应实测结果；远端待办单列 |

## 执行顺序与唯一进度清单

完成实现或文档交付并满足对应验收后才勾选；部分完成在本清单注明剩余项。后文只写要求和实际记录，不另建重复勾选清单。

### 计划准备

- [x] P1 核对仓库规则、既有计划格式、当前源码、文档/CI 扫描与保护边界。
- [x] P2 写明文档分工、模块接口、任务依赖、F 计划衔接和迁移兼容。
- [x] P3 完成单独一轮 review、修正歧义、显式检查本计划链接及差异，记录实际结果。

### 实施阶段

- [x] D1 建立文档登记、权威主题与维护规则。（2026-10-22 完成；120 文档/45 主题/30 窄排除项，449 份公共 Markdown 无遗漏；相关检查 12/12，规则、样例与引用核对通过）
- [x] A1 定义架构边界、关键运行场景与 ADR。（2026-10-22 完成；3 个架构主题视图、3 份 proposed ADR 与索引；17/17 相关检查，71 文档链接、6 个旧锚点、15 条当前依赖及 16 个真实函数出口核对通过）
- [x] D2 迁移活动文档和入口，保留路径/锚点；F7/F5 后收尾。（2026-10-22 最终完成；F5 内容同步、权威映射、六条路径、198 旧锚点和双语原代码/演示/徽章核对通过；相关 94/94、npm test 1041/1041，整合 review 无剩余阻断项）
- [x] D3 接通文档登记、变更影响和 CI 门禁。（2026-10-22 完成；32/32 相关测试、最终 npm test 1019/1019；独立检查覆盖 69 maintained 页，Git 基线另显式纳入变更历史记录并保留 168 个旧锚点；两轴 review 修复后均无剩余问题）
- [x] A2 拆出共享执行机制与独立汇总。（2026-10-22 完成；相关执行回归 222/222、review 修复后报告/依赖回归 65/65、最终 npm test 1028/1028；旧出口与错误类身份、实际包/replay、信号/后代清理通过；两轴复查无剩余问题）
- [x] A3 建立独立规划/执行应用接口并迁移所有入口。（2026-10-22；六类 eval/calibration/四 suite 固定指纹对照通过；修复相关 39/39、npm test 1047/1047、最终文档/架构/实际包门禁 31/31；旧导出、scope/旧数据、synthetic 和 replay 保持；一次整合 review 后无剩余问题）
- [x] A4 收拢 bench authoring 服务并保留写入保护。（2026-10-24；92/92 authoring/claims/source/draft/manage 回归，初次迁移发现的 drafting 汇总遗漏已修复；实际离线 npm 包独立 init/schema 2/command starter 门禁/freeze/edit/remove/首份备份验证通过；最终整合 review 与全量在 V1 执行）
- [x] A5 将目标模块边界接入可执行检查。（2026-10-24；107/107 runtime/source 唯一归属，0 违规，迁移范围 0 例外；1 条具体遗留矩阵校验边有 owner/解除任务。170/170 相关回归及最终 15/15 架构正反例通过，已复用 npm test/full CI 的真实门禁；活动架构/ADR 同步，旧锚点保留）
- [x] V1 完成最终工作树、实际包、replay 和文档的综合验收与 review。（2026-10-24；最终 npm test 1079/1079，三 Node 专项及架构门禁、Node 22.0 minimum、10 个实际 bench 门禁通过；实际包/5 文档/30 回归/7 基础组/5 replay、19+1,583 恢复及历史 18+1 通过；1,685 保护原件不变；46 文件整合 review 修复后无剩余问题，完整边界与输入见下文）
- [x] L1 固定保护基线，补齐 bench 目录与覆盖检查。（2026-10-22；8/8 实际 bench check 全通过，文档/登记 22/22，遗漏/虚构/重复目录回归通过；数据原件未改）
- [x] L2 收敛读者说明和维护记录，保留旧路径/锚点。（2026-10-22；分享指南 72→12 行兼容入口，原内容并入报告指南；旧锚点/原代码块全保留，文档/登记/发布文档检查通过；未新增 Markdown）
- [x] L3 将冻结 artifact 支撑改为显式按需恢复，验证后切换未来 npm 清单。（2026-10-22；隔离安装/5 文档/离线恢复通过，默认固定 HTTPS 完整恢复 19+1,583，483 请求、0 缓存命中、105.793 秒；逐字节验证通过，原30秒单文件 deadline 未变）
- [x] L4 收拢未来发布收据并完成本轮安装、文档、历史回放和整合 review。（2026-10-22；新旧收据/CI/文档40项、CLI夹具39项、最终npm test 1060/1060，18+1原程序、最终隔离包/5文档/离线19+1,583通过；26文件整合review无剩余阻断项）

### 本次 review 与提交交付（2026-10-23）

- [x] C1 冻结并整合 review 全部 200 项相关改动。（2026-10-23；109 默认可审查项及 91 过滤项全部按适用内容核对，无跳过项；修复两份计划的过时摘要，并将两份 ADR 的阶段状态改为引用唯一计划；另修正暂存检查发现的新文件 EOF 空行；生产逻辑/冻结数据不变）
- [x] C2 首个源提交及 C4 修复后的输入均已验收；修复后 npm test 1063/1063、实际包/5文档/离线恢复与安装后短路径检查通过。初轮记录保持：（2026-10-23；Node 24.21.0/macOS npm test 1060/1060，0 fail/skip/cancel；文档 71 页、203 旧锚点保留，22 JSON/引用及 101 模块检查通过；两核心 bench 与全部 contrib 门禁通过；历史及独立包结果见下表）
- [x] C3 已提交并推送 `04ee9b6e945ea58f9ba2c930c36f8bfd26863b57` 到 `origin/codex/docs-evidence-delivery`，建立 [PR #53](https://github.com/remote-controlled-man/skillfit/pull/53)。（2026-10-23；200 项相关文件，提交后工作区干净；遵循主分支 PR/required checks，没有触及私有资料；后续 Windows 修复 `d773276c376c44492ff0e14a42624bd2e0bd8c85` 亦已推送）
- [x] C4 三系统 required、Node 22.13/22.14/24/26 全量及 Node 22.0 minimum 全部通过。（2026-10-23；源 `5078262`，[CI 39906699174](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 8/8；已修复初轮 Windows 四项失败与第二轮批次限时取消；实际计数见 F3/F5 补记，两份计划同步，原待办不变）

C1 的输入为 HEAD `8087e05173d673610d05090a52dd548e00c17517` 上的全部相关工作区内容；已保存完整补丁、未跟踪文件副本和 SHA-256 清单。OpenCodeReview 预览 200 项（109 个默认可审查项、91 个过滤项），由同一次审查按适用规则人工覆盖关键非代码内容。审查与验证日志存于系统临时目录，长期结论、环境、数量和远端链接在此记录，不另建 Markdown。

C1/C2 首个源提交 `04ee9b6` 实测收据（2026-10-23，Node 24.21.0/macOS；保留原记录，C4 修复后结果另记）：

| 验收 | 实际输入与结果 | 边界 |
| --- | --- | --- |
| 保护原件 | catalog/source `56b4dc68e115475e197c6510c9cb2235a5ad2c62` 不变；`check-archives` 验证 19 archives +1,583 support 的路径/大小/SHA；没有删除公开文件 | evidence 仅恢复工具及 npm 排除规则变化；历史报告/归档/runtime、已发布 recipe/收据保持原字节 |
| 原始回放 | 从上一轮实际 HTTPS 恢复工作区校验全部字节后，独立目录执行 18 个原始 replay +1 export-index，19/19 成功，0 模型/Agent CLI 调用 | 保持 Node 24.21.0/POSIX；上一轮未定位原因的一次失败及成功复查不删，本次未再出现，不能声称已证明该偶发问题根因或未来永不发生 |
| 实际候选包 | 1,168 files，压缩 1,224,009 B，展开 5,722,132 B；SHA-256 `f1fcaf0665c01589b800b9f311938a1643e60ff941d1a4befc2e5c1d6d9bcb89`；重新打包与上一轮最终包完全同字节 | plans/decisions 排除于 npm；本轮状态/ADR 修正不改变包。是未发布源候选，版本字段仍 0.13.1 |
| 隔离安装/文档/恢复 | 当前包离线安装，CLI version=0.13.1，Skill 等 5 文档门禁通过；`--offline --from` 恢复 19+1,583，networkAttempts=0、previewWrites=0、碰撞保护通过 | 复用相同输入上已通过的 30 feature、7 foundation 组及 5 portable replay；不重复 HTTPS 483 请求，不执行真实评测 |
| 最终离线检查 | npm test 1060/1060（最终 67.896s；EOF 格式修正后全量复验）；docs 链接/旧锚点/双语/发布文档、实际 npm 清单/大小、JSON 引用、架构及 diff 检查通过 | 本地结果不代替尚未发生的远端 CI；A4/A5/V1 和 F 计划未满足的项继续待办 |

临时完整输出为 `/private/tmp/skillfit-delivery-{npm-test-final.log,docs.json,package.log,historical.log}`；历史逐项结果及日志摘要在 `/private/tmp/skillfit-delivery-historical/historical-smoke.json`。本表保存长期输入、环境、数量及结论；远端提交/CI 链接在 C3/C4 完成后补充。

### PR #53 合并与主分支验收（2026-10-24）

顺序与验收：M1 核对最新 head、合并规则和全部检查，沿用相同输入的 review，以匹配 head 的普通 merge 合并；M2 只跟踪实际合并 SHA 的 main push CI，八个 jobs 均成功且收据 SHA/运行环境/范围/计数匹配才完成，失败则定位、最小修复并重验受影响检查；M3 将实际提交、CI 链接及结果写回现有两份计划，检查事实、链接、旧锚点与差异，按仓库 PR 规则交付记录。状态记录用固定源 CI 加动态 PR/main 检查链接，避免为了写入记录自身 SHA 反复提交。

- [x] M1 合并 PR #53。（2026-10-24 12:08:09 +08:00；匹配已复核 head `a557e5aff30f70ff53f1c1571ed9b28f742dfde2`，8/8 CI 及安全检查成功，普通 merge 得到 `117352d51f1f3dc5bd3cfb0cf7455052539f1eb4`；合并树与被 review 的 head 无文件差异）
- [x] M2 验收合并后的 main push CI。（2026-10-24；[CI 40061140632](https://github.com/remote-controlled-man/skillfit/actions/runs/40061140632)，attempt 1，8/8 jobs 成功；八份收据均匹配真实 main push SHA `117352d51f1f3dc5bd3cfb0cf7455052539f1eb4`，通过现有发布源 CI 验证器及兼容/下限范围核对；无代码修复、无重跑 CI）
- [x] M3 完成计划状态及验证结果记录。（2026-10-24；只改现有两份计划，八份实际 main 收据已核验；本地 npm test 1,063/1,063、0 fail/skip/cancel，68.186s；70 页文档、旧锚点和 diff 检查通过。先前沙箱仅因 HTTP 夹具监听 127.0.0.1 被拒而失败，允许本机端口后全量通过。两文件整合 review 无剩余问题；记录的 PR/required checks 与 main 集成结果见下方动态链接，不追认记录 CI 为源 full CI）

本轮计划 review：执行顺序、失败修复路径、两种 CI 的证据边界和记录交付方式明确；保持历史证据/回放及未实施项的验收条件，无新增设计决策或重复全库 review。

M2 实际 main 验收收据（2026-10-24；run `40061140632` / attempt `1`，全部 0 fail / 0 cancelled）：

| 作业 | 实际 Node | 范围 | tests / pass / skip |
| --- | --- | --- | --- |
| Windows required | 22.23.4 | full | 1060 / 1059 / 1 |
| Ubuntu required | 22.23.3 | full | 1063 / 1063 / 0 |
| macOS required | 22.23.3 | full | 1063 / 1063 / 0 |
| Ubuntu compatibility 22.13.0 | 22.13.0 | full | 1063 / 1063 / 0 |
| Ubuntu compatibility 22.14.0 | 22.14.0 | full | 1063 / 1063 / 0 |
| Ubuntu compatibility 24 | 24.21.0 | full | 1063 / 1063 / 0 |
| Ubuntu compatibility 26 | 26.12.1 | full | 1063 / 1063 / 0 |
| Ubuntu minimum 22.0.0 | 22.0.0 | minimum | 3 / 3 / 0 |

Windows 的 skip 是原有 POSIX escaped-descendant stdout 检查；信号、后代清理、短路径与完整包自检实际执行。main 合并树与 PR head 完全相同，复用 C2 的历史 18+1 回放、19+1,583 恢复及实际包证据；未更改冻结原件或忽略此前已披露的偶发失败。完整八份收据及校验摘要保存在 `/private/tmp/skillfit-merge53-main-receipts/`、`/private/tmp/skillfit-merge53-main-summary.json`，长期结果由上表与固定 GitHub CI 链接保留。

M3 只更新现有两份计划。记录交付的 required checks 按仓库规则通过后正常合并，再核对最终 main CI；记录 PR 和后续 main 状态分别由[记录分支 PR](https://github.com/remote-controlled-man/skillfit/pulls?q=is%3Apr+head%3Acodex%2Fpr53-main-verification)与[main CI](https://github.com/remote-controlled-man/skillfit/actions?query=workflow%3ACI+branch%3Amain)动态呈现，避免为记录自身 SHA 再生成一轮记录提交。records 范围只验证记录，不能替代上述固定源 full CI。

### C4 初轮失败与修复范围（先记录后实施）

[CI 39903578726](https://github.com/remote-controlled-man/skillfit/actions/runs/39903578726) 的其余 7 jobs 成功，Windows Node 22.23.3 全量为 1,059 tests、1,054 pass、4 fail、1 skip（原 POSIX-only 检查），因此 F3/F5 继续未完成。失败日志及八份真实收据已保留。

| 失败面 | 待验证的原因与最小修复 | 验收保持 |
| --- | --- | --- |
| SIGINT/SIGTERM 两项 | 测试 bootstrap 导入异步 CLI 后立即 disconnect，使 Windows 信号桥接通道先于评测结束关闭；让桥接等到 CLI 完成才关闭，并在 POSIX 也执行 IPC 路径以防再漏 | 两种信号均须保留 exit 130/143、stopped receipt、完整哈希及 verifier 后代清理断言，不跳过 Windows |
| 目标路径读取 | 将 Windows `RUNNER~1` 绝对短路径中的 tilde 误当作 home expansion；仅对 Windows shell 的显式盘符绝对路径允许字面 tilde | 相同注册路径才为正信号；`~` home、展开/父目录/无关路径仍 unknown/negative；公共 matcher 先红后绿 |
| 实际包四组自检 | 外层 30 秒限制不足以完成 Windows 的 27 次 mock/本地 verifier/git 调度；只增加该整组测试外壳的有界等待 | 仍须完成全部四组、27 次模拟、0 model calls、期望 verdict 和不可采用；不改生产 deadline、样本或断言 |

修复后只 review 受影响输入，执行相关离线检查、npm test、实际候选包/文档/恢复验证并推送。新的源代码 CI 必须按原 8-job 要求全部通过；不把初轮失败改成通过，也不改冻结输入/回放程序。

C4 修复已推送，待验收 [CI 39905332215](https://github.com/remote-controlled-man/skillfit/actions/runs/39905332215)，源提交 `d773276c376c44492ff0e14a42624bd2e0bd8c85`。

C4 修复的本地结果（2026-10-23）：

- 短路径公共 matcher 红测 0/1→路径回归 11/11；IPC 通道两项均先复现 `ERR_IPC_CHANNEL_CLOSED`，修复后两种信号×OS/IPC 四项 4/4，完整退出码/后代/收据断言保留。最终 npm test 1,063/1,063、0 fail/skip/cancel，64.423s；已包含实际 npm 包四组 27 次模拟及新/旧 portable replay 回归。
- 原固定源、catalog、下载器、历史 recipes、恢复输入均未改；历史 18+1 的被测依赖与成功执行时逐字节相同，复用首次源提交的历史执行证据。未用新 matcher 重新判定旧 fired counts。
- 修复后实际包仍 1,168 files，压缩 1,224,182 B / 展开 5,722,492 B，SHA-256 `7d13ceb5b7f4a57846b8c7f44ea09e7c8c0bc25633ca04c22a758f8b68f48d69`；与首次包仅 `dist/harness/trigger-detection.js`、`docs/metrics.md` 不同。离线隔离安装、CLI version、5文档、19 archives +1,583 support、零网络/碰撞保护，以及安装后短路径正例/无关路径/home expansion 反例通过。
- 仅复核 6 个受影响路径，沿用原 OCR 规则与合同；修复不改统计阈值、生产 timeout、四组样本或断言。docs/旧锚点/JSON 与 diff 门禁通过。完整本地输出 `/private/tmp/skillfit-delivery-{shortpath-red.log,shortpath-green.log,ipc-red.log,ipc-green.log,ci-fix-npm-test.log,ci-fix-package.log}`；平台修复仍须新的远端结果，不能在本机代为勾选。

C4 第二轮结果与补正范围（先记录后实施）：[CI 39905332215](https://github.com/remote-controlled-man/skillfit/actions/runs/39905332215) 的原四项失败均通过，Windows 完整包检查实际用时 61.583s 并通过；其余七个 jobs 通过。Windows 这次为 1,060 tests、1,058 pass、0 fail、1 cancelled、1 原有 POSIX-only skip。唯一取消项是直接调用四组控制的测试本身仍设置 30 秒限时，31 秒被取消；上一轮只修了包测试外壳，遗漏此入口。检查同文件后，迁移导出/回放的多流程测试也已耗时 30.936s，存在同样边界风险。

本补正只统一这三项完整批次/多流程自检的测试外壳到有界 120 秒；单次异常/oracle timeout 的负例限制及所有生产 deadline、样本、verdict/receipt/成本/不可采用断言不变。CLI fixture 的执行均选单 suite，保留原 30 秒界限。修正后相关检查与 npm test 必须通过，并在新源提交上重验远端 CI；不靠重跑旧提交争取偶然通过。该测试文件不随 npm 发货，候选包应保持 SHA-256 `7d13ceb5b7f4a57846b8c7f44ea09e7c8c0bc25633ca04c22a758f8b68f48d69`，以最终文件逐项比对确认。

补正后的 `npm test` 为 1,063/1,063、0 fail/cancel/skip，64.091s；docs/旧锚点/diff 通过。最终 1,168 个打包条目逐文件与上述隔离安装包比对，0 差异；因此包、文档、恢复和历史回放的既有相同输入验收仍有效。仅 review 此测试文件的 3 个外壳 timeout 和说明，原 callback/断言均未改；本地完整输出 `/private/tmp/skillfit-delivery-ci-envelope-npm-test.log`。补正已提交并推送 `5078262b37c2c5c5ffde2cb88aff09e3bf0b891d`，待 [CI 39906699174](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 实际验收。

C4 最终远端验收：源提交 `5078262b37c2c5c5ffde2cb88aff09e3bf0b891d` 的 [CI 39906699174](https://github.com/remote-controlled-man/skillfit/actions/runs/39906699174) 为 completed/success，8/8 jobs；Linux 四兼容版本和 Ubuntu/macOS required 均 1,063/1,063、0 fail/cancel/skip；Windows Node 22.23.4 为 1,059 pass /1,060 tests、1 原有 POSIX-only skip、0 fail/cancel；Node 22.0 minimum 为 3/3。八份收据的 run/attempt、scope、实际 Node 和被测 merge 身份均核对；详见[唯一 F3/F5 验收记录](2026-10-21-measurement-contract-and-capability-remediation.md#f3f5-远端验收补记2026-10-23)。

这次最终状态提交只改两份活动计划，不改变已验收包、执行代码或历史输入；[PR #53 的检查页](https://github.com/remote-controlled-man/skillfit/pull/53/checks)直接保留最新记录提交的 CI 状态。源验收与记录提交分别标识，避免为写入自己的提交哈希再制造一轮记录。F8/A4/A5/V1/R1–R4 不因本次提交交付自动完成。

## L1–L4：目录、记录与按需交付补充

本次扩充处理读者入口和交付负担，不以删除文件数代替兼容性验收。上一轮只读盘点时的仓库快照为 docs 189 文件/77 Markdown、benches 860/165、evidence 1,608/202，包含既有 WIP；benches 只有 10 份维护 README，其余 155 Markdown 是测量输入。两份活动计划当时约 87/97 KB，发布目录 80 文件。所有当前既有工作保留，不将它们归为本轮改动。

### 保留、合并归档与按需清单

| 材料 | 本轮处置 | 兼容要求 |
| --- | --- | --- |
| 当前教程、操作/参考合同、schema、架构视图、driver、profiles | 保留；入口按读者任务组织，不整库换目录 | 不改测量/CLI 合同；双语、版本边界、原示例及锚点继续可用 |
| benches 下 manifest、prompts、fixtures、ground-truth、controls、来源/许可 | 原路径原字节保留；补齐 contrib 8/8 目录（原 5/8） | 目录检查从真实 bench manifest 发现案例；新增/遗漏条目失败，不运行模型 |
| sharing-results 的简短操作说明 | 合并入 evaluation-reports 的分享章节；旧文件仅留导航/旧锚点 | 原操作/输出示例与安全含义全部保留；canonical/受影响页同步，不将字段合同复制到新页 |
| 当前两个活动计划 | 保留本计划的状态、唯一清单、要求和本轮简短验收；仅将本计划已有长阶段记录折叠呈现 | 不另写计划/设计/报告 Markdown；不删旧验证记录；进度不复制到治理页或目录 |
| 其余旧计划、审计、metrics-history、已发布版本 Markdown/JSON/日志/recipes | Git 中保留路径/原文，按已登记 lifecycle 作为历史入口；从默认阅读与未来 npm 维护材料中分离 | 不移动/覆写冻结收据或 recipe；历史未完成状态不追认为完成；当前教程/功能 recipe 仍随包 |
| evidence 根报告、inputs、plans、catalog、恢复工具 | Git 保留；npm 保留轻量报告/必要声明与输入，继续零隐式下载 | catalog v1/source commit、所有 19 archives/1,583 support 的路径/哈希不变 |
| evidence/artifacts 的 19 档及冻结 README/runtime/src/dist/收据等支撑 | Git 原件保留；未来 npm 不再携带 artifacts，改为现有入口显式恢复 | 仅 --yes 恢复后联网；固定提交 HTTPS、字节数/SHA-256；--from/--offline 支持完整本地来源与旧完整包；不解包/执行下载内容 |
| 未来发布收据 | 生成到 `docs/releases/records/<version>/`，一份版本 MD 作为入口，保留全部失败/成功机器凭据 | 旧平铺收据/manifest 导入继续兼容，新格式不能覆盖旧路径；路径/摘要/防碰撞与 CI 分类同步 |

“归档”在本轮指历史生命周期、折叠阅读及安装包排除，**不**删除旧 Git 原件、重写历史或批量改目录。除兼容导航所需的 sharing-results 外，不用一堆新存根替换旧文件。冻结资料的修正仍须追加记录。

### 顺序、依赖与验收

唯一实施状态在上方 L 清单。以下是验收合同，不是第二份进度表。

| 顺序 | 交付与前提 | 必须实际验证 |
| --- | --- | --- |
| L1 | review 本补充后，保存起点清单/哈希；补 bench 根入口、contrib 缺失三项；扩展已有 docs 检查测试 | 8/8 与实际 manifest 一致；遗漏/虚构条目被拒绝；评测数据/冻结资源不变；修改的链接/锚点检查 |
| L2（L1 后） | 合并分享操作、兼容旧入口/锚点及登记；现有计划长记录折叠；定义 npm source-only 维护资料范围 | 旧/新入口均可导航；原示例与语义保留；canonical 唯一、无断链；README 镜像不漂移；本轮不新增 Markdown 文件 |
| L3（L2 后） | 先验证固定源含所有 support，再 TDD 恢复器，最后排除 artifact/维护资料；不能先删包内容再补恢复 | 1,579 非 inline support 已逐项对固定 Git 对象核验（0 差异），其中仅 497 个不同内容；网络缺失支撑按 SHA 复用下载、有限并发，局部损坏拒绝；预览零写/联网；超时/404/坏 hash/碰撞/别名失败不残留；实际 npm pack 与隔离安装/CLI/Skill 文档通过；在线及零网络 --from 恢复 19+1,583 全部字节 |
| L4（L3 后） | 更新收据导出/导入兼容及现有指南/CI targeted 分类；最终冻结本轮输入并整合 review | 新版本收据集中目录且引用摘要正确；旧 bundle 仍可导入，碰撞/越界失败；records 只接受已知新增文件，未知改动 full；18 个历史 replay +1 export-index 原程序在恢复工作区通过；npm test；实际包文件/体积前后对比和保护哈希；计划逐项记结果，A/F 旧待办不勾选 |

本轮“实际包”是源候选，不能称为 npm 0.13.1 已发布新内容。单选 --id 保持现有 shared support 全量恢复语义，不擅自改变 cohort/目录；不在本轮另建 v2 catalog、对象存储、LFS、服务或下载后执行器。

### 取舍、恢复与风险

推荐沿用现有 catalog 与固定 Git 文件来源；已核验其 1,579 非 inline support 的路径/大小/SHA 全部存在于固定提交，无须先发布新远端资产。相比仅补导航，它能降低未来安装负担；相比新建对象存储/压缩 bundle，它不增加托管与发布权限。代价是首次完整恢复会请求多个固定文件，因此同 SHA 内容复用且并发有界；所有输出仍按原路径写入独立目录。预览明确网络/本地来源，普通安装/CLI 不联网。

最可能失败的三点：漏掉 runtime/许可导致旧 replay 失败；源或缓存损坏被当成功；文档重排让旧入口/摘要引用失效。分别以完整 catalog+历史原程序、逐项 hash/无 fallback 掩盖损坏、原锚点与新旧 manifest 测试提前发现。任一必需检查失败就不切换候选包内容；用本轮起点副本恢复打包配置，不动 Git 原件/旧发布。本轮没有删除原件或发布动作，不存在不可逆迁移；已发布旧包始终保留原样。

npm 子目录忽略规则依据 [npm files 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files)，固定提交含义依据 [GitHub 永久链接说明](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files)。不把网络上线结果计入常规离线 CI；在线验收只在本轮显式只读验证中记录。

## 文档分工、登记与生命周期

### 各类文档的职责

保持 [docs/README](../README.md) 为读者入口，[README](../../README.md)为英文产品入口，[中文 README](../../README.zh-CN.md)逐节镜像。先改内容职责和链接，不默认移动全部文件到新目录；现有路径本身是兼容面。

| 类别 | 当前归属及目标 | 负责什么 | 不重复维护什么 |
| --- | --- | --- | --- |
| 入门教程 | first-real-eval、reproducible-offline-example | 一条能完成的入门路径、预期结果和支出边界 | 全量参数、详细统计推导和实时项目进度 |
| 操作指南 | bench authoring、case management、installed/config、self-test、sharing/replay | 某个目标的前提、步骤、错误恢复和验收 | 另一份参考合同的完整字段/枚举/规则 |
| 参考合同 | metrics、eval-component、eval-planning、costs、verifier、bench/schema 文档 | 字段、默认值、拒绝条件、统计及证据语义 | 实施流水、未经验证的未来能力 |
| 能力与版本 | eval-agent-preflight 能力表；对应 release record | 能力表写当前 source 能力和验证范围；release record 写已发布事实 | 指南中复制整张能力表，或用 package 版本冒充未发布改动 |
| 架构与原理 | architecture 及必要的主题页 | 系统边界、模块职责、运行场景、质量要求、风险和接口导航 | 任务完成百分比、重复 CLI 用法 |
| 计划 | docs/plans 下活动计划 | 范围、依赖、授权、唯一任务清单、验收索引和必要决策提案 | 已落地后仍充当当前实现说明的第二权威来源 |
| 架构决策 | docs/decisions/README.md 与编号 ADR；A1 已交付，当前均为 proposed | 一项重要决定的背景、状态、决定、后果、替代关系 | 一项功能的全部过程日志；普通实现选择无须逐个 ADR |
| 验证记录 | 当前计划的简短证据表；过长时另存 docs/plans/verification/ 下的明确记录 | 被测输入/提交或工作区指纹、环境、命令、范围、结果与未执行项 | 新的任务清单；仅存在于 /tmp 的日志不能是唯一长期验收依据 |
| 历史与证据 | metrics-history、dated evidence、完成计划、release recipes/receipts | 保留当时结论和复现输入，指出适用时期和替代入口 | 静默改成当前行为、回写授权或修订原始结果 |

同一主题只有一个规范说明；其他页可保留必要摘要和链接，不要求文字零重复。主题权威与事实依据分开：例如能力表是说明入口，matrix/reader 和离线样本是依据；schema 定义机器结构，叙述合同解释语义，任何一方不一致都要修复，不能用“唯一来源”掩盖冲突。

### D1：登记接口与维护规则

D1 已创建[治理规则](../documentation-governance.md)、[文档登记](../../scripts/documentation-policy.json)及[有效](../examples/documentation-policy.valid.json)/[无效](../examples/documentation-policy.invalid.json)样例。具体字段规则、角色和检查词汇以治理页为维护入口；下列保留本计划的接口约束，D3 按实际交付样例实现门禁。登记文件只供开发检查使用，不成为 CLI runtime 依赖。使用 JSON 和已有工具，不引入 YAML/frontmatter 解析器。

登记外层固定 `schemaVersion: 1`：`documents` 是文档对象数组，`topics` 是以稳定主题 ID 为键的对象，`exclusions` 是排除对象数组；拒绝未知字段和重复路径。每个文档记录 `path`、`kind`、`lifecycle`、`audience`、`owner`、`scope`、`topics`、`checks`；可选 `supersededBy`。其中：

- `path` 是仓库相对的公共文件路径；唯一、存在、不得含绝对路径或越界 realpath。登记文件不接受指向 runs、私有实验室的项。
- `kind` 取 tutorial/how-to/reference/explanation/plan/decision/record/index；`lifecycle` 取 maintained/historical/frozen。活动计划为 maintained；已完成计划经人工确认归 historical，不依据文件日期自动判断。
- `owner` 是仓库维护角色，如 evaluation、bench-authoring、agent-integration、distribution、development，不虚构个人或审批人；角色职责在治理页定义。
- `audience` 是非空去重数组，值为 user/maintainer/contributor；`scope` 是非空的 `{ kind, ref }` 数组，kind 为 source/released/protocol/historical，ref 明确到 `working-tree`、实际版本、协议 ID/冻结日期或历史记录基线。一个文档可有多个明确范围，不能用 reviewedAt 日期证明内容最新。
- 文档的 `topics`、`checks` 是去重 ID 数组，非权威的导航/记录允许空数组；`supersededBy` 是可选仓库文档路径，目标必须存在且无替代环。`topics` 表每项包含 `canonical`（文档路径及可选 fragment）、`sources`（非空实现/数据路径数组）、`schemas`、`dependents` 和 `checks` 数组；主题必有 canonical 和至少一个稳定检查 ID，禁止只登记一个没有依据的标题。发布、研究和任务进度分别指向自身记录，不复制数字。
- `checks` 是受控检查 ID，不是可执行 shell 文本；脚本中静态映射已审查的检查。不存在的 ID、空依据、重复权威和悬空替代关系均失败。

`exclusions` 每项包含 `path`（明确文件或目录前缀）、`reason`、`owner`、`verification`（对应专用检查 ID 或人工复核理由）。机器可执行断言与人工复核项在检查报告中区分；人工项不能输出为机器已证明。D1 同时交付字段/枚举说明和一份最小有效/无效样例；D3 用这些样例验证实际 parser，而不是复制另一份宽松解析器。

登记覆盖公共根入口、docs 下 Markdown、bundled bench/profile/driver 的说明和维护索引。发现范围采用明确公共根，不递归私有/本地输出。frozen artifacts 和发布凭据目录按已有目录/清单整体登记为排除项，保留其专用哈希校验；不为 1,000 多份冻结副本逐个加维护元数据。其他遗漏需给出具体路径/窄前缀和理由，禁止 `docs/**` 等掩盖新增文档的排除规则。

**D1 落地细化（不改变覆盖验收）：** 根目录发现所有公共 Markdown 文件，不只固定六个旧入口；bench 的 prompts/fixtures/ground-truth 和 synthetic target 按实际窄目录排除。`docs/releases/` 混有 maintained 发布指南，因此不整目录忽略：8 份已发布 Markdown 页逐一登记 frozen，非 Markdown 收据/recipe 继续由原发布/包规则保护。旧 Codex 来源审计按其 2026-09-29 范围登记 historical，当前来源合同指向 selectable setup 和实际清单。样例仅演示形状/引用，不能冒充全仓登记；无效样例仅将 owner 改成未知角色。自动 parser、发现门禁和 CI 接线仍待 D3。

验收：调查时已有的 20 份计划、本计划及后续新增公共文档均逐一分类，读者可直接找到活动计划；每个权威主题能定位说明、事实依据和检查。D1 用清单人工核对登记覆盖及有效/无效样例；新增未登记文档自动失败的门禁由 D3 实现并验收，不将尚未写出的检查计作 D1 已完成。角色维护和人工 review 不能被“元数据齐全”代替。

### D2：内容分工与迁移

建立主题→权威页→受影响指南→检查的映射。优先处理规划/确认、预算、能力、统计/采用、模型身份、self-test、结论范围、replay 和发布状态。规划页拥有规划合同，metrics 拥有测量语义，组件页拥有机器 request/result；重叠处链接到对应规则而不是保留不同版本。

目录和路线图保留导航/方向，阶段进度链接到对应活动计划；发布状态链接对应 release record，研究累计量链接 study index。将治理页、ADR 索引和本计划加入开发导航，但不在多个入口复制 0/9。CONTRIBUTING 链接治理规则；AGENTS 如需增加入口只引用同一规则，不复制第二套正文。旧计划只补必要的关联/替代说明，长流水不批量搬走或改写。

为本轮实际调整的页面生成旧路径/fragment→新权威位置迁移表。优先原路径重写职责，旧锚点用显式 alias 保留；确需新路径时，旧文件保留有用的兼容入口及原 fragment，不用 HTML 跳转或依赖文档站。保留英文/中文 README 的逐节对应、原代码块/演示/徽章；不要为了重排文档删除既有命令示例或旧锚点。

后续新计划沿用本文件的状态、唯一清单、依赖、接口/兼容、验收和 review 格式。完成时将当前行为与接口说明同步到权威页，长期取舍沉淀为 accepted ADR；计划保留原始事实、结果索引和剩余项。待实施的设计不能写成现有能力。若拆分长验证记录，路径、摘要和指纹需由计划链接，现有引用继续可达。

验收：入门、bench 自检、受限评测、读报告、portable replay、开发接手六条读者路径可从入口完成导航；每条路径有适用版本和能力边界。对实际修改页核对全文含义及旧锚点集合，不以链接检查代替事实 review。F7/F5 前只同步当前事实；F7/F5 后完成 claims/measurementScope 的权威映射并对 D2 收尾。

此前当前事实部分的交付、旧入口→权威位置映射、六条路径、检查和 review 见 [D2 阶段记录](#d2-当前事实实施与-review-记录2026-10-22)，保留当时未完成整项的事实。本轮最终映射、检查及结论见 [D2 收尾记录](#d2-最终收尾与-review-记录2026-10-22)，不缩减上面的验收。

### D3：文档门禁与 CI

扩展现有 `check-docs.mjs` 和测试，保留现有本地链接/anchor/realpath 安全检查，并消费登记文件。独立执行与 npm test 覆盖 maintained 文档及活动计划；historical/frozen 不强制补新元数据到原文，也不因历史版本字样失败。检查 historical 的登记/替代目标；本次确有修改的历史记录仍走已有变更记录检查，冻结证据继续由专用校验保护。

新增确定性检查：登记覆盖、主题唯一性/目标 anchor、维护角色、稳定检查 ID、旧锚点迁移表、README 双语结构、已有发布文档版本规则。代码→文档影响映射用于产生明确 review 提示；机器可检查的枚举、schema 样例和已实现能力用真实 parser/离线适配器测试，不靠到处匹配字符串或“代码改了必须碰一个 md”来证明一致。

保留 CI 的 full/records/minimum 区分。文档/架构策略、检查脚本、源码、新目录及未知变更仍走 full；已知纯计划/发布记录可保持 records。records 检查复用同一登记与链接逻辑，继续显式纳入变更记录，不能只验证登记而遗漏原文件。兼容 job 强制 full 和最低 Node job 的 minimum 语义不变。

验收反例至少包括：未登记新文档、重复 canonical、错误 fragment、错误替代关系、未知检查 ID、目录 alias 越界、错误版本样例、双语漂移、records 路径漏检及未知 CI 变更。每个失败应指出文件/主题和修复方向。外部链接按来源人工核对，不把联网可用性变成离线测试依赖，也不宣称能自动证明所有叙述事实。

**D3 本轮实现细化（保持上述验收）：** 现有 `check-docs.mjs` 保留链接/anchor 工具出口，增加供独立命令、测试和 CI 共用的 `checkDocumentation(root, options)`；登记解析/发现放在开发脚本中，最小有效/无效样例用同一 parser、关闭全仓覆盖后验证。角色/check ID 由静态受控目录解释，不执行登记文本。独立执行与 npm test 默认检查登记、全部 maintained 文档、README 结构与既有发布规则；历史/frozen 仅校验登记引用，明确变更的历史正文另纳入本轮检查。

变更输入为路径/状态列表；Git 基线适配器只读取已登记或公共未排除 Markdown 的旧正文，比较每个旧路径/fragment，输出 retained/missing 迁移表。原路径页面和 alias 均可保留锚点；删除旧路径或锚点会失败并提示恢复兼容入口。独立命令支持显式 `--base <commit SHA>`，CI 在已知基线上自动比较；未提供/不可获得基线时如实报告未比较，不伪称兼容通过。源码/schema/canonical/指南变更映射为主题、owner、受影响页及受控检查位置的人工 review 提示，不以是否碰过 md 决定通过。

CI full 与 records 在执行各自既有测试前复用上述检查并保留结构化文档回执；records 仍显式包含变更的计划/发布记录，未知变更走 full。Node compatibility 强制 full 和 minimum 仅证明最低运行面的含义不变；本轮验证 workflow 接线/离线适配器，不触发远端 CI，也不据此完成原 F3。

## 目标模块边界与接口

### A1：架构合同与决策记录

A1 已交付[架构总入口](../architecture.md)、[边界与迁移职责](../architecture-boundaries.md)、[运行场景与质量要求](../architecture-runtime.md)、[当前/目标接口](../architecture-interfaces.md)和 [ADR 索引](../decisions/README.md)。当前源码事实与 proposed 目标分别标注，下面保留经批准的目标职责；这不是代码迁移或 A5 门禁已经完成的声明。

扩展现有 architecture 页面为简短总入口，按需要链接主题页。至少写清：CLI/Agent CLI/API/verifier/用户配置的系统边界；下表模块关系；paired、trigger、calibration、自检、saved report/replay 的运行场景；预算和中断后的证据状态；实际 npm 包与固定 replay runtime 的部署边界。使用必要的上下文/组件/时序视图，不要求套满 C4 或 arc42 的所有章节。

| 层/角色 | 主要归属（新增路径为提案） | 允许依赖 | 禁止事项 |
| --- | --- | --- | --- |
| 合同与数据类型 | types、eval-contract 的纯解析部分；拟新增 eval-options/计划类型 | 同层合同和纯校验 | 导入 commands、执行器实例、文件写入、子进程、环境探测 |
| 纯计算 | stats、costs、eval-efficiency 及抽出的汇总 | 合同及其他纯计算 | 文件/网络/进程 I/O、隐式时钟/随机源、执行流程 |
| I/O 基础机制 | 拟新增 process、verifier、trial-workspace；hash、kill-tree 等现有工具 | 合同、纯计算、Node 内置模块 | 回调高层 runner/trigger/session/commands；擅自执行 Agent |
| Agent 集成 | agents/matrix、executors、MCP probe | 合同、I/O 机制、必要纯解析 | 导入 experiment runner、应用服务或 commands；硬编码另一份能力矩阵 |
| 证据读取与审计 | manifests、receipts、input snapshot、audit/replay 及对应纯解析 | 合同、纯计算、I/O/verifier | 为读报告调用模型，导入命令 renderer 或实验执行入口 |
| 执行编排 | runner、trigger、session、judge 执行 | 合同、计算、I/O、集成及证据写入 | 拥有 CLI 展示、反向依赖命令；把不同模式混成一个统计结论 |
| 应用服务 | 拟新增 eval-planning、eval-service、bench-authoring | 必要下层机制及编排，依赖通过接口注入 | commands、console/进程退出、交互确认、另造公开 schema |
| 入口与展示 | cli、commands；保留的兼容包装 | 应用接口、合同、纯展示；composition 可组装具体 adapters | 复制领域判定、用另一次命令执行构造计划、隐藏预算/确认 |
| 安装事务旁路 | install/constants、install/transaction | 保留当前独立边界及必要基础机制 | 因评测重构重写实际用户配置事务；MCP probe 只归 Agent 集成，不重复登记角色 |

这是目标角色，不等于整个 harness 都应纯函数化。混合模块先标出现状和待拆职责，再迁移；不能把存在 fs 的 parser 直接标成纯层后豁免。当前和目标依赖分开记录，A5 为所有活动模块登记归属。类型合同允许被上层使用，但不能从 commands 借用共享业务类型。

已建立三个 proposed ADR：[0001 文档权威与历史边界](../decisions/0001-document-authority-and-history.md)、[0002 分层与共享执行机制](../decisions/0002-layering-and-shared-execution.md)、[0003 规划/确认/执行分离](../decisions/0003-plan-confirm-execute-separation.md)。格式包含编号、标题、Context、Decision、Status、Consequences、替代关系和验证位置；状态取 proposed/accepted/superseded。授权编写只产生 proposed，相关阶段获授权并交付后再按实际标 accepted；不批量虚构历史决定或替代理由。D1 已交付的规则/登记仍有效，不因 ADR 的完整长期方案尚为 proposed 而撤销。

质量场景至少覆盖：新增 mode/能力后需改哪些层；预览零执行；计划失配前置拒绝；中断保留调用和成本；旧数据无法补出的信息保持未知；synthetic 永不授权采用；脱离 checkout 的包/portable replay；新增越界依赖被检查拒绝。每个场景指向下列阶段和真实测试位置，不用抽象“高内聚”代替验收。

### A2：共享执行机制

拟新增 `src/harness/process.ts`、`verifier.ts`、`trial-workspace.ts`，按职责从 runner 抽取；纯 judge/task 汇总放到独立模块，避免 audit 为汇总导入 runner。实际文件名在 A1 review 固定，若需更改则同步路径映射、兼容出口和测试，不改变本阶段责任。

**A2 实施接口细化（2026-10-22，范围与验收不变）：** 三个机制模块沿用上述路径。`createTrialWorkspace(fixtureDir, runDir, { removeMockMarker })` 只做原碰撞检查、复制与显式 marker 清理，`applyOverlay`/`gitInit`/`engagementError` 同属 workspace；Skill/native-diff 安装继续复用现有独立机制，条件和顺序留在各自编排。`trial-summary.ts` 持有 TrialOutcome 数据类型及 `summarizeExperiment(taskOutcomes, readObservations?)`，返回原 tasks/overall，不读文件或执行调用。`judge-protocol.ts` 持有 judge 数据/错误类、顺序、解析、显式 nonce 的提示词构造和汇总；旧 judge 提示词出口保留随机 nonce 默认的薄包装。`trigger-summary.ts` 持有 trigger task/metrics 类型和纯汇总，防止 single-arm audit 为计算导入 trigger 执行。旧 runner/judge/trigger 出口保留同一实现或包装，所有已知非测试底层消费者迁入新路径；A5 的通用类型/副作用门禁仍待办。

- process 保留无 shell 的 argv、cwd/env 处理、输出上限、deadline、退出结果、树终止及信号排空；`runProcess(command, args, cwd, timeoutMs)` 当前是 runner 私有 helper，提取为内部机制时保留行为，不虚构旧公开导出。`ProcessResult` 和 `runVerifier` 等真实既有出口保留兼容委托/类型导出。
- verifier 复用同一 parseCommand、timeout、runtime error 分类及输出解释；`runVerifier(benchDir, command, runDir, timeoutSeconds?)`、`verifierFailure`/日志接口保持，不能为抽象统一改错误含义。
- workspace 只负责 fixture 的临时复制、碰撞/路径保护、原有 Git 与 overlay/Skill delivery 等机制；输入由调用方明确指定。paired/trigger 的目录、marker 清理、安装策略及提示词构造保持各自规则，不能在共享层默认猜测 condition。
- runner/trigger 保留各自 trial 和 experiment 编排；bench check、calibration、control executor、audit 等改用基础模块。执行器无需为了运行 oracle 导入整个 runner；证据读取也不应为 verifier 或纯汇总引入实验编排。

验收：相关 verifier/timeout/interruption/runner/trigger/bench-check/self-test/audit 回归通过；验证非零退出、启动失败、超时、输出截断、SIGINT/SIGTERM 和后代进程退出。生成 verifier 仍可独立执行，不能带入源仓库模块路径。旧导出只是同一实现的薄包装，不保留第二套执行代码；错误类必须重导出同一实例以保留 instanceof。

### A3：独立规划与执行应用接口

已新增 `src/harness/eval-planning.ts`、`eval-service.ts` 及中立选项/计划类型；CLI、request component、self-test 共同调用。证据读入、audit/assessment 编排已迁入 `eval-read-service.ts`，原 report component 保留委托，renderer 留在命令层；复用现有单一 parser，不另造一套报告解析器。保留既有 `runEval`、`prepareEvalPlan`、`runEvalCli`、`reportEvalComponent` 导出及兼容调用方式。新增接口为内部接口，不是新 CLI/JSON 字段或公开 SDK 承诺。

**A3 实施接口细化（2026-10-22，验收不变）：** 中立 `harness/eval-options.ts` 承载原选项、preview/reviewed plan 和报告选项。`eval-planning.ts` 暴露只读 resolve、显式 implementation digest 的纯 build 和共享准备/确认；内部 context 用带判别的 envelope 承载原字段，旧 context 仍逐字参与哈希、不增加持久化字段。`eval-service.ts` 承载 paired/trigger 执行和普通/request 编排，展示通过入口回调，不导入 commands 或交互确认。`eval-read-service.ts` 及单臂 reader/replay 承载现有读取/审计，命令 renderer 保留；case preflight/错误类移至中立层并从旧路径重导出同一实例。calibration 使用 `harness/calibration-service.ts` 的独立 resolve/build/execute 合同，保留原 planSha256、baseline 与检查顺序，不套 paired 外层。self-test 保留 controls/确认外层，suite 直接调用上述应用接口。所有旧出口均为适配/同实例 re-export，迁移不新增 CLI/schema/policy 字段。

迁移前已捕获六类 eval 计划、calibration 和四个 self-test suite 的真实旧 preview/JSON 顺序（零调用），在固定 implementation digest 下用于独立前后对照；新 runtime 文件全部纳入真实 implementation 指纹。此对照是本地重构验证，不能代替真实 CLI 或远端 CI 验收。

| 内部操作 | 输入与输出 | 副作用与边界 |
| --- | --- | --- |
| resolveEvalInputs | 选项、明确注入的 fs/env/descriptor 等依赖 → 已解析的 bench/target/executor 描述与指纹 | 只读解析和既有 preflight；不得创建 run、执行 verifier/oracle/judge/model，不新增探测行为 |
| buildEvalPlan | 解析后的数据、implementation 指纹、版本化的内部 context → 既有 preview/reviewed plan | 确定性构造；不读文件、不探测环境、不展示、不确认、不执行。context 的 self-test/component 信息不得丢失 |
| executeEvalPlan | 已复核计划、解析输入及实际 executor/session 依赖 → 既有 manifest/停止结果 | 启动前重查输入、环境、计划和碰撞；按既有 case gate、预算、session 和模式 dispatch，全部调用留账 |
| render/confirm/report | 计划/结果 → 原英文输出、确认或公开报告 | 文本/JSON 适配位于 commands；report 服务读取/审计证据，renderer 不触发新执行 |

保留旧 context 对象接受能力及其哈希绑定；新调用使用判别明确的内部类型，但不突然拒绝原来有效的包装调用。不增加新的 native-plan 状态枚举或序列化字段；内部 planned/ready/running/stopped 等生命周期只用于解释已有状态，并逐一映射到现有输出，避免新造一套持久化状态机。

paired、installed、revision、rules/MCP、trigger、calibration、request 和 self-test 均列入入口清单。原本独立的单臂计划仍保留合同，不强行改为 paired。实现时可分适配器逐次迁移，但阶段完成要求所有受影响入口明确走共享应用接口或记录有事实依据的独立合同；不允许以遗留独立规划副本结项。

验收：不再通过 runEval 的 dry-run 分支或截取展示文本获得计划。相同已解析输入和固定 implementation 指纹下，迁移前后公开 plan 字段、JSON 序列化顺序及 sha256 相同；改输入/策略/context 后摘要变化，旧确认被拒绝且零调用。真实代码移动引起 implementation 指纹变化是预期，必须重新预览确认，不能为维持旧 hash 排除新 runtime 文件。

同时覆盖预览零写入/零执行、先 gate 后调用、预算耗尽、调用失败、中断前缀、未知成本、角色身份和 synthetic 不可采用；F7 measurementScope 与拒答位置保持。旧 `runEval` 的返回类型和 dry-run null 行为通过包装保留。测试中 fs/env/时钟/执行器均注入或临时隔离，不读真实 Agent 配置验证新逻辑。

### A4：bench authoring 应用接口

**2026-10-24 计划复核与执行细化（验收不缩减）：** 顺序为 A4→A5→V1→F8；F3/F5 已在 main 实际验收，原“待验收”叙述只保留于历史记录，活动架构说明同步纠正。A4 将现有模板/source/draft 实现迁入中立归属并保留原导出；prepare 返回操作、路径/内容、源和目标指纹、展示/确认所需信息，显式 drafting 在确认后单独调用，apply 不做交互。编辑/移除继续只改注册。补充源/目标在确认期间漂移与 init 碰撞的离线反例，不改变公开 flag/输出 schema、200 文件/1 MiB 等限制。

A5 在完整模块归属上分别检查 emitted runtime 和源码类型图；遗留混合模块按真实职责登记，不伪称纯计算。只允许逐边、带 owner/reason/removal task 的遗留例外，A2–A4 迁移范围零例外；直接语法及别名效果检查有明确覆盖边界。V1 与 F8 共用最终工作树已执行的检查，不为两个计划重复跑同一全套；F8 另外逐项核对原 21 个问题的已交付/研究/限制归属。

风险反推：确认后的源/目标变化会写入非预期内容，以重新指纹/碰撞检查前置拒绝；机械搬移可能丢模板/兼容导出，以原行为回归及实际包独立 authoring 验收；分层策略可能误把混合模块当纯或漏掉别名，以完整归属、逐边债务和 AST 正反例验收。公共文件与冻结原件 SHA 基线存于 `/private/tmp/skillfit-a4-f8-location.txt` 指向的临时目录；既有偶发历史失败记录保留，最终按原程序复跑并如实记录。

拟新增 `src/harness/bench-authoring.ts`，复用已有 source capture、drafting、management、模板及校验实现；命令层只解析参数、展示准备结果、确认并调服务。不要再新建一个与现有 `bench-source`/`bench-manage` 重复的实现。

内部接口为 `prepareBenchChange(options, dependencies) → prepared change` 和 `applyBenchChange(prepared, dependencies) → result`。prepared change 包含操作种类、任务/来源、待写路径和内容、现有目标指纹、诊断和授权所需的信息；只读 prepare 默认不写入、不调用模型。原有显式 drafting/decompose 是单独的有预算步骤，不能藏进 prepare 或普通 add。

实际内部调用形状为 `prepareBenchChange(request, dependencies)` 和 `applyBenchChange(prepared)`：clock/写入适配依赖随 prepare 参数进入私有事务，apply 不再接收第二套依赖；这些是受信任的内部适配，不是新增公开 SDK 或持久化授权协议。准备结果中的写入预览是副本，不能改变私有事务字节。此实现细化保持上述只读准备、显式 drafting、复核/碰撞/备份/回滚验收，不增加公开 CLI/schema 字段。

apply 在确认后复核源/目标和碰撞，再沿用现有 staging、备份、逐文件应用、验证和失败回滚。新建产物没有原内容，只保留新目标碰撞保护；已有文件按原命令规则备份/验证/回滚，不套用实际用户配置 writer 的额外流程。保留 init/add/freeze/from-commit/edit/remove/list/show 的现有参数、默认值、退出码、任务顺序与 F7 的显式 schema/claim 规则。200 文件/1 MiB、Git parent/submodule/test-only/test-less、许可证和 provenance、保护 verifier/test 的规则原样保留。

验收：有输出前 preview 无写入/无模型；源变化、越界、目标碰撞、写入/验证失败可观察且原文件恢复；已有 bench 同 schema/任务/字节行为一致。F7 schema 1/2、claims 的输入拒绝和冻结传递全部保留。实际 npm 包中生成的 starter、捕获的 case 和 verifier 独立可用，不从源码 checkout 补模板。

### A5：可执行模块边界

**A4 实施结果（2026-10-24）：** `harness/bench-authoring.ts` 为 prepare/apply 入口；source、draft、command template 各保留单一中立实现，原 commands 路径保留同实例 re-export/薄适配。init 确认期目标碰撞、freeze 源漂移分别先复现失败后修复；新增三项公共接口检查覆盖只读准备、预览内容不能改变实际写入、直接 apply 的源/目标复核与管理操作 fixture 漂移。drafting 的并发目标拒绝最初漏写 summary，92 项整合回归定位并修正统一收尾，付费尝试的成本/身份/停止收据断言保留。

实际候选包 1,172 files / 1,226,162 B 压缩 / 5,728,398 B 展开，离线安装在 checkout 外，command/schema 2 starter、bench check、freeze、edit/remove、文件保留及原备份验证通过；临时验收脚本初次误用 CLI flags，按实际帮助纠正后复用同一包通过，未为脚本修改 CLI。后续仅删除未使用 import、整理局部缩进/变量名，最终包指纹在 V1 重建验收。记录为 `/private/tmp/skillfit-a4-{init-red.log,source-red.log,regression-final.log,package.log}`；包目录由 `/private/tmp/skillfit-a4-package-location.txt` 指向。

**A5 实施结果（2026-10-24）：** 策略逐一登记 107 个模块，runtime 与 erased source type 分开检查。类型注解可指向下层 DTO 所在模块，不加载其实现；仍禁止下层反向指向 entry/application/execution。Session DTO、case preflight 数据及纯 Agent/trigger 保存元数据解析已有中立归属；旧导出与错误类身份保留。原 request parser 为读取 timeout 而导入具体 CLI executor 的边已移除，只保留 `eval-contract -> agents` 的既有矩阵 ID 校验债务；具体理由、owner、解除任务在策略及架构说明中，不允许新边借用。

新反例分别先失败后通过：runtime/type 角色、直接语法/immutable alias/destructuring/lexical shadow 的效果、动态目标声明与有限性、同名动态表达式的独立作用域、失效/迁移范围例外、畸形策略。还修正 `Date(0)` 函数调用仍读取当前时钟的漏检；显式 `new Date(input)` 保持允许。最终 15/15 门禁、170/170 周边回归通过，纯模板/注释/合法类型环不误报。静态检查不承诺覆盖可变别名、反射或任意回调副作用；所列正反例及范围写入权威架构说明。1,685 个受保护历史/发布文件 SHA 全部保持；输出为 `/private/tmp/skillfit-a5-{regression.log,schema-green.log,full-baseline.json,docs.json}`，最终综合结果由 V1 记录。

拟新增 `scripts/architecture-policy.json`，扩展现有 AST 检查，不引入 runtime 依赖。策略包含 schemaVersion、文件/窄前缀归属、每层允许依赖及临时 exceptions；新增活动模块必须能唯一归属，未知/重叠归属失败。计划基线的 85 个模块及此后新增的全部活动模块均登记角色；不要求为历史 replay 副本登记活动角色。

运行时图继续从新构建 dist 检查静态 import/re-export、字面量动态 import 和循环；源 TypeScript 图另外检查类型合同的方向，明确区分 type-only 与运行时依赖，不能把类型边误报成运行时循环。对迁移范围内新增的不可静态枚举动态 import，须显式声明有限目标并验证，不能静默忽略。纯计算层再检查禁止的 Node I/O 模块和环境/时钟/随机源读取，应用服务检查 console 输出、process.exit 和交互确认依赖，避免“没有越界 import 但直接执行了入口行为”绕过规则；所列直接语法及别名正反例明确覆盖，不声称静态分析能证明任意代码绝无副作用。

迁移阶段允许对已确认的遗留边逐条登记 from/to、runtime/type、理由、维护角色和解除任务；禁止整个 harness/commands 的宽泛豁免。A2–A4 迁移范围在结项时无剩余例外。其他真实遗留项明确列债务且不声称全部分层完成；新增同类边不能借旧例外通过。

验收反例包括：executor→runner、evidence→execution、基础机制→应用、core→commands、纯计算→fs/env、共享类型→command 类型、re-export/动态 import 越界、未知模块、失效例外。正例证明合法类型引用、字符串/注释/模板正文及生成 verifier 不误报。npm test/CI 执行时先 build，禁止用陈旧 dist 的绿灯验收源码变更；保留原安装事务边界检查。

## 迁移与兼容方案

| 兼容面 | 必须保持的内容 | 验证与可接受的差异 |
| --- | --- | --- |
| CLI | 已文档化命令、flag、默认、stdout/stderr、退出码、确认与 dry-run | 正常/非法组合/中断的观察测试；仅此计划不新增或删除公开选项 |
| 内部既有入口 | commands/runner 的现有导出、签名、错误类身份和 import 路径 | 同一实现的 re-export/薄包装；迁移所有已知活动消费者，兼容文件仍打包 |
| 计划与哈希 | preview/native plan/result 的结构、关键顺序、policy/bench/target 哈希规则、context 绑定 | 固定实现指纹比对 plan；真实实现变化重新确认，不接受上次 plan-sha 绕过 |
| 统计/成本/身份 | F1/F2/F4/F6 已验收语义及 F7 新合同 | 不合并不同模式、错误样本或 unknown；描述性单臂/合成证据仍不授权采用 |
| 旧数据 | 既有 schema、legacy 未记录字段、停止/不完整 receipts 和错误诊断 | 读旧数据保持原行为；缺失身份/claims 不补造；篡改、数值异常仍拒绝 |
| portable replay | 原始 receipts/inputs 和包自带 runtime，源计划绑定及覆盖 | 新包迁移后删除原输入再 reproduce；旧包按其 pinned runtime/环境复现，不换成今天的实现 |
| 发布包/生成 bundle | requiredFiles、全部新 runtime 依赖、六份 retained tests、离线资源和独立加载 | 实际 npm pack/解包及 relocated bundle；4 MiB/19 MiB 上限不自动上调，不改固定版本 recipe |
| 文档链接 | 现有路径、旧 heading/显式 anchor、双语对应、示例/演示和徽章 | 迁移前集合及映射逐项核对；新增主题用链接汇入，不改历史记录来消除旧版本 |
| 历史保护 | dated evidence、19 原归档、catalog 支撑字节、原 release receipts/recipes、固定 replay | 建立公共受保护文件 SHA 清单前后比对；不读取私有实验室，不执行清理整树命令 |

每阶段从实际工作树建立差异基线，包括已修改和未跟踪的公共文件；在已有 F 改动上增量实施，不能 reset/stash 整批用户工作。只撤回本阶段明确拥有的改动，不靠全树回滚。文件移动采用先提取单一实现、保留旧出口、迁移调用方、验证包路径的顺序；未证明安全前不删兼容层。

## V1：验收矩阵与执行要求

以下为现有命令；生产门禁策略、待提取的应用接口和拟新增测试名仍为待实施产物，不能把设计描述为当前已可执行。已交付登记/ADR 不证明 D3 或 A2–A5 实现。纯文档阶段检查事实/链接/旧锚点/差异，变更可执行示例时验证对应离线路径；代码/build 阶段交付前必须运行 npm test。

```bash
npm test
node scripts/check-docs.mjs
node scripts/check-architecture.mjs
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node scripts/check-contrib-benches.mjs
```

| 验收面 | 输入与执行证据 | 通过条件 |
| --- | --- | --- |
| 文档治理 | 公共登记、权威主题、活动/历史区别、六条读者路径；docs/release-docs/ci-scope 检查 | 无未解释遗漏、重复权威和新断链；旧锚点/双语/版本规则保持；事实人工 review 单列 |
| 分层 | 构建后的 runtime 图、源码类型/禁止能力规则、全部模块归属和正反例 | 新边界确有失败用例，迁移范围零豁免；不是只看总违规数 |
| 规划与模式 | 普通/request/self-test；inject/installed/revision/rules/MCP、trigger/calibration；固定输入/实现指纹 | 计划结构和哈希规则一致；错误/不支持目标前置拒绝；零执行预览可观察 |
| 执行安全 | process/verifier、timeout、descendants、SIGINT/SIGTERM、budget、碰撞、调用失败 | 调用顺序/上限、收据和成本不丢失；退出码与停止/不完整状态保持 |
| F 回归 | stats、trigger-detection、model-identity、bench-self-test、F7 schema/claim 及请求/报告 | 无语义漂移；mock 正向/有害/零效果/错误对照及 synthetic 拒绝采用全部保留 |
| authoring | init/add/from-commit/freeze/draft/manage 的临时 repo/bench；失败注入 | 预览/写入/备份/回滚、来源/体积限制和 schema 1/2 行为保持 |
| 证据与旧数据 | paired/calibration/trigger、judge、完整/停止/缺失/篡改及旧元数据样本 | 原有效性、诊断、未知值和采用结果一致；原始 evidence 不改 |
| 独立分发 | 按 package-contents 既有流程实际离线 npm pack、解包执行；导出迁移/移走原输入；生成 bundle | 无 checkout 仍可用，所需新模块和兼容出口齐全，包策略及 frozen 输入完整 |

重点复用现有 runner/verifier/interruption、eval-plan/CLI/component/preflight、bench-manage/source/draft、report/audit/export/replay、self-test、docs/architecture/package/CI 范围测试。按风险补新行为和越界反例，不写只镜像函数实现或按行数断言的测试。架构移动涉及源码位置断言时改为验证真实合同，不降低原判定要求。

比较结果只规范化明确的临时路径、注入的时间和实际 implementation 指纹差异；逐项注明来源，不整体删除 hash/error/reasons/cost 字段。对 pinned evidence 和导出包完整性校验不做规范化。相同输入和固定 clocks/digest 的比对优先使用可控离线样本，避免把非确定性差异当成可忽略列表无限扩张。

最终记录包含：确切输入（提交或未提交工作区指纹）、环境、targeted/全量通过失败跳过数、命令/记录路径、独立包/replay 结果、旧数据及冻结文件保护、最终 diff review 和未执行项。关键摘要需可长期追溯，临时日志是补充，不提交私有运行资料。通过后无新改动或未解风险不重复全套测试。

V1 完成仅代表本计划所列本地整改验收完成，不代表远端 CI、F8、发布或第三方复现完成。本计划任何必需项未实现/未验证时保持相应阶段及整体未完成，不能以“已有测试绿灯”或“F8 会再检查”代替本阶段证据。F3 已按原条件在所属计划完成；本轮新改动的远端 CI、提交/推送与发布未执行，旧 CI 不替代新源验收。

### V1 最终验收记录（2026-10-24）

以下是提交前的本地 V1 快照；后续提交/PR 与新源 CI 的实际结果只在上方 N1–N3 更新，不把旧结果改写成新运行。

基线 `496ad13077a9dc5beb1b3aa25a26b115849868c1`，环境 macOS/arm64、Node 24.21.0；本轮 46 个修改/新增文件，未新增 Markdown。排除两份自记录计划后的 44 文件 overlay 指纹为 `5f30a178d4fbc6cf2bcd5e13bf85aa46cfc79400ed464696780f373419a1b153`（排序 path/SHA-256 JSON 再 SHA-256；完整 manifest 在临时验证目录）。代码改变会改变实际 implementation 指纹，未省略新模块来保留旧 plan digest。

| 验收面 | 当前实际结果 | 范围与复用理由 |
| --- | --- | --- |
| 全量/架构 | 最终 npm test **1079/1079**，0 fail/skip/cancel，64.099s；107 source/runtime 唯一归属、0 违规；最终架构正反例 16/16 | full CI 通过既有 npm test 入口执行真实策略；本轮只验证本地接线，不声称新源远端 CI 已跑 |
| Node 能力 | 本地 22.13.0、22.14.0、26.0.0 的 authoring/环境/trigger 周边各 **172/172**，各自 LRU bench check 成功；最后策略收紧后三版本各另通过 **16/16** 架构检查；22.0.0 minimum **3/3** | 每个进程使用对应真实 Node 和 PATH，全部 darwin/arm64；不将 targeted/minimum 写成全量或 Linux/Windows 认证。原 F3 跨 OS 结果仍只属于其原提交 |
| 用户入口/合同 | 两核心 bench 加八个 contrib，**10/10** 实际 CLI check 成功；原公开 flags、schema 1/2、claims、错误/预算/信号/成本等由最终全量覆盖 | AST 对照 35 个迁移声明与原实现相同；12 个旧出口直接引用同一函数/类/常量，错误类身份保持 |
| 实际独立包 | **1,174 files / 1,227,266 B 压缩 / 5,731,706 B 展开**；SHA-256 `1645bb01394703b112e9646fdced1bef889fcea84004a4f8fff80f9efe347040`；实际离线安装、starter/schema 2/freeze/edit/remove、半写入故障回滚通过 | package/npm release check、5 文档、30 retained regressions、7 foundation groups、5 个迁移/移走原输入 portable replay 通过；版本字段仍 0.13.1，是未发布候选；包上限未改 |
| 冻结恢复/历史 | 当前包 preview 0 写入、offline networkAttempts=0，**19 archives +1,583 support** 路径/大小/SHA 全验证，碰撞拒绝；本轮原 18 replay +1 export-index **19/19** 成功 | 首份 V1 包已执行全部原程序；最终包仅 authoring JS 和架构 owner 文字不同，catalog/fetcher/历史 recipe、全部 19+1,583 输入逐字节相同，因此复用同输入的历史执行，未重复 18 程序或 HTTPS 下载；原偶发失败的未定位记录保留，不声称其根因已解决 |
| 文档/原件 | 70 页/122 旧锚点检查通过，README/Skill 等 5 个实际包文档通过；**1,685** 受保护 evidence/release 文件 0 字节差异，catalog 固定源 `56b4dc68e115475e197c6510c9cb2235a5ad2c62` 保持 | ADR 按实际交付改 accepted，旧路径/anchors 保留；无新增计划、无冻结修订、无私有实验室读取 |
| 整合 review | OCR 34 默认项及 12 过滤项全部纳入，**46/46**，0 skip；两项发现修复后无剩余阻断 | init 首个写入抛错时需先记录文件所有权，改为 wx fd 后半写入故障注入及实际包负例通过；策略移除 execution/application→安装事务的过宽允许，真实反例先红后绿；例外 owner 复用现有 evaluation 角色 |

初轮全量 1077/1077、首项修复后 1078/1078 的结果保留；最终 1079/1079 才是当前输入。首次 fault hook 尚未接线的红测只证明 hook 未使用，另以旧写入顺序负向对照实际复现“partial 文件遗留”，最终 fd 所有权策略通过同一断言。三个 EOF 空行清理后重新构建，所有 dist 文件与全量受测字节完全相同；未为纯格式变化重跑全套。

最终包相对首份 V1 包只改变 `dist/harness/bench-authoring.js` 和 `docs/architecture-boundaries.md`，已重新执行当前包的所有受影响独立入口和 feature/document/archive 验收；未把前一候选 SHA 冒充最终包。原 feature/history recipes 保持原字节。

临时收据位置：`/private/tmp/skillfit-v1-npm-test-delivery.log`、`/private/tmp/skillfit-v1-node-results-final.json`、`/private/tmp/skillfit-v1-final-policy-nodes.json`、`/private/tmp/skillfit-v1-{docs.json,architecture-final.log,extraction-proof.json,package-final.log}`；包目录由 `/private/tmp/skillfit-v1-package-location.txt` 指向，完整基线/review/manifest 由 `/private/tmp/skillfit-a4-f8-location.txt` 指向。长期必要输入、环境、计数、SHA 和限制均在本表，无需依赖临时目录才能理解结论。

## Review、风险与执行边界

主要风险是哈希/序列化兼容、错误类身份、单臂与 paired 混用、共享机制改变中断行为、生成模板误带依赖、包内遗漏新模块，以及把历史文档当成当前说明重写。对应保护分别落在 A3、A2/A3、A1/A3、A2、A2/A4、V1、D1/D2，不另用泛泛的“保持兼容”收尾。

每阶段实施前确认依赖和最终输入，先形成小步可审查 diff；失败保留诊断并修复所属阶段，不删断言、不改样本凑通过、不降低包上限或门槛。新增公共合同需求先回到 F 计划或新提案，不能由临时 exception 默许。用户未授权的真实调用、用户配置写入、外部消息、推送和发布继续不执行。

本计划采用仓库已有“状态→唯一清单→依赖→接口/兼容→验收→实际记录”的格式。下列资料用于设计取舍，不作为需要全部套用的强制标准：[Diátaxis 文档分工](https://diataxis.fr/)、[Google 文档维护建议](https://google.github.io/styleguide/docguide/best_practices.html)、[arc42 架构文档要素](https://arc42.org/overview/)、[C4 的适度视图](https://c4model.com/diagrams)、[ADR 原始方法](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)、[持续架构检查](https://www.thoughtworks.com/insights/articles/fitness-function-driven-development)。

## 计划复核与实际验证记录

<details>
<summary>此前已交付阶段的完整记录（展开）</summary>

| 日期/工作 | 实际结果 | 未完成项及含义 |
| --- | --- | --- |
| 2026-10-22 调查复核 | 已核对仓库指令、F 阶段真实状态、旧整改范围、docs 默认检查与 CI records 补充、规划/执行/authoring 实现、package/replay 约束 | 只形成计划依据，不计任何 D/A/V 阶段完成 |
| 2026-10-22 变更保护基线 | 写入本文件前记录已有 118 个修改/未跟踪公共文件的 SHA-256，保存在 `/private/tmp/skillfit-governance-plan-before.json` | 用于核对本轮只新增计划；不把 HEAD 当成全部源码输入 |
| 2026-10-22 计划 review | 逐项复核职责、硬依赖与推荐顺序、接口/兼容、正反例、实施授权和 F 完成判定；修正文档登记形状不明确、D1 误承担 D3 自动门禁验收、调查时计划数量口径、MCP 重复角色、report 应用职责和新建产物备份范围；明确 F5 内容同步与 F3/F5 整项验收的区别，避免隐含远端阻塞或依赖环 | 所有新接口、策略文件和 ADR 仍为提案；F 计划正文及进度未改 |
| 2026-10-22 本地检查 | 文档/release-docs 测试 11/11，0 fail/skip/cancel；默认 47 文档及显式加入本计划后的 48 文档均无断链；85 个编译 runtime 模块在现有规则下 0 违规；新增文件 diff 格式通过 | 文档检查不能证明所有事实，现有架构门禁不代表目标分层已实施；本轮未改可执行示例 |
| 2026-10-22 完成边界 | 仅编写和 review 本计划；已有 118 个修改/未跟踪公共文件按保护快照核对，只有本计划为本轮新增 | 未运行 npm test/bench/实际打包验收：本轮仅新增计划；未做真实调用、用户配置修改、远端 CI、提交/推送/发布；实施仍为 0/9 |
| 2026-10-22 D1 范围与保护 | 本轮授权仅 D1；变更前对 2,877 个已跟踪/未跟踪公共文件建立 SHA-256 基线，来源为实际工作区；任务期间重新读取并保留 AGENTS.md 的外部 Skill routing 更新，本轮不编辑该文件 | F 计划与所有业务源码保持；不把新增登记当成 D2 迁移或 D3 自动门禁 |
| 2026-10-22 D1 覆盖与权威 | 交付治理页和 JSON 登记；449 份公共 Markdown = 120 份登记 + 329 份窄排除数据/副本，无未归属项；6 角色、29 检查 ID、45 权威主题、30 排除项；62 maintained/23 historical/35 frozen；21 份计划逐一分类，2 份 maintained | historical 不等于任务全部完成；文档登记不代表检查实际已执行。发布页逐一 frozen 登记，不用整个 releases 目录豁免 |
| 2026-10-22 D1 首次核对与修复 | 临时覆盖断言发现 `benches/_self-test/example/prompts/` 下 2 份嵌套提示词未归属；补对应窄排除后同一断言通过。人工 review 又修正旧 Codex 来源审计的历史范围、README 用户受众及历史计划维护角色 | 保留失败原因；未降级断言或扩大到 bench 总目录排除，未修改原始评测输入 |
| 2026-10-22 D1 规则/样例 | 临时只读核对字段/枚举、公共 realpath、权威 anchor、来源/schema、反向依赖、替代关系及排除范围；3 份 JSON 的语法与重复 key 检查通过；最小有效样例形状/引用通过，无效样例仅因 owner=`unassigned` 被拒绝，恢复该字段与有效样例完全相同 | 临时校验不是生产 parser/CI；最小样例不要求覆盖整个仓库，D3 仍需用真实 parser 验证样例及覆盖反例 |
| 2026-10-22 D1 检查/review | 文档、release-docs、archive 完整性相关检查 12/12，0 fail/skip/cancel；默认文档与全部 maintained 登记合计 64 份本地链接/anchor 通过；新文件和计划差异格式核对通过；已逐项复核 D1 目标、具体字段、主题依据、生命周期和授权边界 | 未改可执行示例、业务/检查脚本或 CI；未跑 npm test/bench/实际包：本阶段为规则和数据交付。D1 完成，其他 8 阶段及 F 原有待办不计完成 |
| 2026-10-22 D1 差异检查复核 | 格式核对包装最初将新文件 `git diff --no-index --check` 的 exit 1 误判为错误；负向对照又纠正了尾空白退出码的假设。本机正常差异为 exit 1/空诊断，故意尾空白为 exit 3/明确诊断；按实际语义核对后，4 个新文件及计划共 5/5 无格式问题 | 修正的是临时核对包装，未忽略实际诊断或修改业务断言；正反例均保留实际结果 |

D1 本地核对摘要位于 `/private/tmp/skillfit-d1-validation.json`，临时核对脚本为 `/private/tmp/skillfit-d1-validate.mjs`，公共文件保护基线为 `/private/tmp/skillfit-d1-before.json`；长期验收以本表计数、交付的登记/治理规则、样例和实际 diff 为索引，不依赖临时文件存在。首轮遗漏和修复均保留在表中。D3 在自己的实施范围内接通真实解析、回归和 CI，本轮不提前编写该生产门禁。

### A1 实施与 review 记录（2026-10-22）

| 验收项 | 实际交付和检查 | 结论边界 |
| --- | --- | --- |
| 当前输入与保护 | 变更前对 2,881 个已跟踪/未跟踪公共文件建立 SHA-256 基线，另存原 architecture 正文/6 个锚点和 D1 登记；沿用含已交付 F 改动的实际工作树 | 不用 HEAD 或发布版 0.13.1 冒充当前源码；业务代码、F 计划、冻结 evidence/发布记录及 D1 样例保持原字节 |
| 系统/模块边界 | 架构入口保留原章节，链接 3 个职责明确的主题页；边界页列 CLI/Agent CLI/API/verifier/配置/MCP、当前组件图、目标角色及 B1–B6 迁移/风险/验收映射 | 当前依赖和 proposed 目标分别展示；85 活动源码模块的分类/副作用门禁仍待 A5，不把零循环当成目标架构完成 |
| 运行与质量场景 | 描述 paired、installed/revision、trigger、calibration、self-test、saved report、replay/export，列现有文件/status、预算/失败/信号后的证据和 npm/native/portable/历史部署边界；Q1–Q8 指向实际测试及后续阶段 | 3 个 Mermaid 上下文/组件/时序视图按结构/源码人工核对，未安装渲染器或生成图像；不新增持久化状态枚举，不把单臂/合成结果当采用证据 |
| 真实接口与兼容 | 逐项核对 16 个现有函数出口、Executor/session/error/helper 合同；明确原 positional 文本执行可不带外部 SHA，JSON/request 要求匹配计划，单臂/自检各守原合同；目标 resolve/build/execute/read/prepare/apply 仅为内部设计 | review 修正 `runProcess` 为现有私有 helper，避免虚构旧公开接口；A2 细化保留真实出口和相同行为；未增加统一确认要求或公开字段 |
| Replay 区分 | review 对照当前 report component 和 portableReproducer 源码，区分当前 reader/audit 使用当前实现与 standalone reproduce 使用 pinned CLI | 两条路径均不调用模型，但通过其中之一不能冒充另一个已验证；本轮未执行实际 replay/打包 |
| ADR 与登记 | 新增 0001/0002/0003 及索引，全部 proposed、无虚构替代/采纳；登记新增 7 文档/4 权威主题，127 登记 + 329 窄排除 = 456 公共 Markdown，无遗漏；原登记的角色/范围和排除保持 | 权威页、来源/schema、反向依赖、角色/检查 ID 及最小有效/无效样例核对通过；D3 生产 parser/CI 仍未实现 |
| 最终相关检查 | 文档/release-docs/architecture/archive 检查 17/17，0 fail/skip/cancel；默认与全部 maintained 登记合计 71 文档无本地断链；6 个旧架构锚点全部保留；85 模块源码内存转译导入视图符合现有检查规则，15 条图示 runtime 边逐条核对通过 | 内存导入核对不是完整类型构建，现有 compiled-runtime 检查也不是 A5；文档登记校验仍为临时只读核对，未改检查脚本 |
| 最终 review 与范围 | 复核任务→视图/接口/ADR→源码/测试位置；新文件与差异格式、真实代码与历史数据保护；只改 architecture/governance/登记/本计划并新增 7 个架构/ADR Markdown 文件 | A1 完成，总进度 2/9；无业务代码/可执行示例变化，未跑 npm test/bench/实际包与 live 验证；F1–F8 待办未变，无用户配置修改、提交、推送、远端 CI、合并或发布 |

A1 临时保护/核对摘要为 `/private/tmp/skillfit-a1-before.json`、`/private/tmp/skillfit-a1-review.json` 和 `/private/tmp/skillfit-a1-validation.json`；本表及实际文档、登记和 diff 提供长期验收索引。下一阶段不得依据本表将 proposed 目标或未执行的质量回归记为实现通过。

### D2 当前事实实施与 review 记录（2026-10-22）

本轮仅交付当前已实现事实的文档整理，不将 D2 整项标为完成。维持总进度 2/9；最终 claims/measurementScope、bench schema 1/2 与目标拒答的权威映射和语义 review 仍依赖 F7 本地实现及 F5 最终同步。原 F 计划及所有其他计划的字节和待办保持原样。

本轮保留所有旧路径与章节，不发生物理文件迁移；下表是旧内容入口→当前权威职责的兼容映射。旧 fragment 仍在原页可用，摘要链接到权威规则，不使用跳转或依赖文档站。完整主题、依据/schema、受影响指南和检查关系由[登记表](../../scripts/documentation-policy.json)维护；本表记录此次变化，不成为第二份活动权威清单。

| 本轮调整的旧路径/fragment | 当前权威位置及实际整理 |
| --- | --- |
| [README / Run from source](../../README.md#run-from-source)、[Build your own cases](../../README.md#build-your-own-cases)、[Roadmap](../../README.md#roadmap)、[Contributing](../../README.md#contributing) | 保留产品入口、代码块和演示；能力/身份细则分别链接能力表/metrics，补 source-only self-test 与治理/架构/ADR/活动计划导航 |
| [中文 README / 从源码运行](../../README.zh-CN.md#从源码运行)、[创建自己的 case](../../README.zh-CN.md#创建自己的-case)、[Roadmap](../../README.zh-CN.md#roadmap)、[贡献](../../README.zh-CN.md#贡献) | 与英文逐节对应；新增文字/链接同步，原命令、示例、徽章不变 |
| [Contributing / Ground rules](../../CONTRIBUTING.md#ground-rules) | 链接[治理规则](../documentation-governance.md)、架构/ADR；维护规则不复制到 AGENTS，文档检查与代码/build 验收区分 |
| [文档目录 / Start here](../README.md#start-here)、[Develop and maintain](../README.md#develop-and-maintain)、[Historical work records](../README.md#historical-work-records) | 目录拥有读者导航；进度回到两份活动计划，历史计划回到生命周期表；增加 source/released 边界，不再抄 F 阶段完成描述 |
| [治理 / Document responsibilities](../documentation-governance.md#document-responsibilities) | 说明规划、语义、字段、成本各自分工和登记查询路径；明确待实现 claims/scope 不属于活动合同 |
| [组件 / Input and execution](../eval-component.md#input-and-execution)、[Adoption policy](../eval-component.md#adoption-policy)、[An explicit efficiency objective](../eval-component.md#an-explicit-efficiency-objective) | 机器字段/政策配置留本页；预算/确认指向 planning，共享采用语义和 bootstrap 指向 metrics；研究累计量/停止流水改为[研究索引](../skill-evaluation-evidence.md)链接 |
| [成本 / Evaluation cost accounting](../eval-costs.md#evaluation-cost-accounting) | 保留 populations/coverage 权威；预算格式链接 planning，停止语义链接 metrics，适配器支持链接能力表 |
| [规划 / Preview and confirm](../eval-planning.md#preview-and-confirm)、[Stop rules and results](../eval-planning.md#stop-rules-and-results) | 预算完整字段/合法范围集中到预览合同；停止摘要链接 metrics/costs；保留文本执行可省外部 SHA 与 JSON/request 必须确认的区别 |
| [流程 / A bounded, inspectable experiment](../experiment-workflow.md#a-bounded-inspectable-experiment) | 保留步骤、原命令和独有的冻结/环境边界说明；版本追加前言改为合同导航，加入独立 synthetic 检查路径 |
| [入门 / Choose a claim](../first-real-eval.md#1-choose-a-claim-and-a-bench)、[Check the bench](../first-real-eval.md#2-check-the-bench-and-the-environment) | 补充 self-test 路径、严格 source-only 边界和 schema 1 当前结论限制；不能把源码命令机械替换成 npm 0.13.1 |
| [路线图 / Goal and current position](../growth-roadmap-2026-10.md#goal-and-current-position)、[Delivery order](../growth-roadmap-2026-10.md#delivery-order)、[Later decisions](../growth-roadmap-2026-10.md#later-decisions) | 拥有方向和历史交付背景；删除 F 进度副本，链接实际计划；原 PR/测试记录保留并标明历史范围，发布状态仍由版本记录拥有 |
| [Metrics / Verdict protocol](../metrics.md#verdict-protocol-what-effective-means)、[Costs, budgets and stopping](../metrics.md#costs-budgets-and-stopping) | 从组件收拢[共享采用门槛](../metrics.md#shared-adoption-gates)的语义；预算格式交给 planning；原公式、数值修正、旧 alias、身份与限制均保留 |
| [Self-test / Results, costs and replay](../bench-self-test.md#results-costs-and-replay) | 保留 F6 合同与命令；补到 portable package 合同的直接链接，suite 与 wrapper 的区别不变 |
| [本计划 / 当前执行状态](#当前执行状态)、[D2 内容分工与迁移](#d2内容分工与迁移) | 记录本轮部分交付、迁移映射、review 和剩余依赖；修正仍称 ADR 待新增的活动描述，不改 A1 历史验收 |

六条读者路径已按最终链接逐段检查，并人工核对版本/结论边界。路径可达是导航验收，不冒充执行了模型、self-test 或 portable replay。

| 路径 | 从入口到合同/操作 | 适用边界 |
| --- | --- | --- |
| 入门 | README → [文档目录](../README.md) → [首次评测](../first-real-eval.md) → [case authoring](../bench-authoring.md) | npm 0.13.1 与 source 构建明确区分；教学任务先替换，预览不是支出授权 |
| Bench 自检 | 文档目录 → [self-test](../bench-self-test.md) → [portable package](../replay-packages.md) | 当前 source protocol 1；固定 benefit/harm/null/error 对照；synthetic 永不授权采用，不证明真实任务的 power 或 native discovery |
| 受限评测 | 文档目录 → [bounded workflow](../experiment-workflow.md) → [planning](../eval-planning.md) → [component](../eval-component.md) | 共享 controls 自 0.11.0；JSON/request 精确确认，文本兼容不变；严格预算须有完整读数能力 |
| 读报告 | 文档目录 → [reports](../evaluation-reports.md) → [metrics](../metrics.md) → [component](../eval-component.md) | 0.10.1/0.11.0 读取基础与 current-source 修正分别标明；unknown、单臂、stopped 与采用不得混用 |
| Portable replay | 文档目录 → [packages](../replay-packages.md) → [sealed inputs](../evaluation-input-snapshots.md) | 当前 reader 与包自带 pinned runtime 区分；旧包按自身版本/输入；零新模型观测，可信 verifier 仍会执行 |
| 开发接手 | 文档目录 → [Contributing](../../CONTRIBUTING.md) → [governance](../documentation-governance.md) → [ADR index](../decisions/README.md) → [architecture](../architecture.md) | 当前实现与 proposed 目标分开；登记/check ID 不等于运行回执，D3/A2–A5 不能从文档交付推定完成 |

| 验收项 | 实际交付/检查 | Review 与结论边界 |
| --- | --- | --- |
| 输入和差异范围 | Node 24.21.0/macOS arm64；变更前实际公共工作树 2,888 文件 SHA-256 基线；本轮只改 14 Markdown + 1 登记 JSON，无增删文件，其余 2,873 文件原字节保留 | 业务源码、可执行脚本、AGENTS、原 F 计划、其他计划及冻结 evidence/release/replay 输入无变化 |
| 权威与登记 | 49→52 主题；细分 `spending-controls`、`adoption-policy`、`conclusion-limits`，链接实现/schema、依赖指南与受控 checks；原文档类别/角色/scope/lifecycle 和 30 窄排除项不变 | 仍是 127 登记 + 329 排除 = 456 公共 Markdown；69 maintained/23 historical/35 frozen、21 计划/2 maintained；登记不是 D3 生产门禁 |
| 兼容检查 | 14 修改 Markdown 的 145 个旧锚点、47 原 fenced 代码/示例块全部保留；README 22 组章节层级、原标题、徽章、演示和图像引用不变，新增文字/链接双语对应；六条路径逐段可达 | 未删除旧命令、移动路径或重写历史证据；只做链接/结构检查不能证明全部叙述事实，另做下述语义 review |
| 文档与完整性检查 | `node --test scripts/check-docs.test.mjs scripts/check-release-docs.test.mjs scripts/check-archives.test.mjs dist/docs.test.js`：23/23，0 fail/skip/cancel；默认入口与全部 maintained 登记合计 71 文档本地链接/anchor 无错误 | 其中现有 compiled docs 测试读取本轮最终 Markdown/阈值来源；不是全量业务回归或 live 验证 |
| 规则与样例检查 | 登记/有效样例/无效样例 3 份 JSON 语法与重复 key 检查通过；形状/引用/反向依赖/权威 fragment/角色/check 词汇和覆盖核对通过；有效样例通过，无效样例按未知 owner 拒绝；15 文件格式检查通过 | 使用临时只读核对，不提交新 checker，不提前实现 D3；最小样例仍不代表全仓覆盖 |
| 最终语义 review | 逐页对照迁移前后正文，预算格式对照 eval-budget，政策默认/范围对照 eval-contract，共享采用门槛对照 eval-acceptance；保留普通文本可无外部 SHA、JSON/request 强制确认、CLI 读数差异、legacy unknown、synthetic/单臂限制和 pinned replay 解释 | review 修正入门“统一替换 npm 前缀”的歧义、组件将公开模型声明称为 attestation 的旧表述，以及活动计划仍称 ADR 未交付的陈述；未改变统计/采用/哈希规则 |
| 完成和未执行 | D2 当前事实部分完成并 review；D2 整项未勾选，总进度仍 2/9，F7/F5 后重新核对最终 claims/scope 合同与双语入口 | 本轮未改可执行示例，未跑 npm test/bench/实际 pack/replay 或真实模型/Agent 调用；无用户配置修改、远端 CI、提交、推送、合并或发布；F1–F8/R 待办保持 |

基线清单摘要为 `d15de892a21fe29eec80de3f453128bf1e151f5d57f2102e1e94e534dbe38749`（按路径排序，对每个 `path + NUL + fileSHA256 + LF` 拼接后再 SHA-256）。临时核对摘要为 `/private/tmp/skillfit-d2-review.json`、`/private/tmp/skillfit-d2-validation.json`；保护快照 `/private/tmp/skillfit-d2-before.json` 与原登记副本的 SHA 核对提供本轮比较输入。本节的范围、映射、具体命令与结果是长期验收索引，不依赖临时文件继续存在；没有将本轮证据写入冻结报告。

### D3 实施与 review 记录（2026-10-22）

D3 已交付。独立命令、测试与 CI 共用 [checkDocumentation](../../scripts/check-docs.mjs)，[登记解析/发现](../../scripts/documentation-registry.mjs)与[Markdown 结构工具](../../scripts/documentation-markdown.mjs)各自保持单一实现。既有 `markdownAnchors`、`markdownLinks`、`inspectDocumentation` 出口保留；`documentationFiles` 现在返回登记中的 maintained 页。开发脚本不成为 npm CLI 的运行时依赖。[治理规则](../documentation-governance.md#executable-checks-and-ci)说明当前接口、输出和限制，计划只保存本轮验收及未完成事项。

| 验收项 | 执行与结果 | 证明范围/限制 |
| --- | --- | --- |
| 实际输入与保护 | Node 24.21.0，macOS arm64，沿用含 F1–F6 WIP 的工作区；变更前 2,888 公共文件 SHA-256 快照，摘要 `e3d65e47b220c28aca9738602d5d088c0b4448760f830762f94060eb467cf179`（同 D2 清单算法） | D3 自身为 8 个既有文件修改 + 3 个新开发脚本/测试，无业务 src、F 计划、其他计划、冻结 evidence/release/replay 或 workflow 文件改动。期间 AGENTS.md 的外部 routing 更新已单独重新读取并保留，不归为本轮编辑 |
| 登记/发现 | 实际 schema 1 parser 验证外层/字段/枚举/重复 JSON key、路径/case/realpath、topic authority/fragment、来源/schema、反向依赖、角色/check ID、替代环和窄排除；目录直接发现未跟踪 Markdown | 127 登记、52 主题、69 maintained、23 historical、35 frozen、30 排除项保持；不递归扫描排除数据，也不声称重新数清其中全部 Markdown；人工排除责任保留为 not-machine-verified |
| 正反例 | [registry tests](../../scripts/documentation-registry.test.mjs)用真实 parser 接受 D1 最小有效样例、拒绝仅 owner 不同的无效样例；覆盖未知版本/字段/角色/check、重复 canonical key/路径、坏 fragment、缺来源、反向关系、替代环、宽/空/重叠排除、未登记新页、私有/外部/依赖/冻结输入 alias；不同主题共用 canonical 页为合法正例 | 失败提示有路径/主题和修复方向；对 source/schema 的显式事实引用与文档发现区分，不把检查 ID 当 shell 或执行许可 |
| 共享入口 | 默认独立命令和 npm test 覆盖全部 69 maintained 页及活动计划，检查本地链接/anchor、双语 README 章节/代码演示/徽章和既有发布命令 pin；显式 changed historical/frozen 页追加正文检查 | historical/frozen 不强制改写正文或套当前版本词；冻结完整性仍由原专用检查负责。记录登记不等于所有历史正文均已重审 |
| 影响与旧锚点 | 代码/schema/canonical/dependent/固定测试路径映射输出 authority、owner、dependents、checks，均标 review-required；未知路径列 unmappedChanges；已知基线逐旧 path/fragment 生成 retained/missing，删除旧页也有明细 | 不采用“代码改了必须碰 md”伪断言；无基线明确未比较，显式请求的坏基线硬失败，未知 CI diff 则 full/unavailable；不声称检查能证明全部 prose、外链事实或翻译准确性 |
| CI 接线 | `ci-scope.mjs test` 在 full/records 原测试前生成 `documentation.json`，失败回执保留并阻止后续测试启动；records 继续检查实际 changed Markdown、JSON/收据引用；records 固定测试集增加 registry 回归 | 现有 workflow 已调用该入口，无需改 job 名或 YAML。policy/check/source/new/unknown 路径走 full；compat 强制 full、minimum 的有限含义保持，未触发远端 CI |
| 本地入口实测 | `node scripts/check-docs.mjs`/`--json`：69 页，0 errors；`--base 8087e05173d673610d05090a52dd548e00c17517 --json`：70 页（含本次显式变更历史页），168 旧锚点 retained、0 errors；真实本地 full/records 文档适配器回执均成功 | 比较对象是确切 HEAD 到当前 WIP，非虚构已提交 D3 或发布版；full 案例比较 scripts README 的 5 锚点，新增计划 records 案例无旧锚点。不是 GitHub Actions 验收回执 |
| 相关检查 | `node --test scripts/check-docs.test.mjs scripts/documentation-registry.test.mjs scripts/check-release-docs.test.mjs scripts/ci-scope.test.mjs`：32/32，0 fail/skip/cancel | 覆盖 standalone alias/JSON、结构与版本漂移、旧锚点保留/丢失、impact 仅提示、records 正反例、未知合法 SHA 回退、回执/退出码和 CI 范围 |
| 全量测试 | 首轮沙箱内 npm test：1017/1018，唯一失败为既有离线 MCP HTTP 测试监听 127.0.0.1 的 EPERM。获准允许回环监听后：1018/1018；review 修复后最终重新 npm test：1019/1019，0 fail/skip/cancel | 未改断言或跳过失败；第一轮为执行环境限制。最终 npm test 包含重新 build、实际 offline pack/包内 controls、原完整业务回归及冻结归档检查；无真实模型/Agent 调用 |
| 完成范围 | 文档/业务/历史保护、格式和旧锚点按最终输入核对；D3 勾选，当前总进度 3/9 | D2 最终收尾、A2–A5/V1 和全部 F1–F8/R 待办不改；未单独重跑 live bench、Node/三 OS 远端 CI、发布/推送/合并，也未将本轮 pack 测试视为发布 |

#### Standards

按 `code-review` 技能冻结实际任务 patch、未跟踪文件正文、HEAD/WIP 归属、规范及哈希，由独立 reviewer 检查仓库规范。首轮无硬性违例，有 1 项非阻断重复逻辑建议：排除项 matcher 应共用；已收拢为 `documentationExcluded`。最终复核剩余 0 项规范/气味问题，未新增 runtime 依赖、业务行为或历史写入。

#### Spec

另一独立 reviewer 对照 D1/D3 接口和本轮用户要求。首轮发现 3 项，均先补失败回归再修复：语法合法但不可用的基线不能阻断 full 回退；resolved alias 不能绕过冻结输入排除或指向 src 等非文档根；旧页删除也要返回每个 fragment 的 missing 行。最终复核剩余 0 项需求缺漏或越界。两轴分开记录，不以测试绿灯替代需求复核。

最终完整测试日志为 `/private/tmp/skillfit-d3-npm-test-reviewed.log`；早期沙箱失败与 review 前通过日志分别保留在 `skillfit-d3-npm-test-first.log`、`skillfit-d3-npm-test-final.log`。Git 基线检查/默认检查摘要为 `/private/tmp/skillfit-d3-anchors-final.json`、`/private/tmp/skillfit-d3-docs-final.json`。实际 full/records 本地适配器回执位于 `/private/tmp/skillfit-d3-ci-full-ofymsmd0/documentation.json` 和 `/private/tmp/skillfit-d3-ci-records-9shs0g76/documentation.json`。Review 最终交付 manifest/patch 位于 `/private/tmp/skillfit-d3-review-verified-3nnl37tl/`；本节及实际交付源码/测试提供长期索引，不将临时日志作为唯一验收依据。

### A2 实施与 review 记录（2026-10-22）

A2 已交付；总进度为 4/9。当前职责与兼容接口以[边界](../architecture-boundaries.md#current-component-dependencies)、[接口](../architecture-interfaces.md#current-internal-ports)及 [ADR 0002](../decisions/0002-layering-and-shared-execution.md) 为说明入口，本节保存本轮范围、证据和未执行项。完整分层/通用门禁决策仍为 proposed，不能由 A2 推定 A3–A5 或 D2/F 阶段完成。

| 验收项 | 实际交付/执行结果 | 证明范围与限制 |
| --- | --- | --- |
| 输入与保护 | HEAD `8087e05173d673610d05090a52dd548e00c17517`，Node 24.21.0/macOS arm64，package 0.13.1；实际起点含 F1–F6、D1/A1/D2 当前事实部分和 D3 的 WIP。对 2,891 公共文件建立 SHA-256 基线，摘要 `f49bbde52fb391035a76d24e910427c4d9f143a21407cc82fbc0aef90be1e14f`（同 D2 清单算法） | 本轮 21 个既有文件修改 + 11 个新增文件（6 runtime + 5 tests），其余 2,870 公共文件原字节保留；F 计划/其他计划、AGENTS、冻结 evidence/原归档、固定发布 recipe/收据/replay 输入、workflow、依赖 manifest/lockfile 不改 |
| 机制职责 | 从 runner 提取 [process](../../src/harness/process.ts)、[verifier](../../src/harness/verifier.ts)、[trial-workspace](../../src/harness/trial-workspace.ts)；runner/trigger 保留各自编排、目录、提示词和安装顺序；control oracle、bench check/命令、审计和 saved single-arm report 使用底层入口 | 不统一 paired/trigger 的 marker、安装/竞争和统计规则；不引入运行时依赖、DI 框架或新的模型/CLI 选项；未实现 A3/A4 应用服务 |
| 纯计算 | [trial-summary](../../src/harness/trial-summary.ts) 逐任务对齐并丢弃错误 pair，输出原 tasks/overall；[judge-protocol](../../src/harness/judge-protocol.ts) 收拢显式 nonce 构造、顺序/解析/receipt/error 类型和汇总；[trigger-summary](../../src/harness/trigger-summary.ts) 保持单臂分母/unknown | 不读文件、不调用 executor；成本 attempts 与 paired populations 不混合，partial 不冒充 final，单臂不升级为 paired；原公式/阈值、未知身份/成本及 synthetic 限制不变 |
| 兼容出口 | runner 的 ProcessResult、TrialOutcome、runVerifier/verifierFailure/verifierLogFor、gitInit/engagementError、summarizeJudge 保留原路径和类型；judge 的 JudgePairFailure/数据/解析/顺序及 trigger 的类型/triggerMetrics 重导出同一实现 | 错误类 instanceof 和函数 identity 由测试验证；旧 buildJudgePrompt 可省 nonce，兼容包装保留原随机默认；内部 process 暴露不虚构 runner 原有公开 runProcess |
| 迁移对照 | 32 个提取函数/错误类 body 与起点 AST 正文逐字相同；固定 clocks、5 任务 × 2 臂 × 2 trial 的 20 份收据和完整 manifest，在规范化后序列化字节（含字段顺序）相同，包含 partial 错误及其被丢弃成功搭档 | 仅省 manifest.createdAt 及替换 receipt.runDir 的临时 runsRoot 前缀；不删除 costs/errors/reasons/hash/身份字段。此样本为 paired inject，其他模式由下述回归证明，不能称作所有未来输入的形式证明 |
| 执行与生成安全 | 新增无 shell argv/cwd/env/stdin EOF、启动失败/非零退出、8 MiB 输出上限、超时后 descendant heartbeat 停止和 pipe 排空；已有 SIGINT/SIGTERM、case deadline、oracle、installed/revision、budget、engagement、judge 失败收据与 synthetic 错误对照回归通过 | process/verifier 行为仍为原单一实现；输出上限/退出码/基础设施错误分类不改；生成 verifier 及六份 retained tests 继续在实际安装包脱离 checkout 执行 |
| 相关测试 | `node --test dist/harness/{process,shared-execution,judge-protocol,trial-summary,trigger-summary,verifier,verifier-timeout,runner,trigger,judge,judge-accounting,installed-skill,skill-revision}.test.js dist/commands/{eval-interruption,bench-self-test,bench-self-test-interruption,eval-report,eval-model-identity,eval-export}.test.js scripts/check-architecture.test.mjs`：222/222；review 修复后 architecture、eval-report/evaluation-report/eval-model-identity/eval-export-modes、trigger-summary：65/65；docs/registry/release-docs/ci-scope：32/32，均 0 fail/skip/cancel | 每个新模块先观察缺失接口的编译失败再接通；输出上限等补充用例是原行为的特征验证。报告遗漏先由真实依赖链回归复现再修复，没有降低断言或跳过测试 |
| 完整测试与分发 | 首轮及 review 修复后重新 `npm test` 均 1028/1028，0 fail/skip/cancel，含重新 build、实际离线 npm pack/安装后 controls、原完整业务回归与冻结归档检查。package requiredFiles 新增 6 runtime，4 MiB/19 MiB 上限和保留测试清单不变 | 使用获准的本地回环监听执行离线 MCP HTTP 测试；无真实模型/Agent CLI。completed/stopped synthetic、paired judge、calibration/trigger 等包在移走/删除原输入后继续 reproduce，未用源码替换 pinned runtime |
| 文档与依赖 | 69 maintained 页无断链；HEAD 基线显式纳入历史变更后 70 页/168 旧锚点 retained；本轮 6 个 Markdown 的 54 旧锚点保留。实际模块 91 个、既有架构规则 0 违规，选定视图的 24 箭头/25 runtime import 边逐条核对；登记来源及固定 test 路径同步 | 新增 focused 回归覆盖共享机制/control/bench-check/audits/saved single-arm report 不能传递加载 runner/judge/trigger。不是 A5 对全部源码类型/副作用/未知归属的通用门禁，也不是远端 CI 验收 |
| 完成边界 | A2 完成并 review，总进度 4/9；D2 的 F7/F5 最终收尾、A3–A5/V1 及全部 F1–F8/R 待办保持，F3 远端 CI 继续待验收 | 未做真实评测、实际用户配置写入、远端 CI、提交、推送、合并或发布；不将离线 synthetic/包检查视为采用证据或发布 |

#### Standards

独立 reviewer 使用冻结的任务 patch、32 个实际文件、起点快照和仓库规范核对，不将 HEAD 聚合的既有 F/D WIP 归为 A2。首轮及报告迁移修复后的增量 review 均无规范违例或需处理的代码气味。兼容重导出/随机默认包装有明确用途，未作为 Middle Man 删除；完整分层 ADR 的 proposed 状态与当前 A2 交付区分。最终 Standards 剩余 0 项。

#### Spec

另一独立 reviewer 首轮发现 1 个已知消费者遗漏：`eval-single-arm-report` 为读取 saved-summary 仍导入 trigger 执行。先将真实报告入口加入 transitive dependency 回归并观察 `commands/eval-single-arm-report.js → harness/trigger.js` 红灯，再改用 trigger-summary、build、相关 65/65 和完整 1028/1028 重跑。复查确认迁移、配对/成本、安装/调用顺序与错误身份无偏移，Spec 剩余 0 项。没有将修复前的测试通过当作迁移已经完整。

长期验收以本节的范围/实际命令/结果及交付源码和测试为索引。补充日志：`/private/tmp/skillfit-a2-targeted.log`、`/private/tmp/skillfit-a2-report-reviewed.log`、`/private/tmp/skillfit-a2-doc-tests.log`、`/private/tmp/skillfit-a2-npm-test-reviewed.log`；首轮全量为 `skillfit-a2-npm-test.log`。保护快照/核对为 `/private/tmp/skillfit-a2-before.json`、`skillfit-a2-audit.json`；迁移对照为 `/private/tmp/skillfit-a2-parity/`，图示边核对为 `skillfit-a2-architecture-view.json`。Review manifest 的最新位置记录于 `/private/tmp/skillfit-a2-review-location.txt`；这些临时文件是补充，不能替代实际交付与本节的长期验收记录。


### D2 最终收尾与 review 记录（2026-10-22）

在 F7 本地验收及 [F5 最终内容同步](2026-10-21-measurement-contract-and-capability-remediation.md#最终内容同步交付与-review2026-10-22)之后完成本阶段。F5 整项仍等待原 F3 远端条件；D2 消费的是已同步的语义，不豁免或代替远端验收。上面的当前事实阶段记录、原路径/fragment 和历史检查结果保留。

没有物理搬迁或删除文档；以下是本轮实际调整的旧入口/fragment → 权威职责兼容映射。字段/枚举不在各指南重新定义；登记表保持原 canonical、owner、生命周期、版本 scope 和静态检查 ID，只补 F6/F7 的受影响页面/检查关系。

| 原路径 / 保留 fragment | 最终权威职责与导航 |
| --- | --- |
| README [Run from source](../../README.md#run-from-source) / 中文[从源码运行](../../README.zh-CN.md#从源码运行)、[docs Start here](../README.md#start-here) | 产品/任务入口说明 source-only 版本边界，直达 self-test 与 bench-claims，不复制阶段计数；中英逐节和原代码/演示/徽章保留 |
| [Metrics Unit of analysis](../metrics.md#unit-of-analysis) / [L0](../metrics.md#l0--bench-health-guard-metrics) | metrics 拥有测量语义；新增[声明与离线对照](../metrics.md#declared-scope-and-offline-controls-current-source)摘要链接到 claims/controls，不重写统计公式或赋予声明证明力 |
| [Bench claims Authoring](../bench-claims.md#authoring-and-compatibility) / [Frozen scope](../bench-claims.md#frozen-scope-and-evidence) | claims、目标派生/拒答、schema 1/2 兼容和 measurementScope 字段唯一合同；补 source 可用性与 3 条隔离执行验证过的示例，旧锚点不动 |
| [Self-test Results](../bench-self-test.md#results-costs-and-replay) | controls 1、期望、成本、单 suite replay 为本页权威；修正旧 unsupported 陈述，schema 2 合法声明仍必需，但 requestedClaim=null 仅诊断，不授予采用资格 |
| [Planning Preview](../eval-planning.md#preview-and-confirm) / [component Output](../eval-component.md#output-contract) | planning 负责参数、确认与 scope 的预览位置；component 负责输出字段/错误码；两者链接 claims 的完整规则，不为 request 1 新造 objective |
| [Reports](../evaluation-reports.md#completed-stopped-and-incomplete-inputs) / [portable Preview](../replay-packages.md#preview-export-and-move) | 报告入口增加[冻结范围](../evaluation-reports.md#frozen-measurement-scope-current-source)；portable 拥有导出/当前 reader 与 pinned runtime 的操作边界，scope 规则回链 claims，历史不补声明 |
| [case Inspect](../case-management.md#inspect-and-select) / [Edit](../case-management.md#edit-or-unregister)、[bench JSON Contract](../bench-check-json.md#version-1-contract) | 管理和 JSON 指南解释新字段/显式 edits，用中央契约定义规则；保留 schema 1 和错误 envelope、备份/回滚、原 INFO 探针与单独 pipeline 自检的区分 |
| [First-run Choose](../first-real-eval.md#1-choose-a-claim-and-a-bench) / [workflow](../experiment-workflow.md#a-bounded-inspectable-experiment) | 去掉 schema 2 pending；按目标选 bench、预览 unsupported 与执行拒答、source/npm 区分回到入口，花费/独立验证规则不变 |
| [capability table](../eval-agent-preflight.md#current-source-capability-table) / [driver](../../skills/skillfit/SKILL.md#which-command-for-which-question) | 能力表集中说明适配器及跨适配器 source 协议；driver 只保留命令选择与关键防误读提示，链接原合同，没有第二套能力常量 |
| [governance responsibilities](../documentation-governance.md#document-responsibilities) / [两份活动计划](../README.md#develop-and-maintain) | 治理页保留稳定维护规则，移除会过时的 F5/D2 待办副本；两份计划分别拥有 F 与 D/A/V 唯一清单和验收，旧历史阶段记录不覆盖 |

六条读者路径从入口逐段核对：入门→authoring→claims；自检→suite replay→claims；有界评测→planning→component→claims；报告→metrics→claims；portable→sealed inputs；开发接手→Contributing→治理/权威主题（架构和 ADR 继续从开发目录可达）。各路径的 npm/source/协议、零调用与真实支出、历史/合成/单臂/采用边界已结合本页实际正文 review，而非只凭断链检查判定事实。

| 验收面 | 实测结果 | 限制 / 后续 |
| --- | --- | --- |
| 分工与登记 | 19 Markdown + 1 登记 JSON；70 maintained、128 registered、53 topics，全部变更可映射影响主题；canonical、来源/schema、原角色/生命周期/scope/检查 ID 保持，仅补依赖关系 | 无文档站/新目录/新检查脚本；字段定义留 claims，计划不再成为唯一现行接口说明 |
| 旧入口与双语 | 修改页的 198 个旧锚点全部保留，零路径删除；双语 README 各 15 个原代码块（含演示）、4 条 badge 行、22 标题保持原字节，原文档示例未删改；六条导航路径通过 | 新增 bench-claims 示例单独标 source-only，不追认到 npm 0.13.1，不把链接检查当模型实测 |
| 功能/示例检查 | 相关检查 94/94，npm test 1041/1041，最终文档/登记/发布/实际包复核 30/30；3 条新示例按原文隔离执行；schema 2 check/edit、四类 self-test 27 次模拟执行、单 suite 导出/移走输入/当前与 pinned replay 均通过且保持诊断/不可采用；driver quick_validate 通过 | 无真实模型/Agent/API/judge/drafter 调用；verifier/oracle 仅本地已知程序，未重跑历史 live 研究 |
| 整合 review / 保护 | OCR delegate 1.13.3 规则 + Codex 一次整合 review，本轮 20/20、工作区清单 173 项中的 153 项旧改动排除；本轮覆盖 100%、工作区 11.6%，修正 scope/claims 必填歧义及无关 Unicode 转义后无剩余阻断项；2,909 公共文件中其余 2,889 个文件逐字节不变，无增删 | 非独立二审；业务代码、脚本、schema、统计/policy、matrix、版本/依赖和冻结 evidence/归档/recipe 不改。F3 远端 CI 未执行，F5 整项仍未勾选；A3–A5/V1 和 F8 未实施 |

D2 按原验收完成，本计划进度为 5/9（D1、A1、D2、D3、A2）。本表、兼容映射、权威页和实际 diff 是长期验收索引；临时检查见 `/private/tmp/skillfit-f5d2-audit.json`、`/private/tmp/skillfit-f5d2-example-results.json` 和 `/private/tmp/skillfit-f5d2-{related,npm-test}.log`。没有项目提交、推送、远端 CI 触发、发布或实际用户配置写入。


### A3 交付、验收与整合 review（2026-10-22）

A3 按上述接口细化交付，总进度 **6/9**。当前职责以[接口](../architecture-interfaces.md#application-interfaces-and-remaining-target)、[运行场景](../architecture-runtime.md#preview-dispatch-and-paired-execution)和 [ADR 0003](../decisions/0003-plan-confirm-execute-separation.md) 为说明入口；ADR 的完整决定仍为 proposed，因为 A4 prepare/apply 尚未实现。本轮不重算 F 计划进度，不勾选 F3/F5，也不启动 A4/A5/V1/F8。

| 验收面 | 实际交付/执行证据 | 证明范围与限制 |
| --- | --- | --- |
| 输入与保护 | HEAD `8087e05173d673610d05090a52dd548e00c17517`，Node 24.21.0/macOS arm64，package 0.13.1；起点是含既有 F/D/A WIP 的实际工作树。2,909 公共文件 SHA 清单摘要 `e6597ae888973a77f6b7ce525c9b1f25dc5854a07ef743678feb4d9bf83b4467`：按路径排序，拼接 `path + NUL + sha256 + NUL` 后 SHA-256 | 26 个既有文件修改、10 个新文件，无删除；其余 2,883 公共文件原字节保持。F 计划、其他计划、AGENTS、matrix/schema、统计与 policy 实现、版本/依赖/lockfile、workflow、冻结 evidence/19 归档/catalog 支撑、发布 recipes/收据/旧 replay 字节均不改；不读私有实验室 |
| 规划接口 | [eval-options](../../src/harness/eval-options.ts) 中立承载原类型；[eval-planning](../../src/harness/eval-planning.ts) 分离 `resolveEvalInputs`、纯 `buildEvalPlan`、`prepareEvaluation` 与确认/复核。resolve 接受隔离路径、执行器和 env/clock；纯 build 在原输入已删除后仍可复算 | 不调用 runEval dry-run、不截取文本/onPlan 获取计划；resolve 不调用入口回调、不展示、不运行 verifier/oracle/judge/model、不建 run。内部 context envelope 不进入 JSON，任意旧 context 字段仍参与哈希 |
| 执行与入口迁移 | [eval-service](../../src/harness/eval-service.ts) 的 `executeEvalPlan`、`runEvaluation`、`runComponentEvaluation` 承载启动复核、case gate、paired/trigger dispatch、session 和结果读取；命令层只适配旧签名和展示。inject、installed、revision、rules/MCP 共用 paired 路径；trigger 保留单臂；request 仍 installed/no judge；self-test suite 直接调应用层 | 普通文本/JSON/request/self-test 的原确认差异保留；未新增 CLI/JSON 字段、自动安装、重试或任务筛选。先拒绝目标/计划/环境/输入漂移与碰撞，再 gate/建 session/调用；预算、角色、失败/中断前缀、unknown 和 synthetic 不可采用语义保持 |
| 独立 calibration 合同 | [calibration-service](../../src/harness/calibration-service.ts) 的 `resolveCalibrationInputs` → 纯 `buildCalibrationPlan` → `prepareCalibration`/`executeCalibration`；bench 直接导入，原 command 路径重导出 | 仍为 baseline-only、独立 `planSha256`、原任务/trial 顺序；case gate 和环境污染错误优先级保持，之后复核冻结计划再建 session；不强套 paired 结果或采用判断 |
| 证据读入与旧出口 | [eval-read-service](../../src/harness/eval-read-service.ts) 和 [single-arm-read](../../src/harness/single-arm-read.ts) 使用原 parser/audit/assessment；report/export/应用编排改用其接口。`runEval` 的 Promise/manifest/null、prepareEvalPlan 的 plan/lines/options/assertCurrent、runEvalCli/reportEvalComponent、single-arm reader/replay、preflight/错误旧路径全部保持 | 函数与错误类 re-export 的 identity 有测试；19 个迁移函数 body 和单臂 renderer 与基线逐字相同。旧 claims/身份/成本缺失不补造，schema 1、measurementScope、calibration/trigger/paired、stopped/损坏/未知数据回归通过；普通读取不加载 runner/judge/trigger |
| 序列化与真实指纹 | 迁移前捕获的 inject、judge、installed、revision、trigger、efficiency 六类计划，在显式 `f×64` implementation digest 下，公开字段、JSON 顺序、SHA 及全部展示 lines 逐项相同；calibration 的 wire/hash 和四个 self-test suite/外层计划在同样明确替换 nested digest 并重算其 SHA 后相同，全部零调用。注入/legacy context 的独立 wire 与 Python SHA golden 作为[永久回归](../../src/harness/eval-application.test.ts)保留 | 只规范化明确的实现 digest 及由它派生的 nested/outer plan hash，不删除 cost/error/reason/scope/context 字段。真实 dist 指纹由 `3be3ad29f0d09708ded15d7998d1b8e43e3846dce100a83938ec0a3e10007467` 变为 `95483460f765a1cac65f73e142d01629e679988b7dc444574aabc75ca6ca173f`；新 runtime 全部纳入，旧真实摘要不能继续确认 |
| 测试与修复 | 首轮旧入口相关 117/117；新增规划/依赖 11/11。第一次 npm test 为 1046 中 1044 pass、2 fail（同一 environment 子测试及父测试计数），定位并修复 calibration 通用漂移错误遮蔽原环境诊断。整合 review 另补默认 console 进度回归，先观察红灯，再修复旧 runEval/runEvalCli 的缺省日志转发。修复相关 `node --test dist/harness/eval-application.test.js dist/commands/{bench-calibration,calibration-cli}.test.js scripts/check-architecture.test.mjs` 为 39/39；最终 `npm test` 为 1047/1047，0 fail/skip/cancel | build 与所有离线测试通过；没有降低错误断言、删除用例或跳过失败。MCP 测试仅获准的本地回环监听；不运行真实 Agent/模型/API/judge/drafter |
| 包与 replay | 全量包括实际离线 npm pack/解包、安装包四类 controls 27 次模拟执行、schema 2 starter、19 归档/1,583 支撑文件离线恢复（4 inline，0 network）；paired/installed/revision、judge、calibration/trigger、stopped 包在移走原输入后 current reader 与 pinned reproduce 继续通过；relocated bundle 用临时配置根通过 | 新 application/preflight/read/display runtime 和全部兼容出口加入 package requiredFiles；4 MiB/19 MiB 上限、六份 retained tests 与旧固定 recipes 不变；不替换旧包 runtime，也不把 replay 当外部模型复现或发布 |
| 文档与依赖 | 70 maintained、128 registered、53 topics；本轮七个 Markdown 的 64 旧锚点全部保留，旧路径不删，旧 proposed 目标锚点显式兼容。26 个受影响主题均映射，0 unmapped/文档错误。101 活动模块、0 既有依赖违规；规划/读服务不能传递加载 runner/judge/trigger 的 focused 回归通过。最终 docs/registry/markdown/architecture/实际包测试 31/31 | 架构文档更新当前/目标、入口清单和 ADR 分阶段状态；未实现 A5 类型/角色/副作用通用门禁。README 与历史证据未改；默认/非法/中断、F7 拒答、角色/成本及迁移包由相应离线回归证明 |
| Review 与边界 | OCR delegate 1.13.3 提供工作区文件过滤/规则；Codex 在冻结的 pre-A3 增量、36 个文件、仓库规范和 A3 要求上完成一次整合 review。两个已证实兼容问题已修复并检查受影响依赖；本阶段 36/36 覆盖，剩余阻断/待修复项 0 | 非独立二审；OCR 工作区中的其他 F/D/A 旧改动明确排除，过滤掉的本阶段 Markdown/JSON 仍人工核对。未做真实模型调用、实际用户配置修改、提交/推送/远端 CI/发布。F3 远端 CI、F5 整项继续待验收 |

长期验收以本节、当前权威接口/ADR、公开源码与回归为索引。补充记录：`/private/tmp/skillfit-a3-before.json`、`skillfit-a3-parity{,-result}.json`、`skillfit-a3-transfer-check.json`、`skillfit-a3-doc-check.json`、`skillfit-a3-review/`；相关日志为 `skillfit-a3-{first-targeted,boundary,order-targeted,display-red,fixes-targeted,final-gates}.log`，首轮全量为 `skillfit-a3-npm-test.log`，修复后全量为 `skillfit-a3-npm-test-final.log`。临时记录不能替代上述交付物，也不扩大其本地离线证明范围。

</details>

### L 补充计划 review（2026-10-22）

采用 OCR delegate preview/rule（本地规则，无外部模型）和 Codex 一次整合 review：工作区 188 项仅 1 项为本轮计划输入，其余 187 项既有改动排除；该 Markdown 被 OCR 按扩展名过滤，已手工纳入规则 review，任务覆盖 1/1。核对用户要求、append-only/零依赖/离线边界、固定源、所有消费者、L 顺序及新旧交付兼容；澄清仅折叠本计划、不改另一活动计划，未发现剩余阻断项。原 A/F 的完成条件不变。已逐项核验固定提交的 1,579 非 inline 支撑对象：大小/SHA 全一致，497 种内容；在线路径及实际包/回放仍由 L3/L4 实测，未提前计完成。Review 起点/patch/规则位于本轮临时工作目录，仅补充验收依据；后续结果在本计划续记。

### L1 实际结果（2026-10-22）

从 2,737 个公开文件保存起点 SHA-256 与可修改资料副本；补齐 contrib 的 oss-lru-cache、oss-skill-followup、waza-behavior，bench 根入口直达案例目录。先观察新目录检查接口缺失的红灯，再实现基于真实 manifest 的覆盖检查；首次把 ../README 误识别为案例，收紧候选名称后文档/登记 22/22 通过。8 个 contrib 原 bench check --json 全部 exit 0，未调用 Agent/模型或改测量数据。相关回执为本轮临时 layout-l1 日志；长期结果以本节及测试代码为索引。

### L2 实际结果（2026-10-22）

分享说明和所有原始命令/合成输出块已完整并入报告指南，旧路径/两个锚点保留，canonical/登记/读者入口同步；本计划此前长记录折叠但原文未删，另一活动计划及冻结记录不改。登记门禁发现新增 dependents 必须与反向 topics 对齐，移除未登记的多余依赖后文档/登记/发布文档检查全通过；修改页全部旧锚点、分享原代码/输出块逐项保留，原合成报告命令实跑 exit 0。治理规则明确复用当前计划与未来版本收据集中，未增加 Markdown；source-only 包排除与恢复在 L3 一起切换，未提前移除支撑。

### L3 验收进行中（2026-10-22）

恢复器先通过缺失 support 的离线/HTTPS红绿回归，再排除 artifact/维护资料。当前实际候选隔离 npm install、CLI --version、5 份安装文档及 19 档/1,583 support 离线恢复通过，0 网络/模型调用。首轮在线文本发现 Content-Encoding=gzip 的压缩 Content-Length 与 fetch 解码字节不同；加用例复现后仅对 identity 响应预判头长度，最终大小/SHA 与流上限仍严格。随后完整在线恢复遇到一次网络 TimeoutError，输出未发布，失败日志保留；正在有限重试，并仅在临时验收 transport 缓存已核验的公开 HTTPS 字节以免重下载，不把本地源码冒充网络取得。产品仍无持久下载缓存或隐式重试，当前默认每文件30秒约束未放宽。未通过在线/最终回放前 L3/L4 不计完成。

### L3 完成结果（2026-10-22）

修复压缩长度误判后，第三轮默认 HTTPS 完整恢复成功：483 个实际请求、0 缓存命中，105.793 秒；全部 19 档和1,583支撑逐项大小/SHA一致。一次压缩头失败、一次瞬时超时日志均保留，未改原30秒单文件 deadline。隔离候选 npm install、5 安装文档、预览/离线恢复、30 个安装回归、7 组 foundation、5 次移走原输入后的 portable replay 均通过；真实模型/Agent及用户配置写入为0。恢复器仅显式 --yes 获取固定公共字节，6个 support workers 与 SHA 复用下载，失败等待 worker 结束再清理；本地损坏/缺失/别名/碰撞不掩盖。候选测量：2,749→1,168文件，19,180,435→5,720,846解压字节，3,069,697→1,223,605压缩字节；最后诊断改动及L4文档将随最终实际包重建复核，不冒充这些历史候选字节。本轮18+1旧程序、最终包与全量测试仍由L4验收。

### L4 验收进行中（2026-10-22）

新导出使用 manifest 2 和 records/<version>/，旧 manifest 1 平铺导入保持；完整导出文件集与 CI targeted 分类联测通过，摘要/预览/碰撞/目录别名/越界和旧格式均覆盖，相关40项全通过。首次历史程序在 independent-validation 的 verifier退出码与记录不一致；隔离原80个delivery全部匹配，随后原完整入口的18个frozen replay及1个export-index全通过。原因未确定，原失败及隔离/完整复验日志都保留，未更改冻结字节或断言。保护核对2,737个起点公共文件：仅本轮24个既有文件变化、0删除、范围外0变化，另新增1个打包配置、0新增Markdown；最终包与全量测试仍待本节补结果。

#### L4 验收发现与范围补充

最终 npm test 首轮为1059/1060，唯一失败是既有 CliExecutor 非零退出夹具直接 process.exit(3)，在输入送达前可能关闭stdin，使EPIPE先于原期望的exit 3/boom被报告。将其测试夹具改为读完stdin后正常设置退出码，原退出码/错误正文断言与独立断管测试保留；不改变执行器生产行为。已核对相邻用例/实现并 review 这一个必要的测试范围补充，未发现阻断，修复后重跑相关及完整离线套件。最终包验收脚本另发现 pack.json 与tar不在同目录而读到了旧候选，摘要检查正确拒绝；改用各自新目录并保留失败日志，不修改产品校验。

### L4 最终交付与整合 review（2026-10-22）

| 验收面 | 实际结果与证据 | 范围/限制 |
| --- | --- | --- |
| 顺序与文件 | 在同一计划补范围并 review 后依次完成 L1–L4；本轮26文件（25个既有文件、1个docs/.npmignore），0新增Markdown、0删除；分享说明合并、旧入口保留、长记录折叠 | 原A4/A5/V1与F3/F5条件不变；未做提交、推送、远端CI或发布 |
| 完整离线测试 | 修正非零退出夹具后，CLI相关39/39；最终 `npm test` 1060/1060，0fail/skip/cancel，Node24.21.0/macOS；既有独立EPIPE断言保留 | 首轮1059/1060及夹具原始失败日志保留；只改测试输入消费时序，没有更改生产执行器或放宽断言 |
| 最终实际包 | 1168文件，压缩1,224,009字节、解压5,722,132字节，SHA-256 `f1fcaf0665c01589b800b9f311938a1643e60ff941d1a4befc2e5c1d6d9bcb89`；package/release check、离线npm install、CLI版本、5安装文档和19+1,583离线恢复全通过 | 与先前完成30安装回归/7组foundation/5 portable replay的目录逐个安装文件比对，仅后改的trusted-publishing说明有差异，所有被测runtime/recipe/driver及其输入相同；未重复无关功能回放，不冒充注册表新版本 |
| 网络及历史 | 固定HTTPS完整恢复483实际请求、0cache hit，19档/1,583support全大小/SHA一致；最终安装包再从该恢复目录离线恢复，网络0、预览0写、碰撞保护通过；18 frozen replay+1 export-index原程序完整复验19/19 | 首次压缩长度误判已回归修复；一次网络超时和一次历史verifier不一致均保留。后者在隔离80个delivery及原完整入口均未复现，原因未确定，未改冻结字节/断言；网络与历史POSIX验收不是远端CI |
| 原件及范围 | 起点2737个公共资料的比较：本轮24个既有资料文件变化，0删除、范围外0变化；另外CLI测试在修正前单独保存副本，最终差异仅夹具一行。全部原catalog、19压缩档、1583支撑、旧发布MD/JSON/recipe和bench数据原字节保持 | 唯一新增文件为打包配置；私有lab/local runs未扫描，不重写Git历史。仓库原件仍保留，缩减针对安装包和默认阅读负担 |
| 整合 review | OCR delegate仅提供规则，Codex一次整合核对Spec/Standards；200项工作区中本轮26项全覆盖（14工具选择、12过滤类型手工纳入），其余174项既有WIP排除；测试夹具增量用同流程补核，无剩余阻断项 | 部分脚本起点只有哈希未存旧正文，完整当前文件作为上下文核对，不把其中旧D/A实现归成本轮；非另起独立二审，未调用OCR外部模型 |

最终包较本轮完整支撑候选减少1,581文件，解压19,180,435→5,722,132字节（约70.2%），压缩3,069,697→1,224,009字节（约60.1%）；期间的说明/诊断小改已计入最终清单，不称为严格只移除文件的同字节实验。归档原件与已发布0.13.1保持原状；未来正式发布须按已有授权/发布流程执行。

长期验收以本节、唯一清单、实际代码/测试及现有权威指南为索引。补充日志在本轮临时 `skillfit-layout-*` 命名空间：计划review与起点/最终manifest、l1/l2/l3/l4红绿、online-first-failed/second-timeout/online-check、history/history-recheck、cli-test、npm-test/npm-test-reviewed和final-package-verified。临时日志不是新仓库文档或唯一验收依据；原失败记录未被成功结果覆盖。
