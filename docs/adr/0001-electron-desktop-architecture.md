# ADR 0001: 采用 Electron 桌面应用架构，v1 仅支持 Oracle/MySQL

Status: Accepted
Date: 2026-09-11

## Context

工作台为 DBA 个人本地使用，需连接 10~50 个数据库实例（Oracle 为主、MySQL 偏少、DM8/Vastbase 等国产库），并通过 SSH 操作 3~5 台 DSG 同步服务器。原项目为 FastAPI+Vue+SQLite 的本地 Web 应用，本次重置后用户在需求访谈中明确选择 Electron 桌面客户端。Node.js 生态对 DM8/Vastbase 的驱动尚不成熟。

## Decision

采用 Electron 桌面应用（渲染进程 Vue 3 + 主进程 Node.js，本地 SQLite 存储），数据库驱动 v1 仅接 Oracle（node-oracledb）与 MySQL（mysql2）；DM8、Vastbase 列入 v2，届时视驱动情况选择 ODBC 桥接或 Python sidecar 方案。

## Consequences

- 正面：双击即用的桌面体验，无需浏览器与本地服务端口；SSH 与数据库操作统一在主进程 Node 生态内闭环
- 负面：安装包体积大（100MB+）；国产库支持推迟到 v2，v1 登记国产库实例需明确提示"暂不支持"
- 后续约束：v2 国产库适配若选 Python sidecar 将引入双运行时打包复杂度；Oracle 11g 需 oracledb thick 模式并捆绑 Instant Client，用户 Oracle 版本分布需在 dev-plan 前确认
