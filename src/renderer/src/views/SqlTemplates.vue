<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { TemplateDTO, TemplateVersionDTO, InstanceDTO } from '../../../shared/ipc'
import type { QueryResult } from '../../../shared/driver-plugin'

// ---- 通用状态 ----
const loading = ref(false)
const globalError = ref('')
const resultError = ref('')
const toast = ref('')
const keyword = ref('')
const templates = ref<TemplateDTO[]>([])
const instances = ref<InstanceDTO[]>([])
const selectedId = ref<number | null>(null)

// ---- 编辑表单 ----
const form = reactive<{ id?: number; title: string; category: string; tags: string; sqlText: string }>({
  id: undefined, title: '', category: '', tags: '', sqlText: ''
})
const paramValues = reactive<Record<string, string>>({})

// ---- 查询结果 ----
const result = ref<QueryResult | null>(null)
const resultRunning = ref(false)
const selectedInstanceId = ref<number | ''>('')

function errMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && (e as any).message) return (e as any).message
  return String(e)
}
function isErr(r: unknown): boolean {
  return !!r && typeof r === 'object' && '__error' in (r as any)
}
function flashToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => { if (toast.value === msg) toast.value = '' }, 2500)
}

// ---- 计算属性 ----
const selectedTemplate = computed(() => templates.value.find(t => t.id === selectedId.value) || null)

const filteredTemplates = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return templates.value
  return templates.value.filter(
    t => (t.title || '').toLowerCase().includes(kw)
      || (t.tags || '').toLowerCase().includes(kw)
      || (t.category || '').toLowerCase().includes(kw)
  )
})

// 参数检测：正则 /:([a-zA-Z_]\w*)/g 提取去重（跳过 :: 双冒号等边界）
const paramNames = computed(() => {
  const set = new Set<string>()
  const re = /:([a-zA-Z_]\w*)/g
  let m: RegExpExecArray | null
  const sql = form.sqlText || ''
  while ((m = re.exec(sql)) !== null) {
    // 忽略伪标点如 :: 连字符
    set.add(m[1])
  }
  return [...set]
})

// ---- 加载 ----
async function loadTemplates() {
  try {
    const r = await window.api.templates.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    templates.value = r as TemplateDTO[]
  } catch (e) { globalError.value = errMsg(e) }
}
async function loadInstances() {
  try {
    const r = await window.api.instances.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    instances.value = r as InstanceDTO[]
  } catch (e) { globalError.value = errMsg(e) }
}
async function refresh() {
  loading.value = true
  await Promise.all([loadTemplates(), loadInstances()])
  loading.value = false
}
onMounted(refresh)

// ---- 选择模板 ----
function selectTemplate(t: TemplateDTO) {
  const fresh = selectedId.value === t.id
  selectedId.value = t.id
  Object.assign(form, {
    id: t.id, title: t.title, category: t.category, tags: t.tags, sqlText: t.sqlText
  })
  clearParams()
  if (fresh) return
  result.value = null
  resultError.value = ''
}
// 新建模板：清空表单，id 置空
function newTemplate() {
  selectedId.value = null
  Object.assign(form, { id: undefined, title: '', category: '', tags: '', sqlText: '' })
  clearParams()
  result.value = null
  resultError.value = ''
}
function clearParams() {
  for (const k of Object.keys(paramValues)) delete paramValues[k]
}

// 切换 SQL / 参数名变化时，为新参数补默认空值
function ensureParams() {
  for (const n of paramNames.value) {
    if (!(n in paramValues)) paramValues[n] = ''
  }
}

// ---- 保存版本 ----
const saving = ref(false)
async function saveVersion() {
  if (!form.title.trim()) { globalError.value = '请填写模板标题'; return }
  globalError.value = ''
  saving.value = true
  const isNew = form.id === undefined
  try {
    const r = await window.api.templates.save({
      id: form.id,
      title: form.title.trim(),
      category: form.category.trim(),
      tags: form.tags.trim(),
      sqlText: form.sqlText
    })
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    globalError.value = ''
    form.id = (r as TemplateDTO).id
    selectedId.value = (r as TemplateDTO).id
    flashToast(isNew ? '已创建模板' : '已保存新版本')
    await loadTemplates()
  } catch (e) { globalError.value = errMsg(e) }
  finally { saving.value = false }
}

// ---- 删除 ----
async function removeTemplate() {
  const cur = selectedTemplate.value || { id: form.id, title: form.title }
  if (cur.id === undefined) { globalError.value = '当前为新建模板，尚无已保存版本可删除'; return }
  if (!window.confirm(`确定删除模板「${cur.title}」吗？`)) return
  globalError.value = ''
  try {
    await window.api.templates.delete(cur.id)
    flashToast('已删除')
    selectedId.value = null
    Object.assign(form, { id: undefined, title: '', category: '', tags: '', sqlText: '' })
    clearParams()
    result.value = null
    resultError.value = ''
    await loadTemplates()
  } catch (e) { globalError.value = errMsg(e) }
}

