<template>
  <div class="flex h-screen bg-bg-main">
    <!-- Sidebar -->
    <aside class="w-64 bg-bg-sidebar text-white flex flex-col transition-all duration-300" :class="{ 'w-20': sidebarCollapsed }">
      <!-- Logo / Quick Add -->
      <div class="p-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h1 v-if="!sidebarCollapsed" class="text-lg font-bold text-white">运维工作平台</h1>
          <h1 v-else class="text-lg font-bold text-white text-center w-full">OPS</h1>
          <el-button type="primary" size="small" circle @click="showQuickAdd = true" :disabled="sidebarCollapsed">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-2">
        <router-link
          v-for="route in menuRoutes"
          :key="route.path"
          :to="route.path"
          class="flex items-center px-4 py-3 text-gray-300 hover:bg-bg-sidebar-hover hover:text-white transition-colors"
          :class="{ 'bg-bg-sidebar-active text-white': isActive(route.path) }"
        >
          <el-icon class="text-lg">
            <component :is="route.meta.icon" />
          </el-icon>
          <span v-if="!sidebarCollapsed" class="ml-3 text-sm">{{ route.meta.title }}</span>
        </router-link>
      </nav>

      <!-- Collapse Toggle -->
      <div class="p-3 border-t border-gray-700">
        <button
          class="w-full flex items-center justify-center text-gray-400 hover:text-white"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <el-icon><component :is="sidebarCollapsed ? 'Expand' : 'Fold'" /></el-icon>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="h-14 bg-white border-b border-border-light flex items-center justify-between px-6 shadow-sm">
        <div class="flex items-center">
          <h2 class="text-lg font-semibold text-text-main">{{ currentPageTitle }}</h2>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Search -->
          <el-input
            v-model="searchQuery"
            placeholder="搜索所有内容..."
            class="w-64"
            size="default"
            :prefix-icon="Search"
          />

          <!-- Alert Bell -->
          <el-badge :value="unresolvedAlertCount" :hidden="unresolvedAlertCount === 0" class="cursor-pointer">
            <el-icon class="text-xl text-text-secondary hover:text-primary" @click="showAlertPanel = true"><Bell /></el-icon>
          </el-badge>

          <!-- Backend Status -->
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 rounded-full" :class="backendConnected ? 'bg-success' : 'bg-danger'"></div>
            <span class="text-sm text-text-secondary">后端状态</span>
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto p-6">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Footer Status Bar -->
      <footer class="h-8 bg-white border-t border-border-light flex items-center justify-between px-6 text-xs text-text-secondary">
        <div class="flex items-center space-x-4">
          <span>采集状态: {{ collectionStatus }}</span>
          <span>调度器: {{ schedulerStatus }}</span>
        </div>
        <div>
          数据存储: {{ dataPath }}
        </div>
      </footer>
    </div>

    <!-- Quick Add Dialog -->
    <el-dialog v-model="showQuickAdd" title="快速新增" width="400px" :close-on-click-modal="true">
      <div class="grid grid-cols-2 gap-3">
        <el-button class="flex flex-col items-center py-4" @click="quickAdd('server')">
          <el-icon class="text-2xl mb-1"><Monitor /></el-icon>
          <span>服务器</span>
        </el-button>
        <el-button class="flex flex-col items-center py-4" @click="quickAdd('database')">
          <el-icon class="text-2xl mb-1"><Coin /></el-icon>
          <span>数据库</span>
        </el-button>
        <el-button class="flex flex-col items-center py-4" @click="quickAdd('job')">
          <el-icon class="text-2xl mb-1"><Timer /></el-icon>
          <span>定时作业</span>
        </el-button>
        <el-button class="flex flex-col items-center py-4" @click="quickAdd('sql-note')">
          <el-icon class="text-2xl mb-1"><Document /></el-icon>
          <span>SQL笔记</span>
        </el-button>
      </div>
    </el-dialog>

    <!-- Alert Panel -->
    <el-dialog v-model="showAlertPanel" title="告警列表" width="600px">
      <div v-if="alerts.length === 0" class="text-center py-8 text-text-secondary">
        <el-icon class="text-4xl text-success mb-2"><CircleCheck /></el-icon>
        <p>暂无未处理告警</p>
      </div>
      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="p-3 bg-white border-l-4 rounded shadow-sm cursor-pointer hover:bg-gray-50"
          :class="{
            'border-danger': alert.level === 'critical',
            'border-warning': alert.level === 'warning',
            'border-primary': alert.level === 'info'
          }"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">{{ alert.message }}</span>
            <el-tag :type="alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'info'" size="small">
              {{ alert.level }}
            </el-tag>
          </div>
          <div class="text-xs text-text-secondary mt-1">
            {{ alert.source_type }}: {{ alert.source_id }} | {{ formatTime(alert.created_at) }}
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const sidebarCollapsed = ref(false)
const showQuickAdd = ref(false)
const showAlertPanel = ref(false)
const searchQuery = ref('')
const backendConnected = ref(true)
const alerts = ref([])
const collectionStatus = ref('正常')
const schedulerStatus = ref('运行中')
const dataPath = ref('local')

const menuRoutes = computed(() => {
  return router.options.routes.filter(r => r.meta && r.meta.title)
})

const currentPageTitle = computed(() => {
  return route.meta.title || '运维工作平台'
})

const unresolvedAlertCount = computed(() => {
  return alerts.value.filter(a => a.status === 'unresolved').length
})

const isActive = (path) => route.path === path

const quickAdd = (type) => {
  showQuickAdd.value = false
  const routeMap = {
    'server': '/servers',
    'database': '/databases',
    'job': '/jobs',
    'sql-note': '/sql-notes'
  }
  router.push(routeMap[type] || '/')
  ElMessage.success(`跳转到${type}新增页面`)
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN')
}

const fetchAlerts = async () => {
  try {
    const res = await axios.get('/api/v1/alerts')
    if (res.data.code === 0) {
      alerts.value = res.data.data
    }
  } catch (e) {
    console.error('Failed to fetch alerts:', e)
  }
}

const checkBackend = async () => {
  try {
    const res = await axios.get('/api/v1/health')
    backendConnected.value = res.data.status === 'healthy'
  } catch (e) {
    backendConnected.value = false
  }
}

onMounted(() => {
  checkBackend()
  fetchAlerts()
  setInterval(checkBackend, 30000)
  setInterval(fetchAlerts, 10000)
})
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
