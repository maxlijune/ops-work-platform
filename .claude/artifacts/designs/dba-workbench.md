# DBA 运维工作台（ops_wrk_platform）Spec

> Status: ALIGNED
> Author: DBA 用户（maxlijune）
> Last updated: 2026-09-11（范围修订 Amendment-1）

## Background

用户是一名 DBA，日常管理 10~50 个数据库实例（Oracle 为主、MySQL 偏少，另有 DM8、Vastbase 等国产库）。工作台为**个人本地使用的 Windows 桌面应用（Electron）**，覆盖：数据库维护监控、参数化 SQL 脚本与查询导出、快速导航。数据库类型支持采用**插件化架构**，由用户自行装卸驱动插件。**DSG 同步运维模块整体暂缓**，待后续版本另行启动。

## Amendment-1（2026-09-11 范围修订）

1. DSG 运维模块（SSH 主机、同步链路、批量启停、初始化向导）整体移出范围，暂缓开发
2. 实例管理的数据库类型支持改为**插件方式**实现：驱动可装卸、可禁用，减少不必要的驱动体积占用，便于后期自行管理插件
3. 新增**快速导航栏模块**：快捷跳转 URL、文件夹、文件、Windows 应用
4. 明确**主要使用场景为 Windows 操作系统**

## In scope（V1）

**基础设施**
- 实例台账：登记实例，按业务系统/环境分组、搜索过滤、一键连接测试（显示可达状态与延迟）
- 可选数据库类型由**已启用的驱动插件**决定
- 凭据随实例保存（不加密，见 Assumptions）

**模块零：插件化驱动框架**
- DriverPlugin 插件契约（连接测试、查询、流式查询、表空间/数据文件/分区采集、扩容 SQL 生成与执行）
- 插件管理页：已装插件列表、启用/禁用、从本地 zip 安装、卸载（用户区插件）
- v1 随安装包内置两个官方插件：Oracle（oracledb thin）、MySQL（mysql2），可禁用
- 插件加载失败不影响应用启动与其他插件

**模块一：监控看板**
- 表空间容量监控看板：全部实例表空间使用率，超阈值标色预警（阈值默认 85%/95%，可配置）
- 数据文件明细：路径、大小、自增长配置
- 手动扩容：选定表空间 → 生成 `ALTER TABLESPACE ... ADD DATAFILE` → 预览 → 确认执行 → 写操作日志
- 分区信息查询：表的分区列表、各分区行数/大小
- 分区健康检查：列出"分区即将耗尽/大表缺分区"的预警清单
- MySQL 实例按其语义做降级展示（无 Oracle 等价视图的能力项明确标注"不支持"）

**模块二：SQL 模板与查询导出**
- 参数化 SQL 模板库：`:name` 形式变量参数，填参执行（插件层转换为各库原生绑定）
- 多版本管理：保存历史版本、可查看、可回退
- 分类 + 标签 + 搜索
- 查询执行：结果网格分页展示；只读限制（首词白名单 + 多语句拒绝 + 危险词拦截）
- 导出：先执行查询确认结果，再手动导出 Excel(.xlsx)/CSV；日常 ≤1 万行；偶发十万行级需流式写入、界面不冻结、不 OOM

**模块三：快速导航**
- 导航项管理：添加/编辑/删除，类型支持 URL / 文件夹 / 文件 / Windows 应用（exe 或快捷方式），分组与排序
- 侧栏快速导航区：点击即打开（URL→默认浏览器；文件夹→资源管理器；文件→关联程序；应用→启动进程）

**横切**
- 操作日志：所有变更类操作（DDL 执行等）记录时间/目标/SQL/结果
- Windows 打包（NSIS 安装包），在 Win10/11 全新机器可安装运行

## Out of scope（V1 不做）