// ---- 执行查询 ----
async function runQuery() {
  resultError.value = ''
  const instId = Number(selectedInstanceId.value)
  if (!instId) { resultError.value = '请先选择执行实例'; return }
  if (!form.sqlText.trim()) { resultError.value = 'SQL 内容为空'; return }
  ensureParams()
  const params: Record<string, unknown> = {}
  for (const n of paramNames.value) params[n] = paramValues[n] ?? ''
  resultRunning.value = true
  try {
    const r = await window.api.query.run(instId, form.sqlText, params, { limit: 1000 })
    if (isErr(r)) { resultError.value = (r as any).__error; return }
    result.value = r as QueryResult
  } catch (e) { resultError.value = errMsg(e) }
  finally { resultRunning.value = false }
}

// ---- 导出 ----
async function exportResult(format: 'xlsx' | 'csv') {
  const cur = result.value
  if (!cur || !cur.columns.length) { resultError.value = '没有可导出的查询结果，请先执行查询'; return }
  resultError.value = ''
  const filePath = window.prompt(
    `请输入导出 ${format.toUpperCase()} 文件的保存路径（如 D:/tmp/导出.${format}）：`, `sql-result.${format}`
  )
  if (!filePath || !filePath.trim()) { flashToast('已取消：未输入保存路径'); return }
  try {
    const r = await window.api.query.export({
      format, filePath: filePath.trim(), columns: cur.columns, rows: cur.rows
    })
    if (isErr(r)) { resultError.value = (r as any).__error; return }
    const p = (r as { path: string }).path
    flashToast(`已导出到 ${p || filePath}`)
  } catch (e) { resultError.value = errMsg(e) }
}

// ---- 版本历史 ----
const versionOpen = ref(false)
const versionLoading = ref(false)
const versions = ref<TemplateVersionDTO[]>([])
const versionError = ref('')
async function openVersions() {
  const id = form.id
  if (id === undefined) { globalError.value = '请先保存该模板后再查看版本历史'; return }
  versionError.value = ''
  versionOpen.value = true
  versionLoading.value = true
  versions.value = []
  try {
    const r = await window.api.templates.versions(id)
    if (isErr(r)) { versionError.value = (r as any).__error; return }
    versions.value = r as TemplateVersionDTO[]
  } catch (e) { versionError.value = errMsg(e) }
  finally { versionLoading.value = false }
}
const revertingNo = ref<number | null>(null)
async function revertTo(v: TemplateVersionDTO) {
  if (form.id === undefined) return
  if (!window.confirm(`确定回退到 v${v.versionNo}（${v.createdAt}）吗？当前 SQL 将被该版本覆盖。`)) return
  revertingNo.value = v.versionNo
  versionError.value = ''
  try {
    const r = await window.api.templates.revert(form.id, v.versionNo)
    if (isErr(r)) { versionError.value = (r as any).__error; return }
    const dto = r as TemplateDTO
    Object.assign(form, { id: dto.id, title: dto.title, category: dto.category, tags: dto.tags, sqlText: dto.sqlText })
    selectedId.value = dto.id
    clearParams()
    result.value = null
    resultError.value = ''
    versionOpen.value = false
    flashToast(`已回退到 v${dto.versionNo}`)
    await loadTemplates()
  } catch (e) { versionError.value = errMsg(e) }
  finally { revertingNo.value = null }
}

// 格式化时间
function fmt(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').replace(/\.\d+$/, '').slice(0, 19)
}
</script>

