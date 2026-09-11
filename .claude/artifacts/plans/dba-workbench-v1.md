# DBA 运维工作台 V1 Implementation Plan

> Status: APPROVED
> Source: .claude/artifacts/designs/dba-workbench.md（含 Amendment-1 范围修订）
> Mode: default（Planner → Architect → Critic 共识循环）
> Iterations: 1 / 3
> Author: maxlijune
> Last updated: 2026-09-11

## Requirements summary

在清空的仓库上从零构建 Windows 桌面端 DBA 工作台（Electron + Vue 3 + TS + SQLite）。V1 交付五块能力：**插件化驱动框架**（官方 oracle/mysql 插件，可装卸/禁用）、**实例台账**（分组/搜索/连接测试）、**监控看板**（表空间容量/数据文件/手动扩容/分区信息/健康检查）、**SQL 模板与查询导出**（参数化模板/版本/只读拦截/xlsx+csv 流式导出）、**快速导航**（URL/文件夹/文件/应用）。DSG 运维模块暂缓。

## Acceptance criteria

继承 spec AC-1 ~ AC-16（见 spec），本 plan 验证段逐条映射。

## RALPLAN-DR

### Planner draft

#### Principles（5）

1. **最小可行**：插件框架只满足"装卸/禁用/zip 安装"，不做市场、自动更新、签名校验
2. **契约先行**：DriverPlugin 接口是核心资产，先定契约再写驱动实现；接口**全异步**（Promise），为未来 sidecar 适配留逃生门
3. **纯 JS 驱动优先**：v1 两个官方驱动（oracledb thin / mysql2）均为纯 JS，规避 Electron native ABI 问题
4. **变更必过管线**：一切 DDL 走"生成 → 预览 → 确认 → 执行 → 日志"，无旁路
5. **Windows 优先**：路径处理、打包（NSIS）、快速导航均按 Windows 验收；不保证 mac/linux

#### Decision drivers（4）

1. **驱动可装卸与体积**（用户核心诉求，权重最高）
2. **后续国产库扩展成本**（v2 DM8/Vastbase 插件化接入）
3. **单人开发可维护性**（无团队协作，架构复杂度必须克制）
4. **日常使用频率**（看板/查询高频优先，导航轻量靠后）

#### Viable options

**Option A: 同进程外置目录插件（favored）**
- 实现思路：插件为文件夹（manifest.json + 入口 JS + 自带 node_modules），主进程启动时从内置 resources/plugins（只读）与 userData/plugins（用户区）双源扫描、动态 import，注册到内存注册表；启停由 SQLite plugin_registry 表控制
- 改动文件：`src/main/plugins/contract.ts`、`src/main/plugins/loader.ts`、`src/main/plugins/registry.ts`、`plugins/oracle-driver/`、`plugins/mysql-driver/`
- Pros：零 IPC 协议代码；纯 JS 驱动直接跑；加载即用，调试简单
- Cons：插件异常可能拖垮主进程（v1 驱动纯 JS、异常面已包 Promise，风险可控）；未来原生驱动插件需处理 Electron ABI

**Option B: Sidecar 子进程插件**
- 实现思路：每个插件独立 Node 子进程，主进程 PluginHost 经 stdio JSON-RPC 调用；生命周期管理（启动/超时/崩溃重启）
- 改动文件：上述文件外增加 `src/main/plugins/host.ts`（RPC 协议+子进程管理）、每个插件侧 `plugins/*/rpc-server.ts`
- Pros：进程隔离，崩溃不传染；原生驱动用系统 Node ABI，免 electron-rebuild；天然支持未来 Python 驱动（DM8）
- Cons：协议+生命周期约 500+ 行额外代码；调试复杂；查询大数据经 IPC 序列化有开销

**Option C: 驱动硬编码直连（invalidated）**
- 不成立理由：直接违背用户"插件化、自行管理、减少体积"的核心诉求，v2 国产库接入即重构，直接排除

#### Planner 采选：Option A

理由：v1 两个驱动均为纯 JS（无 native 段错误风险），Option B 的隔离收益在 v1 兑现不了，却要付出协议与调试成本；契约全异步设计使 v2 遇到原生驱动时可为该插件单独引入 sidecar 适配层而不动接口。符合"最小可行"原则。

### Implementation steps（基于 Option A，7 阶段）

**阶段 0：脚手架与基座**

