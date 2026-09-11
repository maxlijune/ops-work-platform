<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { InstanceDTO, InstanceGroupDTO, PluginStateDTO } from '../../../shared/ipc'

interface TestResult { ok: boolean; ms?: number; error?: string }

// ---- 连接状态缓存（实例 id -> 最近一次测试结果）----
const statusMap = ref<Record<number, { state: 'idle' | 'testing' | 'ok' | 'fail'; ms?: number; error?: string }>>({})

// ---- 通用状态 ----
const loading = ref(false)
const globalError = ref('')
const toast = ref('')
const instances = ref<InstanceDTO[]>([])
const groups = ref<InstanceGroupDTO[]>([])
const plugins = ref<PluginStateDTO[]>([])
const keyword = ref('')

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
const groupsById = computed(() => {
  const m = new Map<number, InstanceGroupDTO>()
  for (const g of groups.value) m.set(g.id, g)
  return m
})

// 已启用插件声明的 dbType 去重
const enabledDbTypeCount = computed(() => {
  const s = new Set<string>()
  for (const p of plugins.value) {
    if (p.enabled && p.manifest.dbType) s.add(p.manifest.dbType)
  }
  return s.size
})

// 表单可用 dbType：已启用插件 + 当前已选（防止编辑未启用驱动实例时丢失选项）
const dbTypeOptions = computed(() => {
  const s = new Set<string>()
  for (const t of plugins.value) if (t.enabled && t.manifest.dbType) s.add(t.manifest.dbType)
  if (form.dbType) s.add(form.dbType)
  return [...s]
})

const filteredInstances = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return instances.value
  return instances.value.filter(
    i => (i.name || '').toLowerCase().includes(kw) || (i.host || '').toLowerCase().includes(kw)
  )
})

// 环境分组列：优先展示分组名，否则回退 env
function envLabel(ins: InstanceDTO): string {
  if (ins.groupId && groupsById.value.has(ins.groupId)) return groupsById.value.get(ins.groupId)!.name || (ins.env || '-')
  return ins.env || '-'
}

// ---- 加载 ----
async function loadInstances() {
  try {
    const r = await window.api.instances.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    instances.value = r as InstanceDTO[]
  } catch (e) { globalError.value = errMsg(e) }
}
async function loadGroups() {
  try {
    const r = await window.api.groups.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    groups.value = r as InstanceGroupDTO[]
  } catch (e) { globalError.value = errMsg(e) }
}
async function loadPlugins() {
  try {
    const r = await window.api.plugins.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    plugins.value = r as PluginStateDTO[]
  } catch (e) { /* 预览环境忽略 */ }
}
async function refresh() {
  loading.value = true
  await Promise.all([loadInstances(), loadGroups(), loadPlugins()])
  loading.value = false
}
onMounted(refresh)

// ---- 测试连接 ----
async function testConnection(ins: InstanceDTO) {
  statusMap.value[ins.id] = { state: 'testing' }
  try {
    const r = await window.api.instances.test(ins.id)
    if (isErr(r)) { statusMap.value[ins.id] = { state: 'fail', error: (r as any).__error }; return }
    const t = r as TestResult
    if (t.ok) statusMap.value[ins.id] = { state: 'ok', ms: t.ms }
    else statusMap.value[ins.id] = { state: 'fail', error: t.error || '连接失败' }
  } catch (e) {
    statusMap.value[ins.id] = { state: 'fail', error: errMsg(e) }
  }
}
function statusOf(ins: InstanceDTO) {
  return statusMap.value[ins.id] || { state: 'idle' as const }
}

// ---- 删除 ----
async function removeInstance(ins: InstanceDTO) {
  if (!window.confirm(`确定删除实例「${ins.name}」吗？`)) return
  try {
    await window.api.instances.delete(ins.id)
    delete statusMap.value[ins.id]
    flashToast('已删除')
    await loadInstances()
  } catch (e) { globalError.value = errMsg(e) }
}

// ---- 新增 / 编辑弹窗 ----
const modalOpen = ref(false)
const formSaving = ref(false)
const formError = ref('')
const envOptions = ['生产', '测试', '归档', '其他']

const form = reactive<{
  id?: number
  name: string
  host: string
  port: number | ''
  service: string
  dbType: string
  groupId: number | ''
  env: string
  user: string
  password: string
  note: string
}>({ name: '', host: '', port: 1521, service: '', dbType: '', groupId: '', env: '', user: '', password: '', note: '' })

function openCreate() {
  Object.assign(form, { id: undefined, name: '', host: '', port: 1521, service: '', dbType: dbTypeOptions.value[0] || '', groupId: '', env: '', user: '', password: '', note: '' })
  formError.value = ''
  modalOpen.value = true
}
function openEdit(ins: InstanceDTO) {
  Object.assign(form, {
    id: ins.id,
    name: ins.name,
    host: ins.host,
    port: ins.port,
    service: ins.service,
    dbType: ins.dbType,
    groupId: ins.groupId ?? '',
    env: ins.env ?? '',
    user: ins.user,
    password: ins.password,
    note: ins.note ?? ''
  })
  formError.value = ''
  modalOpen.value = true
}

