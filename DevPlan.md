# 运维工作平台开发计划 (Dev Plan)

> **版本**: v1.0
> **依据**: `PRD.md`
> **原则**: 能运行、能测试、能验收
> **最后更新**: 2026-08-09

---

## 阶段 0：环境准备与项目初始化
**目标**: 搭建可独立运行的前后端项目骨架，确保开发环境一致。

### 0.1. 技术栈与版本锁定
*   **后端**: Python 3.10+
*   **前端**: Node.js 18+
*   **核心依赖** (需在 `requirements.txt` / `package.json` 中锁定版本):
    *   后端: `FastAPI`, `SQLAlchemy`, `APScheduler`, `Paramiko`, `PyMySQL`, `psycopg2-binary`, `cryptography`, `pydantic`
    *   前端: `Vue 3`, `Vite`, `Pinia`, `Vue Router`, `Tailwind CSS`, `Element Plus`, `ECharts`, `Axios`

### 0.2. 项目结构
```
/workspace
├── backend/                # 后端代码
│   ├── app/
│   │   ├── main.py         # FastAPI 入口
│   │   ├── core/           # 核心配置 (DB, 加密)
│   │   ├── models/         # ORM 模型
│   │   ├── routers/        # API 路由
│   │   ├── services/       # 业务逻辑 (采集、告警)
│   │   └── schemas/        # Pydantic 数据模型
│   ├── data/               # SQLite 数据库目录
│   ├── requirements.txt
│   └── start.sh            # 启动脚本
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── api/            # API 调用封装
│   │   ├── components/     # 通用组件
│   │   ├── views/          # 页面视图
│   │   ├── stores/         # Pinia 状态
│   │   └── App.vue
│   ├── package.json
│   └── start.sh
└── README.md
```

### 0.3. 验收标准
1.  **运行**：执行 `backend/start.sh` 可启动 FastAPI 服务 (端口 8000)，执行 `frontend/start.sh` 可启动 Vite 服务 (端口 5173)。
2.  **测试**：浏览器访问 `http://localhost:8000/docs` 能看到 Swagger UI。
3.  **验收**：前端页面能成功调用后端的一个健康检查接口（如 `/api/v1/health`）并显示“连接成功”。

---

## 阶段 1：基础架构与通用服务
**目标**: 建立数据模型、通用 CRUD 接口、加密服务和统一告警机制。

### 1.1. 数据库模型设计
**数据表** (需在 `backend/app/models/` 下实现):
*   **`servers` 表**:
    *   `id` (Integer, PK)
    *   `name` (String, 唯一)
    *   `ip` (String)
    *   `os_type` (String, e.g., "Linux")
    *   `ssh_port` (Integer, default 22)
    *   `ssh_username` (String)
    *   `ssh_password_enc` (Text, **加密存储**)
    *   `ssh_key_enc` (Text, nullable, **加密存储**)
    *   `status` (String, default "active")
    *   `created_at`, `updated_at`
*   **`databases` 表**:
    *   `id` (Integer, PK)
    *   `name` (String, 唯一)
    *   `type` (String, e.g., "MySQL", "PostgreSQL")
    *   `host`, `port`, `db_name`
    *   `username`
    *   `password_enc` (Text, **加密存储**)
    *   `server_id` (Integer, FK -> servers.id, nullable)
    *   `status`, `created_at`, `updated_at`
*   **`alerts` 表**:
    *   `id` (Integer, PK)
    *   `source_type` (String, e.g., "server", "database", "job")
    *   `source_id` (Integer)
    *   `level` (String, "info", "warning", "critical")
    *   `alert_type` (String, e.g., "CPU_HIGH", "DB_DOWN")
    *   `message` (Text)
    *   `status` (String, default "unresolved")
    *   `resolved_at`, `resolved_by`
    *   `created_at`
*   **`sql_notes` 表**:
    *   `id` (Integer, PK)
    *   `title`, `content`, `db_type`, `folder`, `tags`
    *   `version` (Integer)
    *   `is_current` (Boolean)
    *   `created_at`, `updated_at`
