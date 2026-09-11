import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database | null = null

export function initDb(): Database.Database {
  if (db) return db
  // Windows 本地个人工具：数据存用户数据目录
  const base = app.getPath('userData')
  mkdirSync(base, { recursive: true })
  db = new Database(join(base, 'ops-work-platform.db'))
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

export function getDb(): Database.Database {
  return db ?? initDb()
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS instance_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      env TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      service TEXT DEFAULT '',
      db_type TEXT NOT NULL,
      group_id INTEGER,
      env TEXT DEFAULT '',
      user TEXT DEFAULT '',
      password TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(group_id) REFERENCES instance_groups(id)
    );
    CREATE TABLE IF NOT EXISTS sql_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      sql_text TEXT NOT NULL,
      version_no INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS template_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version_no INTEGER NOT NULL,
      sql_text TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS nav_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      grp TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT DEFAULT (datetime('now','localtime')),
      target TEXT,
      action TEXT,
      payload TEXT,
      result TEXT
    );
    CREATE TABLE IF NOT EXISTS plugin_registry (
      plugin_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

/** 统一的变更操作日志入口 */
export function auditLog(target: string, action: string, payload: string, result: string): void {
  getDb()
    .prepare('INSERT INTO audit_logs (target, action, payload, result) VALUES (?,?,?,?)')
    .run(target, action, payload, result)
}