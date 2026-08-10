<template>
  <div class="space-y-4">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs text-text-secondary">正常</p>
          <p class="text-2xl font-bold text-success">{{ stats.normal }}</p>
        </div>
        <el-icon class="text-3xl text-success/60"><CircleCheck /></el-icon>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs text-text-secondary">异常</p>
          <p class="text-2xl font-bold text-danger">{{ stats.abnormal }}</p>
        </div>
        <el-icon class="text-3xl text-danger/60"><CircleClose /></el-icon>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs text-text-secondary">监控总数</p>
          <p class="text-2xl font-bold text-primary">{{ stats.total }}</p>
        </div>
        <el-icon class="text-3xl text-primary/60"><DataLine /></el-icon>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="flex justify-between items-center">
      <div class="flex space-x-2">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>新增监控
        </el-button>
        <el-button @click="fetchConfigs">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
      <div class="flex items-center space-x-2">
        <el-input
          v-model="searchQuery"
          placeholder="搜索监控名称..."
          style="width: 200px"
          clearable
        />
        <el-select v-model="filterType" placeholder="监控类型" clearable style="width: 140px">
          <el-option label="数据库备份" value="database" />
          <el-option label="服务器文件" value="file" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px">
          <el-option label="正常" value="normal" />
          <el-option label="异常" value="abnormal" />
          <el-option label="未知" value="unknown" />
        </el-select>
      </div>
    </div>

    <!-- 监控项列表 -->
    <el-card>
      <el-table :data="filteredConfigs" style="width: 100%" v-loading="loading">
        <el-table-column min-width="220" label="名称 / 类型">
          <template #default="{ row }">
            <div class="flex flex-col gap-1">
              <span class="font-semibold text-text-main">{{ row.name || '-' }}</span>
              <el-tag
                size="small"
                :type="row.monitor_type === 'database' ? 'primary' : 'warning'"
                effect="light"
              >
                <el-icon class="mr-1 align-middle">
                  <Coin v-if="row.monitor_type === 'database'" />
                  <Document v-else />
                </el-icon>
                <span class="align-middle">{{ row.monitor_type === 'database' ? 'DB备份' : '文件监控' }}</span>
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="150" label="目标" show-overflow-tooltip>
          <template #default="{ row }">{{ targetName(row) }}</template>
        </el-table-column>
        <el-table-column width="120" label="检查方式">
          <template #default="{ row }">{{ checkMethodText(row) }}</template>
        </el-table-column>
        <el-table-column width="110" label="状态">
          <template #default="{ row }">
            <div class="flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full inline-block" :class="statusInfo(row.status).dot" />
              <span :class="statusInfo(row.status).textClass">{{ statusInfo(row.status).text }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="130" label="上次检查">
          <template #default="{ row }">
            <el-tooltip :content="formatTime(row.last_check_time)" placement="top">
              <span>{{ formatRelativeTime(row.last_check_time) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column width="80" label="操作" align="right">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, row)">
              <el-button size="small" link class="!px-1.5 text-gray-500 hover:text-primary">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail"><el-icon><View /></el-icon>详情</el-dropdown-item>
                  <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                  <el-dropdown-item divided command="delete" style="color: var(--el-color-danger)"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="text-center py-8 text-text-secondary">
            <el-icon class="text-4xl text-gray-300 mb-2"><Files /></el-icon>
            <p>暂无备份监控数据，请点击「新增监控」创建配置</p>
          </div>
        </template>
      </el-table>
    </el-card>

    <!-- 新增/编辑监控弹窗 -->
    <el-dialog
      v-model="showDialog"
      :title="editingItem ? '编辑监控' : '新增监控'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="监控名称">
          <el-input v-model="configForm.name" placeholder="例如：核心库每日备份" />
        </el-form-item>
        <el-form-item label="监控类型">
          <el-radio-group v-model="configForm.monitor_type" @change="onTypeChange">
            <el-radio-button value="database">数据库备份</el-radio-button>
            <el-radio-button value="file">服务器文件</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 数据库备份 -->
        <template v-if="configForm.monitor_type === 'database'">
          <el-form-item label="数据库实例">
            <el-select v-model="configForm.database_id" placeholder="选择数据库实例" filterable style="width: 100%">
              <el-option
                v-for="db in databases"
                :key="db.id"
                :label="`${db.name} (${db.type || 'DB'})`"
                :value="db.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="检查方式">
            <el-radio-group v-model="configForm.check_method">
              <el-radio value="file">SSH 文件检查</el-radio>
              <el-radio value="sql">SQL 查询</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="configForm.check_method === 'file'" label="备份路径">
            <el-input
              v-model="configForm.backup_path"
              placeholder="/path/to/backup/{db_name}_{date}"
            />
          </el-form-item>
          <el-form-item v-if="configForm.check_method === 'sql'" label="查询SQL">
            <el-input
              v-model="configForm.check_sql"
              type="textarea"
              :rows="3"
              placeholder="SELECT MAX(backup_time) FROM backup_log;"
            />
          </el-form-item>
        </template>

        <!-- 服务器文件 -->
        <template v-else>
          <el-form-item label="服务器">
            <el-select v-model="configForm.server_id" placeholder="选择服务器" filterable style="width: 100%">
              <el-option
                v-for="s in servers"
                :key="s.id"
                :label="`${s.name} (${s.ip || '-'})`"
                :value="s.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="文件路径">
            <el-input
              v-model="configForm.file_path"
              placeholder="/path/to/file 或 /path/to/dir"
            />
          </el-form-item>
          <el-form-item label="检查项">
            <el-checkbox-group v-model="configForm.check_items">
              <el-checkbox value="exists">存在性</el-checkbox>
              <el-checkbox value="size">大小阈值</el-checkbox>
              <el-checkbox value="mtime">修改时间</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item v-if="configForm.check_items.includes('size')" label="最小大小">
            <el-input v-model="configForm.size_threshold" placeholder="100">
              <template #append>MB</template>
            </el-input>
            <p class="text-xs text-text-secondary mt-1">文件小于该值视为异常</p>
          </el-form-item>
          <el-form-item v-if="configForm.check_items.includes('mtime')" label="最大修改间隔">
            <el-input v-model="configForm.mtime_threshold" placeholder="24">
              <template #append>小时</template>
            </el-input>
            <p class="text-xs text-text-secondary mt-1">文件修改时间超过该值视为异常</p>
          </el-form-item>
        </template>

        <el-form-item label="期望频率">
          <el-select v-model="configForm.expected_frequency" style="width: 100%">
            <el-option label="每小时" value="hourly" />
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetailDialog" :title="`${detailItem?.name || '监控'} - 详情`" width="640px">
      <el-descriptions v-if="detailItem" :column="2" border>
        <el-descriptions-item label="监控名称">{{ detailItem.name }}</el-descriptions-item>
        <el-descriptions-item label="监控类型">
          <el-tag size="small" :type="detailItem.monitor_type === 'database' ? 'primary' : 'warning'">
            {{ detailItem.monitor_type === 'database' ? 'DB备份' : '文件监控' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="目标">{{ targetName(detailItem) }}</el-descriptions-item>
        <el-descriptions-item label="检查方式">{{ checkMethodText(detailItem) }}</el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'database' && detailItem.check_method === 'file'" label="备份路径" :span="2">
          {{ detailItem.backup_path || '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'database' && detailItem.check_method === 'sql'" label="查询SQL" :span="2">
          <pre class="whitespace-pre-wrap break-all font-mono text-xs m-0">{{ detailItem.check_sql || '-' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'file'" label="文件路径" :span="2">
          {{ detailItem.file_path || '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'file'" label="检查项" :span="2">
          <el-tag v-for="item in (detailItem.check_items || [])" :key="item" size="small" class="mr-1">
            {{ checkItemText(item) }}
          </el-tag>
          <span v-if="!detailItem.check_items || detailItem.check_items.length === 0">-</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'file' && detailItem.check_items && detailItem.check_items.includes('size')" label="最小大小">
          {{ detailItem.size_threshold || '-' }} MB
        </el-descriptions-item>
        <el-descriptions-item v-if="detailItem.monitor_type === 'file' && detailItem.check_items && detailItem.check_items.includes('mtime')" label="最大修改间隔">
          {{ detailItem.mtime_threshold || '-' }} 小时
        </el-descriptions-item>
        <el-descriptions-item label="期望频率">{{ frequencyText(detailItem.expected_frequency) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <div class="flex items-center space-x-1.5">
            <span class="w-2 h-2 rounded-full inline-block" :class="statusInfo(detailItem.status).dot" />
            <span>{{ statusInfo(detailItem.status).text }}</span>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="上次检查时间" :span="2">{{ formatTime(detailItem.last_check_time) }}</el-descriptions-item>
        <el-descriptions-item v-if="detailItem.last_check_detail" label="检查详情" :span="2">
          <pre class="whitespace-pre-wrap break-all font-mono text-xs m-0">{{ formatDetail(detailItem.last_check_detail) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const configs = ref([])
const servers = ref([])
const databases = ref([])
const loading = ref(false)
const showDialog = ref(false)
const showDetailDialog = ref(false)
const editingItem = ref(null)
const detailItem = ref(null)
const searchQuery = ref('')
const filterType = ref('')
const filterStatus = ref('')

const defaultForm = () => ({
  name: '',
  monitor_type: 'database',
  database_id: null,
  check_method: 'file',
  backup_path: '',
  check_sql: '',
  server_id: null,
  file_path: '',
  check_items: ['exists'],
  size_threshold: '',
  mtime_threshold: ''
})
const configForm = ref(defaultForm())

const filteredConfigs = computed(() => {
  return configs.value.filter(c => {
    const matchSearch = !searchQuery.value || c.name?.includes(searchQuery.value)
    const matchType = !filterType.value || c.monitor_type === filterType.value
    const matchStatus = !filterStatus.value || (c.status || 'unknown') === filterStatus.value
    return matchSearch && matchType && matchStatus
  })
})

const stats = computed(() => {
  const total = configs.value.length
  const normal = configs.value.filter(c => c.status === 'normal').length
  const abnormal = configs.value.filter(c => c.status === 'abnormal').length
  return { total, normal, abnormal }
})

const fetchConfigs = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/settings/backup-config')
    if (res.data.code === 0) {
      configs.value = Array.isArray(res.data.data) ? res.data.data : []
    } else {
      configs.value = []
    }
  } catch (e) {
    configs.value = []
  } finally {
    loading.value = false
  }
}

const fetchServers = async () => {
  try {
    const res = await axios.get('/api/v1/servers')
    if (res.data.code === 0) servers.value = Array.isArray(res.data.data) ? res.data.data : []
  } catch (e) {
    servers.value = []
  }
}

const fetchDatabases = async () => {
  try {
    const res = await axios.get('/api/v1/databases')
    if (res.data.code === 0) databases.value = Array.isArray(res.data.data) ? res.data.data : []
  } catch (e) {
    databases.value = []
  }
}

const openCreateDialog = () => {
  editingItem.value = null
  configForm.value = defaultForm()
  showDialog.value = true
}

const editConfig = (row) => {
  editingItem.value = row
  configForm.value = {
    name: row.name || '',
    monitor_type: row.monitor_type || 'database',
    database_id: row.database_id ?? null,
    check_method: row.check_method || 'file',
    backup_path: row.backup_path || '',
    check_sql: row.check_sql || '',
    server_id: row.server_id ?? null,
    file_path: row.file_path || '',
    check_items: Array.isArray(row.check_items) ? [...row.check_items] : ['exists'],
    size_threshold: row.size_threshold ?? '',
    mtime_threshold: row.mtime_threshold ?? '',
    expected_frequency: row.expected_frequency || 'daily'
  }
  showDialog.value = true
}

const onTypeChange = () => {
  // 切换类型时重置对方字段，避免脏数据
  if (configForm.value.monitor_type === 'database') {
    configForm.value.server_id = null
    configForm.value.file_path = ''
    configForm.value.check_items = ['exists']
    configForm.value.size_threshold = ''
    configForm.value.mtime_threshold = ''
    if (!configForm.value.check_method) configForm.value.check_method = 'file'
  } else {
    configForm.value.database_id = null
    configForm.value.backup_path = ''
    configForm.value.check_sql = ''
  }
}

const saveConfig = async () => {
  const f = configForm.value
  if (!f.name?.trim()) {
    ElMessage.warning('请输入监控名称')
    return
  }
  const payload = {
    name: f.name.trim(),
    monitor_type: f.monitor_type,
    expected_frequency: f.expected_frequency || 'daily'
  }
  if (f.monitor_type === 'database') {
    if (!f.database_id) {
      ElMessage.warning('请选择数据库实例')
      return
    }
    payload.database_id = f.database_id
    payload.check_method = f.check_method
    if (f.check_method === 'file') {
      payload.backup_path = f.backup_path
    } else {
      payload.check_sql = f.check_sql
    }
  } else {
    if (!f.server_id) {
      ElMessage.warning('请选择服务器')
      return
    }
    if (!f.file_path?.trim()) {
      ElMessage.warning('请输入文件路径')
      return
    }
    payload.server_id = f.server_id
    payload.file_path = f.file_path.trim()
    payload.check_items = f.check_items.length ? f.check_items : ['exists']
    if (f.check_items.includes('size')) payload.size_threshold = f.size_threshold
    if (f.check_items.includes('mtime')) payload.mtime_threshold = f.mtime_threshold
  }
  try {
    if (editingItem.value) {
      await axios.put(`/api/v1/settings/backup-config/${editingItem.value.id}`, payload)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/v1/settings/backup-config', payload)
      ElMessage.success('创建成功')
    }
    showDialog.value = false
    fetchConfigs()
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const handleAction = (cmd, row) => {
  switch (cmd) {
    case 'detail': viewDetail(row); break
    case 'edit': editConfig(row); break
    case 'delete': deleteConfig(row); break
  }
}

const deleteConfig = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除监控 "${row.name}" 吗？`, '确认删除', { type: 'warning' })
    await axios.delete(`/api/v1/settings/backup-config/${row.id}`)
    ElMessage.success('删除成功')
    fetchConfigs()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const viewDetail = (row) => {
  detailItem.value = row
  showDetailDialog.value = true
}

// 目标名称映射
const targetName = (row) => {
  if (!row) return '-'
  if (row.target_name) return row.target_name
  if (row.monitor_type === 'database') {
    const db = databases.value.find(d => d.id === row.database_id)
    return db?.name || (row.database_id ? `DB#${row.database_id}` : '-')
  }
  const s = servers.value.find(srv => srv.id === row.server_id)
  return s?.name || (row.server_id ? `Server#${row.server_id}` : '-')
}

const checkMethodText = (row) => {
  if (!row) return '-'
  if (row.monitor_type === 'file') return 'SSH文件检查'
  return row.check_method === 'sql' ? 'SQL查询' : '文件检查'
}

const checkItemText = (item) => {
  const map = { exists: '存在性', size: '大小阈值', mtime: '修改时间' }
  return map[item] || item
}

const frequencyText = (f) => {
  const map = { hourly: '每小时', daily: '每天', weekly: '每周' }
  return map[f] || f || '-'
}

const statusInfo = (status) => {
  switch (status) {
    case 'normal':
      return { text: '正常', dot: 'bg-success', textClass: 'text-success' }
    case 'abnormal':
      return { text: '异常', dot: 'bg-danger', textClass: 'text-danger' }
    default:
      return { text: '未知', dot: 'bg-gray-400', textClass: 'text-text-secondary' }
  }
}

const formatDetail = (detail) => {
  if (detail == null) return '-'
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail, null, 2)
  } catch (e) {
    return String(detail)
  }
}

const formatTime = (t) => (t ? new Date(t).toLocaleString('zh-CN') : '-')

const formatRelativeTime = (t) => {
  if (!t) return '-'
  const ts = new Date(t).getTime()
  if (isNaN(ts)) return '-'
  const diff = Date.now() - ts
  if (diff < 0) return '刚刚'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

onMounted(() => {
  fetchConfigs()
  fetchServers()
  fetchDatabases()
})
</script>