async function saveForm() {
  formError.value = ''
  if (!form.name.trim() || !form.host.trim()) { formError.value = '请填写实例名称与主机'; return }
  if (!/^\d+$/.test(String(form.port))) { formError.value = '端口必须为数字'; return }
  formSaving.value = true
  const payload: Partial<InstanceDTO> = {
    name: form.name.trim(),
    host: form.host.trim(),
    port: Number(form.port),
    service: form.service.trim(),
    dbType: form.dbType,
    groupId: form.groupId === '' ? undefined : Number(form.groupId),
    env: form.env || undefined,
    user: form.user.trim(),
    password: form.password,
    note: form.note.trim() || undefined
  }
  if (form.id !== undefined) payload.id = form.id
  try {
    const r = await window.api.instances.save(payload)
    if (isErr(r)) { formError.value = (r as any).__error; return }
    modalOpen.value = false
    flashToast(form.id !== undefined ? '已更新' : '已新增')
    await loadInstances()
  } catch (e) { formError.value = errMsg(e) }
  finally { formSaving.value = false }
}

// ---- 分组管理弹窗 ----
const groupOpen = ref(false)
const newGroupName = ref('')
const groupError = ref('')

// 打开主弹窗时若分组尚未加载则补齐
watch(modalOpen, () => { if (modalOpen.value && !groups.value.length) loadGroups() })

async function addGroup() {
  const name = newGroupName.value.trim()
  if (!name) { groupError.value = '请输入分组名'; return }
  groupError.value = ''
  try {
    const r = await window.api.groups.save({ name })
    if (isErr(r)) { groupError.value = (r as any).__error; return }
    newGroupName.value = ''
    flashToast('已新增分组')
    await loadGroups()
  } catch (e) { groupError.value = errMsg(e) }
}
async function removeGroup(g: InstanceGroupDTO) {
  if (!window.confirm(`确定删除分组「${g.name}」吗？`)) return
  try {
    await window.api.groups.delete(g.id)
    flashToast('已删除')
    await loadGroups()
    // 分组删除后清空引用该分组的表单选择
    if (form.groupId === g.id) form.groupId = ''
  } catch (e) { groupError.value = errMsg(e) }
}
</script>

