// 浏览器预览 mock：仅当 Electron preload 未注入 window.api 时启用（沙箱无 GUI 无法跑 Electron）。
// 供静态构建在纯浏览器中做 UI 验收；Windows 真机上 preload 总会注入真实桥，本模块自然失效。
import type { Api, InstanceDTO, InstanceGroupDTO, PluginStateDTO, DashboardTablespacesResult, TemplateDTO, TemplateVersionDTO, AuditLogDTO, NavItemDTO } from '../../shared/ipc'

const GB = 1024 ** 3
const day = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

const tpl = (p: Partial<TemplateDTO>): TemplateDTO => ({ id: 0, title: '', category: '', tags: '', sqlText: '', versionNo: 1, updatedAt: day(), ...p })

export function ensureApiMock(): void {
  if (window.api) return

  const instances: InstanceDTO[] = [
    { id: 1, name: '生产-订单库', host: '192.168.10.31', port: 1521, service: 'PROD01', dbType: 'oracle', groupId: 1, env: 'prod', user: 'app_ops', password: '***', note: '核心交易库' },
    { id: 2, name: '生产-日志库', host: '192.168.10.35', port: 1521, service: 'PROD02', dbType: 'oracle', groupId: 1, env: 'prod', user: 'app_ops', password: '***', note: '归档切换' },
    { id: 3, name: '联调-会员中心', host: '192.168.20.88', port: 3306, service: 'member', dbType: 'mysql', groupId: 2, env: 'uat', user: 'dba', password: '***', note: '业务联调' },
    { id: 4, name: '测试-报表仓', host: 'fail-192.168.30.2', port: 1521, service: 'TESTDW', dbType: 'oracle', groupId: 3, env: 'test', user: 'dba', password: '***', note: '连接失败演示' }
  ]
  const groups: InstanceGroupDTO[] = [
    { id: 1, name: '生产环境', env: 'prod', sortOrder: 1 },
    { id: 2, name: '联调环境', env: 'uat', sortOrder: 2 },
    { id: 3, name: '测试环境', env: 'test', sortOrder: 3 }
  ]
  const plugins: PluginStateDTO[] = [
    { manifest: { id: 'driver-oracle', name: 'Oracle 驱动', dbType: 'oracle', version: '1.0.0', description: '内置 Oracle 11g 驱动（thick 模式）', capabilities: { tablespace: 'full', datafile: true, expand: true, partition: true } }, source: 'builtin', enabled: true, path: 'plugins/driver-oracle' },
    { manifest: { id: 'driver-mysql', name: 'MySQL 驱动', dbType: 'mysql', version: '1.0.0', description: '内置 MySQL 驱动', capabilities: { tablespace: 'basic', datafile: false, expand: false, partition: true } }, source: 'builtin', enabled: true, path: 'plugins/driver-mysql' }
  ]

  const mkDashboard = (): DashboardTablespacesResult[] => {
    const mk = (i: number, name: string, arr: Array<[string, number, number]>): DashboardTablespacesResult => ({
      instanceId: i, instanceName: name, dbType: 'oracle', online: i !== 4,
      onlineMs: i === 4 ? undefined : 120 + i * 40,
      tablespaces: arr.map(([n, used, total]) => {
        const usedPercent = Math.round((used / total) * 1000) / 10
        return { name: n, totalBytes: total * GB, usedBytes: used * GB, freeBytes: (total - used) * GB, usedPercent, status: 'ONLINE' }
      })
    })
    return [
      mk(1, '生产-订单库', [['USERS', 468.2, 512], ['SYSAUX', 103.1, 128], ['UNDOTBS1', 12.8, 64], ['SYSTEM', 93, 96]]),
      mk(2, '生产-日志库', [['LOGDATA', 289.6, 320], ['ARCHIVE', 195.3, 256], ['UNDO', 20, 96]]),
      mk(3, '联调-会员中心', [['business_ts', 289.6, 320]]) as DashboardTablespacesResult,
      { instanceId: 4, instanceName: '测试-报表仓', dbType: 'oracle', online: false, error: 'ORA-12541: TNS:no listener', tablespaces: [] }
    ]
  }

  const templates: TemplateDTO[] = [
    tpl({ id: 1, title: '表空间使用率 TOP20', category: '监控', tags: 'tablespace,容量', sqlText: 'SELECT * FROM dba_tablespace_usage_metrics ORDER BY used_percent DESC FETCH FIRST 20 ROWS ONLY', versionNo: 3 }),
    tpl({ id: 2, title: '分区缺失预警', category: '分区', tags: 'partition,drill', sqlText: '-- 查询当月无分区的表\nSELECT * FROM v$partition_check WHERE high_value < trunc(sysdate)' }),
    tpl({ id: 3, title: '业务数据量比对', category: '筛查', tags: 'sync,比对', sqlText: 'SELECT COUNT(*) FROM orders WHERE create_time >= :startTime' })
  ]
  const versions: TemplateVersionDTO[] = [
    { id: 1, templateId: 1, versionNo: 1, sqlText: 'SELECT * FROM dba_tablespaces', createdAt: day() },
    { id: 2, templateId: 1, versionNo: 2, sqlText: 'SELECT * FROM dba_tablespace_usage_metrics', createdAt: day() },
    { id: 3, templateId: 1, versionNo: 3, sqlText: templates[0].sqlText, createdAt: day() }
  ]
  const logs: AuditLogDTO[] = [
    { id: 1, time: day(), target: '生产-订单库', action: '扩容', payload: 'ADD DATAFILE USERS06, 8G', result: 'SUCCESS' },
    { id: 2, time: day(), target: '测试-报表仓', action: '连接测试', payload: 'testConnection', result: 'FAIL' },
    { id: 3, time: day(), target: '生产-订单库', action: '查询', payload: 'SELECT COUNT(*) FROM orders', result: 'SUCCESS' }
  ]
  const navs: NavItemDTO[] = [
    { id: 1, name: 'DSG 控制台', type: 'url', target: 'http://10.0.2.15:8800', group: '同步' },
    { id: 2, name: 'Zabbix 监控', type: 'url', target: 'http://10.0.2.16', group: '监控' },
    { id: 3, name: '备份脚本目录', type: 'folder', target: 'D:\\scripts\\backup', group: '脚本' },
    { id: 4, name: '扩容检查单', type: 'file', target: 'D:\\docs\\扩容检查单.md', group: '文档' }
  ]

  const api: Api = {
    plugins: {
      list: async () => plugins,
      setEnabled: async (id, enabled) => { const p = plugins.find((x) => x.manifest.id === id); if (p) p.enabled = enabled; return true },
      install: async () => plugins[0],
      uninstall: async () => true
    },
    instances: {
      list: async () => instances,
      save: async (d) => templates[0] as unknown as InstanceDTO,
      delete: async () => {},
      test: async (id) => (id === 4 ? { ok: false, error: 'ORA-12541: TNS:no listener' } : { ok: true, ms: 46 })
    },
    groups: {
      list: async () => groups,
      save: async (d) => ({ id: 9, name: d.name ?? '新分组', env: d.env }) as InstanceGroupDTO,
      delete: async () => {}
    },
    dashboard: {
      tablespaces: async () => mkDashboard(),
      datafiles: async () => [
        { fileName: 'USERS01.DBF', path: 'D:\\ORADATA\\PROD01\\', sizeBytes: 32 * GB, autoextend: true, nextBytes: 512 * 1024 ** 2, maxSizeBytes: 32 * GB },
        { fileName: 'USERS02.DBF', path: 'D:\\ORADATA\\PROD01\\', sizeBytes: 32 * GB, autoextend: true, nextBytes: 512 * 1024 ** 2, maxSizeBytes: 32 * GB }
      ],
      addDatafile: async () => ({ columns: [], rows: [], rowCount: 0, isSelect: false }),
      partitions: async () => [
        { partitionName: 'P_202601', highValue: '20260201', numRows: 1200000, bytes: 220 * 1024 * 1024 * 1024 },
        { partitionName: 'P_202602', highValue: '20260301', numRows: 980000, bytes: 180 * 1024 * 1024 * 1024 }
      ],
      partitionHealth: async (id) => (id === 1 ? [{ table: 'TRANS_LOG', partitions: 12, lastHighValue: '20260901', issue: 'near-exhaustion', note: '分区已达当月上限，需预建下月分区' }] : [])
    },
    templates: {
      list: async () => templates,
      save: async (d) => tpl({ ...d, id: d.id ?? 99, versionNo: (d.versionNo ?? 1) + 1 }),
      delete: async () => {},
      versions: async () => versions,
      revert: async (id, vNo) => ({ ...templates[0], sqlText: versions.find((v) => v.versionNo === vNo)?.sqlText ?? '' })
    },
    query: {
      run: async (_id, _sql, _params, opts) => ({
        columns: ['ID', 'NAME', 'CREATED'],
        rows: [
          { ID: 1, NAME: 'DEMO_ROW_A', CREATED: day() },
          { ID: 2, NAME: 'DEMO_ROW_B', CREATED: day() }
        ],
        rowCount: 2,
        isSelect: true
      }),
      export: async () => ({ path: 'D:\\exports\\demo.xlsx' })
    },
    logs: { list: async (limit) => logs.slice(0, limit ?? 100) },
    nav: {
      list: async () => navs,
      save: async (d) => ({ id: 9, name: d.name ?? '', type: d.type ?? 'url', target: d.target ?? '' }) as NavItemDTO,
      delete: async () => {},
      open: async () => ({ ok: true })
    },
    settings: { get: async () => null },
    app: { info: async () => ({ version: '0.0.1.202609111236', name: 'DBA 运维工作台' }) }
  }

  window.api = api as Api
}