- **DSG 同步运维模块（整体暂缓）**：SSH 主机管理、同步链路登记、计划内批量启停、初始化向导
- DM8、Vastbase 驱动插件（V2；届时评估原生驱动 ABI 与 sidecar 适配）
- 插件在线市场、自动更新、第三方插件开发者文档（v1 仅官方插件 + 本地 zip 安装）
- 表空间自动扩容；分区预建/过期清理等分区 DDL
- 定期核查任务、定时导出、例行巡检报告、主动告警推送（只要看板标色）
- 多用户/登录/权限体系；凭据加密存储；执行计划（EXPLAIN）查看
- macOS/Linux 适配保证（技术上尽量跨平台，但仅在 Windows 验证）

## Assumptions

- 单账号体系：同一实例查询与维护共用一个账号，查询只读靠 SQL 解析拦截（用户知晓并接受绕过风险）
- 凭据本地明文或轻混淆存储（用户明确不要求加密）
- Oracle 插件默认走 oracledb **thin 模式**（纯 JS，支持 Oracle 12.1+）；若存在 11g 实例需切换 thick 模式并捆绑 Instant Client（见 Open questions）
- 官方插件随安装包置于 resources（可禁用、保证可恢复）；用户区插件在 userData/plugins，支持 zip 安装与卸载
- 主要平台 Windows；数据库驱动 v1 仅纯 JS（oracledb thin / mysql2），规避 Electron ABI 问题
- 技术栈：Electron + Vue 3 + TypeScript + better-sqlite3；UI 组件库 Element Plus（脚手架阶段可更换，非架构决策）

## Solution（架构草图）

```text
Electron 桌面应用（Windows 优先）
├─ 渲染进程（Vue 3 + Element Plus）
│   ├─ 快速导航侧栏 + 导航项管理
│   ├─ 实例台账（分组/搜索/连接测试）
│   ├─ 监控看板（表空间/数据文件/扩容/分区/健康检查）
│   ├─ SQL 模板库（版本/分类/参数执行/导出）
│   └─ 插件管理（列表/启停/zip 安装/卸载）
├─ 主进程（Node.js）
│   ├─ 插件框架：契约 + 加载器 + 注册表（内置 resources 与 userData 双来源）
│   ├─ 官方插件：oracle-driver（oracledb thin）、mysql-driver（mysql2）
│   ├─ 统一变更管线：生成 SQL → 预览 → 确认 → 执行 → 记日志
│   ├─ 只读守卫（sqlguard）+ 导出引擎（exceljs 流式 / csv 逐批）
│   └─ 快速导航执行（shell.openExternal / openPath）
└─ 本地存储 SQLite（better-sqlite3）
```

## Edge cases & risks

| Category | Notes |
|---|---|
| SQL 拦截绕过 | 解析拦截非硬边界（多语句、注释混淆可绕过）；用户已接受；操作日志可事后追溯 |
| 凭据明文 | 本地单机风险自担；建议至少限制数据文件 OS 权限 |
| 大结果集 | 十万行导出需流式；结果网格分页/限量加载，禁止一次物化全量 |
| 插件加载失败 | 单插件 manifest 校验失败/import 异常时隔离捕获，应用与其余插件正常启动，管理页标红展示原因 |
| Oracle 11g | thin 模式不支持 11g；若占比高需 thick + Instant Client，影响插件体积与分发（Open question） |
| MySQL 语义差异 | 无 dba_* 视图，表空间/分区信息来自 information_schema，部分能力降级或标"不支持" |
| 看板拉取风暴 | 50 实例并发拉取需限流（并发 4~6），单实例超时不算失败全局 |
| 误操作 | DDL 有预览+确认+日志，无二次字符校验防护（用户选择放弃） |
| better-sqlite3 ABI | 需 electron-rebuild 匹配 Electron ABI，首次构建注意 |

## Acceptance criteria

