import ExcelJS from 'exceljs'
import { createWriteStream } from 'fs'
// 流式导出：小结果集内存写 xlsx；大结果集分批写 xlsx（流式 workbook）或 csv（逐批 append）
// 见 spec AC-11：10 万行导出时进度可见、界面不冻结、内存不溢出

export interface ExportInput {
  format: 'xlsx' | 'csv'
  filePath: string
  columns: string[]
  rows: Record<string, unknown>[]
}

function cellValue(v: unknown): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') return JSON.stringify(v)
  return v as string | number | boolean
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** 导出行 → 值数组 */
function toValues(columns: string[], row: Record<string, unknown>): unknown[] {
  return columns.map((c) => row[c])
}

export async function exportResult(opts: ExportInput): Promise<void> {
  const { format, filePath, columns, rows } = opts
  if (format === 'csv') {
    await exportCsv(filePath, columns, rows)
  } else {
    await exportXlsx(filePath, columns, rows)
  }
}

async function exportCsv(filePath: string, columns: string[], rows: Record<string, unknown>[]): Promise<void> {
  const header = columns.map(csvEscape).join(',')
  const BATCH = 5000
  const stream = createWriteStream(filePath, { encoding: 'utf8' })
  await new Promise<void>((resolve, reject) => {
    stream.write('\uFEFF' + header + '\r\n', (e) => (e ? reject(e) : resolve()))
  })
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    await new Promise<void>((resolve, reject) => {
      let ok = true
      for (const r of chunk) {
        ok = stream.write(toValues(columns, r).map(csvEscape).join(',') + '\r\n')
        if (!ok) break
      }
      // backpressure：流写完排空后再继续处理下一批
      const done = () => resolve()
      if (ok) done()
      else stream.once('drain', done)
      stream.once('error', reject)
    })
  }
  await new Promise<void>((resolve, reject) => stream.end((e: Error | undefined) => (e ? reject(e) : resolve())))
}

async function exportXlsx(filePath: string, columns: string[], rows: Record<string, unknown>[]): Promise<void> {
  // 小结果集：内存写
  if (rows.length <= 10000) {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow(columns)
    for (const r of rows) ws.addRow(toValues(columns, r).map(cellValue))
    await wb.xlsx.writeFile(filePath)
    return
  }
  // 大结果集：流式 workbook，分批 addRows
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath })
  const ws = wb.addWorksheet('Sheet1')
  ws.addRow(columns).commit()
  const BATCH = 5000
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const rowObjs = chunk.map((r) => toValues(columns, r).map(cellValue))
    // commit 每行以维持低内存
    for (const values of rowObjs) ws.addRow(values as ExcelJS.RowValues).commit()
    if (i % 20000 === 0) await waitImmediate()
  }
  ws.commit()
  await wb.commit()
}

function waitImmediate(): Promise<void> {
  return new Promise((r) => setImmediate(r))
}