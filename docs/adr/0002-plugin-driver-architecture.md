# ADR 0002: 数据库驱动采用同进程外置目录插件架构

Status: Accepted
Date: 2026-09-11

## Context

用户要求实例管理的数据库类型支持以插件方式实现：驱动可装卸、可禁用，减少不必要的驱动体积占用，便于后期自行管理插件。v1 仅需 Oracle（oracledb thin，纯 JS）与 MySQL（mysql2，纯 JS）两个驱动；v2 计划接入 DM8、Vastbase 等可能包含原生二进制的国产库驱动。本决策细化 ADR 0001 中"数据库驱动 v1 仅接 Oracle 与 MySQL"的接入方式。

## Decision

采用同进程外置目录插件：插件为文件夹（manifest.json + 入口 JS + 自带 node_modules），主进程启动时从内置 resources/plugins（只读，官方插件，可禁用不可卸载）与 userData/plugins（用户区，支持 zip 安装/卸载）双源扫描动态加载。DriverPlugin 契约全异步（Promise）并带 capabilities 能力声明；加载器对插件方法做统一 Promise wrap 兜底，单插件失败隔离不影响应用。

## Consequences

- 正面：插件装卸即数据库类型开关，安装包只携带必要驱动；契约全异步使 v2 可为原生驱动插件单独引入 sidecar 适配层（SidecarAdapter implements DriverPlugin）而不推翻接口
- 负面：同进程无崩溃隔离，依赖方法级 wrap 兜底而非进程边界；未来原生驱动插件需处理 Electron ABI 或走 sidecar；插件安全性仅靠 manifest 校验（个人工具不做签名）
- 后续约束：v2 国产库插件引入原生模块时，必须先评估 sidecar 适配；SidecarAdapter 方案确定前不得在 DriverPlugin 契约中引入同步或主进程阻塞调用
