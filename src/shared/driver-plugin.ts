// 领域驱动插件契约（无运行时依赖，主进程加载器据此注入各驱动实现）

/** 插件清单元信息 */
export interface PluginManifest {
  id: string
  name: string
  dbType: string // 数据库类型标识，如 'oracle' | 'mysql'；对应实例的 db_type
  version: string
  description?: string
  /** 由插件声明的能力位，渲染端据此隐藏不支持的列/操作 */
  capabilities?: {
    tablespace?: 'full' | 'basic' | 'none' // 表空间监控：full 完整 / basic 精简 / none 不支持
    datafile?: boolean // 数据文件明细
    expand?: boolean // 手动扩容
    partition?: boolean // 分区信息/健康检查
  }
}

/** 数据库连接配置（凭据字段明文，见 spec Assumptions） */
export interface DbConnection {
  host: string
  port: number
  service: string // Oracle service name / SID；MySQL 此处为数据库名
  user: string
  password: string
  connectString?: string
}

export interface QueryOptions {
  limit?: number
  offset?: number
}

/** 流式查询：每批返回行数组，由插件分批吐出 */
export type StreamBatchHandler = (batch: Record<string, unknown>[]) => void | Promise<void>

// ---- 表空间 ----
export interface TablespaceInfo {
  name: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usedPercent: number
  status?: string
  /** 数据块数量等附加信息 */
  blocks?: number
}

export interface DatafileInfo {
  fileName: string
  path: string
  sizeBytes: number
  autoextend: boolean
  nextBytes?: number
  maxSizeBytes?: number
}

export interface AddDatafileOptions {
  fileName: string
  sizeMB: number
  autoextend: boolean
  nextMB: number
  maxMB?: number
}

// ---- 分区 ----
export interface PartitionInfo {
  partitionName: string
  highValue?: string
  numRows?: number
  bytes?: number
  lastWrite?: string
}

export interface PartitionHealthIssue {
  table: string
  owner?: string
  partitions: number
  lastHighValue?: string
  issue: 'no-rows' | 'near-exhaustion' | 'missing-high-value'
  note: string
}

// ---- 查询 ----
export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  rowCount: number
  isSelect: boolean
}

/** DM/Vastbase 未接入插件的统一错误 */
export class UnsupportedDbError extends Error {
  constructor(dbType: string) {
    super(`暂不支持该数据库类型：${dbType}（将在后续版本提供驱动插件）`)
    this.name = 'UnsupportedDbError'
  }
}