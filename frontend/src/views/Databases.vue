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
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="host" label="主机:端口" width="160">
          <template #default="{ row }">{{ row.host }}:{{ row.port }}</template>
        </el-table-column>
        <el-table-column prop="active_connections" label="连接数" width="100" />
        <el-table-column prop="slow_queries" label="慢查询" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'online' ? 'success' : row.status === 'warning' ? 'warning' : 'danger'" size="small">
              {{ row.status || 'unknown' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="上次采集" width="160">
          <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link @click="editDB(row)">编辑</el-button>
            <el-button size="small" link @click="testConnection(row)">测试</el-button>
            <el-button size="small" link type="danger" @click="deleteDB(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDialog" :title="editingDB ? '编辑数据库' : '新增数据库'" width="500px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="名称"><el-input v-model="formData.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="formData.type">
            <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-form-item>
        <el-form-item label="主机"><el-input v-model="formData.host" /></el-form-item>
        <el-form-item label="端口"><el-input-number v-model="formData.port" :min="1" :max="65535" /></el-form-item>
        <el-form-item label="库名"><el-input v-model="formData.db_name" /></el-form-item>
        <el-form-item label="用户名"><el-input v-model="formData.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="formData.password" type="password" show-password /></el-form-item>
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

const openCreateDialog = () => {
  editingDB.value = null
  formData.value = { name: '', type: 'MySQL', host: '', port: 3306, db_name: '', username: '', password: '' }
  showDialog.value = true
}

const editDB = (db) => { editingDB.value = db; formData.value = { ...db }; showDialog.value = true }

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

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(fetchDatabases)
</script>