- AC-1 禁用 mysql 插件后：新建实例的类型下拉不含 MySQL；已有 MySQL 实例标记"插件禁用"；重新启用后恢复
- AC-2 插件管理页选择本地 zip 安装 → 解压至用户插件目录 → 列表出现且可正常使用；卸载用户区插件后从列表消失
- AC-3 登记一个 Oracle 实例后，看板展示其全部表空间使用率，超过 85%/95% 分别标黄/标红（阈值可配置）
- AC-4 手动扩容：生成 SQL 预览 → 确认后执行成功 → 操作日志新增一条记录（含 SQL、时间、结果）
- AC-5 查看任一表空间的数据文件明细（路径/大小/自增长）
- AC-6 查询任一分区表的分区列表及各分区行数/大小
- AC-7 分区健康检查输出"分区即将耗尽"的预警清单
- AC-8 新建带参数的 SQL 模板（如 `:date`），填参执行返回结果网格
- AC-9 模板保存第 2 版后，可查看版本历史并回退到第 1 版
- AC-10 在查询模块提交 UPDATE/DELETE/INSERT/DDL 语句被拦截并提示
- AC-11 查询结果可导出 xlsx 与 csv；导出 10 万行时进度可见、界面不冻结、内存不溢出
- AC-12 实例台账支持分组过滤、名称/IP 搜索、连接测试并显示可达状态
- AC-13 快速导航：添加 URL/文件夹/文件/应用四类导航项，点击分别打开浏览器/资源管理器/关联程序/启动应用
- AC-14 Windows 打包产出 NSIS 安装包，全新 Win10/11 机器安装后上述 AC 全部可复验
- AC-15 损坏一个插件目录（如改坏 manifest.json）后应用正常启动，插件管理页标红显示该插件加载失败原因

## Open questions

- 用户的 Oracle 版本分布（11g 占比）：决定 oracle 插件 thin/thick 模式与 Instant Client 捆绑策略 —— 开发监控看板前需确认
- 表空间扩容规则：新增数据文件的大小/路径是固定配置还是每次手动指定

## Core entities (ontology)

| Entity | Type | Key fields | Relationship |
|---|---|---|---|
| DriverPlugin 驱动插件 | 运行时模块 | id, name, db_type, version, source(builtin/user), enabled | 决定 Instance 可选 db_type |
| Instance 实例 | 配置 | name, host, port, service, db_type, group, env, credentials | 属于 Group；db_type 依赖插件 |
| Group 业务分组 | 配置 | name, env | 拥有多个 Instance |
| Tablespace 表空间 | 运行时数据 | name, instance_id, used_pct, status | 属于 Instance |
| Datafile 数据文件 | 运行时数据 | path, size, autoext, maxsize | 属于 Tablespace |
| Partition 分区 | 运行时数据 | table, name, rows, size, last_write | 运行时按表查询 |
| SqlTemplate SQL模板 | 持久数据 | title, category, tags, sql_text, params | 拥有 TemplateVersion |
| TemplateVersion 版本 | 持久数据 | version_no, sql_text, note, created_at | 属于 SqlTemplate |
| NavItem 快速导航项 | 持久数据 | name, type(url/folder/file/app), target, group, sort_no | 独立 |
| AuditLog 操作日志 | 持久数据 | time, target, action, payload, result | 独立 |

（SshHost / SyncLink 随 DSG 模块暂缓，移出 V1 本体）

## Interview metadata

- Mode: --deep
- Waves: 6 + 1 次书面范围修订（Amendment-1）
- Final ambiguity: 20% → 修订后新增范围已直接由用户书面明确，无新增歧义
- Status: PASSED

### Clarity breakdown（修订前基线）

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Goal | 0.90 | 0.43 | 0.387 |
| Scope | 0.85 | 0.28 | 0.238 |
| AC | 0.60 | 0.29 | 0.174 |
| | | Sum | 0.799 → Ambiguity 20% |

### Ontology convergence

6 轮累计实体 11 个，Wave 4 起零漂移；Amendment-1 新增 DriverPlugin、NavItem，移出 SshHost/SyncLink。
