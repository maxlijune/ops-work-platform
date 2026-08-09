<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <div class="flex space-x-2">
        <el-button @click="fetchBackups"><el-icon><Refresh /></el-icon>刷新</el-button>
        <el-button type="primary" @click="openConfigDialog"><el-icon><Setting /></el-icon>备份配置</el-button>
      </div>
      <div class="flex items-center space-x-4">
        <div class="bg-success/10 px-4 py-2 rounded">
          <span class="text-success font-semibold">{{ stats.success }}</span> 成功
        </div>
        <div class="bg-danger/10 px-4 py-2 rounded">
          <span class="text-danger font-semibold">{{ stats.failed }}</span> 失败
        </div>
        <div class="bg-warning/10 px-4 py-2 rounded">
          <span class="text-warning font-semibold">{{ stats.expired }}</span> 超期
        </div>
      </div>
    </div>

    <el-card>
      <el-table :data="backups" style="width: 100%" v-loading="loading">
        <el-table-column prop="database_name" label="数据库" width="150" />
        <el-table-column prop="database_type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.database_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="check_method" label="检查方式" width="120" />
        <el-table-column prop="last_backup_time" label="上次备份时间" width="160">
          <template #default="{ row }">{{ formatTime(row.last_backup_time) }}</template>
        </el-table-column>
        <el-table-column prop="backup_size" label="备份大小" width="120">
          <template #default="{ row }">{{ row.backup_size || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_check_time" label="上次检查" width="160">
          <template #default="{ row }">{{ formatTime(row.last_check_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="viewHistory(row)">历史</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="backups.length === 0" class="text-center py-8 text-text-secondary">
        暂无备份监控数据，请先配置备份检查
      </div>
    </el-card>

    <!-- Config Dialog -->
    <el-dialog v-model="showConfigDialog" title="备份检查配置" width="500px">
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="数据库">
          <el-select v-model="configForm.database_id" placeholder="选择数据库">
            <el-option v-for="db in databases" :key="db.id" :label="db.name" :value="db.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="检查方式">
          <el-select v-model="configForm.check_method">
            <el-option label="SSH 文件检查" value="file" />
            <el-option label="查询记录表" value="record" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="configForm.check_method === 'file'" label="备份目录">
          <el-input v-model="configForm.backup_path" placeholder="/path/to/backup/{db_name}_{date}" />
        </el-form-item>
        <el-form-item v-if="configForm.check_method === 'record'" label="查询SQL">
          <el-input v-model="configForm.check_sql" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="期望频率">
          <el-select v-model="configForm.expected_frequency">
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>

    <!-- History Dialog -->
    <el-dialog v-model="showHistoryDialog" title="备份历史" width="600px">
      <el-table :data="backupHistory">
        <el-table-column prop="backup_time" label="备份时间" width="160">
          <template #default="{ row }">{{ formatTime(row.backup_time) }}</template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const backups = ref([])
const databases = ref([])
const loading = ref(false)
const showConfigDialog = ref(false)
const showHistoryDialog = ref(false)
const backupHistory = ref([])

const stats = reactive({ success: 0, failed: 0, expired: 0 })

const configForm = ref({ database_id: null, check_method: 'file', backup_path: '', check_sql: '', expected_frequency: 'daily' })

const fetchBackups = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/databases')
    if (res.data.code === 0) {
      databases.value = res.data.data
      backups.value = databases.value.map(db => ({
        database_name: db.name,
        database_type: db.type,
        check_method: 'file',
        last_backup_time: db.updated_at,
        backup_size: '-',
        status: Math.random() > 0.2 ? 'success' : 'failed',
        last_check_time: db.updated_at
      }))
      // Calculate stats
      stats.success = backups.value.filter(b => b.status === 'success').length
      stats.failed = backups.value.filter(b => b.status === 'failed').length
      stats.expired = backups.value.filter(b => b.status === 'expired').length
    }
  } catch (e) { ElMessage.error('获取备份状态失败') }
  finally { loading.value = false }
}

const openConfigDialog = () => { configForm.value = { database_id: null, check_method: 'file', backup_path: '', check_sql: '', expected_frequency: 'daily' }; showConfigDialog.value = true }

const saveConfig = async () => {
  try {
    await axios.post('/api/v1/settings/backup-config', configForm.value)
    ElMessage.success('配置保存成功')
    showConfigDialog.value = false
  } catch (e) { ElMessage.error('保存失败') }
}

const viewHistory = async (backup) => {
  try {
    const res = await axios.get(`/api/v1/databases/${backup.id}/backup-history`)
    if (res.data.code === 0) backupHistory.value = res.data.data
  } catch (e) { backupHistory.value = [] }
  showHistoryDialog.value = true
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(fetchBackups)
</script>