1. 初始化项目 — `package.json`、`electron.vite.config.ts`、`src/main/index.ts`（窗口创建）、`src/preload/index.ts`（contextBridge 暴露 `window.api`）、`src/renderer/main.ts` + `src/renderer/App.vue`（Vue3 + Element Plus + vue-router 侧栏布局）
2. SQLite 基座 — `src/main/db/index.ts`（better-sqlite3 单例 + 建表迁移）：`instance_groups`、`instances`、`sql_templates`、`template_versions`、`nav_items`、`audit_logs`、`plugin_registry(plugin_id PK, enabled, source)`、`settings(key PK, value)`（存阈值）
3. IPC 基座 — `src/main/ipc/index.ts`（ipcMain.handle 统一注册器 + 错误包装），preload 按域暴露（instances/templates/nav/plugins/dashboard/logs）

**阶段 1：插件框架（核心资产，最先做）**

4. 插件契约 — `src/main/plugins/contract.ts`：
   `interface DriverPlugin { manifest{id,name,dbType,version}; testConnection(cfg); query(cfg,sql,params,opts); streamQuery(cfg,sql,params,onBatch); getTablespaces(cfg); getDatafiles(cfg,ts); listPartitionedTables(cfg); getPartitionInfo(cfg,table); getPartitionHealth(cfg); generateAddDatafileSql(cfg,ts,opts); executeDdl(cfg,sql) }`，全部 Promise；能力可选字段声明（如 mysql 声明 `capabilities: {tablespace: 'basic', partition: true}`）
5. 插件加载器 — `src/main/plugins/loader.ts`：扫描双源目录 → 校验 manifest → 动态 import → 接口探测 → 注册 `src/main/plugins/registry.ts`；**单插件失败 try/catch 隔离**，失败原因记入注册表供管理页展示；启停读 `plugin_registry`
6. Oracle 官方插件 — `plugins/oracle-driver/`（index.js + manifest.json + node_modules）：oracledb **thick 模式**（11g 与 12c+ 通吃，用户已确认 11g 较多/不确定）；**阶段 1 首日 ABI spike**：在 Electron 主进程验证 oracledb 预编译二进制可加载，不兼容则 electron-rebuild 或捆绑匹配 Electron ABI 的二进制；`initOracleClient({libDir})` 优先读插件设置的本机 Instant Client 路径（DBA 机器常已装），其次插件目录捆绑副本；表空间 SQL（`dba_data_files`/`dba_free_space` 聚合）、数据文件、`dba_tab_partitions` 分区信息、健康检查（MAXVALUE 分区、未来分区余量 < 阈值清单）、扩容 SQL 生成（跟随现有数据文件路径/命名 + 默认大小可改）、DDL 执行
7. MySQL 官方插件 — `plugins/mysql-driver/`：mysql2/promise；`information_schema.INNODB_TABLESPACES`/`FILES` 表空间（降级：无自增长概念标"不支持"）、`information_schema.PARTITIONS` 分区；`:name` 参数转 `?` 绑定
8. 插件管理页 — `src/renderer/views/Plugins.vue` + `src/main/plugins/installer.ts`：列表（来源/版本/状态/失败原因）、启停开关、zip 解压安装到 userData/plugins、卸载（仅用户源；内置源只能禁用，保证可恢复）

**阶段 2：实例台账**

9. 实例 CRUD + 分组 + 搜索 — `src/renderer/views/Instances.vue` + `src/main/ipc/instances.ts`；类型下拉数据来自 registry 的已启用插件；插件缺失的已有实例标"插件禁用/缺失"
10. 连接测试 — 调 `plugin.testConnection`，展示可达状态与延迟

**阶段 3：监控看板（V1 最高优先业务模块）**

11. 表空间看板 — `src/renderer/views/Dashboard.vue` + `src/main/ipc/dashboard.ts`：并发限流 4~6 逐实例拉取，超时单实例标灰不阻塞全局；阈值（settings 默认 85/95）黄/红标色
12. 数据文件明细 + 手动扩容 — `src/renderer/components/DatafileDrawer.vue`、`ExpandDialog.vue`：`generateAddDatafileSql` 自动跟随该表空间现有数据文件路径/命名，大小给默认值且可改 → SQL 预览 → 确认 → `executeDdl` → 写 `audit_logs`
13. 分区信息 + 健康检查 — `src/renderer/views/Partitions.vue`：选实例+表 → 分区列表（行数/大小）；健康检查页签输出预警清单；MySQL 按 capabilities 降级

