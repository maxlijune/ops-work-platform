import type { PluginManifest, DbConnection, TablespaceInfo, DatafileInfo, PartitionInfo, PartitionHealthIssue, AddDatafileOptions, QueryResult } from '../../shared/driver-plugin'
import type { DriverPlugin } from './registry'

// 沙箱桩驱动：无真实 Oracle/MySQL 环境时的内置回退实现。
// 用途：
//  1) 提供真实连接无法验证时端到端 UI 演示数据；
//  2) 复用同一 DriverPlugin 接口，Windows 真机上将该 factory 切换为 oracledb / mysql2 实现即可。
// 桩数据固定返回一组示例表空间/数据文件/分区，便于 UI 验收。

export function createDummyOracle(manifest: PluginManifest): DriverPlugin {
  return {
    manifest,
    async testConnection(cfg: DbConnection) {
      // 演示：host 含 'fail' 视为连接失败
      if (cfg.host.includes('fail')) throw new Error('ORA-12541: TNS:no listener')
    },
    async query(cfg, sql, params, opts) {
      const rows = [
        { ID: 1, NAME: 'DEMO_ROW_A', CREATED: new Date().toISOString().slice(0, 19).replace('T', ' ') },
        { ID: 2, NAME: 'DEMO_ROW_B', CREATED: new Date().toISOString().slice(0, 19).replace('T', ' ') }
      ]
      return { columns: Object.keys(rows[0]), rows }
    },
    async getTablespaces() {
      const list: TablespaceInfo[] = [
        { name: 'USERS', totalBytes: 512 * 1024 ** 3, usedBytes: 468.2 * 1024 ** 2 * 1024, freeBytes: 43.8 * 1024 ** 2 * 1024, usedPercent: 91.4, status: 'ONLINE' },
        { name: 'SYSAUX', totalBytes: 128 * 1024 ** 3, usedBytes: 103.1 * 1024 ** 2 * 1024, freeBytes: 24.9 * 1024 ** 2 * 1024, usedPercent: 80.5, status: 'ONLINE' },
        { name: 'UNDOTBS1', totalBytes: 64 * 1024 ** 3, usedBytes: 12.8 * 1024 ** 2 * 1024, freeBytes: 51.2 * 1024 ** 2 * 1024, usedPercent: 20.0, status: 'ONLINE' },
        { name: 'SYSTEM', totalBytes: 96 * 1024 ** 3, usedBytes: 93 * 1024 ** 2 * 1024, freeBytes: 3 * 1024 ** 2 * 1024, usedPercent: 96.8, status: 'ONLINE' }
      ]
      return list
    },
    async getDatafiles(_cfg, tablespace) {
      const sizes = [32, 32, 64, 64, 96, 96]
      return sizes.map((size, i): DatafileInfo => ({
        fileName: `${tablespace}${String(i + 1).padStart(2, '0')}.DBF`,
        path: i < 3 ? `D:\\ORADATA\\PROD01\\` : `E:\\ORADATA2\\PROD01\\`,
        sizeBytes: size * 1024 ** 3,
        autoextend: i !== 2,
        nextBytes: 512 * 1024 ** 2,
        maxSizeBytes: size * 1024 ** 3
      }))
    },
    async generateAddDatafileSql(_cfg, tablespace, opts: AddDatafileOptions) {
      const auto = opts.autoextend
        ? ` AUTOEXTEND ON NEXT ${opts.nextMB}M${opts.maxMB ? ` MAXSIZE ${opts.maxMB}M` : ' UNLIMITED'}`
        : ''
      return [
        `ALTER TABLESPACE ${tablespace}`,
        `ADD DATAFILE '${opts.fileName}' SIZE ${opts.sizeMB}M${auto};`
      ].join('\n')
    },
    async executeDdl(_cfg, sql) {
      return { columns: [], rows: [], rowCount: 0, affectedRows: 0, isSelect: false }
    },
    async listPartitionedTables() {
      return ['ORDERS', 'TRANS_LOG']
    },
    async getPartitionInfo(_cfg, table) {
      const list: PartitionInfo[] = [
        { partitionName: 'P_202601', highValue: '20260201', numRows: 1200000, bytes: 220 * 1024 ** 2 * 1024 },
        { partitionName: 'P_202602', highValue: '20260301', numRows: 980000, bytes: 180 * 1024 ** 2 * 1024 },
        { partitionName: 'P_202603', highValue: '20260401', numRows: 1050000, bytes: 195 * 1024 ** 2 * 1024 },
        { partitionName: 'P_202604', highValue: '20260501', numRows: 800000, bytes: 150 * 1024 ** 2 * 1024 }
      ]
      return list.map((p) => ({ ...p, table }))
    },
    async getPartitionHealth() {
      const issues: PartitionHealthIssue[] = [
        { table: 'ORDERS', partitions: 4, lastHighValue: '20260501', issue: 'near-exhaustion', note: '分区上限已接近当前时间，需预建下月分区' }
      ]
      return issues
    }
  }
}

export function createDummyMysql(manifest: PluginManifest): DriverPlugin {
  const base = createDummyOracle(manifest)
  return {
    ...base,
    manifest,
    async testConnection(cfg: DbConnection) {
      if (cfg.host.includes('fail')) throw new Error('ER_ACCESS_DENIED_ERROR: Access denied')
    },
    async getTablespaces() {
      const list: TablespaceInfo[] = [
        { name: 'innodb_system', totalBytes: 96 * 1024 ** 3, usedBytes: 41.2 * 1024 ** 2 * 1024, freeBytes: 54.8 * 1024 ** 2 * 1024, usedPercent: 43.0, status: 'ACTIVE' },
        { name: 'business_ts', totalBytes: 320 * 1024 ** 3, usedBytes: 289.6 * 1024 ** 2 * 1024, freeBytes: 30.4 * 1024 ** 2 * 1024, usedPercent: 90.5, status: 'ACTIVE' }
      ]
      return list
    },
    async generateAddDatafileSql(_cfg, tablespace, opts: AddDatafileOptions) {
      // MySQL 无 ALTER TABLESPACE ADD DATAFILE；返回说明性 SQL（capabilities.expand=false 时前端会隐藏该操作）
      return `-- MySQL 暂不支持手动扩容表空间\n-- 请评估表空间分配或归档清理`
    }
  }
}

export interface DummyDriver extends ReturnType<typeof createDummyOracle> {}