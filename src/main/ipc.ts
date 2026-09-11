import { ipcMain, dialog, shell } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  InstanceDTO, InstanceGroupDTO, TemplateDTO, TemplateVersionDTO, AuditLogDTO,
  NavItemDTO, NavType, QueryExportOptions, DashboardTablespacesResult
} from '../shared/ipc'
import type { DbConnection, AddDatafileOptions, UnsupportedDbError as UnsupportedDbErrorType } from '../shared/driver-plugin'
import { getDb, auditLog } from './db'
import { guardSql, extractParams } from './sqlguard'
import { exportResult } from './exporter'
import { PluginManager } from './plugins/registry'

type Handler = (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown

function register(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (e) {
      return { __error: e instanceof Error ? e.message : String(e) }
    }
  })
}

// 统一错误装箱：IPC 返回 { __error } 时渲染端识别
function classify<T>(ret: T | { __error: string }): T {
  return ret as T
}

interface Unwrap<T> {
  ok: boolean
  data: T | null
  error?: string
}
function unwrap<T>(ret: unknown): Unwrap<T> {
  if (ret && typeof ret === 'object' && '__error' in (ret as object)) {
    return { ok: false, data: null, error: (ret as { __error: string }).__error }
  }
  return { ok: true, data: ret as T }
}

// ---- 实例 -> 连接配置 ----
function toConn(row: InstanceDTO): DbConnection {
  return {
    host: row.host,
    port: row.port,
    service: row.service,
    user: row.user,
    password: row.password
  }
}

