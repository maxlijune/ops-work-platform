<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type {
  DashboardTablespacesResult,
  InstanceDTO,
  AuditLogDTO,
  NavItemDTO
} from '../../../shared/ipc'
import type {
  TablespaceInfo,
  DatafileInfo,
  AddDatafileOptions,
  PartitionInfo,
  PartitionHealthIssue
} from '../../../shared/driver-plugin'

type Level = 'ok' | 'warn' | 'danger'
type CapacityFilter = 'all' | 'danger' | 'warn' | 'ok'

interface CapacityRow {
  instanceId: number
  instanceName: string
  dbType: string
  online: boolean
  error?: string
  ts: TablespaceInfo
}

interface DrawerState {
  instanceId: number
  tablespace: string
  name: string
  files: DatafileInfo[]
}

// ---- 阈值（本地可调）----
const warnPct = ref(85)
const dangerPct = ref(95)
const thresholdOpen = ref(false)

function usageLevel(p: number): Level {
  if (p >= dangerPct.value) return 'danger'
  if (p >= warnPct.value) return 'warn'
  return 'ok'
}

// ---- 通用 ----
const loading = ref(false)
const lastRefresh = ref(nowStr())
const globalError = ref('')
const toast = ref('')

function nowStr() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
function errMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && (e as any).message) return (e as any).message
  return String(e)
}
function isErr(r: unknown): boolean {
  return !!r && typeof r === 'object' && '__error' in (r as any)
}
function fmtBytes(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '-'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
function flashToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => { if (toast.value === msg) toast.value = '' }, 3000)
}
function pctWidth(p: number): string {
  return `${Math.min(100, Math.max(0, p)).toFixed(1)}%`
}

// ---- 数据 ----
const results = ref<DashboardTablespacesResult[]>([])
const instances = ref<InstanceDTO[]>([])
const logs = ref<AuditLogDTO[]>([])
const navs = ref<NavItemDTO[]>([])
const healthIssues = ref<PartitionHealthIssue[]>([])

const capFilter = ref<CapacityFilter>('all')

const rows = computed<CapacityRow[]>(() => {
  const out: CapacityRow[] = []
  for (const r of results.value) {
    if (r.online && r.tablespaces && r.tablespaces.length) {
      for (const t of r.tablespaces) {
        out.push({ instanceId: r.instanceId, instanceName: r.instanceName, dbType: r.dbType, online: true, ts: t })
      }
    } else {
      out.push({
        instanceId: r.instanceId,
        instanceName: r.instanceName,
        dbType: r.dbType,
        online: false,
        error: r.error,
        ts: { name: '-', totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 }
      })
    }
  }
  return out
})

function rowLevel(r: CapacityRow): Level {
  if (!r.online) return 'danger'
  return usageLevel(r.ts.usedPercent)
}

const filteredRows = computed<CapacityRow[]>(() =>
  capFilter.value === 'all' ? rows.value : rows.value.filter(r => rowLevel(r) === capFilter.value)
)

const dangerCount = computed(() => rows.value.filter(r => rowLevel(r) === 'danger').length)
const warnCount = computed(() => rows.value.filter(r => rowLevel(r) === 'warn').length)
const okCount = computed(() => rows.value.filter(r => rowLevel(r) === 'ok').length)

const capTabs = computed(() => [
  { key: 'all' as CapacityFilter, label: '全部', count: rows.value.length },
  { key: 'danger' as CapacityFilter, label: '危险', count: dangerCount.value },
  { key: 'warn' as CapacityFilter, label: '警告', count: warnCount.value },
  { key: 'ok' as CapacityFilter, label: '正常', count: okCount.value }
])

function rowStatusText(r: CapacityRow): string {
  if (!r.online) return '离线'
  return usageLevel(r.ts.usedPercent) === 'ok' ? '正常' : usageLevel(r.ts.usedPercent) === 'warn' ? '警告' : '危险'
}

