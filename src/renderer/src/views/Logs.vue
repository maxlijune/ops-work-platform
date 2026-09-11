<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AuditLogDTO } from '../../../shared/ipc'

const loading = ref(false)
const globalError = ref('')
const logs = ref<AuditLogDTO[]>([])

function errMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && (e as any).message) return (e as any).message
  return String(e)
}
function isErr(r: unknown): boolean {
  return !!r && typeof r === 'object' && '__error' in (r as any)
}

// ---- 加载 ----
async function load() {
  loading.value = true
  globalError.value = ''
  try {
    const r = await window.api.logs.list(200)
    if (isErr(r)) { globalError.value = (r as any).__error; return }
    logs.value = r as AuditLogDTO[]
  } catch (e) { globalError.value = errMsg(e) }
  finally { loading.value = false }
}
onMounted(load)

// 负载列：可能为 SQL，过长截断显示
const PAYLOAD_MAX = 120
function truncated(payload: string): string {
  if (!payload) return '-'
  return payload.length > PAYLOAD_MAX ? payload.slice(0, PAYLOAD_MAX) + '…' : payload
}

function fmt(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').replace(/\.\d+$/, '').slice(0, 19)
}
function resultText(r: string): string {
  if (!r) return '-'
  return r.length > 80 ? r.slice(0, 80) + '…' : r
}
</script>

<template>
  <div class="logs">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">操作日志</div>
        <div class="page-sub">所有变更操作记录 · 扩容/DDL 等自动留痕</div>
      </div>
      <div class="page-actions">
        <button class="wf-btn wf-btn-ghost" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <div v-if="globalError" class="error-bar">{{ globalError }}</div>

    <!-- 日志表格 -->
    <div class="wf-board">
      <div class="table-wrap">
        <table class="wf-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>目标</th>
              <th>操作类型</th>
              <th>负载</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td class="mono nowrap">{{ fmt(log.time) }}</td>
              <td>{{ log.target || '-' }}</td>
              <td>
                <span class="action-badge">{{ log.action || '-' }}</span>
              </td>
              <td>
                <div class="mono payload" :title="log.payload">{{ truncated(log.payload) }}</div>
              </td>
              <td class="result-cell mono" :title="log.result">{{ resultText(log.result) }}</td>
            </tr>
            <tr v-if="!loading && logs.length === 0">
              <td colspan="5" class="empty-cell">暂无操作日志</td>
            </tr>
            <tr v-if="loading"><td colspan="5" class="empty-cell">加载中…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px; overflow-y: auto; height: 100%;
}

/* 页面头部 */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.page-title { font-size: 19px; font-weight: 700; color: var(--wf-text); }
.page-sub { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }
.page-actions { display: flex; gap: 10px; }

/* 错误提示条 */
.error-bar {
  background: #fdeeee; color: var(--wf-danger); border: 1px solid #f6c6c4;
  padding: 9px 14px; border-radius: var(--wf-radius); font-size: 12.5px; word-break: break-all;
}
.empty-cell { text-align: center; color: var(--wf-text-4); padding: 28px 0 !important; }

/* 表格 */
.table-wrap { overflow-x: auto; }
.nowrap { white-space: nowrap; }
.action-badge {
  font-size: 11.5px; color: var(--wf-accent); background: var(--wf-accent-soft);
  border-radius: 3px; padding: 1px 7px; white-space: nowrap;
}
.payload {
  max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--wf-text-2); font-family: var(--wf-mono); font-size: 12px;
}
.result-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>