<template>
  <div class="flex h-screen bg-bg-main gap-3">
    <!-- Sidebar - GitHub-inspired dark sidebar -->
    <aside class="bg-bg-sidebar text-gray-300 flex flex-col transition-all duration-200 shadow-lg shadow-black/20 z-10" :class="sidebarCollapsed ? 'w-16' : 'w-60'">
      <!-- Logo / Brand -->
      <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2">
        <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span class="text-white text-sm font-bold">O</span>
        </div>
        <div v-if="!sidebarCollapsed" class="flex flex-col overflow-hidden">
          <span class="text-sm font-semibold text-white truncate">运维工作平台</span>
          <span class="text-xs text-gray-500 truncate">Ops Work Platform</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-2 px-2">
        <div class="px-3 py-1 text-xs text-gray-600 uppercase tracking-wider" v-if="!sidebarCollapsed">主菜单</div>
        <router-link
          v-for="route in mainMenuRoutes"
          :key="route.path"
          :to="route.path"
          class="flex items-center px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-bg-sidebar-hover hover:text-white transition-colors mb-0.5"
          :class="{ 'bg-bg-sidebar-hover text-white': isActive(route.path) }"
        >
          <el-icon class="text-base flex-shrink-0 w-5"><component :is="route.meta.icon" /></el-icon>
          <span v-if="!sidebarCollapsed" class="ml-3 font-medium">{{ route.meta.title }}</span>
        </router-link>
      </nav>

      <!-- Bottom Section: Settings + User -->
      <div class="border-t border-border-dark">
        <!-- Settings (always at bottom) -->
        <div class="px-2 py-2">
          <router-link
            v-for="route in bottomMenuRoutes"
            :key="route.path"
            :to="route.path"
            class="flex items-center px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-bg-sidebar-hover hover:text-white transition-colors mb-0.5"
            :class="{ 'bg-bg-sidebar-hover text-white': isActive(route.path) }"
          >
            <el-icon class="text-base flex-shrink-0 w-5"><component :is="route.meta.icon" /></el-icon>
            <span v-if="!sidebarCollapsed" class="ml-3 font-medium">{{ route.meta.title }}</span>
          </router-link>
        </div>

        <!-- User Profile -->
        <div class="px-3 py-2 border-t border-border-dark">
          <el-dropdown trigger="click" @command="handleUserCommand">
            <div class="flex items-center gap-2 cursor-pointer hover:bg-bg-sidebar-hover rounded-md px-2 py-1.5 transition-colors">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
                <span class="text-white text-xs font-bold">O</span>
              </div>
              <div v-if="!sidebarCollapsed" class="flex flex-col overflow-hidden">
                <span class="text-xs font-semibold text-white truncate">运维用户</span>
                <span class="text-xs text-gray-500 truncate">ops@local</span>
              </div>
              <el-icon v-if="!sidebarCollapsed" class="ml-auto text-gray-500 text-xs"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile"><el-icon><User /></el-icon>个人信息</el-dropdown-item>
                <el-dropdown-item command="settings"><el-icon><Setting /></el-icon>设置</el-dropdown-item>
                <el-dropdown-item divided command="about"><el-icon><InfoFilled /></el-icon>关于</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- Collapse Toggle -->
        <div class="px-3 py-2 border-t border-border-dark">
          <button
            class="w-full flex items-center justify-center text-gray-500 hover:text-white text-xs"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <el-icon><component :is="sidebarCollapsed ? 'Expand' : 'Fold'" /></el-icon>
            <span v-if="!sidebarCollapsed" class="ml-2">收起侧栏</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden ml-1">
      <!-- Header - GitHub inspired -->
      <header class="h-14 bg-white border-b border-border-light flex items-center justify-between px-5">
        <div class="flex items-center gap-4">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 text-sm">
            <span class="text-text-secondary">运维工作平台</span>
            <span class="text-gray-300">/</span>
            <span class="font-semibold text-text-main">{{ currentPageTitle }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Search -->
          <el-input
            v-model="searchQuery"
            placeholder="搜索 (Ctrl+K)"
            class="w-48"
            size="small"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <!-- Alert Bell -->
          <el-badge :value="unresolvedAlertCount" :hidden="unresolvedAlertCount === 0" class="cursor-pointer">
            <el-icon class="text-lg text-text-secondary hover:text-primary" @click="showAlertPanel = true"><Bell /></el-icon>
          </el-badge>

          <!-- Backend Status -->
          <div class="flex items-center gap-1.5 text-xs">
            <div class="w-2 h-2 rounded-full" :class="backendConnected ? 'bg-success' : 'bg-danger'"></div>
            <span class="text-text-secondary">{{ backendConnected ? '已连接' : '未连接' }}</span>
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto bg-bg-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Alert Panel -->
    <el-dialog v-model="showAlertPanel" title="告警列表" width="560px">
      <div v-if="alerts.length === 0" class="text-center py-8 text-text-secondary">
        <el-icon class="text-4xl text-success mb-2"><CircleCheck /></el-icon>
        <p>暂无未处理告警</p>
      </div>
      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="flex items-center p-3 bg-gray-50 rounded border-l-4 cursor-pointer hover:bg-gray-100"
          :class="{
            'border-danger': alert.level === 'critical',
            'border-warning': alert.level === 'warning',
            'border-primary': alert.level === 'info'
          }"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <el-tag :type="alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'info'" size="small">
                {{ alert.level }}
              </el-tag>
              <span class="text-sm font-medium">{{ alert.message }}</span>
            </div>
            <div class="text-xs text-text-secondary mt-1">
              {{ alert.source_type }} · {{ formatTime(alert.created_at) }}
            </div>
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
import { Search } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const sidebarCollapsed = ref(false)
const showAlertPanel = ref(false)
const searchQuery = ref('')
const backendConnected = ref(true)
const alerts = ref([])

const allRoutes = computed(() => {
  return router.options.routes.filter(r => r.meta && r.meta.title)
})

const mainMenuRoutes = computed(() => {
  return allRoutes.value.filter(r => r.path !== '/settings')
})

const bottomMenuRoutes = computed(() => {
  return allRoutes.value.filter(r => r.path === '/settings')
})

const currentPageTitle = computed(() => {
  return route.meta.title || '运维工作平台'
})

const unresolvedAlertCount = computed(() => {
  return alerts.value.filter(a => a.status === 'unresolved').length
})

const isActive = (path) => route.path === path

const handleUserCommand = (cmd) => {
  if (cmd === 'profile') ElMessage.info('个人信息功能开发中')
  else if (cmd === 'settings') router.push('/settings')
  else if (cmd === 'about') ElMessage.info('运维工作平台 v1.0.0')
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
