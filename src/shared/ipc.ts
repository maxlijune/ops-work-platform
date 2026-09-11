// IPC 通道常量与请求/响应类型（preload 与渲染进程共用的桥契约）
import type { PluginManifest, TablespaceInfo, DatafileInfo, AddDatafileOptions, PartitionInfo, PartitionHealthIssue, QueryResult, QueryOptions } from './driver-plugin'

export const IPC = {
  // 插件
  pluginList: 'plugins:list',
  pluginSetEnabled: 'plugins:setEnabled',
  pluginInstall: 'plugins:install',
  pluginUninstall: 'plugins:uninstall',
  // 实例
  instanceList: 'instances:list',
  instanceSave: 'instances:save',
  instanceDelete: 'instances:delete',
  instanceTest: 'instances:test',
  // 分组
  groupList: 'groups:list',
  groupSave: 'groups:save',
  groupDelete: 'groups:delete',
  // 看板
  dashboardTablespaces: 'dashboard:tablespaces',
  dashboardDatafiles: 'dashboard:datafiles',
  dashboardAddDatafile: 'dashboard:addDatafile',
  dashboardPartitions: 'dashboard:partitions',
  dashboardPartitionHealth: 'dashboard:partitionHealth',
  // SQL 模板
  templateList: 'templates:list',
  templateSave: 'templates:save',
  templateDelete: 'templates:delete',
  templateVersions: 'templates:versions',
  templateRevert: 'templates:revert',
  // 查询
  queryRun: 'query:run',
  queryExport: 'query:export',
  // 设置/阈值
  settingsGet: 'settings:get',
  // 日志
  logsList: 'logs:list',
  // 快捷导航
  navList: 'nav:list',
  navSave: 'nav:save',
  navDelete: 'nav:delete',
  navOpen: 'nav:open',
  // 应用信息
  appInfo: 'app:info'
} as const

/** 一个实例的完整传输形态（凭据明文） */
export interface InstanceDTO {
  id: number
  name: string
  host: string
  port: number
  service: string
  dbType: string
  groupId?: number
  env?: string
  user: string
  password: string
  note?: string
}

export interface InstanceGroupDTO {
  id: number
  name: string
  env?: string
  sortOrder?: number
}

export interface PluginStateDTO {
  manifest: PluginManifest
  source: 'builtin' | 'user'
  enabled: boolean
  path: string
  error?: string
}

export interface DashboardTablespacesResult {
  instanceId: number
  instanceName: string
  dbType: string
  online: boolean
  onlineMs?: number
  error?: string
  tablespaces: TablespaceInfo[]
}

export interface PartitionHealthLegacy {
  issue: PartitionHealthIssue
}

export interface QueryExportOptions {
  format: 'xlsx' | 'csv'
  filePath: string
  columns: string[]
  rows: Record<string, unknown>[]
}

/** preload 暴露的 window.api 全量形状 */
export interface Api {
  plugins: {
    list(): Promise<PluginStateDTO[]>
    setEnabled(id: string, enabled: boolean): Promise<boolean>
    install(zipPath: string): Promise<PluginStateDTO>
    uninstall(id: string): Promise<boolean>
  }
  instances: {
    list(): Promise<InstanceDTO[]>
    save(d: Partial<InstanceDTO>): Promise<InstanceDTO>
    delete(id: number): Promise<void>
    test(id: number): Promise<{ ok: boolean; ms?: number; error?: string }>
  }
  groups: {
    list(): Promise<InstanceGroupDTO[]>
    save(d: Partial<InstanceGroupDTO>): Promise<InstanceGroupDTO>
    delete(id: number): Promise<void>
  }
  dashboard: {
    tablespaces(): Promise<DashboardTablespacesResult[]>
    datafiles(instanceId: number, tablespace: string): Promise<DatafileInfo[]>
    addDatafile(instanceId: number, tablespace: string, opts: AddDatafileOptions): Promise<QueryResult>
    partitions(instanceId: number, table: string): Promise<PartitionInfo[]>
    partitionHealth(instanceId: number): Promise<PartitionHealthIssue[]>
  }
  templates: {
    list(): Promise<TemplateDTO[]>
    save(d: Partial<TemplateDTO>): Promise<TemplateDTO>
    delete(id: number): Promise<void>
    versions(id: number): Promise<TemplateVersionDTO[]>
    revert(id: number, versionNo: number): Promise<TemplateDTO>
  }
  query: {
    run(instanceId: number, sql: string, params: Record<string, unknown>, opts?: QueryOptions): Promise<QueryResult>
    export(opts: QueryExportOptions): Promise<{ path: string }>
  }
  logs: {
    list(limit?: number): Promise<AuditLogDTO[]>
  }
  nav: {
    list(): Promise<NavItemDTO[]>
    save(d: Partial<NavItemDTO>): Promise<NavItemDTO>
    delete(id: number): Promise<void>
    open(id: number): Promise<{ ok: boolean; error?: string }>
  }
  settings: {
    get(key: string): Promise<string | null>
  }
  app: {
    info(): Promise<{ version: string; name: string }>
  }
}

export interface TemplateDTO {
  id: number
  title: string
  category: string
  tags: string
  sqlText: string
  versionNo: number
  updatedAt: string
}

export interface TemplateVersionDTO {
  id: number
  templateId: number
  versionNo: number
  sqlText: string
  note?: string
  createdAt: string
}

export interface AuditLogDTO {
  id: number
  time: string
  target: string
  action: string
  payload: string
  result: string
}

export type NavType = 'url' | 'folder' | 'file' | 'app'

export interface NavItemDTO {
  id: number
  name: string
  type: NavType
  target: string
  group?: string
  sortOrder?: number
}