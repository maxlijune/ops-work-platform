<template>
  <div class="space-y-4">
    <el-tabs v-model="activeTab">
      <!-- Platform Jobs Tab -->
      <el-tab-pane label="平台作业" name="platform">
        <div class="flex justify-between items-center mb-4">
          <el-button type="primary" @click="openCreateDialog"><el-icon><Plus /></el-icon>新增作业</el-button>
        </div>
        <el-card>
          <el-table :data="platformJobs" style="width: 100%" v-loading="loading">
            <el-table-column prop="name" label="作业名" width="180" />
            <el-table-column prop="target" label="目标" width="120" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="schedule" label="调度表达式" width="140" />
            <el-table-column prop="last_run" label="上次运行" width="160">
              <template #default="{ row }">{{ formatTime(row.last_run) }}</template>
            </el-table-column>
            <el-table-column prop="next_run" label="下次运行" width="160">
              <template #default="{ row }">{{ formatTime(row.next_run) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="toggleJob(row)" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="right">
              <template #default="{ row }">
                <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, row)">
                  <el-button size="small" link class="!px-1.5 text-gray-500 hover:text-primary">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="run"><el-icon><VideoPlay /></el-icon>立即运行</el-dropdown-item>
                      <el-dropdown-item command="history"><el-icon><Clock /></el-icon>历史记录</el-dropdown-item>
                      <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                      <el-dropdown-item divided command="delete" style="color: var(--el-color-danger)"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Server Crontab Tab -->
      <el-tab-pane label="服务器 Cron" name="crontab">
        <div class="mb-4">
          <el-select v-model="selectedServer" placeholder="选择服务器" style="width: 200px">
            <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-button @click="fetchCrontab" :disabled="!selectedServer">获取 Cron</el-button>
        </div>
        <el-card>
          <el-table :data="crontabList" style="width: 100%">
            <el-table-column prop="user" label="用户" width="100" />
            <el-table-column prop="schedule" label="调度表达式" width="140" />
            <el-table-column prop="command" label="命令" />
            <el-table-column prop="next_run" label="下次运行" width="160" />
          </el-table>
          <div v-if="crontabList.length === 0" class="text-center py-6 text-text-secondary">
            暂无 Cron 数据
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingJob ? '编辑作业' : '新增作业'" width="600px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="作业名"><el-input v-model="formData.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="formData.type">
            <el-option label="脚本" value="script" />
            <el-option label="SQL" value="sql" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标">
          <el-select v-model="formData.target_id" placeholder="选择目标">
            <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="调度表达式">
          <el-input v-model="formData.schedule" placeholder="*/5 * * * *" />
          <div class="mt-1">
            <el-radio-group v-model="presetSchedule" @change="applyPreset">
              <el-radio-button label="*/5 * * * *">每5分钟</el-radio-button>
              <el-radio-button label="0 * * * *">每小时</el-radio-button>
              <el-radio-button label="0 0 * * *">每天零点</el-radio-button>
            </el-radio-group>
          </div>
        </el-form-item>
        <el-form-item label="执行内容">
          <el-input v-model="formData.content" type="textarea" :rows="4" placeholder="脚本或SQL内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveJob">保存</el-button>
      </template>
    </el-dialog>

    <!-- History Dialog -->
    <el-dialog v-model="showHistoryDialog" title="执行历史" width="700px">
      <el-table :data="jobHistory" style="width: 100%">
        <el-table-column prop="start_time" label="开始时间" width="160">
          <template #default="{ row }">{{ formatTime(row.start_time) }}</template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时" width="100">
          <template #default="{ row }">{{ row.duration?.toFixed(2) }}s</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="output" label="输出">
          <template #default="{ row }">
            <el-button size="small" link @click="showOutput(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const activeTab = ref('platform')
const platformJobs = ref([])
const loading = ref(false)
const showDialog = ref(false)
const showHistoryDialog = ref(false)
const editingJob = ref(null)
const jobHistory = ref([])
const servers = ref([])
const selectedServer = ref(null)
const crontabList = ref([])
const presetSchedule = ref('')

const formData = ref({ name: '', type: 'script', target_id: null, schedule: '', content: '' })

const fetchJobs = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/jobs')
    if (res.data.code === 0) platformJobs.value = res.data.data
  } catch (e) { ElMessage.error('获取作业列表失败') }
  finally { loading.value = false }
}

const fetchServers = async () => {
  try {
    const res = await axios.get('/api/v1/servers')
    if (res.data.code === 0) servers.value = res.data.data
  } catch (e) { console.error(e) }
}

const fetchCrontab = async () => {
  try {
    const res = await axios.get(`/api/v1/servers/${selectedServer.value}/crontab`)
    if (res.data.code === 0) crontabList.value = res.data.data
  } catch (e) { ElMessage.error('获取 Cron 失败') }
}

const openCreateDialog = () => {
  editingJob.value = null
  formData.value = { name: '', type: 'script', target_id: null, schedule: '', content: '' }
  presetSchedule.value = ''
  showDialog.value = true
}

const editJob = (job) => { editingJob.value = job; formData.value = { ...job }; showDialog.value = true }

const saveJob = async () => {
  try {
    if (editingJob.value) {
      await axios.put(`/api/v1/jobs/${editingJob.value.id}`, formData.value)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/v1/jobs', formData.value)
      ElMessage.success('创建成功')
    }
    showDialog.value = false; fetchJobs()
  } catch (e) { ElMessage.error('保存失败') }
}

const handleAction = (cmd, row) => {
  switch (cmd) {
    case 'run': runJob(row); break
    case 'history': viewHistory(row); break
    case 'edit': editJob(row); break
    case 'delete': deleteJob(row); break
  }
}

const deleteJob = async (job) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${job.name}" 吗？`, '确认', { type: 'warning' })
    await axios.delete(`/api/v1/jobs/${job.id}`)
    ElMessage.success('删除成功'); fetchJobs()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const runJob = async (job) => {
  try {
    const res = await axios.post(`/api/v1/jobs/${job.id}/run`)
    ElMessage.success('作业已启动')
  } catch (e) { ElMessage.error('运行失败') }
}

const toggleJob = async (job) => {
  try {
    await axios.put(`/api/v1/jobs/${job.id}`, { enabled: job.enabled })
    ElMessage.success(job.enabled ? '已启用' : '已暂停')
  } catch (e) {
    job.enabled = !job.enabled
    ElMessage.error('操作失败')
  }
}

const viewHistory = async (job) => {
  try {
    const res = await axios.get(`/api/v1/jobs/${job.id}/history`)
    if (res.data.code === 0) jobHistory.value = res.data.data
  } catch (e) { console.error(e) }
  showHistoryDialog.value = true
}

const showOutput = (record) => {
  ElMessageBox.alert(`<pre style="white-space:pre-wrap;font-family:monospace;">${record.output || '无输出'}</pre>`, '执行输出', { dangerouslyUseHTMLString: true })
}

const applyPreset = () => {
  formData.value.schedule = presetSchedule.value
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(() => { fetchJobs(); fetchServers() })
</script>