export function registerIpc(): void {
  // 应用信息
  register(IPC.appInfo, () => ({ version: process.env.npm_package_version ?? '0.0.1', name: 'DBA 运维工作台' }))

  // 设置
  register(IPC.settingsGet, (_e, key: string) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined
    return row ? row.value : null
  })

  // ---- 插件 ----
  register(IPC.pluginList, () => PluginManager.getInstance().list())
  register(IPC.pluginSetEnabled, (_e, id: string, enabled: boolean) => PluginManager.getInstance().setEnabled(id, enabled))
  register(IPC.pluginInstall, async (_e, zipPath: string) => {
    let p = zipPath
    if (!p) {
      const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '插件包', extensions: ['zip'] }] })
      if (r.canceled || !r.filePaths[0]) throw new Error('已取消选择')
      p = r.filePaths[0]
    }
    return PluginManager.getInstance().install(p)
  })
  register(IPC.pluginUninstall, (_e, id: string) => PluginManager.getInstance().uninstall(id))

  // ---- 分组 ----
  register(IPC.groupList, () => getDb().prepare('SELECT * FROM instance_groups ORDER BY sort_order,id').all())
  register(IPC.groupSave, (_e, d: Partial<InstanceGroupDTO>) => {
    if (d.id) {
      getDb().prepare('UPDATE instance_groups SET name=?, env=? WHERE id=?').run(d.name ?? '', d.env ?? '', d.id)
    } else {
      getDb().prepare('INSERT INTO instance_groups (name,env) VALUES (?,?)').run(d.name ?? '', d.env ?? '')
    }
    return getDb().prepare('SELECT * FROM instance_groups ORDER BY id').all().slice(-1)[0]
  })
  register(IPC.groupDelete, (_e, id: number) => getDb().prepare('DELETE FROM instance_groups WHERE id=?').run(id))

  // ---- 实例 ----
  register(IPC.instanceList, () => getDb().prepare('SELECT * FROM instances ORDER BY id').all())
  register(IPC.instanceSave, (_e, d: Partial<InstanceDTO>) => {
    if (d.id) {
      getDb()
        .prepare('UPDATE instances SET name=?,host=?,port=?,service=?,db_type=?,group_id=?,env=?,user=?,password=?,note=? WHERE id=?')
        .run(d.name ?? '', d.host ?? '', d.port ?? 1521, d.service ?? '', d.dbType ?? 'oracle', d.groupId ?? null, d.env ?? '', d.user ?? '', d.password ?? '', d.note ?? '', d.id)
    } else {
      getDb()
        .prepare('INSERT INTO instances (name,host,port,service,db_type,group_id,env,user,password,note) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(d.name ?? '', d.host ?? '', d.port ?? 1521, d.service ?? '', d.dbType ?? 'oracle', d.groupId ?? null, d.env ?? '', d.user ?? '', d.password ?? '', d.note ?? '')
    }
    return getDb().prepare('SELECT * FROM instances ORDER BY id').all().slice(-1)[0]
  })
  register(IPC.instanceDelete, (_e, id: number) => getDb().prepare('DELETE FROM instances WHERE id=?').run(id))
  register(IPC.instanceTest, (_e, id: number) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(id) as InstanceDTO
    if (!inst) return { ok: false, error: '实例不存在' }
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    if (!adapter) return { ok: false, error: `驱动插件未启用：${inst.dbType}` }
    const t0 = Date.now()
    return adapter
      .testConnection(toConn(inst))
      .then(() => ({ ok: true, ms: Date.now() - t0 }))
      .catch((e: Error) => ({ ok: false, error: e.message }))
  })

  // ---- 看板：表空间 ----
  register(IPC.dashboardTablespaces, async () => {
    const instances = getDb().prepare('SELECT * FROM instances').all() as InstanceDTO[]
    const results: DashboardTablespacesResult[] = []
    for (const inst of instances) {
      const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
      if (!adapter) {
        results.push({ instanceId: inst.id, instanceName: inst.name, dbType: inst.dbType, online: false, error: 'driver disabled', tablespaces: [] })
        continue
      }
      const t0 = Date.now()
      try {
        await adapter.testConnection(toConn(inst))
        const tablespaces = await adapter.getTablespaces(toConn(inst))
        results.push({ instanceId: inst.id, instanceName: inst.name, dbType: inst.dbType, online: true, onlineMs: Date.now() - t0, tablespaces })
      } catch (e) {
        results.push({ instanceId: inst.id, instanceName: inst.name, dbType: inst.dbType, online: false, error: e instanceof Error ? e.message : String(e), tablespaces: [] })
      }
    }
    return results
  })

  register(IPC.dashboardDatafiles, (_e, instanceId: number, tablespace: string) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(instanceId) as InstanceDTO
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    return adapter ? adapter.getDatafiles(toConn(inst), tablespace) : []
  })

  register(IPC.dashboardAddDatafile, async (_e, instanceId: number, tablespace: string, opts: AddDatafileOptions) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(instanceId) as InstanceDTO
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    if (!adapter) throw new Error('驱动未启用')
    const sql = await adapter.generateAddDatafileSql(toConn(inst), tablespace, opts)
    const result = await adapter.executeDdl(toConn(inst), sql)
    auditLog(`${inst.name}::${tablespace}`, '扩容', sql, 'SUCCESS')
    return result
  })

  register(IPC.dashboardPartitions, (_e, instanceId: number, table: string) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(instanceId) as InstanceDTO
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    return adapter ? adapter.getPartitionInfo(toConn(inst), table) : []
  })

  register(IPC.dashboardPartitionHealth, (_e, instanceId: number) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(instanceId) as InstanceDTO
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    return adapter ? adapter.getPartitionHealth(toConn(inst)) : []
  })

  // ---- SQL 模板 ----
  register(IPC.templateList, () => getDb().prepare('SELECT * FROM sql_templates ORDER BY updated_at DESC').all())
  register(IPC.templateSave, (_e, d: Partial<TemplateDTO>) => {
    if (d.id) {
      // 保存即新版本
      const cur = getDb().prepare('SELECT version_no FROM sql_templates WHERE id=?').get(d.id) as { version_no: number } | undefined
      const newVersion = (cur ? cur.version_no : 0) + 1
      getDb().prepare('UPDATE sql_templates SET title=?,category=?,tags=?,sql_text=?,version_no=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
        .run(d.title ?? '', d.category ?? '', d.tags ?? '', d.sqlText ?? '', newVersion, d.id)
      getDb().prepare('INSERT INTO template_versions (template_id,version_no,sql_text,note) VALUES (?,?,?,?)')
        .run(d.id, newVersion, d.sqlText ?? '', '')
    } else {
      getDb().prepare('INSERT INTO sql_templates (title,category,tags,sql_text,version_no) VALUES (?,?,?,?,1)')
        .run(d.title ?? '', d.category ?? '', d.tags ?? '', d.sqlText ?? '')
      const id = (getDb().prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id
      getDb().prepare('INSERT INTO template_versions (template_id,version_no,sql_text) VALUES (?,1,?)').run(id, d.sqlText ?? '')
    }
    return getDb().prepare('SELECT * FROM sql_templates ORDER BY id DESC').all()[0]
  })
  register(IPC.templateDelete, (_e, id: number) => {
    getDb().prepare('DELETE FROM template_versions WHERE template_id=?').run(id)
    getDb().prepare('DELETE FROM sql_templates WHERE id=?').run(id)
  })
  register(IPC.templateVersions, (_e, id: number) => getDb().prepare('SELECT * FROM template_versions WHERE template_id=? ORDER BY version_no DESC').all(id))
  register(IPC.templateRevert, (_e, id: number, versionNo: number) => {
    const v = getDb().prepare('SELECT sql_text FROM template_versions WHERE template_id=? AND version_no=?').get(id, versionNo) as { sql_text: string } | undefined
    if (!v) throw new Error('版本不存在')
    getDb().prepare('UPDATE sql_templates SET sql_text=? WHERE id=?').run(v.sql_text, id)
    return getDb().prepare('SELECT * FROM sql_templates WHERE id=?').get(id)
  })

  // ---- 查询 ----
  register(IPC.queryRun, async (_e, instanceId: number, sql: string, params: Record<string, unknown>, opts?: { limit?: number }) => {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id=?').get(instanceId) as InstanceDTO
    const adapter = PluginManager.getInstance().adapterFor(inst.dbType)
    if (!adapter) throw new Error('驱动未启用')
    const check = guardSql(sql)
    if (!check.allowed) throw new Error(`只读拦截：${check.reason}`)
    const result = await adapter.query(toConn(inst), sql, params ?? {}, { limit: opts?.limit })
    return result
  })
  register(IPC.queryExport, async (_e, o: QueryExportOptions) => {
    const out = await exportResult({ format: o.format, filePath: o.filePath, columns: o.columns, rows: o.rows })
    return { path: o.filePath }
  })

  // ---- 日志 ----
  register(IPC.logsList, (_e, limit = 100) => getDb().prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit))

  // ---- 快捷导航 ----
  register(IPC.navList, () => getDb().prepare('SELECT * FROM nav_items ORDER BY sort_order,id').all())
  register(IPC.navSave, (_e, d: Partial<NavItemDTO>) => {
    if (d.id) {
      getDb().prepare('UPDATE nav_items SET name=?,type=?,target=?,grp=?,sort_order=? WHERE id=?')
        .run(d.name ?? '', d.type ?? 'url', d.target ?? '', d.group ?? '', d.sortOrder ?? 0, d.id)
    } else {
      getDb().prepare('INSERT INTO nav_items (name,type,target,grp,sort_order) VALUES (?,?,?,?,?)')
        .run(d.name ?? '', d.type ?? 'url', d.target ?? '', d.group ?? '', d.sortOrder ?? 0)
    }
    return getDb().prepare('SELECT * FROM nav_items ORDER BY id DESC').all()[0]
  })
  register(IPC.navDelete, (_e, id: number) => getDb().prepare('DELETE FROM nav_items WHERE id=?').run(id))
  register(IPC.navOpen, async (_e, id: number) => {
    const nav = getDb().prepare('SELECT * FROM nav_items WHERE id=?').get(id) as NavItemDTO
    if (!nav) return { ok: false, error: '导航项不存在' }
    try {
      switch (nav.type) {
        case 'url':
          await shell.openExternal(nav.target)
          break
        case 'folder':
        case 'file':
          await shell.openPath(nav.target)
          break
        case 'app':
          await shell.openPath(nav.target)
          break
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}