<template>
  <div class="templates">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">SQL 模板库</div>
        <div class="page-sub">参数化 SQL 模板 · 支持 :name 参数 · 查询只读</div>
      </div>
      <div class="page-actions">
        <button class="wf-btn wf-btn-primary" @click="newTemplate">新建模板</button>
      </div>
    </div>

    <div v-if="globalError" class="error-bar">{{ globalError }}</div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <div class="body">
      <!-- 左：模板列表 -->
      <div class="wf-board left">
        <div class="wf-board-head toolbar">
          <input class="wf-input" v-model="keyword" placeholder="搜索模板/标签" />
        </div>
        <div class="tpl-list">
          <div
            v-for="t in filteredTemplates"
            :key="t.id"
            class="tpl-item"
            :class="{ active: selectedId === t.id }"
            @click="selectTemplate(t)"
          >
            <div class="tpl-title">
              <span class="tpl-name">{{ t.title }}</span>
              <span class="ver-badge" :class="selectedId === t.id ? 'on' : ''">v{{ t.versionNo }}</span>
            </div>
            <div class="tpl-meta">
              <span v-if="t.category" class="cat-tag">{{ t.category }}</span>
              <span v-if="t.tags" class="tpl-tags">{{ t.tags }}</span>
            </div>
          </div>
          <div v-if="!loading && filteredTemplates.length === 0" class="empty-tip">暂无模板</div>
          <div v-if="loading" class="empty-tip">加载中…</div>
        </div>
      </div>

      <!-- 右：详情 -->
      <div class="wf-board right">
        <!-- 工具栏 -->
        <div class="wf-board-head toolbar">
          <select class="wf-select sel-instance" v-model="selectedInstanceId">
            <option value="" disabled>选择执行实例</option>
            <option v-for="ins in instances" :key="ins.id" :value="ins.id">
              {{ ins.name }}（{{ ins.dbType }}）
            </option>
          </select>
          <div class="toolbar-gap" />
          <button class="wf-btn wf-btn-primary" :disabled="resultRunning" @click="runQuery">
            {{ resultRunning ? '执行中…' : '执行' }}
          </button>
          <button class="wf-btn wf-btn-ghost" @click="exportResult('xlsx')">导出 Excel</button>
          <button class="wf-btn wf-btn-ghost" @click="exportResult('csv')">导出 CSV</button>
        </div>

        <!-- 编辑区 -->
        <div class="editor">
          <div class="field-row">
            <input class="wf-input" v-model="form.title" placeholder="标题，如 核心表行数统计" />
            <input class="wf-input" v-model="form.category" placeholder="分类，如 运维巡检" />
            <input class="wf-input" v-model="form.tags" placeholder="标签（逗号分隔）" />
          </div>

          <textarea
            class="wf-textarea sql-area"
            v-model="form.sqlText"
            placeholder="SELECT * FROM t WHERE id = :id  ·  支持 :name 参数，执行时自动填充"
            @input="ensureParams"
          ></textarea>

          <!-- 参数区 -->
          <div v-if="paramNames.length" class="params">
            <span class="params-label">参数值</span>
            <div class="params-grid">
              <div v-for="n in paramNames" :key="n" class="param-item">
                <span class="mono param-key">:{{ n }}</span>
                <input class="wf-input" v-model="paramValues[n]" :placeholder="`${n} 的值`" />
              </div>
            </div>
          </div>

          <div class="action-row">
            <div class="left-ops">
              <button class="wf-btn wf-btn-primary" :disabled="saving" @click="saveVersion">
                {{ saving ? '保存中…' : form.id !== undefined ? '保存版本' : '新建模板' }}
              </button>
              <button class="wf-btn wf-btn-ghost" @click="openVersions">查看版本历史</button>
            </div>
            <button class="wf-btn wf-btn-danger" @click="removeTemplate">删除</button>
          </div>

          <!-- 查询结果 -->
          <div v-if="resultError" class="result-error">{{ resultError }}</div>
          <div v-if="result" class="result-wrap">
            <div class="result-meta mono">
              返回 {{ result.rowCount }} 行
              <span v-if="!result.isSelect" class="affect-note">（非 SELECT 语句，show 结果仅供预览）</span>
            </div>
            <div class="table-scroll">
              <table class="wf-table">
                <thead>
                  <tr>
                    <th v-for="c in result.columns" :key="c">{{ c }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in result.rows" :key="ri">
                    <td v-for="c in result.columns" :key="c" class="mono">{{ row[c] }}</td>
                  </tr>
                  <tr v-if="result.rows.length === 0"><td :colspan="result.columns.length" class="empty-cell">无数据</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 版本历史弹窗 -->
    <div class="wf-mask" :class="{ show: versionOpen }" @click.self="versionOpen = false">
      <div class="wf-modal sm">
        <div class="wf-modal-head">
          <div class="t">版本历史</div>
          <button class="wf-modal-close" @click="versionOpen = false">×</button>
        </div>
        <div class="wf-modal-body">
          <div v-if="versionError" class="err-text">{{ versionError }}</div>
          <div v-if="versionLoading" class="empty-tip">加载中…</div>
          <div v-else-if="versions.length" class="ver-list">
            <div v-for="v in versions" :key="v.id" class="ver-row">
              <div class="ver-head">
                <span class="ver-no">v{{ v.versionNo }}</span>
                <span class="ver-time">{{ fmt(v.createdAt) }}</span>
              </div>
              <div class="ver-sql mono">{{ v.sqlText }}</div>
              <div class="ver-actions">
                <button
                  class="wf-op wf-op-ghost"
                  :disabled="revertingNo === v.versionNo"
                  @click="revertTo(v)"
                >回退到该版本</button>
              </div>
            </div>
          </div>
          <div v-else class="empty-tip">暂无历史版本</div>
        </div>
        <div class="wf-modal-foot">
          <span class="warn-note">回退会用历史版本的 SQL 覆盖当前内容</span>
          <button class="wf-btn wf-btn-ghost" @click="versionOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.templates {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px; overflow-y: auto; height: 100%;
}

