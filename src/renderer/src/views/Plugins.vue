<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PluginStateDTO } from '../../../shared/ipc'

const loading = ref(false)
const globalError = ref('')
const toast = ref('')
const plugins = ref<PluginStateDTO[]>([])

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

// 处于 error 状态且有 error 描述的插件，用于表格上方的红色错误提示条
const errorPlugins = ref<PluginStateDTO[]>([])

// ---- 加载 ----
async function loadPlugins() {
  try {
    const r = await window.api.plugins.list()
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    plugins.value = r as PluginStateDTO[]
    errorPlugins.value = (r as PluginStateDTO[]).filter(p => !!p.error)
  } catch (e) { globalError.value = errMsg(e) }
}
async function refresh() {
  loading.value = true
  await loadPlugins()
  loading.value = false
}
onMounted(refresh)

// ---- 启用 / 停用 ----
const togglingId = ref<string | null>(null)
async function toggleEnabled(p: PluginStateDTO) {
  togglingId.value = p.id
  globalError.value = ''
  try {
    const r = await window.api.plugins.setEnabled(p.id, !p.enabled)
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    if (r === false) { globalError.value = '切换失败，请重试'; return }
    flashToast(p.enabled ? '已停用' : '已启用')
    await loadPlugins()
  } catch (e) { globalError.value = errMsg(e) }
  finally { togglingId.value = null }
}

// ---- 安装 ----
const installing = ref(false)
async function installPlugin() {
  globalError.value = ''
  // 沙箱无原生对话框，用 prompt 让用户输入 zip 绝对路径
  const zipPath = window.prompt('请输入插件 zip 文件的绝对路径，如 D:/plugins/my-plugin.zip：')
  if (!zipPath || !zipPath.trim()) {
    flashToast('已取消：未输入路径')
    return
  }
  installing.value = true
  try {
    const r = await window.api.plugins.install(zipPath.trim())
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    const dto = r as PluginStateDTO
    flashToast(`已安装插件「${dto.manifest.name || dto.manifest.id}」`)
    await loadPlugins()
  } catch (e) { globalError.value = errMsg(e) }
  finally { installing.value = false }
}

// ---- 卸载（仅 user 来源）----
const removingId = ref<string | null>(null)
async function uninstall(p: PluginStateDTO) {
  if (!window.confirm(`确定卸载插件「${p.manifest.name || p.manifest.id}」吗？`)) return
  removingId.value = p.id
  globalError.value = ''
  try {
    const r = await window.api.plugins.uninstall(p.id)
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    if (r === false) { globalError.value = '卸载失败，请重试'; return }
    flashToast('已卸载')
    await loadPlugins()
  } catch (e) { globalError.value = errMsg(e) }
  finally { removingId.value = null }
}

function sourceLabel(p: PluginStateDTO): string {
  return p.source === 'builtin' ? '内置' : '用户区'
}
</script>

<template>
  <div class="plugins">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">插件管理</div>
        <div class="page-sub">数据库驱动插件 · 可装卸/禁用 · 内置插件可禁用不可卸载</div>
      </div>
      <div class="page-actions">
        <button class="wf-btn wf-btn-primary" :disabled="installing" @click="installPlugin">
          {{ installing ? '安装中…' : '安装插件(.zip)' }}
        </button>
      </div>
    </div>

    <div v-if="globalError" class="error-bar">{{ globalError }}</div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- 插件错误提示条 -->
    <div v-if="errorPlugins.length" class="plugin-error-bar">
      <template v-for="p in errorPlugins" :key="p.id">
        <div class="plugin-error-line">
          <span class="mono">{{ p.manifest.name || p.manifest.id }}</span>
          ：{{ p.error }}
        </div>
      </template>
    </div>

    <!-- 插件表格 -->
    <div class="wf-board">
      <div class="table-wrap">
        <table class="wf-table">
          <thead>
            <tr>
              <th>插件名</th>
              <th>数据库类型</th>
              <th>版本</th>
              <th>来源</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in plugins" :key="p.id">
              <td>
                {{ p.manifest.name }}
                <span class="id-badge mono">{{ p.manifest.id }}</span>
              </td>
              <td>{{ p.manifest.dbType || '-' }}</td>
              <td class="mono">{{ p.manifest.version || '-' }}</td>
              <td>{{ sourceLabel(p) }}</td>
              <td>
                <span v-if="p.error" class="wf-status danger"><i></i>异常</span>
                <span v-else-if="p.enabled" class="wf-status ok"><i></i>已启用</span>
                <span v-else class="wf-status"><i></i>已停用</span>
              </td>
              <td class="op-cell">
                <button
                  class="wf-op"
                  :disabled="togglingId === p.id"
                  @click="toggleEnabled(p)"
                >{{ p.enabled ? '停用' : '启用' }}</button>
                <button
                  v-if="p.source === 'user'"
                  class="wf-op wf-op-danger"
                  :disabled="removingId === p.id"
                  @click="uninstall(p)"
                >卸载</button>
              </td>
            </tr>
            <tr v-if="!loading && plugins.length === 0"><td colspan="6" class="empty-cell">暂无插件</td></tr>
            <tr v-if="loading"><td colspan="6" class="empty-cell">加载中…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugins {
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
.empty-cell { text-align: center; color: var(--wf-text-4); padding: 28px 0 !important; }

/* 插件错误提示条 */
.plugin-error-bar {
  background: #fdeeee; color: var(--wf-danger); border: 1px solid #f6c6c4;
  padding: 9px 14px; border-radius: var(--wf-radius); font-size: 12.5px; flex-shrink: 0;
}
.plugin-error-line { word-break: break-all; }
.plugin-error-line + .plugin-error-line { margin-top: 4px; }

/* id 徽标 */
.id-badge {
  font-size: 11px; color: var(--wf-text-3); background: var(--wf-bg-soft);
  border-radius: 3px; padding: 1px 6px; margin-left: 6px; white-space: nowrap;
}
.table-wrap { overflow-x: auto; }
.op-cell { white-space: nowrap; }
</style>