<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Dashboard from './views/Dashboard.vue'
import Instances from './views/Instances.vue'
import SqlTemplates from './views/SqlTemplates.vue'
import Plugins from './views/Plugins.vue'
import Logs from './views/Logs.vue'
import Settings from './views/Settings.vue'

const current = ref('dashboard')
const appVersion = ref('0.0.1.202609111236')
const navBadge = ref('')
const object = ref<any>(null)

onMounted(async () => {
  try {
    const info = await window.api.app.info()
    appVersion.value = info.version
    const logs = await window.api.logs.list(20)
    if (logs.length > 0) navBadge.value = String(logs.length)
  } catch {
    // Vite 预览环境无主进程
  }
})

const navs = [
  { key: 'dashboard', label: '监控看板', icon: 'grid' },
  { key: 'instances', label: '实例台账', icon: 'db' },
  { key: 'templates', label: 'SQL 模板', icon: 'code' },
  { key: 'plugins', label: '插件管理', icon: 'plug' },
  { key: 'logs', label: '操作日志', icon: 'list' },
  { key: 'settings', label: '设置', icon: 'gear' }
]
</script>

<template>
  <div class="app">
    <!-- 左栏导航（企业微信风格：深蓝黑 + 商务蓝高亮） -->
    <nav class="rail">
      <div class="rail-logo">DB</div>
      <div
        v-for="n in navs"
        :key="n.key"
        class="rail-item"
        :class="{ active: current === n.key }"
        :title="n.label"
        @click="current = n.key"
      >
        <svg v-if="n.icon==='grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>
        <svg v-else-if="n.icon==='db'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>
        <svg v-else-if="n.icon==='code'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/></svg>
        <svg v-else-if="n.icon==='plug'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
        <svg v-else-if="n.icon==='list'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        <span v-if="n.key==='logs' && navBadge" class="rail-badge">{{ navBadge }}</span>
      </div>
      <div class="rail-spacer"></div>
      <div class="rail-ver">{{ appVersion }}</div>
    </nav>

    <!-- 主区 -->
    <main class="main">
      <Dashboard v-if="current==='dashboard'" />
      <Instances v-else-if="current==='instances'" />
      <SqlTemplates v-else-if="current==='templates'" />
      <Plugins v-else-if="current==='plugins'" />
      <Logs v-else-if="current==='logs'" />
      <Settings v-else />
    </main>
  </div>
</template>

<style scoped>
.app { display: flex; height: 100vh; }
.rail {
  width: 56px; background: var(--wf-rail-bg); flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center; padding: 14px 0 12px; gap: 4px;
}
.rail-logo {
  width: 34px; height: 34px; border-radius: 7px; margin-bottom: 16px;
  background: var(--wf-accent); color: #fff; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.rail-item {
  width: 38px; height: 38px; border-radius: 7px; position: relative;
  display: flex; align-items: center; justify-content: center;
  color: var(--wf-rail-ico); cursor: pointer; transition: all .15s;
}
.rail-item:hover { color: #d3d9e0; background: rgba(255,255,255,.07); }
.rail-item.active { color: var(--wf-rail-active); background: rgba(255,255,255,.1); }
.rail-item.active svg { color: var(--wf-accent); }
.rail-item.active::after {
  content: ''; position: absolute; left: 50%; bottom: 3px; transform: translateX(-50%);
  width: 14px; height: 2.5px; border-radius: 2px; background: var(--wf-accent);
}
.rail-item svg { width: 19px; height: 19px; }
.rail-badge {
  position: absolute; top: 4px; right: 4px; min-width: 15px; height: 15px; padding: 0 4px;
  background: var(--wf-danger); color: #fff; font-size: 10px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; line-height: 1;
}
.rail-spacer { flex: 1; }
.rail-ver {
  writing-mode: vertical-rl; font-size: 9px; color: #5a6068; letter-spacing: 1px;
}
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--wf-body-bg); }
</style>