**阶段 4：SQL 模板与查询导出**

14. 模板库 — `src/renderer/views/SqlTemplates.vue` + `src/main/ipc/templates.ts`：CRUD、保存即新版本（`template_versions`）、回退、分类/标签/搜索
15. 查询执行 — `src/renderer/components/QueryRunner.vue`：`:name` 参数解析（`src/main/sqlguard.ts` 同目录 `parseParams`）→ 只读校验 → `plugin.query`（LIMIT 包装分页）→ 结果网格
16. 只读守卫 — `src/main/sqlguard.ts`：剥注释 → 多语句拒绝（`;` 分割 >1 拒绝）→ 首词白名单（SELECT/WITH）→ 危险词黑名单扫描；vitest 单测覆盖（正常 SELECT、WITH CTE、注释混淆、多语句、UPDATE/DELETE/DDL 十类用例）
17. 导出引擎 — `src/main/exporter.ts`：≤1 万行 exceljs 内存写 xlsx；>1 万行走 `streamQuery` + exceljs 流式 workbook / csv 逐批 append；渲染进程进度条（IPC 进度事件）

**阶段 5：快速导航**

18. 导航数据与执行 — `src/main/ipc/nav.ts` + `nav_items` 表；点击执行：URL→`shell.openExternal`，文件夹/文件/exe→`shell.openPath`（.lnk 快捷方式经 openPath 同样可启动）
19. 导航 UI — `src/renderer/components/NavRail.vue`（侧栏分组列表，点击即开）+ `src/renderer/views/NavManager.vue`（增删改/类型选择/拖拽排序）

**阶段 6：打包与验收**

20. 打包 — `electron-builder.yml`：win x64 NSIS；`extraResources` 把 `plugins/oracle-driver`、`plugins/mysql-driver` 带入 resources（真实文件系统，避免 asar 内动态 import 问题）；better-sqlite3 需 `electron-rebuild`
21. 全量验收 — 按 Verification steps 在开发机 + 全新 Windows 虚拟机逐条过 AC-1~AC-15

#### Workspace setup

- 实施前运行 `git status --short` 与 `git branch --show-current`
- 当前状态：分支 `trae/agent-m7OVxe`，工作区干净（spec/docs 已提交）
- 本 plan 为全新脚手架（所有文件均新建，无与现有代码并行修改的冲突面），**建议直接在当前分支开发**；如需隔离可用 `git worktree add -b feature/v1-scaffold ../ops-workbench-v1`，但收益有限（无并行任务）
- 每完成一个阶段做一次 commit，保持 diff 可回溯

#### Open questions（留给后续）

（已闭环 2026-09-11：① 11g 较多/不确定 → oracle 插件 thick 模式 + Instant Client，本机路径优先、捆绑副本兜底，阶段 1 首日 ABI spike；② 扩容规则 → 跟随现有数据文件路径/命名 + 默认大小可改）

### Architect challenge

#### Steelman against Option A

- **反方核心论点**：插件与主进程同生共死。DBA 工作台的价值在于"打开就能看全部实例"，一旦某驱动在批量拉取中抛出未捕获异常或内存泄漏，整个应用崩溃，日常可用性归零。v2 引入 DM8/Vastbase 原生驱动后，ABI 不匹配与段错误风险陡增，届时从 Option A 迁移到隔离架构要重写加载层。Option B 从第一天做，隔离收益立即可得，且原生驱动免 electron-rebuild。
- **若反驳成立**：plan 应改为 Option B——每个插件独立子进程 + JSON-RPC，主进程 PluginHost 管理生命周期与超时。

**Planner 回应**：v1 驱动全为纯 JS，段错误源不存在；连接/查询异常已包 Promise，可在 loader 层统一兜底（`src/main/plugins/loader.ts` 加载时 wrap 插件方法，未捕获 rejection 记日志不崩主进程）；50 实例拉取已限流。Option B 的 500+ 行协议代码在 v1 无受益场景。**采选修正**：在步骤 5 中显式加入"插件方法统一 wrap 兜底"，吸收反方合理部分。

#### Tradeoff tensions（3）

