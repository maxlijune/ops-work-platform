<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex justify-between items-center">
      <div class="flex space-x-2">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon> 新增服务器
        </el-button>
        <el-button @click="fetchServers">
          <el-icon><Refresh /></el-icon> 手动采集
        </el-button>
      </div>
      <div class="flex items-center space-x-2">
        <el-input v-model="searchQuery" placeholder="搜索服务器..." style="width: 200px" :prefix-icon="Search" />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
          <el-option label="异常" value="error" />
        </el-select>
      </div>
    </div>

    <!-- Server Table -->
    <el-card>
      <el-table :data="filteredServers" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="ip" label="IP地址" width="140" />
        <el-table-column prop="os_type" label="操作系统" width="100" />
        <el-table-column prop="cpu_usage" label="CPU" width="100">
          <template #default="{ row }">
            <div class="flex items-center">
              <el-progress
                :percentage="row.cpu_usage || 0"
                :color="getMeterColor(row.cpu_usage)"
                :stroke-width="10"
                style="width: 80px"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="memory_usage" label="内存" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="row.memory_usage || 0"
              :color="getMeterColor(row.memory_usage)"
              :stroke-width="10"
              style="width: 80px"
            />
          </template>
        </el-table-column>
        <el-table-column prop="disk_usage" label="磁盘" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="row.disk_usage || 0"
              :color="getMeterColor(row.disk_usage)"
              :stroke-width="10"
              style="width: 80px"
            />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'online' ? 'success' : row.status === 'warning' ? 'warning' : 'danger'" size="small">
              {{ row.status || 'unknown' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="上次采集" width="160">
          <template #default="{ row }">
            {{ formatTime(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link @click="editServer(row)">编辑</el-button>
            <el-button size="small" link @click="testConnection(row)">测试</el-button>
            <el-button size="small" link type="danger" @click="deleteServer(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingServer ? '编辑服务器' : '新增服务器'" width="500px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="IP地址">
          <el-input v-model="formData.ip" />
        </el-form-item>
        <el-form-item label="操作系统">
          <el-select v-model="formData.os_type">
            <el-option label="Linux" value="Linux" />
            <el-option label="Windows" value="Windows" />
          </el-select>
        </el-form-item>
        <el-form-item label="SSH端口">
          <el-input-number v-model="formData.ssh_port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="formData.ssh_username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="formData.ssh_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="formData.tags" placeholder="逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveServer">保存</el-button>
      </template>
    </el-dialog>

    <!-- Detail Dialog -->
    <el-dialog v-model="showDetailDialog" :title="detailServer?.name + ' - 详情'" width="700px">
      <div v-if="detailServer" class="space-y-4">
        <!-- Real-time Metrics -->
        <div class="grid grid-cols-4 gap-4">
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-text-secondary text-xs">CPU</p>
            <p class="text-xl font-bold text-primary">{{ detailServer.cpu_usage || 0 }}%</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-text-secondary text-xs">内存</p>
            <p class="text-xl font-bold text-primary">{{ detailServer.memory_usage || 0 }}%</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-text-secondary text-xs">磁盘</p>
            <p class="text-xl font-bold text-primary">{{ detailServer.disk_usage || 0 }}%</p>
          </div>
          <div class="bg-gray-50 p-4 rounded text-center">
            <p class="text-text-secondary text-xs">负载</p>
            <p class="text-xl font-bold text-primary">{{ detailServer.load_average || 0 }}</p>
          </div>
        </div>

        <!-- Alert History -->
        <div>
          <h4 class="font-semibold mb-2">告警记录</h4>
          <div v-if="detailAlerts.length === 0" class="text-center py-4 text-text-secondary">
            暂无告警记录
          </div>
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

const servers = ref([])
const loading = ref(false)
const searchQuery = ref('')
const filterStatus = ref('')
const showDialog = ref(false)
const showDetailDialog = ref(false)
const editingServer = ref(null)
const detailServer = ref(null)
const detailAlerts = ref([])

const formData = ref({
  name: '',
  ip: '',
  os_type: 'Linux',
  ssh_port: 22,
  ssh_username: '',
  ssh_password: '',
  tags: ''
})

const filteredServers = computed(() => {
  return servers.value.filter(s => {
    const matchSearch = !searchQuery.value || s.name?.includes(searchQuery.value) || s.ip?.includes(searchQuery.value)
    const matchStatus = !filterStatus.value || s.status === filterStatus.value
    return matchSearch && matchStatus
  })
})

const fetchServers = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/servers')
    if (res.data.code === 0) {
      servers.value = res.data.data
    }
  } catch (e) {
    ElMessage.error('获取服务器列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingServer.value = null
  formData.value = { name: '', ip: '', os_type: 'Linux', ssh_port: 22, ssh_username: '', ssh_password: '', tags: '' }
  showDialog.value = true
}

const editServer = (server) => {
  editingServer.value = server
  formData.value = { ...server }
  showDialog.value = true
}

const saveServer = async () => {
  try {
    if (editingServer.value) {
      await axios.put(`/api/v1/servers/${editingServer.value.id}`, formData.value)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/v1/servers', formData.value)
      ElMessage.success('创建成功')
    }
    showDialog.value = false
    fetchServers()
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const deleteServer = async (server) => {
  try {
    await ElMessageBox.confirm(`确定删除服务器 "${server.name}" 吗？`, '确认删除', { type: 'warning' })
    await axios.delete(`/api/v1/servers/${server.id}`)
    ElMessage.success('删除成功')
    fetchServers()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const testConnection = async (server) => {
  try {
    const res = await axios.post(`/api/v1/servers/${server.id}/test-connection`)
    if (res.data.code === 0) {
      ElMessage.success('连接成功')
    } else {
      ElMessage.error(res.data.message || '连接失败')
    }
  } catch (e) {
    ElMessage.error('测试连接失败')
  }
}

const viewDetail = async (server) => {
  detailServer.value = server
  try {
    const res = await axios.get(`/api/v1/servers/${server.id}`)
    if (res.data.code === 0) {
      detailServer.value = { ...server, ...res.data.data }
    }
  } catch (e) {
    console.error(e)
  }
  showDetailDialog.value = true
}

const getMeterColor = (value) => {
  if (value >= 90) return '#C44536'
  if (value >= 70) return '#E8B923'
  return '#7A8B6F'
}

const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

onMounted(fetchServers)
</script>
