# DBA 运维工作台（ops_wrk_platform）Spec

> Status: ALIGNED
> Author: DBA 用户（maxlijune）
> Last updated: 2026-09-11

## Background

用户是一名 DBA，日常管理 10~50 个数据库实例（Oracle 为主、MySQL 偏少，另有 DM8、Vastbase 等国产库），并负责迪思杰 DSG 数据同步软件的运维。原项目已完全重置，本 spec 定义全新工作台的交付范围。工作台为**个人本地使用的 Electron 桌面应用**，覆盖三大场景：数据库维护监控、参数化 SQL 脚本与查询导出、DSG 同步运维编排。

## In scope（V1）

**基础设施**
- 实例台账：登记 Oracle/MySQL 实例，按业务系统/环境分组、搜索过滤、一键连接测试（显示可达状态）
- 凭据随实例保存（不加密，见 Assumptions）

**模块一：监控看板（V1 最高优先级）**
- 表空间容量监控看板：全部实例表空间使用率，超阈值标色预警（阈值可配置）
- 数据文件明细：路径、大小、自增长配置
- 手动扩容：选定表空间 → 自动生成 `ALTER TABLESPACE ... ADD DATAFILE` → 预览 SQL → 确认执行 → 写操作日志
- 分区信息查询：表的分区列表、各分区行数/大小
- 分区健康检查：列出"分区即将耗尽/大表缺分区"的预警清单

**模块二：SQL 模板与查询导出**
- 参数化 SQL 模板库：变量参数（如 `:date`、`:emp_no`），填参执行
- 多版本管理：保存历史版本、可查看、可回退
- 分类 + 标签 + 搜索
- 查询执行：结果网格展示；只读限制（SQL 解析拦截 DML/DDL）
- 导出：先执行查询确认结果，再手动导出 Excel(.xlsx)/CSV；日常 ≤1 万行，偶发十万行级需流式写入不卡顿、不 OOM

**模块三：DSG 同步运维**
- SSH 主机管理（3~5 台 DSG 服务器，简单列表维护即可）
- 同步链路登记与计划内批量启停：按顺序编排多条链路的启停命令，实时回显每步输出
- 初始化向导：新链路全量初始化（建链路→全量装载→增量追平→校验）与断点恢复重同步，分步引导、每步展示命令输出

**横切**
- 操作日志：所有变更类操作（DDL 执行、启停、初始化步骤）记录时间/目标/SQL 或命令/结果

## Out of scope（V1 不做）

- DM8、Vastbase 等国产库连接（V2 适配；v1 中登记时明确提示"暂不支持"）
- 表空间自动扩容（定期任务自动加数据文件）
- 分区预建、过期分区清理等分区 DDL（v1 分区仅查询与健康检查）
- 定期核查任务、定时导出任务
- 例行巡检报告生成（只要实时看板）
- 主动告警推送（桌面通知等；只要看板标色）
- 多用户/登录/权限体系（个人使用）
- 凭据加密存储
- 执行计划（EXPLAIN）查看

## Assumptions

- 单账号体系：同一实例查询与维护共用一个账号，查询只读靠 SQL 解析拦截实现（用户知晓并接受绕过风险）
- 凭据（数据库密码、SSH 密码/密钥）本地明文或轻混淆存储，不做加密（用户两次明确未选加密）
- 表空间阈值默认 85% 警告 / 95% 危险，可配置
- 同步链路元数据 v1 手工登记（名称/源/目标/所属 DSG 主机/启停命令）
- DSG 命令集以用户提供的实际命令为准，工作台做成可配置命令模板
- 数据库驱动走 Node 生态：node-oracledb、mysql2

## Solution（架构草图）

```text
Electron 桌面应用
├─ 渲染进程（Vue 3 + 组件库）
│   ├─ 实例台账（分组/搜索/连接测试）
│   ├─ 监控看板（表空间/分区/健康检查）
│   ├─ SQL 模板库（版本/分类/参数执行/导出）
│   └─ DSG 运维（链路管理/批量启停/初始化向导）
├─ 主进程（Node.js）
│   ├─ 数据库访问：node-oracledb / mysql2
│   ├─ SSH 执行：ssh2（连接 DSG 服务器、命令回显）
│   ├─ 统一变更管线：生成 → 预览 → 确认 → 执行 → 记日志
│   └─ 导出引擎：小量内存写 xlsx；大量流式分批写 CSV/xlsx
└─ 本地存储 SQLite（better-sqlite3）：台账/模板/版本/链路/日志
```