// ---- 统计卡片 ----
const statTotal = computed(() => instances.value.length)
const statOnline = computed(() => results.value.filter(r => r.online).length)
const statSpaceAlert = computed(() => rows.value.filter(r => rowLevel(r) !== 'ok').length)
const statPartition = computed(() => healthIssues.value.length)
const statToday = computed(() => logs.value.length)

// ---- 加载 ----
async function loadTablespaces() {
  try {
    const r = await window.api.dashboard.tablespaces()
    if (isErr(r)) { results.value = []; globalError.value = (r as any).__error }
    else results.value = r as DashboardTablespacesResult[]
  } catch (e) { globalError.value = errMsg(e) }
}
async function loadInstances() {
  try {
    instances.value = await window.api.instances.list()
    if (partInstanceId.value < 0 && instances.value.length) partInstanceId.value = instances.value[0].id
  } catch (e) { /* 无主进程时忽略 */ }
}
async function loadLogs() {
  try { logs.value = await window.api.logs.list() } catch { /* 忽略 */ }
}
async function loadNavs() {
  try {
    const r = await window.api.nav.list()
    if (isErr(r) || !Array.isArray(r) || !r.length) { navs.value = [] }
    else navs.value = r as NavItemDTO[]
  } catch { navs.value = [] }
}
async function loadPartitionHealth() {
  if (partInstanceId.value < 0) { healthIssues.value = []; return }
  try {
    const r = await window.api.dashboard.partitionHealth(partInstanceId.value)
    if (isErr(r)) healthIssues.value = []
    else healthIssues.value = r as PartitionHealthIssue[]
  } catch { healthIssues.value = [] }
}

async function refresh() {
  loading.value = true
  await Promise.all([loadTablespaces(), loadInstances(), loadLogs(), loadNavs(), loadPartitionHealth()])
  loading.value = false
  lastRefresh.value = nowStr()
  flashToast('刷新成功')
}

onMounted(refresh)

// ---- 快速导航 ----
const navIcons: Record<string, string> = { url: '🌐', folder: '📁', file: '📄', app: '⚙️' }
async function openNav(id: number) {
  try {
    const r = await window.api.nav.open(id)
    if (!r.ok) globalError.value = r.error || '打开失败'
  } catch (e) { globalError.value = errMsg(e) }
}

// ---- 分区监控 ----
const subTab = ref<'capacity' | 'partition'>('partition')
const partInstanceId = ref(-1)
const partTable = ref('')
const partRows = ref<PartitionInfo[]>([])
const partError = ref('')

async function runPartitionQuery() {
  partError.value = ''
  partRows.value = []
  if (partInstanceId.value < 0) { partError.value = '请先选择实例'; return }
  const table = partTable.value.trim()
  if (!table) { partError.value = '请输入表名'; return }
  try {
    const r = await window.api.dashboard.partitions(partInstanceId.value, table)
    if (isErr(r)) partError.value = (r as any).__error
    else partRows.value = r as PartitionInfo[]
  } catch (e) { partError.value = errMsg(e) }
}

const issueText: Record<PartitionHealthIssue['issue'], string> = {
  'no-rows': '无数据',
  'near-exhaustion': '接近耗尽',
  'missing-high-value': '缺少上界值'
}

// ---- 手动扩容 ----
const expandTarget = ref<CapacityRow | null>(null)
const newFilePath = ref('')
const initialSizeGB = ref(1)
const autoextend = ref(true)
const nextMB = ref(100)
const expandError = ref('')

const expandSubtitle = computed(() => {
  const t = expandTarget.value
  if (!t) return ''
  return `${t.instanceName} · ${t.ts.name} · 当前使用率 ${t.ts.usedPercent.toFixed(1)}%`
})

function openExpand(r: CapacityRow) {
  expandTarget.value = r
  expandError.value = ''
  newFilePath.value = `/u01/oradata/${r.instanceName.toLowerCase()}/${r.ts.name.toLowerCase()}.dbf`
  initialSizeGB.value = 1
  autoextend.value = true
  nextMB.value = 100
}