*   **`plan_tasks` 表**:
    *   `id`, `title`, `description`, `status` (String), `priority` (Integer)
    *   `due_date`, `progress`, `assignee`, `plan_type` (String, "ops" or "data")
    *   `created_at`, `updated_at`

### 1.2. 通用服务实现
*   **`encryption_service.py`**: 实现 `encrypt(plaintext)` 和 `decrypt(ciphertext)` 方法，使用 `cryptography.fernet` 算法。
*   **`alert_service.py`**: 实现 `create_alert()` 和 `get_alerts()` 方法。
*   **`crud_base.py`**: 提供通用的增删改查基类，减少代码重复。

### 1.3. 验收标准
1.  **运行**：执行 `python -m app.core.database` 成功创建 `data/app.db` 及所有表。
2.  **测试**：通过 API 创建一条服务器记录，检查数据库文件中 `ssh_password_enc` 字段是否为密文（非明文）。
3.  **验收**：
    *   调用 `/api/v1/alerts` 能成功查询告警列表。
    *   调用 `/api/v1/servers` 能成功增删改查服务器（验证密文存储）。

---

## 阶段 2：服务器与数据库监控模块
**目标**: 实现核心的监控采集和展示功能。

### 2.1. 服务器模块开发
*   **后端 API** (`backend/app/routers/servers.py`):
    *   `POST /api/v1/servers/test-connection`: 测试 SSH 连接。
    *   `POST /api/v1/servers/{id}/collect`: 立即执行一次采集（调用 `Paramiko`）。
    *   采集内容：`CPU_USAGE`, `MEMORY_USAGE`, `DISK_USAGE`, `LOAD_AVERAGE`。
*   **后端逻辑** (`backend/app/services/ssh_client.py`):
    *   封装 `Paramiko` 客户端。
    *   实现 `execute_command()` 和 `check_file_exists()` 方法。
    *   异常时自动调用 `alert_service.create_alert()`。
*   **前端页面** (`frontend/src/views/Servers.vue`):
    *   **列表页**: 表格展示服务器列表，支持新增/编辑、测试连接、手动采集。
    *   **详情页**: 展示实时指标卡片和 ECharts 趋势图。

### 2.2. 数据库模块开发
*   **后端 API** (`backend/app/routers/databases.py`):
    *   `POST /api/v1/databases/test-connection`: 测试 DB 连接（根据 `type` 字段分发到不同驱动）。
    *   `POST /api/v1/databases/{id}/collect`: 执行一次采集。
    *   采集内容：`ACTIVE_CONNECTIONS`, `SLOW_QUERIES`, `TABLE_SIZE`, `REPLICATION_DELAY`。
*   **前端页面** (`frontend/src/views/Databases.vue`):
    *   类似服务器模块，需支持按数据库类型动态展示不同详情 Tab（如 Oracle 展示表空间，MySQL 展示主从状态）。

### 2.3. 驾驶舱开发
*   **后端 API** (`backend/app/routers/cockpit.py`):
    *   `GET /api/v1/cockpit/summary`: 聚合各模块核心指标。
*   **前端页面** (`frontend/src/views/Cockpit.vue`):
    *   **统计带**: 在线率、成功率等大数字卡片。
    *   **告警区**: 展示最近 10 条未处理告警，点击跳转详情。

### 2.4. 验收标准
1.  **运行**：后端服务正常运行，前端页面可访问。
2.  **测试**:
    *   配置一台测试服务器，点击“测试连接”，返回成功。
    *   点击“立即采集”，数据库中 `servers` 表的 `updated_at` 更新，`alerts` 表可能新增记录（模拟异常时）。
3.  **验收**:
    *   前端服务器列表页能正常展示列表和新增弹窗。
    *   驾驶舱页面能正确显示服务器在线率和告警数量。
    *   点击告警条目可跳转到对应服务器详情页。

---

## 阶段 3：辅助功能模块
**目标**: 完善作业调度、笔记、计划、备份等辅助功能。

