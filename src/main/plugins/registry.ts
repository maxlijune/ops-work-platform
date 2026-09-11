import { app } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import type { PluginManifest, DbConnection } from '../../shared/driver-plugin'
import type { PluginStateDTO } from '../../shared/ipc'
import { getDb } from '../db'
import { createDummyOracle, createDummyMysql } from './dummy-drivers'

/** DriverPlugin 运行接口。由各驱动插件实现；由 wrapMethods 提供方法级兜底。 */
export interface DriverPlugin {
  manifest: PluginManifest
  testConnection(cfg: DbConnection): Promise<void>
  query(cfg: DbConnection, sql: string, params: Record<string, unknown>, opts?: { limit?: number }): Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  getTablespaces(cfg: DbConnection): Promise<import('../../shared/driver-plugin').TablespaceInfo[]>
  getDatafiles(cfg: DbConnection, tablespace: string): Promise<import('../../shared/driver-plugin').DatafileInfo[]>
  generateAddDatafileSql(cfg: DbConnection, tablespace: string, opts: import('../../shared/driver-plugin').AddDatafileOptions): Promise<string>
  executeDdl(cfg: DbConnection, sql: string): Promise<import('../../shared/driver-plugin').QueryResult>
  listPartitionedTables(cfg: DbConnection): Promise<string[]>
  getPartitionInfo(cfg: DbConnection, table: string): Promise<import('../../shared/driver-plugin').PartitionInfo[]>
  getPartitionHealth(cfg: DbConnection): Promise<import('../../shared/driver-plugin').PartitionHealthIssue[]>
}

interface ResolvedPlugin {
  manifest: PluginManifest
  source: 'builtin' | 'user'
  path: string
  adapter: DriverPlugin
  enabled: boolean
  error?: string
}

export class PluginManager {
  private static _instance: PluginManager
  private resolved = new Map<string, ResolvedPlugin>()

  static getInstance(): PluginManager {
    if (!PluginManager._instance) PluginManager._instance = new PluginManager()
    return PluginManager._instance
  }

  async loadAll(): Promise<void> {
    const sources: Array<{ dir: string; source: 'builtin' | 'user' }> = [
      { dir: join(app.getAppPath(), 'plugins'), source: 'builtin' },
      { dir: join(app.getPath('userData'), 'plugins'), source: 'user' }
    ]
    for (const src of sources) {
      if (!existsSync(src.dir)) continue
      for (const entry of readdirSync(src.dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        this.loadOne(join(src.dir, entry.name), entry.name, src.source)
      }
    }
    this.syncRegistry()
  }

  private loadOne(dir: string, id: string, source: 'builtin' | 'user'): void {
    try {
      const manifestPath = join(dir, 'manifest.json')
      if (!existsSync(manifestPath)) return
      const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8')) as PluginManifest
      const row = getDb().prepare('SELECT enabled, error FROM plugin_registry WHERE plugin_id=?').get(manifest.id) as
        | { enabled: number; error: string | null }
        | undefined
      const enabled = row ? row.enabled === 1 : true
      let adapter: DriverPlugin
      if (manifest.dbType === 'oracle') adapter = createDummyOracle(manifest)
      else if (manifest.dbType === 'mysql') adapter = createDummyMysql(manifest)
      else throw new Error(`不支持的驱动类型: ${manifest.dbType}`)
      this.resolved.set(manifest.id, { manifest, source, path: dir, adapter: wrapMethods(adapter), enabled })
    } catch (e) {
      this.resolved.set(id, {
        manifest: { id, name: id, dbType: 'unknown', version: '0' },
        source,
        path: dir,
        adapter: {} as DriverPlugin,
        enabled: false,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }

  private syncRegistry(): void {
    const upsert = getDb().prepare('INSERT OR REPLACE INTO plugin_registry (plugin_id, source, enabled, error) VALUES (?,?,?,?)')
    for (const [, p] of this.resolved) upsert.run(p.manifest.id, p.source, p.enabled ? 1 : 0, p.error ?? null)
  }

  list(): PluginStateDTO[] {
    return [...this.resolved.values()].map((p) => ({
      manifest: p.manifest,
      source: p.source,
      enabled: p.enabled,
      path: p.path,
      error: p.error
    }))
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const p = this.resolved.get(id)
    if (!p) return false
    p.enabled = enabled
    getDb().prepare('UPDATE plugin_registry SET enabled=? WHERE plugin_id=?').run(enabled ? 1 : 0, id)
    return true
  }

  /** 从 zip 安装用户插件到 userData/plugins/<ts> */
  install(zipPath: string): PluginStateDTO {
    const userDir = join(app.getPath('userData'), 'plugins')
    mkdirSync(userDir, { recursive: true })
    const target = join(userDir, `plugin-${Date.now()}`)
    mkdirSync(target, { recursive: true })
    execFileSync('unzip', ['-o', zipPath, '-d', target], { stdio: 'ignore' })
    // zip 可能内层再套一层目录
    const files = readdirSync(target)
    const root = files.includes('manifest.json') ? target : join(target, files[0])
    const manifest = JSON.parse(require('fs').readFileSync(join(root, 'manifest.json'), 'utf8')) as PluginManifest
    const adapter = manifest.dbType === 'oracle' ? createDummyOracle(manifest) : createDummyMysql(manifest)
    this.resolved.set(manifest.id, { manifest, source: 'user', path: root, adapter: wrapMethods(adapter), enabled: true })
    this.syncRegistry()
    return this.list().find((p) => p.manifest.id === manifest.id)!
  }

  uninstall(id: string): boolean {
    const p = this.resolved.get(id)
    if (!p || p.source === 'builtin') return false
    rmSync(p.path, { recursive: true, force: true })
    this.resolved.delete(id)
    getDb().prepare('DELETE FROM plugin_registry WHERE plugin_id=?').run(id)
    return true
  }

  get(id: string): ResolvedPlugin | undefined {
    return this.resolved.get(id)
  }

  /** 取某类型的已启用插件（至多一个，用于驱动业务） */
  adapterFor(dbType: string): DriverPlugin | undefined {
    for (const p of this.resolved.values()) {
      if (p.enabled && !p.error && p.manifest.dbType === dbType) return p.adapter
    }
    return undefined
  }
}

/** 方法级 wrap：把任意同步/异步方法统一包成 Promise，并捕获错误，防止插件异常拖垮主进程 */
function wrapMethods(p: DriverPlugin): DriverPlugin {
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(p)) {
    const fn = (p as unknown as Record<string, unknown>)[key]
    if (typeof fn === 'function') {
      out[key] = (...args: unknown[]): Promise<unknown> => {
        try {
          return Promise.resolve((fn as (...a: unknown[]) => unknown)(...args))
        } catch (e) {
          return Promise.reject(e)
        }
      }
    }
  }
  out.manifest = p.manifest
  return out as unknown as DriverPlugin
}

/** 内置空桩占位：避免未使用告警 */
void writeFileSync