const sqlPreview = computed(() => {
  const t = expandTarget.value
  if (!t) return ''
  const name = t.ts.name
  const path = newFilePath.value.trim() || "'/path/to/ts_name.dbf'"
  const sizeG = Math.max(1, initialSizeGB.value || 1)
  const next = Math.max(1, nextMB.value || 0)
  const isMySQL = /mysql|maria/i.test(t.dbType)
  const lines: string[] = []
  if (isMySQL) {
    lines.push(`ALTER TABLESPACE \`${name}\``)
    lines.push(`  ADD DATAFILE '${path}'`)
    lines.push(autoextend.value ? `  AUTOEXTEND ON NEXT ${next}M` : '  AUTOEXTEND OFF')
  } else {
    lines.push(`ALTER TABLESPACE "${name}"`)
    lines.push(`  ADD DATAFILE '${path}'`)
    lines.push(`  SIZE ${sizeG}G`)
    lines.push(autoextend.value ? `  AUTOEXTEND ON NEXT ${next}M MAXSIZE UNLIMITED` : '  AUTOEXTEND OFF')
  }
  lines.push(';')
  return lines.join('\n')
})

async function confirmExpand() {
  const t = expandTarget.value
  if (!t) return
  expandError.value = ''
  const opts: AddDatafileOptions = {
    fileName: newFilePath.value.trim(),
    sizeMB: Math.max(1, Math.round(initialSizeGB.value * 1024)),
    autoextend: autoextend.value,
    nextMB: Math.max(0, nextMB.value || 0)
  }
  try {
    const res = await window.api.dashboard.addDatafile(t.instanceId, t.ts.name, opts)
    if (isErr(res)) throw new Error((res as any).__error)
    expandTarget.value = null
    flashToast('已写入操作日志')
    await loadTablespaces()
    lastRefresh.value = nowStr()
  } catch (e) { expandError.value = errMsg(e) }
}

// ---- 数据文件明细 ----
const drawer = ref<DrawerState | null>(null)
const drawerError = ref('')

const drawerCount = computed(() => drawer.value?.files.length || 0)
const drawerTotal = computed(() => (drawer.value?.files || []).reduce((s, d) => s + (d.sizeBytes || 0), 0))
const drawerAlloc = computed(() => (drawer.value?.files || []).reduce((s, d) => s + (d.sizeBytes || 0), 0))
const drawerTitle = computed(() => {
  const d = drawer.value
  return d ? `${d.name} · ${d.tablespace}` : ''
})

async function openDrawer(r: CapacityRow) {
  drawerError.value = ''
  drawer.value = { instanceId: r.instanceId, tablespace: r.ts.name, name: r.instanceName, files: [] }
  try {
    const res = await window.api.dashboard.datafiles(r.instanceId, r.ts.name)
    if (isErr(res)) drawerError.value = (res as any).__error
    else drawer.value = { instanceId: r.instanceId, tablespace: r.ts.name, name: r.instanceName, files: res as DatafileInfo[] }
  } catch (e) { drawerError.value = errMsg(e) }
}
</script>

