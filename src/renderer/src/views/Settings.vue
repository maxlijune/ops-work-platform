<script setup lang="ts">
import { onMounted, ref } from 'vue'

// 版本 fallback（无主进程/读失败时使用）
const VERSION_FALLBACK = '0.0.1.202609111236'
const THRESH_WARN_KEY = 'wf_thresh_warn'
const THRESH_DANGER_KEY = 'wf_thresh_danger'
const DEFAULT_WARN = 85
const DEFAULT_DANGER = 95

const warnThresh = ref<string>(String(DEFAULT_WARN))
const dangerThresh = ref<string>(String(DEFAULT_DANGER))
const savedTip = ref('')
const appName = ref('DBA 运维工作台')
const appVersion = ref(VERSION_FALLBACK)

function errMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && (e as any).message) return (e as any).message
  return String(e)
}
function isErr(r: unknown): boolean {
  return !!r && typeof r === 'object' && '__error' in (r as any)
}

function flashSaved(msg: string) {
  savedTip.value = msg
  window.setTimeout(() => { if (savedTip.value === msg) savedTip.value = '' }, 2500)
}

// ---- 读取本地阈值（localStorage，当前无写接口）----
function loadThresh() {
  const w = localStorage.getItem(THRESH_WARN_KEY)
  const d = localStorage.getItem(THRESH_DANGER_KEY)
  warnThresh.value = w != null ? w : String(DEFAULT_WARN)
  dangerThresh.value = d != null ? d : String(DEFAULT_DANGER)
}

function saveThresh() {
  let w = Number(warnThresh.value)
  let d = Number(dangerThresh.value)
  if (!Number.isFinite(w) || w < 0 || w > 100) { flashSaved('警告阈值需为 0-100 的数字'); return }
  if (!Number.isFinite(d) || d < 0 || d > 100) { flashSaved('危险阈值需为 0-100 的数字'); return }
  if (w >= d) { flashSaved('警告阈值应小于危险阈值'); return }
  localStorage.setItem(THRESH_WARN_KEY, String(w))
  localStorage.setItem(THRESH_DANGER_KEY, String(d))
  warnThresh.value = String(w)
  dangerThresh.value = String(d)
  flashSaved('已保存')
}

// ---- 应用信息 ----
async function loadAppInfo() {
  try {
    const r = await window.api.app.info()
    if (isErr(r)) { appName.value = 'DBA 运维工作台'; appVersion.value = VERSION_FALLBACK; return }
    const info = r as { version: string; name: string }
    if (info.name) appName.value = info.name
    appVersion.value = info.version || VERSION_FALLBACK
  } catch (e) {
    // 无主进程等：走 fallback
    appName.value = 'DBA 运维工作台'
    appVersion.value = VERSION_FALLBACK
  }
}

onMounted(() => { loadThresh(); loadAppInfo() })
</script>

<template>
  <div class="settings">
    <!-- 页面头部 -->
    <div class="page-head">
      <div>
        <div class="page-title">设置</div>
        <div class="page-sub">阈值与显示偏好</div>
      </div>
    </div>

    <!-- 容量告警阈值 -->
    <div class="wf-board">
      <div class="wf-board-head head">
        <span class="head-title">容量告警阈值</span>
      </div>
      <div class="board-body">
        <div class="wf-form-grid">
          <div class="wf-form-row">
            <label>警告阈值<span class="hint">默认 85</span></label>
            <div class="input-with-unit">
              <input class="wf-input" type="number" v-model.number="warnThresh" min="0" max="100" />
              <span class="unit">%</span>
            </div>
          </div>
          <div class="wf-form-row">
            <label>危险阈值<span class="hint">默认 95</span></label>
            <div class="input-with-unit">
              <input class="wf-input" type="number" v-model.number="dangerThresh" min="0" max="100" />
              <span class="unit">%</span>
            </div>
          </div>
        </div>
        <div class="thresh-note">这些值会被监控看板使用：超过警告阈值以黄色提示，超过危险阈值以红色告警。</div>
        <div class="save-actions">
          <button class="wf-btn wf-btn-primary" @click="saveThresh">保存</button>
          <span v-if="savedTip" class="saved-tip">{{ savedTip }}</span>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="wf-board">
      <div class="wf-board-head head">
        <span class="head-title">关于</span>
      </div>
      <div class="board-body">
        <div class="about-row">
          <span class="about-label">名称</span>
          <span class="about-value">{{ appName }}</span>
        </div>
        <div class="about-row">
          <span class="about-label">版本</span>
          <span class="about-value">{{ appVersion }}</span>
        </div>
        <div class="about-desc">
          本工具为 DBA 日常运维设计，Windows 桌面端，数据库能力由插件驱动。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px; overflow-y: auto; height: 100%;
  max-width: 720px;
}

/* 页面头部 */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.page-title { font-size: 19px; font-weight: 700; color: var(--wf-text); }
.page-sub { font-size: 12px; color: var(--wf-text-3); margin-top: 3px; }

/* 卡片 */
.head { padding: 12px 16px; }
.head-title { font-size: 13.5px; font-weight: 600; color: var(--wf-text); }
.board-body { padding: 16px; }

.input-with-unit { display: flex; align-items: center; gap: 8px; }
.input-with-unit .wf-input { width: 160px; }
.unit { font-size: 13px; color: var(--wf-text-3); }

.thresh-note { font-size: 12px; color: var(--wf-text-4); margin-top: 4px; }
.save-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.saved-tip { font-size: 12.5px; color: var(--wf-ok); }

/* 关于 */
.about-row { display: flex; align-items: center; gap: 14px; padding: 5px 0; font-size: 13px; }
.about-label { width: 60px; color: var(--wf-text-3); flex-shrink: 0; }
.about-value { color: var(--wf-text); }
.about-desc {
  margin-top: 12px; padding: 12px 14px; background: var(--wf-bg-soft);
  border: 1px solid var(--wf-border); border-radius: var(--wf-radius);
  font-size: 12.5px; color: var(--wf-text-2); line-height: 1.7;
}
</style>