### 3.1. 定时作业模块
*   **后端**:
    *   集成 `APScheduler`。
    *   `POST /api/v1/jobs`: 创建定时任务（支持 `interval` 和 `cron` 表达式）。
    *   任务类型：`script` (通过 SSH 执行) 和 `sql` (通过 DB 客户端执行)。
    *   `GET /api/v1/jobs/{id}/history`: 查询执行历史。
    *   `GET /api/v1/servers/{id}/crontab`: 采集服务器原生 Crontab。
*   **前端** (`Jobs.vue`):
    *   平台作业列表 + 执行日志时间线。
    *   服务器 Cron 查看页。

### 3.2. SQL 笔记模块
*   **后端**:
    *   `POST /api/v1/sql-notes`: 创建新版本（不覆盖旧版本）。
    *   `GET /api/v1/sql-notes/{id}/versions`: 获取版本历史。
    *   `GET /api/v1/sql-notes/{id}/compare`: 对比两个版本。
*   **前端** (`SQLNotes.vue`):
    *   三栏布局：分类树 / 笔记列表 / 编辑器。
    *   支持 Markdown 编辑器（如 `v-md-editor`）。
    *   版本历史与对比视图。

### 3.3. 开发计划模块
*   **后端**: `PlanTask` CRUD，`plan_type` 区分运维/数据。
*   **前端**:
    *   看板组件（使用 `vuedraggable`）。
    *   任务详情弹窗。

### 3.4. 数据备份监控
*   **后端**: 定时通过 SSH 检查备份文件，生成告警。
*   **前端**: 备份状态表格，配置编辑。

### 3.5. 资料与设置
*   **后端**: 全局设置、资料库 CRUD、数据导出接口。
*   **前端**: 设置表单、Markdown 文档编辑器、系统信息页。

### 3.6. 验收标准
1.  **测试**:
    *   创建一个定时作业，设置为每分钟执行一次，观察执行历史日志。
    *   创建 SQL 笔记，保存后修改内容再次保存，检查版本历史是否有 2 条记录。
2.  **验收**:
    *   定时作业能按预期执行，失败时有日志记录和告警。
    *   SQL 笔记版本对比能清晰展示差异。
    *   开发看板能成功拖拽任务卡片改变状态。

---

## 阶段 4：联调与优化
**目标**: 解决模块间依赖，提升用户体验，修复 Bug。

### 4.1. 全局状态管理
*   使用 Pinia 实现全局告警状态（顶部铃铛实时更新）。
*   实现全局 Loading 和 Toast 提示。

### 4.2. 性能与体验优化
*   **后端**: 优化 SQL 查询，避免 N+1 问题；使用异步任务处理采集逻辑。
*   **前端**: 路由懒加载；图表按需加载；列表分页。

### 4.3. 异常处理
*   **后端**: 全局异常捕获，返回统一错误格式。
*   **前端**: 处理网络断开、后端无响应、权限错误等场景。

### 4.4. 验收标准
1.  **压力测试**: 手动创建 100 个服务器，前端列表滚动流畅，无明显卡顿。
2.  **故障注入**: 强制关闭后端，前端操作时能弹出“后端连接失败”提示。
3.  **UI 验收**: 全站配色、字体、圆角、按钮风格符合 PRD 视觉规范。

---

## 阶段 5：交付与文档
**目标**: 完成最终交付物。

### 5.1. 一键启动与停止
*   提供 `start.sh` 和 `stop.sh` 脚本。
*   `start.sh` 包含：创建虚拟环境 -> 安装依赖 -> 启动后端 -> 启动前端 -> 打开浏览器。

### 5.2. 平台使用手册
*   在“资料与设置”模块内置详细的中文使用文档。
*   涵盖：快速开始、各模块功能详解、常见问题排查。

### 5.3. 最终验收
*   **全流程跑通**: 从新增服务器 -> 配置采集 -> 产生告警 -> 处理告警。
*   **数据持久化**: 重启后端服务，之前配置的服务器和告警记录依然存在。
*   **安全验证**: 检查数据库文件，确认所有凭证字段均为密文。