# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| 实例 (Instance) | 已登记的数据库连接目标，含主机/端口/服务名/凭据/分组 | v1 支持 Oracle/MySQL；国产库 v2 |
| 业务分组 (Group) | 实例按业务系统/环境（生产/测试）的组织维度 | |
| 表空间 (Tablespace) | Oracle 存储单元，容量监控与手动扩容的对象 | |
| 数据文件 (Datafile) | 表空间的物理文件（路径/大小/自增长配置） | |
| 分区 (Partition) | 表的数据分区，v1 仅查询与健康检查，不做分区 DDL | |
| SQL模板 (SqlTemplate) | 参数化 SQL 脚本，带变量参数（如 `:date`） | 原称"筛查脚本"，访谈 Wave 3 定名 |
| 模板版本 (TemplateVersion) | SQL 模板的历史版本，支持查看与回退 | |
| 同步链路 (SyncLink) | DSG 中一条源→目标的数据同步通道 | |
| SSH主机 (SshHost) | 部署 DSG 的服务器，共 3~5 台 | |
| 初始化向导 (Init Wizard) | 新链路全量初始化/断点恢复的分步流程编排 | 建链路→全量装载→增量追平→校验 |
| 操作日志 (AuditLog) | 工作台执行的所有变更操作记录 | DDL/启停/初始化均入日志 |
| DSG | 迪思杰数据同步软件（RealSync/SuperSync 系列） | 通过 SSH+命令行操作 |
