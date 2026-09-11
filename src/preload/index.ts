import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { Api, InstanceDTO, InstanceGroupDTO, TemplateDTO, TemplateVersionDTO, AuditLogDTO, NavItemDTO, QueryExportOptions } from '../shared/ipc'
import type { AddDatafileOptions } from '../shared/driver-plugin'

function unwrap<T>(ret: unknown, def: T): T {
  if (ret && typeof ret === 'object' && '__error' in (ret as object)) {
    return def
  }
  return ret as T
}

function err<T = unknown>(): Promise<never> {
  return Promise.reject(new Error('IPC error'))
}

const api: Api = {
  plugins: {
    list: () => ipcRenderer.invoke(IPC.pluginList).then((r) => unwrap(r, [])),
    setEnabled: (id, enabled) => ipcRenderer.invoke(IPC.pluginSetEnabled, id, enabled).then((r) => unwrap(r, false)),
    install: (zipPath) => ipcRenderer.invoke(IPC.pluginInstall, zipPath),
    uninstall: (id) => ipcRenderer.invoke(IPC.pluginUninstall, id).then((r) => unwrap(r, false))
  },
  instances: {
    list: () => ipcRenderer.invoke(IPC.instanceList).then((r) => unwrap<InstanceDTO[]>(r, [])),
    save: (d) => ipcRenderer.invoke(IPC.instanceSave, d) as Promise<InstanceDTO>,
    delete: (id) => ipcRenderer.invoke(IPC.instanceDelete, id),
    test: (id) => ipcRenderer.invoke(IPC.instanceTest, id) as Promise<{ ok: boolean; ms?: number; error?: string }>
  },
  groups: {
    list: () => ipcRenderer.invoke(IPC.groupList).then((r) => unwrap<InstanceGroupDTO[]>(r, [])),
    save: (d) => ipcRenderer.invoke(IPC.groupSave, d) as Promise<InstanceGroupDTO>,
    delete: (id) => ipcRenderer.invoke(IPC.groupDelete, id)
  },
  dashboard: {
    tablespaces: () => ipcRenderer.invoke(IPC.dashboardTablespaces),
    datafiles: (instanceId, tablespace) => ipcRenderer.invoke(IPC.dashboardDatafiles, instanceId, tablespace),
    addDatafile: (instanceId, tablespace, opts) => ipcRenderer.invoke(IPC.dashboardAddDatafile, instanceId, tablespace, opts) as Promise<AddDatafileOptions extends never ? never : any>,
    partitions: (instanceId, table) => ipcRenderer.invoke(IPC.dashboardPartitions, instanceId, table),
    partitionHealth: (instanceId) => ipcRenderer.invoke(IPC.dashboardPartitionHealth, instanceId)
  },
  templates: {
    list: () => ipcRenderer.invoke(IPC.templateList).then((r) => unwrap<TemplateDTO[]>(r, [])),
    save: (d) => ipcRenderer.invoke(IPC.templateSave, d) as Promise<TemplateDTO>,
    delete: (id) => ipcRenderer.invoke(IPC.templateDelete, id),
    versions: (id) => ipcRenderer.invoke(IPC.templateVersions, id).then((r) => unwrap<TemplateVersionDTO[]>(r, [])),
    revert: (id, versionNo) => ipcRenderer.invoke(IPC.templateRevert, id, versionNo) as Promise<TemplateDTO>
  },
  query: {
    run: (instanceId, sql, params, opts) => ipcRenderer.invoke(IPC.queryRun, instanceId, sql, params, opts),
    export: (o: QueryExportOptions) => ipcRenderer.invoke(IPC.queryExport, o)
  },
  logs: {
    list: (limit) => ipcRenderer.invoke(IPC.logsList, limit).then((r) => unwrap<AuditLogDTO[]>(r, []))
  },
  nav: {
    list: () => ipcRenderer.invoke(IPC.navList).then((r) => unwrap<NavItemDTO[]>(r, [])),
    save: (d) => ipcRenderer.invoke(IPC.navSave, d) as Promise<NavItemDTO>,
    delete: (id) => ipcRenderer.invoke(IPC.navDelete, id),
    open: (id) => ipcRenderer.invoke(IPC.navOpen, id)
  },
  settings: {
    get: (key) => ipcRenderer.invoke(IPC.settingsGet, key)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo)
  }
}

contextBridge.exposeInMainWorld('api', api)