1. **插件隔离性 vs 实现成本**：in-process 无隔离但零协议代码。取舍依据：v1 无 native 驱动 → 隔离收益趋零，选 A；v2 原生驱动出现时按插件粒度引入 sidecar 适配
2. **官方插件分发方式**：内置 resources（可恢复、安装包 +几 MB）vs 纯 zip 手装（零体积、易丢失、首次体验差）。取舍依据：两个纯 JS 驱动体积小（<10MB），选内置 + 可禁用
3. **SQL 拦截强度 vs 个人工具易用性**：严格 AST 解析（node-sql-parser 对 Oracle 方言覆盖不全，误杀风险）vs 白名单+黑名单（有绕过面）。取舍依据：用户已书面接受绕过风险且为个人单机，选轻量方案 + 单测固化已知绕过用例

#### Synthesis path

A 与 B 并非互斥终点：契约全异步 + 能力声明（capabilities）+ 插件方法 wrap 兜底，使 v2 可为原生插件单独提供 `SidecarAdapter implements DriverPlugin`，其余纯 JS 插件继续同进程。Option A 即综合方案。

#### Principle violations

无。逐条核对 5 条 Principles 与采选方案一致。

### Critic verdict

| 维度 | 状态 | 备注 |
|---|---|---|
| Principle-option consistency | ✓ | Option A 与"最小可行/纯 JS 优先/契约先行"一致 |
| Fair alternative exploration | ✓ | B 有完整 steelman 未被敷衍；C 有显式 invalidation |
| Risk mitigation clarity | ✓ | 每条 risk 均有对应 mitigation（见下表） |
| AC testability | ✓ | AC-1~15 二值可验，验证段逐条给出操作 |
| Verification concreteness | ✓ | 单测命令（vitest）、构建命令（electron-builder）、手动步骤齐备 |
| File/line coverage | ✓ | 21 个步骤全部 cite 新建文件路径（greenfield 无行号，以文件为单位） |

#### Verdict: APPROVED（含 3 条 Reservations，已合入下文 Risks/Verification）

**Reservations（合入正文）**：
1. oracledb thin 对 11g 不支持——plan 假设 thin 可用；若用户 11g 占比高，thick + Instant Client 会使插件体积和加载复杂度显著上升。**已合入**：Open questions 标记为阶段 3 前置条件，Risks 表列缓解措施
2. MySQL 表空间语义降级未定义到字段级——`INNODB_TABLESPACES` 无自增长/maxsize 概念，看板列需按 capabilities 隐藏列而非显示空值。**已合入**：步骤 4 capabilities 声明 + 步骤 13 降级展示
3. better-sqlite3 在 Windows + Electron 下首次构建易踩 ABI 坑。**已合入**：Risks 表 + 阶段 6 步骤 20 显式 electron-rebuild

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| oracledb thick 预编译二进制与 Electron ABI 不匹配 | 阶段 1 首日 ABI spike 验证；不兼容则 electron-rebuild 或捆绑匹配 Electron 的二进制 |
| Instant Client 体积（约 80~200MB）推高插件体积 | 插件设置支持指定本机已有 Instant Client 路径（DBA 机器常已装），捆绑副本兜底可后装 |
| 插件方法未捕获异常拖垮主进程 | loader 对插件每个方法统一 Promise wrap + catch，失败记日志返回结构化错误；插件加载失败隔离（AC-15 验证） |
| MySQL 表空间字段与 Oracle 不齐 | capabilities 声明 + 看板按能力隐藏列，不显示假空值 |
| 50 实例看板拉取风暴 | 并发限流 4~6 + 单实例超时（如 10s）标灰，不阻塞全局 |
| SQL 拦截被绕过（多语句/注释混淆） | sqlguard 单测固化已知绕过形态；操作日志可追溯；用户已书面接受残余风险 |
| 10 万行导出 OOM/界面冻结 | streamQuery 分批（如 5000/批）+ exceljs 流式 workbook；网格分页只取首页 |
| better-sqlite3 ABI 不匹配 | 阶段 0 即验证 `electron-rebuild` 流程，不等阶段 6 |
| zip 安装恶意/损坏插件 | manifest 严格校验 + 入口 import try/catch 隔离；个人工具不做签名（Out of scope 已声明） |
| Windows 路径中文/空格 | 全路径处理用 path.join；测试用例包含中文路径实例 |

## Verification steps