<template>
  <div class="dash">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">监控看板</div>
        <div class="page-sub">表空间容量 · 最后刷新时间 {{ lastRefresh }}</div>
      </div>
      <div class="page-actions">
        <button class="wf-btn wf-btn-ghost" :disabled="loading" @click="refresh">手动刷新</button>
        <button class="wf-btn wf-btn-primary" @click="thresholdOpen = true">阈值设置</button>
      </div>
    </div>

    <div v-if="globalError" class="error-bar">{{ globalError }}</div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- 1) 统计卡片 -->
    <div class="stats">
      <div class="stat">
        <div class="stat-side info">🖥</div>
        <div><div class="stat-num">{{ statTotal }}</div><div class="stat-label">实例总数</div></div>
      </div>
      <div class="stat">
        <div class="stat-side ok">✔</div>
        <div><div class="stat-num">{{ statOnline }}</div><div class="stat-label">在线实例</div></div>
      </div>
      <div class="stat" :class="{ danger: statSpaceAlert > 0 }">
        <div class="stat-side danger">!</div>
        <div><div class="stat-num">{{ statSpaceAlert }}</div><div class="stat-label">空间告警</div></div>
      </div>
      <div class="stat">
        <div class="stat-side warn">⚠</div>
        <div><div class="stat-num">{{ statPartition }}</div><div class="stat-label">分区预警</div></div>
      </div>
      <div class="stat">
        <div class="stat-side info">🕘</div>
        <div><div class="stat-num">{{ statToday }}</div><div class="stat-label">今日变更</div></div>
      </div>
    </div>

    <!-- 快速导航 chips -->
    <div v-if="navs.length" class="quick-nav">
      <span class="qn-label">快速导航</span>
      <button
        v-for="n in navs"
        :key="n.id"
        class="qn-chip"
        @click="openNav(n.id)"
      >
        <span class="qn-ico">{{ navIcons[n.type] || '🔗' }}</span>
        {{ n.name }}
      </button>
    </div>

    <!-- 2) 表空间容量看板 -->
    <div class="wf-board">
      <div class="wf-board-head board-head">
        <div class="wf-tabs">
          <div
            v-for="t in capTabs"
            :key="t.key"
            class="wf-tab"
            :class="{ active: capFilter === t.key }"
            @click="capFilter = t.key"
          >
            {{ t.label }} <span class="tab-count">{{ t.count }}</span>
          </div>
        </div>
        <div class="legend">
          <span class="lg"><i class="dot ok"></i>正常</span>
          <span class="lg"><i class="dot warn"></i>警告</span>
          <span class="lg"><i class="dot danger"></i>危险</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="wf-table">
          <thead>
            <tr><th>实例</th><th>表空间</th><th>总大小</th><th>已用</th><th>使用率</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in filteredRows" :key="i">
              <td>{{ r.instanceName }} <span class="db-tag">{{ r.dbType }}</span></td>
              <td class="mono">{{ r.ts.name }}</td>
              <td>{{ fmtBytes(r.ts.totalBytes) }}</td>
              <td>{{ fmtBytes(r.ts.usedBytes) }}</td>
              <td class="usage-cell">
                <div class="wf-usage">
                  <div class="wf-bar">
                    <div
                      class="wf-bar-fill"
                      :class="rowLevel(r)"
                      :style="{ width: r.online ? pctWidth(r.ts.usedPercent) : '0%' }"
                    ></div>
                  </div>
                  <span class="wf-pct" :class="rowLevel(r)">{{ r.online ? r.ts.usedPercent.toFixed(1) + '%' : '--' }}</span>
                </div>
              </td>
              <td>
                <span class="wf-status" :class="rowLevel(r)"><i></i>{{ rowStatusText(r) }}</span>
                <div v-if="!r.online && r.error" class="err-tip" :title="r.error">{{ r.error }}</div>
              </td>
              <td>
                <button class="wf-op" @click="openExpand(r)">扩容</button>
                <button class="wf-op wf-op-ghost" @click="openDrawer(r)">明细</button>
              </td>
            </tr>
            <tr v-if="!loading && filteredRows.length === 0"><td colspan="7" class="empty-cell">暂无数据</td></tr>
            <tr v-if="loading"><td colspan="7" class="empty-cell">加载中…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 5) 分区管理标签页 -->
    <div class="wf-board sub-board">
      <div class="wf-board-head board-head">
        <div class="wf-tabs">
          <div class="wf-tab" :class="{ active: subTab === 'capacity' }" @click="subTab = 'capacity'">表空间容量</div>
          <div class="wf-tab" :class="{ active: subTab === 'partition' }" @click="subTab = 'partition'">分区监控</div>
        </div>
      </div>

      <div v-if="subTab === 'capacity'" class="sub-capacity">
        <div class="cap-sum">
          <span><b>{{ results.length }}</b> 个实例</span>
          <span><b>{{ rows.length }}</b> 个表空间</span>
          <span><b>{{ statSpaceAlert }}</b> 个预警</span>
        </div>
        <div class="cap-hint">完整容量明细见上方「表空间容量看板」表格。</div>
      </div>

      <div v-else class="sub-partition">
        <div class="part-toolbar">
          <select class="wf-select part-select" v-model="partInstanceId">
            <option :value="-1">选择实例</option>
            <option v-for="ins in instances" :key="ins.id" :value="ins.id">{{ ins.name }}</option>
          </select>
          <input class="wf-input part-input" v-model="partTable" placeholder="输入表名，如 CUSTOMERS" @keyup.enter="runPartitionQuery" />
          <button class="wf-btn wf-btn-primary" @click="runPartitionQuery">查询</button>
        </div>
        <div v-if="partError" class="err-text">{{ partError }}</div>

        <table v-if="partRows.length" class="wf-table part-table">
          <thead>
            <tr><th>分区名</th><th>上界值</th><th>行数</th><th>大小</th><th>最后写入</th></tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in partRows" :key="i">
              <td class="mono">{{ p.partitionName }}</td>
              <td class="mono">{{ p.highValue ?? '-' }}</td>
              <td>{{ p.numRows ?? '-' }}</td>
              <td>{{ fmtBytes(p.bytes) }}</td>
              <td>{{ p.lastWrite ?? '-' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="health-title">分区健康检查</div>
        <table class="wf-table">
          <thead>
            <tr><th>表名</th><th>分区数</th><th>最新上界值</th><th>预警说明</th></tr>
          </thead>
          <tbody>
            <tr v-for="(h, i) in healthIssues" :key="i">
              <td class="mono">{{ h.table }}</td>
              <td>{{ h.partitions }}</td>
              <td class="mono">{{ h.lastHighValue ?? '-' }}</td>
              <td>
                <span class="wf-status warn"><i></i>{{ issueText[h.issue] }}</span>
                <span class="health-note">{{ h.note }}</span>
              </td>
            </tr>
            <tr v-if="!healthIssues.length"><td colspan="4" class="empty-cell">未发现分区健康问题</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3) 手动扩容弹窗 -->
    <div class="wf-mask" :class="{ show: !!expandTarget }" @click.self="expandTarget = null">
      <div class="wf-modal">
        <div class="wf-modal-head">
          <div>
            <div class="t">手动扩容</div>
            <div class="modal-sub">{{ expandSubtitle }}</div>
          </div>
          <button class="wf-modal-close" @click="expandTarget = null">×</button>
        </div>
        <div class="wf-modal-body">
          <div class="wf-form-row">
            <label>新数据文件路径</label>
            <input class="wf-input" v-model="newFilePath" placeholder="/u01/oradata/xxx/ts_name.dbf" />
          </div>
          <div class="wf-form-grid">
            <div class="wf-form-row">
              <label>初始大小 (GB)</label>
              <input class="wf-input size-input" type="number" min="0" v-model.number="initialSizeGB" />
            </div>
            <div class="wf-form-row">
              <label>下次增长 (MB)</label>
              <input class="wf-input size-input" type="number" min="0" v-model.number="nextMB" />
            </div>
          </div>
          <div class="wf-form-row check-row">
            <label class="check-label"><input type="checkbox" v-model="autoextend" /> 自增长打开</label>
          </div>
          <div class="wf-form-row">
            <label>SQL 预览</label>
            <pre class="sql-preview"><code>{{ sqlPreview }}</code></pre>
          </div>
          <div v-if="expandError" class="err-text">{{ expandError }}</div>
        </div>
        <div class="wf-modal-foot">
          <span class="warn-note">执行前请确认磁盘空间充足；本次操作将写入操作日志</span>
          <div>
            <button class="wf-btn wf-btn-ghost" @click="expandTarget = null">取消</button>
            <button class="wf-btn wf-btn-primary" @click="confirmExpand">确认执行</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 4) 数据文件明细抽屉 -->
    <div class="wf-drawer-mask" :class="{ show: !!drawer }" @click.self="drawer = null"></div>
    <aside class="wf-drawer" :class="{ show: !!drawer }">
      <div class="drawer-head">
        <div>
          <div class="t">数据文件明细</div>
          <div class="modal-sub">{{ drawerTitle }}</div>
        </div>
        <button class="wf-modal-close" @click="drawer = null">×</button>
      </div>
      <div class="drawer-body">
        <div v-if="drawer" class="drawer-chips">
          <div class="chip"><div class="chip-num">{{ drawerCount }}</div><div class="chip-label">文件数</div></div>
          <div class="chip"><div class="chip-num">{{ fmtBytes(drawerTotal) }}</div><div class="chip-label">总大小</div></div>
          <div class="chip"><div class="chip-num">{{ fmtBytes(drawerAlloc) }}</div><div class="chip-label">已用</div></div>
        </div>
        <div v-if="drawerError" class="err-text">{{ drawerError }}</div>
        <table v-if="drawer && drawer.files.length" class="wf-table">
          <thead><tr><th>文件名</th><th>路径</th><th>大小</th><th>自增长</th></tr></thead>
          <tbody>
            <tr v-for="(d, i) in drawer.files" :key="i">
              <td class="mono">{{ d.fileName }}</td>
              <td class="mono path-cell">{{ d.path }}</td>
              <td>{{ fmtBytes(d.sizeBytes) }}</td>
              <td>{{ d.autoextend ? 'ON' : 'OFF' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="drawer && !drawer.files.length && !drawerError" class="empty-tip">暂无数据文件信息</div>
      </div>
    </aside>

    <!-- 阈值设置弹窗 -->
    <div class="wf-mask" :class="{ show: thresholdOpen }" @click.self="thresholdOpen = false">
      <div class="wf-modal sm">
        <div class="wf-modal-head">
          <div class="t">阈值设置</div>
          <button class="wf-modal-close" @click="thresholdOpen = false">×</button>
        </div>
        <div class="wf-modal-body">
          <div class="wf-form-grid">
            <div class="wf-form-row"><label>警告阈值 %</label><input class="wf-input" type="number" v-model.number="warnPct" /></div>
            <div class="wf-form-row"><label>危险阈值 %</label><input class="wf-input" type="number" v-model.number="dangerPct" /></div>
          </div>
        </div>
        <div class="wf-modal-foot">
          <span></span>
          <button class="wf-btn wf-btn-primary" @click="thresholdOpen = false">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px; overflow-y: auto; height: 100%;
}

/* 页面头部 */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.page-title { font-size: 19px; font-weight: 700; color: var(--wf-text); }
.page-sub { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }
.page-actions { display: flex; gap: 10px; }

/* 错误 / 提示条 */
.error-bar {
  background: #fdeeee; color: var(--wf-danger); border: 1px solid #f6c6c4;
  padding: 9px 14px; border-radius: var(--wf-radius); font-size: 12.5px; word-break: break-all;
}
.toast {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 600;
  background: #1f2329; color: #fff; padding: 9px 18px; border-radius: 6px; font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,.25); animation: toast-in .2s;
}
@keyframes toast-in { from { opacity: 0; transform: translate(-50%, -8px); } }
.err-text { color: var(--wf-danger); font-size: 12.5px; margin: 6px 0; }
.err-tip { color: var(--wf-danger); font-size: 11.5px; margin-top: 3px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-cell { text-align: center; color: var(--wf-text-4); padding: 28px 0 !important; }
.empty-tip { text-align: center; color: var(--wf-text-4); padding: 30px 0; font-size: 13px; }

/* 1) 统计卡片 */
.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat {
  background: #fff; border-radius: var(--wf-radius); padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(31,35,41,.06); border: 1px solid var(--wf-border);
  display: flex; align-items: flex-start; gap: 14px;
}
.stat-side {
  width: 40px; height: 40px; border-radius: 5px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.stat-side.ok { background: #e8f7e8; }
.stat-side.warn { background: #fdf2e4; }
.stat-side.danger { background: #fdeeee; }
.stat-side.info { background: #e8f3ff; }
.stat-num { font-size: 24px; font-weight: 700; line-height: 1.2; color: #1f2329; font-variant-numeric: tabular-nums; }
.stat.danger .stat-num { color: var(--wf-danger); }
.stat-label { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }

/* 快速导航 */
.quick-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.qn-label { font-size: 12px; color: var(--wf-text-3); margin-right: 2px; }
.qn-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px;
  background: #fff; border: 1px solid var(--wf-border-2); border-radius: 15px;
  font-size: 12.5px; color: var(--wf-text-2); cursor: pointer; font-family: inherit;
  transition: all .14s;
}
.qn-chip:hover { border-color: var(--wf-accent); color: var(--wf-accent); }
.qn-ico { font-size: 13px; }

/* 看板头部 */
.board-head { gap: 16px; }
.wf-board-head { align-items: center; }
.legend { margin-left: auto; display: flex; gap: 14px; align-items: center; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--wf-text-3); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.ok { background: var(--wf-ok); }
.dot.warn { background: var(--wf-warn); }
.dot.danger { background: var(--wf-danger); }
.tab-count { font-size: 11px; color: var(--wf-text-4); margin-left: 2px; }
.table-wrap { overflow-x: auto; }
.db-tag {
  font-size: 10.5px; color: var(--wf-text-4); background: var(--wf-bg-soft);
  border: 1px solid var(--wf-border); border-radius: 3px; padding: 1px 5px; margin-left: 4px;
}
.usage-cell { min-width: 160px; }

/* 5) 分区管理 */
.sub-board { margin-top: 2px; }
.sub-capacity { padding: 22px; text-align: center; color: var(--wf-text-3); }
.cap-sum { display: flex; gap: 28px; justify-content: center; font-size: 13px; margin-bottom: 8px; }
.cap-sum b { font-size: 18px; color: var(--wf-text); font-variant-numeric: tabular-nums; }
.cap-hint { font-size: 12px; color: var(--wf-text-4); }
.sub-partition { padding: 16px; }
.part-toolbar { display: flex; gap: 10px; margin-bottom: 12px; }
.part-select { width: 200px; }
.part-input { flex: 1; }
.part-table { margin-bottom: 16px; }
.health-title { font-size: 13px; font-weight: 600; margin: 8px 0 10px; }
.health-note { color: var(--wf-text-3); font-size: 12px; margin-left: 8px; }

/* 手动扩容 SQL 预览 */
.sql-preview {
  background: #26292e; color: #7cc3ff; border-radius: 5px;
  padding: 12px 14px; font-family: var(--wf-mono); font-size: 12.5px;
  line-height: 1.7; overflow-x: auto; white-space: pre;
}
.size-input { width: 150px; display: inline-block; }
.check-label { display: flex; align-items: center; gap: 6px; color: var(--wf-text-2); cursor: pointer; font-weight: 400; }
.warn-note { font-size: 12px; color: var(--wf-text-4); }
.modal-sub { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }
.wf-modal.sm { width: 440px; }

/* 4) 明细抽屉 */
.wf-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: 520px; max-width: 92vw;
  background: #fff; z-index: 360; box-shadow: -6px 0 24px rgba(31,35,41,.16);
  transform: translateX(100%); transition: transform .22s cubic-bezier(.22,.61,.36,1);
  display: flex; flex-direction: column;
}
.wf-drawer.show { transform: translateX(0); }
.drawer-head { padding: 16px 20px; border-bottom: 1px solid var(--wf-border); display: flex; align-items: center; }
.drawer-head .t { font-size: 15px; font-weight: 600; }
.drawer-body { padding: 18px 20px; overflow-y: auto; flex: 1; }
.drawer-chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.chip {
  background: var(--wf-bg-soft); border: 1px solid var(--wf-border);
  border-radius: 5px; padding: 12px 14px; text-align: center;
}
.chip-num { font-size: 18px; font-weight: 700; color: var(--wf-text); font-variant-numeric: tabular-nums; }
.chip-label { font-size: 12px; color: var(--wf-text-3); margin-top: 4px; }
.path-cell { word-break: break-all; white-space: normal; max-width: 220px; }
</style>