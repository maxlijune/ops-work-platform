# 运维工作平台 - 版本与项目参考文档

> **版本**: v1.0.0 (First Release)
> **发布日期**: 2026-08-09
> **状态**: ✅ 第一版交付完成，代码已推送到 GitHub
> **仓库地址**: https://github.com/maxlijune/ops-work-platform
> **目标读者**: 后续维护/迭代开发者（本人）

---

## 1. 版本记录

### v1.0.0 - 2026-08-09 第一版交付

**完成内容**:
- [x] 前后端项目骨架搭建与本地运行验证
- [x] 9 大核心模块的 API（FastAPI）+ 页面（Vue 3）
- [x] SQLite 本地持久化（8 张数据表）
- [x] Fernet 对称加密存储 SSH/DB 凭据
- [x] 前端 ↔ 后端 联调通过（Vite 代理 `/api` → 8000 端口）
- [x] 驾驶舱数据汇总（服务器/数据库/作业/告警统计）
- [x] SQL 笔记版本控制（同笔记多版本存储）
- [x] 启动脚本 `start.sh` / `stop.sh`
- [x] GitHub 仓库建立并推送
- [x] 综合验收测试（12 项通过）

**提交哈希**:
- 第一版初始化提交: `58de994` (feat: 初始化运维工作平台项目, 52 files / 7132 lines)

---

## 2. 项目定位与核心约束（不可轻易打破）

### 2.1 产品定位
- **用户**: 单人使用（平台作者本人），不做多用户/权限
- **环境**: 个人电脑本地运行，浏览器访问 `localhost:5173`
- **认证**: 无前端登录；后端接口无 token 校验（仅本地可信环境）
- **网络**: 浏览器本地，后端通过内网连接服务器/数据库做采集

### 2.2 硬性约束 (Must Keep)
1. **持久化不可丢**：所有配置、状态、笔记、历史必须保存在本地文件，刷新/重启/关机后都不能丢
2. **凭证必须加密**：SSH 密码/密钥、DB 密码必须加密存储，严禁明文写入 DB 或 JSON
3. **后端采集代理**：浏览器无法直接 SSH/直连 DB，必须经由 Python 后端执行
4. **UI 风格**：温暖低饱和色调（#E8DDD3 米咖色系），参考 PRD 第 3 章设计规范
5. **数据不出本机**：不做云端同步、不发送任何遥测数据到公网

