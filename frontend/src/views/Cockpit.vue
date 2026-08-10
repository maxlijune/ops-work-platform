<template>
  <div class="space-y-4">
    <!-- Page Title -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-text-main">运维驾驶舱</h1>
        <p class="text-xs text-text-secondary mt-0.5">平台运行状态总览</p>
      </div>
      <el-button size="small" @click="fetchData">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <!-- Statistics Cards - GitHub style -->
    <div class="grid grid-cols-4 gap-3">
      <!-- Server Stats -->
      <div class="bg-white border border-border-light rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-text-secondary">服务器资源</span>
          <el-icon class="text-lg text-primary"><Monitor /></el-icon>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold" :class="(summary.server_online || 0) === (summary.server_total || 0) ? 'text-success' : 'text-danger'">
            {{ summary.server_online || 0 }}
          </span>
          <span class="text-sm text-text-secondary">/ {{ summary.server_total || 0 }} 在线</span>
        </div>
        <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="serverHealthColor" :style="{ width: serverHealthPercent + '%' }"></div>
        </div>
      </div>

      <!-- Database Stats -->
      <div class="bg-white border border-border-light rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-text-secondary">数据库状态</span>
          <el-icon class="text-lg text-primary"><Coin /></el-icon>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold" :class="(summary.database_online || 0) === (summary.database_total || 0) ? 'text-success' : 'text-danger'">
            {{ summary.database_online || 0 }}
          </span>
          <span class="text-sm text-text-secondary">/ {{ summary.database_total || 0 }} 在线</span>
        </div>
        <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="dbHealthColor" :style="{ width: dbHealthPercent + '%' }"></div>
        </div>
      </div>

      <!-- Job Success Rate -->
      <div class="bg-white border border-border-light rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-text-secondary">今日作业成功率</span>
          <el-icon class="text-lg text-primary"><Timer /></el-icon>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold" :class="jobRateColor">{{ summary.job_success_rate || 0 }}%</span>
        </div>
        <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="jobRateBarColor" :style="{ width: (summary.job_success_rate || 0) + '%' }"></div>
        </div>
      </div>

      <!-- Active Alerts -->
      <div class="bg-white border border-border-light rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-text-secondary">活跃告警</span>
          <el-icon class="text-lg" :class="alertCount > 0 ? 'text-danger' : 'text-success'"><Warning /></el-icon>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold" :class="alertCount > 0 ? 'text-danger' : 'text-success'">{{ alertCount }}</span>
          <span class="text-sm text-text-secondary">{{ alertCount > 0 ? '需要处理' : '一切正常' }}</span>
        </div>
        <div v-if="alertCount > 0" class="mt-2 text-xs text-danger font-medium">
          <span class="status-dot" style="background-color: #CF222E"></span>有未处理告警
        </div>
        <div v-else class="mt-2 text-xs text-success font-medium">
          <span class="status-dot" style="background-color: #1A7F37"></span>系统运行正常
        </div>
      </div>
    </div>

    <!-- Alerts Section -->
    <div class="bg-white border border-border-light rounded-lg">
      <div class="px-4 py-3 border-b border-border-light flex items-center justify-between bg-gray-50 rounded-t-lg">
        <h3 class="text-sm font-semibold text-text-main">异常告警</h3>
        <el-button size="small" link @click="$router.push('/alerts')">查看全部</el-button>
      </div>
      <div class="p-3">
        <div v-if="recentAlerts.length === 0" class="text-center py-6 text-text-secondary">
          <el-icon class="text-3xl text-success mb-2"><CircleCheck /></el-icon>
          <p class="text-sm">系统运行正常，暂无告警</p>
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="alert in recentAlerts"
            :key="alert.id"
            class="flex items-center px-3 py-2 rounded border-l-2 cursor-pointer hover:bg-gray-50 transition-colors"
            :class="{
              'border-danger bg-red-50': alert.level === 'critical',
              'border-warning bg-yellow-50': alert.level === 'warning',
              'border-primary bg-blue-50': alert.level === 'info'
            }"
            @click="goToAlert(alert)"
          >
            <span class="status-dot" :class="alert.level === 'critical' ? 'offline' : alert.level === 'warning' ? 'warning' : 'unknown'"></span>
            <span class="text-sm flex-1 font-medium">{{ alert.message }}</span>
            <span class="text-xs text-text-secondary ml-3">{{ formatRelativeTime(alert.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Module Summaries -->
    <div class="grid grid-cols-3 gap-3">
      <!-- Servers Summary -->
      <div class="bg-white border border-border-light rounded-lg">
        <div class="px-4 py-3 border-b border-border-light flex items-center justify-between bg-gray-50 rounded-t-lg">
          <h3 class="text-sm font-semibold text-text-main">服务器资源</h3>
          <el-button size="small" link @click="$router.push('/servers')">更多 →</el-button>
        </div>
        <div class="p-3">
          <div v-for="server in serverSummary" :key="server.id" class="flex items-center justify-between py-2 border-b border-border-light last:border-0">
            <div class="flex items-center gap-2">
              <span class="status-dot" :class="server.status === 'online' ? 'online' : server.status === 'warning' ? 'warning' : 'offline'"></span>
              <span class="text-sm font-medium">{{ server.name }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <span v-if="server.cpu_usage" :class="getMetricColorClass(server.cpu_usage)">CPU {{ server.cpu_usage }}%</span>
              <span v-if="server.memory_usage" :class="getMetricColorClass(server.memory_usage)">MEM {{ server.memory_usage }}%</span>
            </div>
          </div>
          <p v-if="serverSummary.length === 0" class="text-center text-text-secondary py-4 text-sm">暂无服务器数据</p>
        </div>
      </div>

      <!-- Databases Summary -->
      <div class="bg-white border border-border-light rounded-lg">
        <div class="px-4 py-3 border-b border-border-light flex items-center justify-between bg-gray-50 rounded-t-lg">
          <h3 class="text-sm font-semibold text-text-main">数据库状态</h3>
          <el-button size="small" link @click="$router.push('/databases')">更多 →</el-button>
        </div>
        <div class="p-3">
          <div v-for="db in databaseSummary" :key="db.id" class="flex items-center justify-between py-2 border-b border-border-light last:border-0">
            <div class="flex items-center gap-2">
              <span class="status-dot" :class="db.status === 'online' ? 'online' : db.status === 'warning' ? 'warning' : 'offline'"></span>
              <span class="text-sm font-medium">{{ db.name }}</span>
            </div>
            <el-tag size="small" type="info">{{ db.type }}</el-tag>
          </div>
          <p v-if="databaseSummary.length === 0" class="text-center text-text-secondary py-4 text-sm">暂无数据库数据</p>
        </div>
      </div>

      <!-- Jobs Summary -->
      <div class="bg-white border border-border-light rounded-lg">
        <div class="px-4 py-3 border-b border-border-light flex items-center justify-between bg-gray-50 rounded-t-lg">
          <h3 class="text-sm font-semibold text-text-main">定时作业</h3>
          <el-button size="small" link @click="$router.push('/jobs')">更多 →</el-button>
        </div>
        <div class="p-4 text-center">
          <el-progress
            type="circle"
            :percentage="summary.job_success_rate || 0"
            :width="100"
            :color="progressColor"
          />
          <p class="text-xs text-text-secondary mt-2">今日执行成功率</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()

const summary = ref({})
const recentAlerts = ref([])
const serverSummary = ref([])
const databaseSummary = ref([])

const alertCount = computed(() => {
  return recentAlerts.value.filter(a => a.status === 'unresolved').length
})

const serverHealthPercent = computed(() => {
  const total = summary.value.server_total || 0
  const online = summary.value.server_online || 0
  return total > 0 ? Math.round((online / total) * 100) : 0
})

const serverHealthColor = computed(() => {
  const pct = serverHealthPercent.value
  if (pct === 100) return 'bg-success'
  if (pct >= 50) return 'bg-warning'
  return 'bg-danger'
})

const dbHealthPercent = computed(() => {
  const total = summary.value.database_total || 0
  const online = summary.value.database_online || 0
  return total > 0 ? Math.round((online / total) * 100) : 0
})

const dbHealthColor = computed(() => {
  const pct = dbHealthPercent.value
  if (pct === 100) return 'bg-success'
  if (pct >= 50) return 'bg-warning'
  return 'bg-danger'
})

const jobRateColor = computed(() => {
  const rate = summary.value.job_success_rate || 0
  if (rate >= 90) return 'text-success'
  if (rate >= 70) return 'text-warning'
  return 'text-danger'
})

const jobRateBarColor = computed(() => {
  const rate = summary.value.job_success_rate || 0
  if (rate >= 90) return 'bg-success'
  if (rate >= 70) return 'bg-warning'
  return 'bg-danger'
})

const progressColor = computed(() => {
  const rate = summary.value.job_success_rate || 0
  if (rate >= 90) return '#1A7F37'
  if (rate >= 70) return '#BF8700'
  return '#CF222E'
})

const getMetricColorClass = (val) => {
  if (val >= 90) return 'text-danger font-medium'
  if (val >= 70) return 'text-warning font-medium'
  return 'text-success'
}

const fetchData = async () => {
  try {
    const [summaryRes, alertsRes, serverRes, dbRes] = await Promise.all([
      axios.get('/api/v1/cockpit/summary'),
      axios.get('/api/v1/cockpit/alerts'),
      axios.get('/api/v1/cockpit/server-summary'),
      axios.get('/api/v1/cockpit/database-summary')
    ])

    if (summaryRes.data.code === 0) summary.value = summaryRes.data.data
    if (alertsRes.data.code === 0) recentAlerts.value = alertsRes.data.data.slice(0, 5)
    if (serverRes.data.code === 0) serverSummary.value = serverRes.data.data.slice(0, 5)
    if (dbRes.data.code === 0) databaseSummary.value = dbRes.data.data.slice(0, 5)
  } catch (e) {
    console.error('Failed to fetch cockpit data:', e)
  }
}

const goToAlert = (alert) => {
  const routeMap = {
    'server': '/servers',
    'database': '/databases',
    'job': '/jobs'
  }
  router.push(routeMap[alert.source_type] || '/')
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN')
}

const formatRelativeTime = (timeStr) => {
  if (!timeStr) return ''
  const diff = Date.now() - new Date(timeStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return formatTime(timeStr)
}

onMounted(fetchData)
</script>
