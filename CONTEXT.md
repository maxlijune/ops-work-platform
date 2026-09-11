# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| 驱动插件 (DriverPlugin) | 一种数据库类型的连接与操作能力模块，可装卸/禁用 | 内置源(resources)与用户源(userData/plugins)双来源；v1 官方插件 oracle/mysql |
| 实例 (Instance) | 已登记的数据库连接目标，含主机/端口/服务名/凭据/分组 | 可选 db_type 由已启用插件决定 |
| 业务分组 (Group) | 实例按业务系统/环境（生产/测试）的组织维度 | |
| 表空间 (Tablespace) | Oracle 存储单元，容量监控与手动扩容的对象 | MySQL 按其语义降级展示 |
| 数据文件 (Datafile) | 表空间的物理文件（路径/大小/自增长配置） | |
| 分区 (Partition) | 表的数据分区，v1 仅查询与健康检查，不做分区 DDL | |
| SQL模板 (SqlTemplate) | 参数化 SQL 脚本，`:name` 形式变量参数 | 原称"筛查脚本"，访谈 Wave 3 定名 |
| 模板版本 (TemplateVersion) | SQL 模板的历史版本，支持查看与回退 | |
| 快速导航项 (NavItem) | 侧栏快捷入口，类型：URL/文件夹/文件/Windows 应用 | 点击经 shell.openExternal/openPath 打开 |
| 操作日志 (AuditLog) | 工作台执行的所有变更操作记录 | DDL 等变更均入日志 |
| DSG | 迪思杰数据同步软件（RealSync/SuperSync 系列） | **模块整体暂缓**，相关术语（SSH主机/同步链路/初始化向导）随模块冻结，重启时恢复 |