### 2.3 当前已明确暂不做
- 移动端适配
- 多用户、权限系统
- 邮件/短信/钉钉等外部告警通知（仅站内告警表）
- 复杂 BI 报表、多维度分析

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────┐
│                   本机浏览器                      │
│   ┌─────────────────────────────────────────┐   │
│   │ Vue 3 + Element Plus + ECharts 前端     │   │
│   │ 端口 5173 (Vite Dev Server)             │   │
│   │                                         │   │
│   │  9 大模块页面 (router 守卫: 无登录)     │   │
│   │  ├─ Cockpit  (首页驾驶舱)               │   │
│   │  ├─ Servers  (服务器资源)               │   │
│   │  ├─ Databases(数据库状态)               │   │
│   │  ├─ Jobs     (定时作业)                 │   │
│   │  ├─ SQLNotes (SQL笔记+版本)             │   │
│   │  ├─ PlanOps  (运维开发看板)             │   │
│   │  ├─ PlanData (数据开发看板)             │   │
│   │  ├─ Backup   (备份监控)                 │   │
│   │  └─ Settings (资料+全局设置)            │   │
│   └────────────┬────────────────────────────┘   │
│                │ /api/v1/* 代理转发              │
│                ▼                                  │
│   ┌─────────────────────────────────────────┐   │
│   │ FastAPI 后端 Python 3.10+               │   │
│   │ 端口 8000                                │   │
│   │                                         │   │
│   │  routers (8 组 API)                     │   │
│   │  ├─ servers      ├─ databases           │   │
│   │  ├─ alerts       ├─ jobs                │   │
│   │  ├─ sql-notes    ├─ plan-tasks          │   │
│   │  ├─ settings     └─ cockpit             │   │
│   │                                         │   │
│   │  services: APScheduler / Paramiko SSH   │   │
│   │            PyMySQL / psycopg2 DB 连接   │   │
│   │            Fernet 加解密                │   │
│   └────────────┬────────────────────────────┘   │
│                │                                  │
│                ▼                                  │
│   ┌─────────────────────────────────────────┐   │
│   │ 本地 SQLite 文件: backend/data/app.db   │   │
│   │ 加密密钥:  backend/data/.encryption_key │   │
│   └─────────────────────────────────────────┘   │
│                                                  │
│          (可选) SSH / DB 连接 内网采集目标       │
└─────────────────────────────────────────────────┘
```

---

## 4. 技术栈与版本（升级前必读）

### 4.1 后端 (Python)

| 依赖 | 版本 | 作用 | 升级注意 |
|------|------|------|----------|
| Python | 3.10+ | 解释器 | 当前使用 3.14，pydantic-core 需要高版本支持 |
| fastapi | 0.115.0 | Web 框架 | 大版本升级需检查路由注册签名变化 |
| uvicorn | 0.30.0 | ASGI 服务 | 与 fastapi 版本配套 |
| sqlalchemy | 2.0.35 | ORM | 2.x 语法（`session.execute(select())`），升级后不要混用 1.x |
| apscheduler | 3.10.4 | 定时调度 | 注意迁移到 4.x 的 API 不兼容 |
| paramiko | 3.4.0 | SSH 客户端 | 服务器指标采集依赖 |
| cryptography | 43.0.1 | Fernet 加解密 | 升级需验证旧密钥可解密 |
| pydantic | 2.9.2 | 数据校验 | 2.x `BaseModel`，不要引入 v1 写法 |
| pymysql | 1.1.1 | MySQL 驱动 | |
| psycopg2-binary | 2.9.9 | PostgreSQL 驱动 | |

### 4.2 前端 (Node)

| 依赖 | 版本 | 作用 |
|------|------|------|------|
| Vue | ^3.4.0 | 核心框架（Composition API） |
| vue-router | ^4.3.0 | 路由（createWebHistory） |
| pinia | ^2.1.7 | 状态管理 |
| element-plus | ^2.6.0 | UI 组件库 |
| @element-plus/icons-vue | ^2.3.1 | Element 图标 |
| echarts | ^5.5.0 | 图表库 |
| vue-echarts | ^6.7.3 | ECharts Vue 封装 |
| axios | ^1.6.8 | HTTP 客户端（统一 API 封装在 `src/api/index.js`） |
| vuedraggable | ^4.1.0 | 看板拖拽 |
| vite | ^5.2.0 | 构建/开发服务器 |
| tailwindcss | ^3.4.1 | 实用优先 CSS |
| @vitejs/plugin-vue | ^5.0.4 | Vue 单文件支持 |

---

## 5. 目录结构

```
/workspace (ops-work-platform)
├── PRD.md                    # 产品需求文档（需求源头，优先级最高）
├── DevPlan.md                # 开发计划（阶段、验收标准）
├── VERSION_HISTORY.md        # 本文件 ← 维护入口
├── start.sh                  # 一键启动脚本（后端+前端）
├── stop.sh                   # 一键停止脚本
│
├── backend/
│   ├── start.sh              # 仅启动后端
│   ├── requirements.txt      # Python 依赖清单（锁定版本）
│   │
│   ├── data/                 # 🔒 本地持久化数据（严禁入库）
│   │   ├── app.db            # SQLite 数据库
│   │   └── .encryption_key   # Fernet 密钥（丢失=所有密码无法解密）
│   │
│   └── app/
│       ├── main.py           # FastAPI 入口：建表、CORS、路由注册
│       │
│       ├── core/
│       │   ├── database.py   # 引擎、Session、Base 模型、DB 路径
│       │   └── encryption.py # Fernet 加密/解密（密钥存储位置必须同步 database.py）
│       │
│       ├── models/           # SQLAlchemy ORM 模型（一一对应数据表）
│       │   ├── server.py     # servers 表
│       │   ├── database.py   # databases 表
│       │   ├── alert.py      # alerts 表（统一告警表）
│       │   ├── job.py        # jobs, job_history 表
│       │   ├── sql_note.py   # sql_notes, sql_note_versions 表
│       │   ├── plan_task.py  # plan_tasks 表（含 plan_type 区分运维/数据）
│       │   └── settings.py   # settings, docs, backup_records 表
│       │
│       ├── routers/          # REST API（8 组）
│       │   ├── server.py     # CRUD + /test + /{id}/collect + /{id}/crontab
│       │   ├── database.py   # CRUD + /test + /{id}/collect
│       │   ├── alert.py      # CRUD + /{id}/resolve 状态流转
│       │   ├── job.py        # CRUD + /{id}/history + /{id}/execute
│       │   ├── sql_note.py   # CRUD + /{id}/versions + /{id}/versions/{v} 版本
│       │   ├── plan_task.py  # CRUD + ?plan_type=ops/data 看板过滤
│       │   ├── cockpit.py    # /summary 驾驶舱统计
│       │   └── settings.py   # /global 全局设置 + /docs 资料库 + /system 系统信息
│       │
│       ├── schemas/          # Pydantic 请求/响应模型
│       └── services/         # 预留：调度器、采集逻辑、业务复杂逻辑
│
└── frontend/
    ├── start.sh              # 仅启动前端
    ├── package.json          # 前端依赖（锁定 version 字段）
    ├── vite.config.js        # 关键：代理 /api → http://localhost:8000
    ├── tailwind.config.js    # 自定义颜色：温暖低饱和配色
    ├── postcss.config.js
    ├── index.html
    │
    └── src/
        ├── main.js           # Vue 入口，Element Plus/Pinia/Router 注册
        ├── App.vue           # 全局布局（侧栏 + 顶栏 + 内容区）
        ├── style.css         # 全局样式（Tailwind 指令 + Element 覆写）
        │
        ├── api/
        │   └── index.js      # Axios 封装（统一前缀、错误提示、响应解包 code=0）
        │
        ├── router/
        │   └── index.js      # 9 条路由 + meta 图标/标题
        │
        └── views/            # 9 个页面组件（与路由一一对应）
            ├── Cockpit.vue       # 驾驶舱：统计卡片、异常告警、模块摘要
            ├── Servers.vue       # 服务器：列表 + 新增/编辑/测试/采集弹窗
            ├── Databases.vue     # 数据库：列表 + 新增/编辑/测试/采集弹窗
            ├── Jobs.vue          # 定时作业：列表 + 执行历史
            ├── SQLNotes.vue      # SQL笔记：列表 + 版本切换弹窗
            ├── PlanOps.vue       # 运维开发看板（共享 PlanTask 组件逻辑）
            ├── PlanData.vue      # 数据开发看板（同上）
            ├── Backup.vue        # 备份监控：备份记录列表
            └── Settings.vue      # 资料与设置：全局配置 + Markdown 文档库
```

---

## 6. 数据模型（数据库表）

SQLite 数据库文件: **`backend/data/app.db`**

> 建表方式：`Base.metadata.create_all(bind=engine)` 在 `main.py` 启动时自动执行。
> 后续加字段/加表：必须同时更新 SQLAlchemy model，或手写迁移脚本（当前未集成 Alembic）。

| 表名 | 核心字段 | 说明 |
|------|----------|------|
| **servers** | id, name(unique), ip, os_type, ssh_port, ssh_username, ssh_password_enc, ssh_key_enc, tags, status, cpu_usage, memory_usage, disk_usage, load_average, created_at, updated_at | 服务器清单，密码字段 `_enc` 后缀表示 Fernet 加密 |
| **databases** | id, name(unique), type, host, port, db_name, username, password_enc, charset, connect_params, status, connections, slow_queries, table_size, replication_delay, last_collected_at, created_at, updated_at | 数据库实例，MySQL/PG/Oracle/DM8/Vastbase/TDSQL 都用 type 字段区分 |
| **alerts** | id, source_type(server/database/job/backup), source_id, level(info/warning/critical), title, message, status(unresolved/resolved/acknowledged), acknowledged_at, resolved_at, created_at | 统一告警表，所有模块告警都写入这里 |
| **jobs** | id, name, type(script/sql/crontab), target_id, target_type, content, cron_expression, timeout_seconds, enabled, last_run_at, next_run_at, created_at, updated_at | 定时作业定义 |
| **job_history** | id, job_id, start_time, end_time, duration_seconds, status(success/failed/timeout), output, error_message | 作业执行历史，1 job → N history |
| **sql_notes** | id, title, db_type, category, tags, content, version, latest_version_id, created_at, updated_at | SQL 笔记主表 |
| **sql_note_versions** | id, note_id, version, content, remark, created_at | 同一笔记的历史版本，note_id 外键 |
| **plan_tasks** | id, plan_type(ops/data), title, description, status(todo/in_progress/review/done/blocked), priority(0-3), tags, assignee, start_date, due_date, parent_id, sort_order, created_at, updated_at | 运维/数据看板共用，plan_type 分区 |
| **backup_records** | id, database_id, backup_type(full/incremental/log), backup_file, backup_size_bytes, backup_started_at, backup_finished_at, duration_seconds, status(success/failed/running), verify_status(unverified/passed/failed), error_message | 备份历史 |
| **settings** | id, key(unique), value, type(string/number/boolean/json), description, updated_at | 全局配置 key-value |
| **docs** | id, title, slug, category, content(md), tags, is_pinned, created_at, updated_at | 知识库 Markdown 文档 |

### 6.1 加密规则

- 使用 `cryptography.Fernet`（对称加密）
- 密钥文件: **`backend/data/.encryption_key`**（二进制，严禁上传/泄露/丢失）
- 加密字段名约定: 以 `_enc` 结尾（如 `ssh_password_enc`, `password_enc`, `ssh_key_enc`）
- API 返回前端时一律不解密（前端只看到空串或加密内容，但后端采集时会内部解密使用）
- **迁移须知**：如迁移数据库文件，必须**同步迁移加密密钥**，否则所有密码无法还原

---

## 7. 前后端通信约定

### 7.1 API 基础

| 项 | 值 |
|----|----|
| Base URL | 前端: `/api/v1` (经 Vite 代理)；直连: `http://localhost:8000/api/v1` |
| 健康检查 | `GET /api/v1/health` → `{"status":"healthy","service":"ops-platform"}` |
| Swagger 文档 | 运行后端后访问 `http://localhost:8000/docs` |

### 7.2 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```
- `code=0` 表示成功；非 0 时 `message` 含错误信息，前端 `ElMessage.error` 会自动弹
- 前端 Axios 封装在 [frontend/src/api/index.js](frontend/src/api/index.js)，已做响应拦截

### 7.3 各模块 REST API 速查

```
服务器 Servers:
GET    /api/v1/servers                    列表（支持 ?keyword= & ?status=）
POST   /api/v1/servers                    新增
GET    /api/v1/servers/{id}               详情
PUT    /api/v1/servers/{id}               更新
DELETE /api/v1/servers/{id}               删除
POST   /api/v1/servers/{id}/test          测试 SSH 连接
POST   /api/v1/servers/{id}/collect       手动采集指标（执行 SSH）
GET    /api/v1/servers/{id}/crontab       获取服务器 Crontab 内容

数据库 Databases: 同服务器结构
POST   /api/v1/databases/{id}/test        测试连接
POST   /api/v1/databases/{id}/collect     手动采集指标

告警 Alerts:
GET    /api/v1/alerts?status=unresolved   告警列表
POST   /api/v1/alerts                     手动创建告警
POST   /api/v1/alerts/{id}/acknowledge    确认告警
POST   /api/v1/alerts/{id}/resolve        关闭告警
DELETE /api/v1/alerts/{id}

作业 Jobs:
GET    /api/v1/jobs                       作业列表
POST   /api/v1/jobs                       新增
PUT    /api/v1/jobs/{id}                  更新
DELETE /api/v1/jobs/{id}
GET    /api/v1/jobs/{id}/history          执行历史
POST   /api/v1/jobs/{id}/execute          立即执行一次
POST   /api/v1/jobs/{id}/toggle           启用/禁用

SQL 笔记 SQLNotes:
GET    /api/v1/sql-notes                  列表（?category=&db_type=&keyword=）
POST   /api/v1/sql-notes                  新建（自动 v1）
PUT    /api/v1/sql-notes/{id}             更新（若 content 变化 → 自动新建版本）
GET    /api/v1/sql-notes/{id}/versions    列出所有版本
GET    /api/v1/sql-notes/{id}/versions/{v} 获取指定版本内容
POST   /api/v1/sql-notes/{id}/restore/{v}  回滚到指定版本

计划任务 PlanTasks:
GET    /api/v1/plan-tasks?plan_type=ops   看板列项（ops / data）
POST   /api/v1/plan-tasks                 新增
PUT    /api/v1/plan-tasks/{id}            更新（含拖拽改状态/排序）
DELETE /api/v1/plan-tasks/{id}

驾驶舱 Cockpit:
GET    /api/v1/cockpit/summary            全局统计：服务器/数据库在线率、今日作业成功率、告警数

设置 Settings:
GET    /api/v1/settings/global            获取所有全局设置
PUT    /api/v1/settings/global            批量更新
GET    /api/v1/settings/system            系统信息（Python版本、DB路径、平台、端口）
GET    /api/v1/settings/docs              资料列表
POST   /api/v1/settings/docs              新增 Markdown 文档
PUT    /api/v1/settings/docs/{id}
DELETE /api/v1/settings/docs/{id}
```

---

## 8. 启动与停止（日常使用）

### 8.1 Linux / macOS 一键启动

```bash
cd /path/to/ops-work-platform
./start.sh
```

### 8.2 Windows 一键启动

```cmd
:: 双击 start.bat 即可
:: 或在命令行中运行
cd C:\path\to\ops-work-platform
start.bat
```

启动顺序：
1. 后端 FastAPI → 端口 `8000`
2. 前端 Vite Dev Server → 端口 `5173`
3. 浏览器自动打开 `http://localhost:5173`

> **Windows 首次运行**：`start.bat` 会自动创建 Python 虚拟环境并安装依赖，可能需要几分钟。

### 8.3 单独启动

**Linux / macOS:**
```bash
# 仅后端
cd backend && python -m app.main      # 或 ./backend/start.sh

# 仅前端
cd frontend && npm run dev            # 或 ./frontend/start.sh
```

**Windows:**
```cmd
:: 仅后端
cd backend && start.bat

:: 仅前端
cd frontend && start.bat
```

### 8.4 停止

**Linux / macOS:**
```bash
./stop.sh
# 或手动:
pkill -f "python -m app.main"
pkill -f "vite"
```

**Windows:**
```cmd
:: 双击 stop.bat 即可
stop.bat

:: 或手动关闭弹出窗口
:: 或在任务管理器中结束 python.exe / node.exe
```

### 8.5 Windows 环境要求

| 依赖 | 版本要求 | 下载地址 |
|------|----------|----------|
| Python | 3.10+ | https://www.python.org/downloads/ |
| Node.js | 16+ | https://nodejs.org/ |
| Git | 2.x（可选，用于克隆仓库） | https://git-scm.com/ |

> Windows 安装 Python 时务必勾选 **"Add Python to PATH"**。

### 8.6 日常运维位置

| 内容 | Linux/macOS 路径 | Windows 路径 |
|------|------------------|-------------|
| 数据库文件 | `backend/data/app.db` | `backend\data\app.db` |
| 加密密钥 | `backend/data/.encryption_key` | `backend\data\.encryption_key` |
| Python 虚拟环境 | `backend/venv/` | `backend\venv\` |
| 后端日志 | `uvicorn stdout` | 同左 |
| 前端日志 | 浏览器 Console / Vite stdout | 同左 |

---

## 9. 设计风格与视觉规范

### 9.1 配色（温暖低饱和）

| 用途 | 色值 | 说明 |
|------|------|------|
| 主背景 | `#F7F3ED` | 米杏色 |
| 侧栏背景 | `#EFE7DA` | 浅卡其 |
| 主色 Primary | `#A67C52` | 温暖棕色（按钮、强调） |
| 主色 Hover | `#8C6340` | 深棕 |
| 成功 Success | `#6B8E23` | 橄榄绿（低饱和） |
| 警告 Warning | `#C9A66B` | 米金黄 |
| 危险 Danger | `#B5533B` | 砖红 |
| 信息 Info | `#6B8FA6` | 雾蓝 |
| 卡片背景 | `#FFFBF4` / 白色 | 卡片层 |
| 文字主色 | `#3E342A` | 深棕黑 |
| 文字辅助 | `#7A6B5C` | 灰棕 |
| 边框 | `#E5D9C6` | 米色分割线 |

> 配置位置: `frontend/tailwind.config.js` → `theme.extend.colors`，同时覆写 Element Plus CSS 变量
> 参考：`frontend/src/style.css`

### 9.2 布局规则
- 左侧固定侧栏：Logo + 9 模块导航（带图标）
- 顶部操作栏：全局搜索框 + 快速新增按钮（根据当前上下文）+ 后端状态指示器
- 主体内容区：卡片化，12 栅格，响应式最小宽度 1280px

---

## 10. 第一版已知问题与后续迭代清单 (TODO)

### 10.1 已确认实现但深度待加强
- [ ] **服务器采集命令参数化**：目前采集逻辑预留，需补 `services/collector.py` 里具体 SSH 命令（top/free/df/ps）与阈值判定
- [ ] **数据库驱动覆盖**：已写 MySQL/PG 基础连接，Oracle/DM8/Vastbase/TDSQL 的 `services/db_connectors.py` 待按类型补驱动与采集 SQL
- [ ] **APScheduler 作业运行时**：路由已注册，但调度器实例化与任务注册流程需在 `main.py` 启动时挂载
- [ ] **备份监控的自动采集**：备份记录表已建，需编写针对常见备份工具（mysqldump/pg_dump/rman）的解析器
- [ ] **资料库里的 Markdown 编辑器**：当前页面预留了结构，需要集成 `md-editor-v3` 或同等库
- [ ] **驾驶舱 ECharts 图表**：页面已装 ECharts，需要把服务器/数据库历史指标序列化成趋势图

### 10.2 用户体验/健壮性增强
- [ ] 统一确认弹窗（删除关键数据前二次确认）
- [ ] 列表加载骨架屏 / 空状态插画
- [ ] 前端错误边界页（404/500/后端未启动友好提示）
- [ ] 后端异常兜底：采集失败应降级为 `status: error` 并写告警，不应让接口 500
- [ ] 接口幂等与乐观锁：更新操作防止覆盖并发修改

### 10.3 工具链/工程化
- [ ] 数据库迁移工具（Alembic）：当前改模型只能删库重建，上生产前必须加
- [ ] 前端 Pinia store 分层：9 个模块应有自己的 `stores/*.js`，避免组件内直连 axios
- [ ] 单测/Pytest 骨架：`backend/tests/` + `frontend/tests/`（PRD 验收有要求但未建工程）
- [ ] 日志规范：Python logging 配置 + 按天轮转文件
- [ ] Python 虚拟环境：项目首次部署建议 `python -m venv backend/.venv` 隔离依赖

### 10.4 功能方向（按需启动）
- [ ] 备份文件校验（MD5/SHA、可恢复性演练）
- [ ] SQL 笔记的收藏夹、分组树
- [ ] 看板甘特图视图
- [ ] 告警去重与聚合（同服务器同错误合并为 1 条）
- [ ] 外部通知：钉钉/企业微信机器人（需要用户显式开启）

---

## 11. 排障速查

| 现象 | 可能原因 | 快速处理 |
|------|----------|----------|
| 前端列表"获取失败" | 后端未启动 | Linux: `ps aux \| grep app.main`；Windows: 检查任务管理器 python.exe |
| 前端访问 "后端服务无响应" | 端口 8000 不通 / Vite 代理失败 | `curl http://localhost:8000/api/v1/health` 验证后端 |
| 后端启动报 `sqlite3 no such table` | app.db 为空且 `models` 未导入到 `main.py` | 确认 `from app.models import server,database,...` 在 `main.py` import 链上 |
| 加解密失败 "InvalidToken" | 密钥文件被换/被删 | **无法恢复，只能重新录入所有密码** |
| 服务器/数据库密码解密为空 | 新建时没传密码 / 解密异常被吞 | 重新编辑保存密码 |
| git push 报 443 连不上 | 本机/环境代理策略 | 检查 `.gitconfig` 代理，或切换 SSH URL 推送 |
| npm install 卡住 | 国内源问题 | `--registry https://registry.npmmirror.com` 或写 `.npmrc` |
| pip install 卡住 | 同上 | `-i https://pypi.tuna.tsinghua.edu.cn/simple` |
| UI 色调不对（冷蓝色系） | Tailwind + Element Plus 自定义颜色被覆盖 | 检查 `tailwind.config.js` 与 `style.css` 导入顺序 |
| **Windows: `'python' 不是内部命令`** | Python 未加入 PATH | 重装 Python 勾选 "Add to PATH"，或手动加入系统环境变量 |
| **Windows: `start.bat` 闪退** | 编码或命令错误 | 右键用"编辑"打开查看报错，或在 cmd 中手动执行定位 |
| **Windows: 端口被占用 8000/5173** | 上次未正常停止 | `stop.bat` 或 `netstat -aon \| findstr :8000` 找 PID 后 `taskkill /pid PID /f` |
| **Windows: psycopg2 安装失败** | 缺少 C 编译器 | 使用 `psycopg2-binary`（已在 requirements.txt 中），或装 Visual Studio Build Tools |

---

## 12. 变更记录模板（后续版本请追加到这里）

### vX.Y.Z - YYYY-MM-DD
- **新增**: ...
- **修复**: ...
- **优化**: ...
- **破坏性改动**: ...
- **数据迁移**: 是否需要重建 DB / 执行迁移脚本
- **Git Commit**: `...sha7...`

---

**文档结束**

> 维护原则：改架构、改模型、改依赖版本、改启动方式，都要先更新本文件再写代码。保持与 PRD.md、DevPlan.md 三者一致。