## Edge cases & risks

| Category | Notes |
|---|---|
| SQL 拦截绕过 | 解析拦截非硬边界（多语句、注释混淆可绕过）；用户已接受；操作日志可事后追溯 |
| 凭据明文 | 本地单机风险自担；建议至少限制数据文件 OS 权限 |
| 大结果集 | 十万行导出需流式；查询结果网格需分页/限量加载，禁止一次物化全量 |
| SSH 中断 | 批量启停中途断连：已执行步骤标记状态，支持从断点继续 |
| DSG 命令失败 | 向导单步失败即停止并标红，不允许跳步；显示原始输出便于排查 |
| 驱动兼容 | Oracle 11g 需 oracledb thick 模式（捆绑 Instant Client）；thin 模式仅 12c+；用户 Oracle 版本分布待确认 |
| 误操作 | DDL 有预览+确认+日志，但无二次字符校验防护（用户选择放弃） |

## Acceptance criteria

- AC-1 登记一个 Oracle 实例后，看板展示其全部表空间使用率，超过阈值标红
- AC-2 手动扩容：生成 SQL 预览 → 确认后执行成功 → 操作日志新增一条记录（含 SQL、时间、结果）
- AC-3 查看任一表空间的数据文件明细（路径/大小/自增长）
- AC-4 查询任一分区表的分区列表及各分区行数/大小
- AC-5 分区健康检查输出"分区即将耗尽"的预警清单
- AC-6 新建带参数的 SQL 模板（如 `:date`），填参执行返回结果网格
- AC-7 模板保存第 2 版后，可查看版本历史并回退到第 1 版
- AC-8 在查询模块提交 UPDATE/DELETE/INSERT/DDL 语句被拦截并提示
- AC-9 查询结果可导出 xlsx 与 csv；导出 10 万行时进度可见、界面不冻结、内存不溢出
- AC-10 实例台账支持分组过滤、名称/IP 搜索、连接测试并显示可达状态
- AC-11 DSG 批量启停：勾选多条链路按序执行，每步实时显示命令输出与成功/失败
- AC-12 初始化向导按步骤引导，单步失败停止并标红显示原始输出
- AC-13 通过 SSH 连接 DSG 服务器执行命令并回显输出
- AC-14 v1 中登记 DM8/Vastbase 类型实例时提示"暂不支持，将在 v2 提供"

## Open questions

- 用户 Oracle 版本分布（11g 占比）：决定 oracledb thin/thick 模式及是否捆绑 Instant Client —— dev-plan 前需确认
- DSG 实际命令样例（启停、装载、状态查询语法）：实现模块三前必须提供
- 表空间扩容规则：新增数据文件的大小/路径是固定配置还是每次手动指定

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| Instance 实例 | 配置 | name, host, port, service, db_type, group, env, credentials | 属于 Group |
| Group 业务分组 | 配置 | name, env | 拥有多个 Instance |
| Tablespace 表空间 | 运行时数据 | name, instance_id, used_pct, status | 属于 Instance |
| Datafile 数据文件 | 运行时数据 | path, size, autoext, maxsize | 属于 Tablespace |
| Partition 分区 | 运行时数据 | table, name, rows, size, last_write | 运行时按表查询 |
| SqlTemplate SQL模板 | 持久数据 | title, category, tags, sql_text, params | 拥有 TemplateVersion |
| TemplateVersion 版本 | 持久数据 | version_no, sql_text, note, created_at | 属于 SqlTemplate |
| SshHost SSH主机 | 配置 | name, host, user, credential | 拥有 SyncLink |
| SyncLink 同步链路 | 配置 | name, source, target, ssh_host_id, cmds | 属于 SshHost |
| AuditLog 操作日志 | 持久数据 | time, target, action, payload, result | 独立 |

## Interview metadata

- Mode: --deep
- Waves: 6
- Final ambiguity: 20%
- Status: PASSED

### Clarity breakdown

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Goal | 0.90 | 0.43 | 0.387 |
| Scope | 0.85 | 0.28 | 0.238 |
| AC | 0.60 | 0.29 | 0.174 |
| | | Sum | 0.799 → Ambiguity 20% |

### Ontology convergence

6 轮累计实体 11 个，Wave 4 起零漂移；"筛查脚本"于 Wave 3 定名为"SQL模板"后保持稳定。