/* 页面头部 */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; flex-shrink: 0; }
.page-title { font-size: 19px; font-weight: 700; color: var(--wf-text); }
.page-sub { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }
.page-actions { display: flex; gap: 10px; }

/* 错误 / 提示条 */
.error-bar {
  background: #fdeeee; color: var(--wf-danger); border: 1px solid #f6c6c4;
  padding: 9px 14px; border-radius: var(--wf-radius); font-size: 12.5px; word-break: break-all; flex-shrink: 0;
}
.toast {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 600;
  background: #1f2329; color: #fff; padding: 9px 18px; border-radius: 6px; font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,.25); animation: toast-in .2s;
}
@keyframes toast-in { from { opacity: 0; transform: translate(-50%, -8px); } }
.err-text { color: var(--wf-danger); font-size: 12.5px; margin: 6px 0; }
.warn-note { font-size: 12px; color: var(--wf-text-4); }
.empty-tip { text-align: center; color: var(--wf-text-4); padding: 22px 0; font-size: 13px; }
.empty-cell { text-align: center; color: var(--wf-text-4); padding: 28px 0 !important; }

/* 左右布局 */
.body { display: flex; gap: 14px; flex: 1; min-height: 0; }

/* 左：列表面板 */
.left { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; }
.toolbar { padding: 12px 16px; gap: 10px; display: flex; align-items: center; }
.tpl-list { overflow-y: auto; flex: 1; padding: 8px; }
.tpl-item {
  padding: 10px 12px; border-radius: var(--wf-radius); cursor: pointer;
  transition: background .13s; border: 1px solid transparent;
}
.tpl-item:hover { background: var(--wf-bg-soft); }
.tpl-item.active { background: #e8f3ff; border-color: rgba(0,130,239,.25); }
.tpl-title { display: flex; align-items: center; gap: 8px; }
.tpl-name { font-size: 13.5px; font-weight: 600; color: var(--wf-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.ver-badge {
  font-size: 10.5px; color: var(--wf-text-3); background: var(--wf-bg-soft);
  border-radius: 3px; padding: 1px 6px; white-space: nowrap;
}
.ver-badge.on { color: #0082ef; background: #d6eaff; }
.tpl-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.cat-tag { font-size: 11px; color: #2ea121; background: #e8f6e7; border-radius: 3px; padding: 1px 6px; }
.tpl-tags { font-size: 11px; color: var(--wf-text-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 右：详情面板 */
.right { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sel-instance { width: 220px; }
.toolbar-gap { flex: 1; }
.editor { padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }
.field-row { display: flex; gap: 10px; }
.sql-area { height: 220px; font-family: var(--wf-mono); }

/* 参数区 */
.params { background: var(--wf-bg-soft); border: 1px solid var(--wf-border); border-radius: var(--wf-radius); padding: 10px 12px; }
.params-label { font-size: 12px; color: var(--wf-text-2); font-weight: 600; }
.params-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px; }
.param-item { display: flex; align-items: center; gap: 8px; }
.param-key { font-size: 12px; color: var(--wf-accent); white-space: nowrap; }

/* 底部按钮行 */
.action-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.left-ops { display: flex; gap: 10px; }

/* 查询结果 */
.result-error {
  background: #fdeeee; color: var(--wf-danger); border: 1px solid #f6c6c4;
  padding: 9px 14px; border-radius: var(--wf-radius); font-size: 12.5px; word-break: break-all;
}
.result-wrap { border: 1px solid var(--wf-border); border-radius: var(--wf-radius); overflow: hidden; }
.result-meta { font-size: 12px; color: var(--wf-text-2); padding: 8px 14px; background: var(--wf-bg-soft); border-bottom: 1px solid var(--wf-border); }
.affect-note { color: var(--wf-warn-deep); margin-left: 6px; }
.table-scroll { overflow: auto; max-height: 320px; }
.table-scroll .mono { white-space: nowrap; }

/* 版本历史弹窗 */
.wf-modal.sm { width: 460px; }
.ver-list { display: flex; flex-direction: column; gap: 10px; }
.ver-row { border: 1px solid var(--wf-border); border-radius: var(--wf-radius); padding: 10px 12px; }
.ver-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ver-no { font-size: 13px; font-weight: 600; color: var(--wf-accent); }
.ver-time { font-size: 12px; color: var(--wf-text-4); }
.ver-sql {
  font-size: 12px; color: var(--wf-text-2); background: var(--wf-bg-soft);
  border-radius: 3px; padding: 8px 10px; max-height: 96px; overflow: hidden; white-space: pre-wrap; word-break: break-all;
}
.ver-actions { margin-top: 8px; text-align: right; }
</style>