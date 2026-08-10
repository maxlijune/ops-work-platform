<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <div class="flex space-x-2">
        <el-button type="primary" @click="openCreateDialog"><el-icon><Plus /></el-icon>新增数据库</el-button>
        <el-button @click="fetchDatabases"><el-icon><Refresh /></el-icon>手动采集</el-button>
      </div>
      <div class="flex items-center space-x-2">
        <el-input v-model="searchQuery" placeholder="搜索数据库..." style="width: 200px" />
        <el-select v-model="filterType" placeholder="类型" clearable style="width: 140px">
          <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
        </el-select>
      </div>
    </div>

    <el-card>
      <el-table :data="filteredDatabases" style="width: 100%" v-loading="loading">
        <!-- 名称 + 类型 -->
        <el-table-column label="名称 / 类型" min-width="180">
          <template #default="{ row }">
            <div class="flex flex-col gap-1">
              <span class="font-bold text-text-main">{{ row.name }}</span>
              <span class="inline-flex">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="typeTagClass(row.type)"
                >{{ row.type }}</span>
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- 主机:端口 -->
        <el-table-column label="主机:端口" min-width="160">
          <template #default="{ row }">
            <span class="text-text-secondary">{{ row.host }}:{{ row.port }}</span>
          </template>
        </el-table-column>

        <!-- 健康指标：连接数 + 慢查询 -->
        <el-table-column label="健康指标" min-width="180">
          <template #default="{ row }">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1">
                <span class="text-xs text-text-secondary">连接</span>
                <el-tag :type="connectionColor(row.active_connections)" size="small" effect="light">
                  {{ row.active_connections || 0 }}
                </el-tag>
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="text-xs text-text-secondary">慢查</span>
                <el-tag :type="slowQueryColor(row.slow_queries)" size="small" effect="light">
                  {{ row.slow_queries || 0 }}
                </el-tag>
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- 状态：圆点 + 文字 -->
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full" :class="statusDotClass(row.status)"></span>
              <span>{{ statusText(row.status) }}</span>
            </span>
          </template>
        </el-table-column>

        <!-- 上次采集：相对时间 -->
        <el-table-column label="上次采集" min-width="120">
          <template #default="{ row }">
            <el-tooltip :content="formatTime(row.updated_at)" placement="top" :disabled="!row.updated_at">
              <span class="text-text-secondary">{{ formatRelativeTime(row.updated_at) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="80" fixed="right" align="right">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, row)">
              <el-button size="small" link class="!px-1.5 text-gray-500 hover:text-primary">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail"><el-icon><View /></el-icon>详情</el-dropdown-item>
                  <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                  <el-dropdown-item command="test"><el-icon><Connection /></el-icon>测试连接</el-dropdown-item>
                  <el-dropdown-item divided command="delete" style="color: var(--el-color-danger)"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDialog" :title="editingDB ? '编辑数据库' : '新增数据库'" width="520px">
      <el-form :model="formData" label-width="110px">
        <el-form-item label="名称"><el-input v-model="formData.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="formData.type" @change="onTypeChange">
            <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-form-item>

        <el-form-item
          v-for="field in currentFields"
          :key="field.key"
          :label="field.label"
        >
          <el-input-number
            v-if="field.type === 'number'"
            v-model="formData[field.key]"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="formData[field.key]"
            style="width: 100%"
          >
            <el-option v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
          </el-select>
          <el-input
            v-else
            v-model="formData[field.key]"
            :type="field.type === 'password' ? 'password' : 'text'"
            :show-password="field.type === 'password'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDB">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDetailDialog" :title="detailDB?.name + ' - 详情'" width="700px">
      <div v-if="detailDB" class="space-y-4">
        <div class="grid grid-cols-4 gap-4">
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-xs text-text-secondary">连接数</p>
            <p class="text-xl font-bold">{{ detailDB.active_connections || 0 }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-xs text-text-secondary">慢查询</p>
            <p class="text-xl font-bold text-warning">{{ detailDB.slow_queries || 0 }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-xs text-text-secondary">表大小</p>
            <p class="text-xl font-bold">{{ detailDB.total_size || 0 }} GB</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-xs text-text-secondary">复制延迟</p>
            <p class="text-xl font-bold">{{ detailDB.replication_delay || 0 }}s</p>
          </div>
        </div>

        <div>
          <h4 class="font-semibold mb-2">告警记录</h4>
          <div v-if="detailAlerts.length === 0" class="text-center py-4 text-text-secondary">暂无告警</div>
          <el-table v-else :data="detailAlerts" size="small">
            <el-table-column prop="created_at" label="时间" width="160">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column prop="level" label="级别" width="80">
              <template #default="{ row }">
                <el-tag :type="row.level === 'critical' ? 'danger' : 'warning'" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="描述" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'resolved' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const dbTypes = ['MySQL', 'PostgreSQL', 'Oracle', 'DM8', 'Vastbase', 'TDSQL', 'SQL Server', 'MongoDB']

// 每种数据库类型的默认端口与所需配置字段
const dbTypeConfigs = {
  'MySQL': {
    port: 3306,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'charset', label: '字符集', type: 'input', default: 'utf8mb4' }
    ]
  },
  'PostgreSQL': {
    port: 5432,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'ssl_mode', label: 'SSL模式', type: 'select', default: 'prefer', options: ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'] }
    ]
  },
  'Oracle': {
    port: 1521,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'service_name', label: '服务名(SID)', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' }
    ]
  },
  'DM8': {
    port: 5236,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' }
    ]
  },
  'Vastbase': {
    port: 5432,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' }
    ]
  },
  'TDSQL': {
    port: 3306,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'instance_id', label: '实例ID', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' }
    ]
  },
  'SQL Server': {
    port: 1433,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' }
    ]
  },
  'MongoDB': {
    port: 27017,
    fields: [
      { key: 'host', label: '主机', type: 'input' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'db_name', label: '库名', type: 'input' },
      { key: 'username', label: '用户名', type: 'input' },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'auth_db', label: '认证库', type: 'input', default: 'admin' }
    ]
  }
}