- **单测**：`npx vitest run` — sqlguard（SELECT 放行、WITH 放行、UPDATE/DELETE/INSERT/MERGE/DDL 拦截、多语句拒绝、注释混淆拒绝）+ parseParams（`:name` 提取/去重）+ exporter（小数据 xlsx/csv 内容断言）
- **开发运行**：`npm run dev` — 阶段 0 起每阶段结束手工冒烟
- **AC-1/2/15**：插件管理页禁用 mysql → 新建实例无 MySQL 选项、已有 MySQL 实例标"插件禁用"；zip 安装/卸载；改坏某插件 manifest.json 后重启 → 应用正常、管理页标红
- **AC-3~7、AC-16**：登记真实 Oracle 测试实例（含至少一台 11g 验证 thick 模式；无 11g 环境则用 12c+ 验证并在验收记录标注 11g 待验）→ 看板使用率 + 阈值标色；扩容走预览（跟随现有路径/命名 + 默认大小可改）→确认→查 audit_logs；数据文件/分区/健康检查逐页核验
- **AC-8~10**：建带 `:date` 模板执行；保存 v2 回退 v1；提交 `UPDATE ...` 被拦
- **AC-11**：Oracle 执行 `SELECT * FROM dual CONNECT BY level <= 100000` 构造 10 万行 → 导出 xlsx/csv，观察进度条与任务管理器内存（峰值 < 1.5GB）
- **AC-12**：分组过滤、名称/IP 搜索、连接测试（含一个不可达实例显示失败）
- **AC-13**：添加四类导航项（一个 URL、一个含中文空格路径的文件夹、一个 txt 文件、一个 exe）逐一点击验证打开行为
- **AC-14**：`npm run dist` 产出 NSIS → 全新 Windows 虚拟机安装 → 复验 AC-1~13 抽查项
- **构建**：`npm run build`（渲染/主进程编译零错误）

## ADR

- **Decision**：Electron 桌面应用（Windows 优先）；数据库能力经**同进程外置目录插件**接入（DriverPlugin 全异步契约 + capabilities 能力声明 + 方法级 wrap 兜底）；v1 内置 oracle(thick 模式 + Instant Client，兼容 11g)/mysql 两个官方插件，用户区插件支持 zip 安装/卸载；DSG 模块暂缓；新增快速导航模块
- **Drivers**：驱动可装卸（决定性）、国产库扩展成本、单人可维护性、使用频率
- **Alternatives considered**：
  - Option A 同进程插件 — **chosen**：mysql 纯 JS、oracle thick 经 ABI spike 前置验证，无进程隔离刚需，契约异步保留 sidecar 逃生门
  - Option B Sidecar 子进程 — rejected：500+ 行协议成本在 v1 无受益场景；v2 原生驱动出现时按插件粒度引入 `SidecarAdapter` 即可，无需整体迁移
  - Option C 驱动硬编码 — rejected：违背用户插件化核心诉求
- **Why chosen**：以最小代码满足"可装卸、减体积、可自管理"核心诉求；mysql 纯 JS 零 ABI 风险，oracle thick 的 ABI 风险以阶段 1 首日 spike 前置消解；异步契约为 v2 国产库（可能原生/Python）预留了不推翻重来的演进路径
- **Consequences**：正面——插件装卸即类型开关、安装包只带必要驱动、v2 扩展不动核心；负面——同进程无崩溃隔离（靠 wrap 兜底）、原生驱动插件（未来）需单独 sidecar 适配、插件质量依赖 manifest 校验而非签名
- **Follow-ups**（进 backlog，不在本 plan 实施）：v2 DM8/Vastbase 插件（评估原生 ABI / sidecar）；DSG 模块重启（spec 冻结术语恢复）；插件签名与在线更新机制；执行计划（EXPLAIN）查看

## Review trail

- Planner draft v1：7 阶段 21 步，采选 Option A（同进程插件）
- Architect challenge v1：steelman 指出同进程崩溃传染风险 → Planner 吸收为"插件方法统一 wrap 兜底"（步骤 5 增强）；确认 3 条 tension 均有取舍依据
- Critic verdict v1：APPROVED with 3 reservations（11g 风险、MySQL 降级字段级定义、better-sqlite3 ABI）→ 全部合入 Risks & mitigations 与 Verification steps
- Final iterations: 1 / 3
- 2026-09-11 补充：两项 open question 闭环（① 11g 较多/不确定 → oracle 插件 thick 模式 + 阶段 1 首日 ABI spike；② 扩容规则 → 跟随现有数据文件 + 默认大小可改），已同步更新步骤 6/12、风险表、AC-16 与 ADR
