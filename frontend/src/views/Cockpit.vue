<template>
  <div class="space-y-6">
    <!-- Statistics Bar -->
    <div class="grid grid-cols-4 gap-4">
      <el-card class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-text-secondary text-sm">服务器</p>
            <p class="text-2xl font-bold text-text-main">{{ summary.server_online || 0 }} / {{ summary.server_total || 0 }}</p>
            <p class="text-xs text-success">在线 / 总数</p>
          </div>
          <el-icon class="text-3xl text-primary"><Monitor /></el-icon>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-text-secondary text-sm">数据库</p>
            <p class="text-2xl font-bold text-text-main">{{ summary.database_online || 0 }} / {{ summary.database_total || 0 }}</p>
            <p class="text-xs text-success">在线 / 总数</p>
          </div>
          <el-icon class="text-3xl text-primary"><Coin /></el-icon>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-text-secondary text-sm">今日作业成功率</p>
            <p class="text-2xl font-bold text-text-main">{{ summary.job_success_rate || 0 }}%</p>
            <p class="text-xs text-success">成功 / 总执行</p>
          </div>
          <el-icon class="text-3xl text-primary"><Timer /></el-icon>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-text-secondary text-sm">活跃告警</p>
            <p class="text-2xl font-bold text-danger">{{ alertCount }}</p>
            <p class="text-xs text-warning">需要处理</p>
          </div>
          <el-icon class="text-3xl text-warning"><Warning /></el-icon>
        </div>
      </el-card>
    </div>

    <!-- Alerts Section -->
    <el-card>
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="font-semibold">异常告警</h3>
          <el-button size="small" link @click="$router.push('/servers')">查看全部</el-button>
        </div>
      </template>
      <div v-if="recentAlerts.length === 0" class="text-center py-6 text-text-secondary">
        <el-icon class="text-3xl text-success mb-2"><CircleCheck /></el-icon>
        <p>系统运行正常，暂无告警</p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="alert in recentAlerts"
          :key="alert.id"
          class="flex items-center p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
          @click="goToAlert(alert)"
        >
          <el-tag
            :type="alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'info'"
            size="small"
            class="mr-3"
          >
            {{ alert.level }}
          </el-tag>
          <span class="flex-1 text-sm">{{ alert.message }}</span>
          <span class="text-xs text-text-secondary">{{ formatTime(alert.created_at) }}</span>
        </div>
      </div>
    </el-card>

    <!-- Module Summaries -->
    <div class="grid grid-cols-3 gap-4">
      <!-- Servers Summary -->
      <el-card>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="font-semibold">服务器资源</h3>
            <el-button size="small" link @click="$router.push('/servers')">更多</el-button>
          </div>
        </template>
        <div class="space-y-2">
          <p v-for="server in serverSummary" :key="server.id" class="flex justify-between text-sm py-1 border-b border-border-light">
            <span>{{ server.name }}</span>
            <span :class="getStatusClass(server.status)">{{ server.status }}</span>
          </p>
          <p v-if="serverSummary.length === 0" class="text-center text-text-secondary py-2">暂无服务器数据</p>
        </div>
      </el-card>

      <!-- Databases Summary -->
      <el-card>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="font-semibold">数据库状态</h3>
            <el-button size="small" link @click="$router.push('/databases')">更多</el-button>
          </div>
        </template>
        <div class="space-y-2">
          <p v-for="db in databaseSummary" :key="db.id" class="flex justify-between text-sm py-1 border-b border-border-light">
            <span>{{ db.name }}</span>
            <span :class="getStatusClass(db.status)">{{ db.status }}</span>
          </p>
          <p v-if="databaseSummary.length === 0" class="text-center text-text-secondary py-2">暂无数据库数据</p>
        </div>
      </el-card>

      <!-- Jobs Summary -->
      <el-card>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="font-semibold">定时作业</h3>
            <el-button size="small" link @click="$router.push('/jobs')">更多</el-button>
          </div>
        </template>
        <div class="text-center py-4">
          <div class="relative w-32 h-32 mx-auto">
            <el-progress
              type="circle"
              :percentage="summary.job_success_rate || 0"
              :color="progressColor"
            />
          </div>
          <p class="text-sm text-text-secondary mt-2">今日执行成功率</p>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const summary = ref({})
const recentAlerts = ref([])
const serverSummary = ref([])
const databaseSummary = ref([])

const alertCount = computed(() => {
  return recentAlerts.value.filter(a => a.status === 'unresolved').length
})

const progressColor = computed(() => {
  const rate = summary.value.job_success_rate || 0
  if (rate >= 90) return '#7A8B6F'
  if (rate >= 70) return '#E8B923'
  return '#C44536'
})

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

const getStatusClass = (status) => {
  if (status === 'online' || status === 'active') return 'text-success'
  if (status === 'warning') return 'text-warning'
  return 'text-danger'
}

onMounted(fetchData)
</script>