// 类型 -> 彩色标签样式
const typeTagClass = (type) => {
  const map = {
    'MySQL': 'bg-blue-100 text-blue-700',
    'PostgreSQL': 'bg-indigo-100 text-indigo-700',
    'Oracle': 'bg-red-100 text-red-700',
    'DM8': 'bg-amber-100 text-amber-700',
    'Vastbase': 'bg-purple-100 text-purple-700',
    'TDSQL': 'bg-teal-100 text-teal-700',
    'SQL Server': 'bg-cyan-100 text-cyan-700',
    'MongoDB': 'bg-green-100 text-green-700'
  }
  return map[type] || 'bg-gray-100 text-gray-700'
}

const databases = ref([])
const loading = ref(false)
const searchQuery = ref('')
const filterType = ref('')
const showDialog = ref(false)
const showDetailDialog = ref(false)
const editingDB = ref(null)
const detailDB = ref(null)
const detailAlerts = ref([])

const formData = ref({ name: '', type: 'MySQL', host: '', port: 3306, db_name: '', username: '', password: '' })

// 当前类型需要的字段列表
const currentFields = computed(() => {
  return dbTypeConfigs[formData.value.type]?.fields || []
})

const filteredDatabases = computed(() => {
  return databases.value.filter(d => {
    const matchSearch = !searchQuery.value || d.name?.includes(searchQuery.value) || d.host?.includes(searchQuery.value)
    const matchType = !filterType.value || d.type === filterType.value
    return matchSearch && matchType
  })
})

const fetchDatabases = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/databases')
    if (res.data.code === 0) databases.value = res.data.data
  } catch (e) { ElMessage.error('获取数据库列表失败') }
  finally { loading.value = false }
}

// 根据类型构建初始 formData：填充默认端口与字段默认值
const buildFormData = (type, base = {}) => {
  const config = dbTypeConfigs[type]
  const data = { name: base.name || '', type, host: base.host || '', username: base.username || '', password: base.password || '' }
  config.fields.forEach(f => {
    if (f.type === 'number') {
      data[f.key] = base[f.key] != null ? base[f.key] : config.port
    } else if (base[f.key] != null) {
      data[f.key] = base[f.key]
    } else if (f.default != null) {
      data[f.key] = f.default
    } else {
      data[f.key] = ''
    }
  })
  return data
}

const openCreateDialog = () => {
  editingDB.value = null
  formData.value = buildFormData('MySQL')
  showDialog.value = true
}

const onTypeChange = (type) => {
  // 切换类型时保留名称，端口与字段按新类型默认值填充
  formData.value = buildFormData(type, { name: formData.value.name })
}

const editDB = (db) => { editingDB.value = db; formData.value = buildFormData(db.type, db); showDialog.value = true }

const saveDB = async () => {
  try {
    if (editingDB.value) {
      await axios.put(`/api/v1/databases/${editingDB.value.id}`, formData.value)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/v1/databases', formData.value)
      ElMessage.success('创建成功')
    }
    showDialog.value = false; fetchDatabases()
  } catch (e) { ElMessage.error('保存失败') }
}

const handleAction = (cmd, row) => {
  switch (cmd) {
    case 'detail': viewDetail(row); break
    case 'edit': editDB(row); break
    case 'test': testConnection(row); break
    case 'delete': deleteDB(row); break
  }
}

const deleteDB = async (db) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${db.name}" 吗？`, '确认', { type: 'warning' })
    await axios.delete(`/api/v1/databases/${db.id}`)
    ElMessage.success('删除成功'); fetchDatabases()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const testConnection = async (db) => {
  try {
    const res = await axios.post(`/api/v1/databases/${db.id}/test-connection`)
    ElMessage.success(res.data.message || '连接成功')
  } catch (e) { ElMessage.error('连接失败') }
}

const viewDetail = async (db) => {
  detailDB.value = db
  try {
    const res = await axios.get(`/api/v1/databases/${db.id}`)
    if (res.data.code === 0) detailDB.value = { ...db, ...res.data.data }
  } catch (e) { console.error(e) }
  showDetailDialog.value = true
}

// 健康指标颜色：连接数
const connectionColor = (val) => {
  const v = val || 0
  if (v >= 100) return 'danger'
  if (v >= 50) return 'warning'
  return 'success'
}

// 健康指标颜色：慢查询
const slowQueryColor = (val) => {
  const v = val || 0
  if (v >= 10) return 'danger'
  if (v >= 1) return 'warning'
  return 'success'
}

// 状态圆点样式
const statusDotClass = (status) => {
  const map = {
    online: 'bg-success',
    warning: 'bg-warning',
    offline: 'bg-danger',
    error: 'bg-danger'
  }
  return map[status] || 'bg-gray-400'
}

// 状态文字
const statusText = (status) => {
  const map = {
    online: '在线',
    warning: '告警',
    offline: '离线',
    error: '异常'
  }
  return map[status] || '未知'
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

// 相对时间
const formatRelativeTime = (t) => {
  if (!t) return '-'
  const diff = Date.now() - new Date(t).getTime()
  if (diff < 0) return '刚刚'
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

onMounted(fetchDatabases)
</script>