<template>
  <div class="instances">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">实例台账</div>
        <div class="page-sub">共 {{ instances.length }} 个实例 · 支持插件驱动 {{ enabledDbTypeCount }} 种</div>
      </div>
      <div class="page-actions">
        <button class="wf-btn wf-btn-ghost" @click="groupOpen = true">分组管理</button>
        <button class="wf-btn wf-btn-primary" @click="openCreate">新增实例</button>
      </div>
    </div>

    <div v-if="globalError" class="error-bar">{{ globalError }}</div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- 搜索 + 表格 -->
    <div class="wf-board">
      <div class="wf-board-head board-toolbar">
        <input class="wf-input search-input" v-model="keyword" placeholder="搜索名称 / IP" />
      </div>
      <div class="table-wrap">
        <table class="wf-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>主机:端口</th>
              <th>服务名</th>
              <th>数据库类型</th>
              <th>环境分组</th>
              <th>连接状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ins in filteredInstances" :key="ins.id">
              <td>
                {{ ins.name }}
                <span class="db-badge">{{ ins.dbType }}</span>
              </td>
              <td class="mono">{{ ins.host }}:{{ ins.port }}</td>
              <td class="mono">{{ ins.service || '-' }}</td>
              <td>{{ ins.dbType }}</td>
              <td>{{ envLabel(ins) }}</td>
              <td>
                <span v-if="statusOf(ins).state === 'testing'" class="wf-status warn"><i></i>测试中…</span>
                <span v-else-if="statusOf(ins).state === 'ok'" class="wf-status ok"><i></i>在线 · {{ statusOf(ins).ms }}ms</span>
                <span v-else-if="statusOf(ins).state === 'fail'" class="wf-status danger">
                  <i></i>离线 · {{ statusOf(ins).error }}
                </span>
                <span v-else class="wf-status warn"><i></i>未测试</span>
              </td>
              <td class="op-cell">
                <button class="wf-op" :disabled="statusOf(ins).state === 'testing'" @click="testConnection(ins)">测试连接</button>
                <button class="wf-op" @click="openEdit(ins)">编辑</button>
                <button class="wf-op wf-op-danger" @click="removeInstance(ins)">删除</button>
              </td>
            </tr>
            <tr v-if="!loading && filteredInstances.length === 0"><td colspan="7" class="empty-cell">暂无数据</td></tr>
            <tr v-if="loading"><td colspan="7" class="empty-cell">加载中…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div class="wf-mask" :class="{ show: modalOpen }" @click.self="modalOpen = false">
      <div class="wf-modal">
        <div class="wf-modal-head">
          <div class="t">{{ form.id !== undefined ? '编辑实例' : '新增实例' }}</div>
          <button class="wf-modal-close" @click="modalOpen = false">×</button>
        </div>
        <div class="wf-modal-body">
          <div class="wf-form-grid">
            <div class="wf-form-row">
              <label>实例名称</label>
              <input class="wf-input" v-model="form.name" placeholder="如 生产库-核心" />
            </div>
            <div class="wf-form-row">
              <label>主机</label>
              <input class="wf-input" v-model="form.host" placeholder="127.0.0.1 或 db.example.com" />
            </div>
            <div class="wf-form-row">
              <label>端口</label>
              <input class="wf-input" type="number" v-model.number="form.port" placeholder="1521" />
            </div>
            <div class="wf-form-row">
              <label>服务名 / 数据库</label>
              <input class="wf-input" v-model="form.service" placeholder="ORCLPIDB / mydb" />
            </div>
            <div class="wf-form-row">
              <label>数据库类型</label>
              <select class="wf-select" v-model="form.dbType">
                <option v-for="t in dbTypeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="wf-form-row">
              <label>所属分组</label>
              <select class="wf-select" v-model="form.groupId">
                <option value="">无分组</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
            <div class="wf-form-row">
              <label>环境</label>
              <select class="wf-select" v-model="form.env">
                <option value="">不指定</option>
                <option v-for="e in envOptions" :key="e" :value="e">{{ e }}</option>
              </select>
            </div>
            <div class="wf-form-row">
              <label>用户名</label>
              <input class="wf-input" v-model="form.user" placeholder="用户名" />
            </div>
            <div class="wf-form-row">
              <label>密码</label>
              <input class="wf-input" type="password" v-model="form.password" placeholder="密码" />
            </div>
          </div>
          <div class="wf-form-row">
            <label>备注</label>
            <textarea class="wf-textarea" v-model="form.note" placeholder="备注信息（可选）"></textarea>
          </div>
          <div v-if="formError" class="err-text">{{ formError }}</div>
        </div>
        <div class="wf-modal-foot">
          <span></span>
          <div>
            <button class="wf-btn wf-btn-ghost" @click="modalOpen = false">取消</button>
            <button class="wf-btn wf-btn-primary" :disabled="formSaving" @click="saveForm">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分组管理弹窗 -->
    <div class="wf-mask" :class="{ show: groupOpen }" @click.self="groupOpen = false">
      <div class="wf-modal sm">
        <div class="wf-modal-head">
          <div class="t">分组管理</div>
          <button class="wf-modal-close" @click="groupOpen = false">×</button>
        </div>
        <div class="wf-modal-body">
          <div class="group-add">
            <input class="wf-input" v-model="newGroupName" placeholder="新分组名称" @keyup.enter="addGroup" />
            <button class="wf-btn wf-btn-primary" @click="addGroup">新增</button>
          </div>
          <div v-if="groupError" class="err-text">{{ groupError }}</div>
          <div class="group-list">
            <div v-for="g in groups" :key="g.id" class="group-row">
              <span>{{ g.name }}</span>
              <button class="wf-op wf-op-danger" @click="removeGroup(g)">删除</button>
            </div>
            <div v-if="!groups.length" class="empty-tip">暂无分组</div>
          </div>
        </div>
        <div class="wf-modal-foot">
          <span class="warn-note">删除分组不影响其下实例，实例将回到未分组状态</span>
          <button class="wf-btn wf-btn-ghost" @click="groupOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.instances {
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
.empty-cell { text-align: center; color: var(--wf-text-4); padding: 28px 0 !important; }
.empty-tip { text-align: center; color: var(--wf-text-4); padding: 18px 0; font-size: 13px; }
.warn-note { font-size: 12px; color: var(--wf-text-4); }

/* 搜索工具栏 */
.board-toolbar { padding: 12px 16px; }
.search-input { width: 240px; }
.table-wrap { overflow-x: auto; }

/* dbType 徽标 */
.db-badge {
  font-size: 10.5px; color: #0082ef; background: #e8f3ff;
  border-radius: 3px; padding: 1px 6px; margin-left: 6px; white-space: nowrap;
}
.op-cell { white-space: nowrap; }

/* 分组管理 */
.wf-modal.sm { width: 440px; }
.group-add { display: flex; gap: 10px; margin-bottom: 8px; }
.group-add .wf-input { flex: 1; }
.group-list { max-height: 300px; overflow-y: auto; }
.group-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px; border-bottom: 1px solid #f0f1f3; font-size: 13px;
}
.group-row:last-child { border-bottom: none; }
</style>