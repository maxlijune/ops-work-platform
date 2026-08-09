<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <div class="flex space-x-2">
        <el-button type="primary" @click="openCreateDialog"><el-icon><Plus /></el-icon>新增任务</el-button>
        <el-radio-group v-model="viewMode">
          <el-radio-button label="board">看板</el-radio-button>
          <el-radio-button label="list">列表</el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex items-center space-x-2">
        <el-select v-model="filterPriority" placeholder="优先级" clearable style="width: 120px">
          <el-option label="高" :value="3" />
          <el-option label="中" :value="2" />
          <el-option label="低" :value="1" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px">
          <el-option label="待办" value="todo" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="done" />
        </el-select>
      </div>
    </div>

    <!-- Board View -->
    <div v-if="viewMode === 'board'" class="grid grid-cols-3 gap-4">
      <div v-for="status in statusColumns" :key="status.key" class="bg-gray-100 rounded-lg p-3">
        <h3 class="font-semibold mb-3 text-sm">{{ status.label }} ({{ getFilteredTasksByStatus(status.key).length }})</h3>
        <div
          class="space-y-2"
          @dragover.prevent
          @drop="(e) => handleDrop(e, status.key)"
        >
          <div
            v-for="task in getFilteredTasksByStatus(status.key)"
            :key="task.id"
            draggable="true"
            @dragstart="(e) => handleDragStart(e, task)"
            class="bg-white p-3 rounded shadow-sm cursor-pointer hover:shadow transition-shadow"
            @click="viewTaskDetail(task)"
          >
            <div class="flex justify-between items-start">
              <span class="font-medium text-sm">{{ task.title }}</span>
              <el-tag :type="getPriorityType(task.priority)" size="small">{{ getPriorityLabel(task.priority) }}</el-tag>
            </div>
            <p class="text-xs text-text-secondary mt-1 line-clamp-2">{{ task.description }}</p>
            <div class="flex justify-between items-center mt-2 text-xs">
              <span class="text-text-secondary">{{ task.assignee || '未分配' }}</span>
              <span :class="isOverdue(task.due_date) ? 'text-danger' : 'text-text-secondary'">
                {{ task.due_date ? formatDate(task.due_date) : '无截止' }}
              </span>
            </div>
            <el-progress v-if="task.progress > 0" :percentage="task.progress" :stroke-width="8" class="mt-2" />
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <el-card v-else>
      <el-table :data="filteredTasks" style="width: 100%">
        <el-table-column prop="title" label="标题" width="200" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">{{ getPriorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="负责人" width="100" />
        <el-table-column prop="due_date" label="截止日期" width="120">
          <template #default="{ row }">{{ formatDate(row.due_date) }}</template>
        </el-table-column>
        <el-table-column prop="progress" label="进度" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" link @click="viewTaskDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create Dialog -->
    <el-dialog v-model="showCreateDialog" title="新增任务" width="500px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="标题"><el-input v-model="formData.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="formData.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="formData.status">
            <el-option label="待办" value="todo" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="done" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="formData.priority">
            <el-option label="高" :value="3" />
            <el-option label="中" :value="2" />
            <el-option label="低" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人"><el-input v-model="formData.assignee" /></el-form-item>
        <el-form-item label="截止日期"><el-date-picker v-model="formData.due_date" type="date" /></el-form-item>
        <el-form-item label="进度"><el-input-number v-model="formData.progress" :min="0" :max="100" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createTask">创建</el-button>
      </template>
    </el-dialog>

    <!-- Detail Dialog -->
    <el-dialog v-model="showDetailDialog" title="任务详情" width="600px">
      <div v-if="currentTask" class="space-y-4">
        <h2 class="text-xl font-bold">{{ currentTask.title }}</h2>
        <p class="text-text-secondary">{{ currentTask.description }}</p>
        <div class="grid grid-cols-2 gap-4">
          <div><strong>状态:</strong> {{ getStatusLabel(currentTask.status) }}</div>
          <div><strong>优先级:</strong> {{ getPriorityLabel(currentTask.priority) }}</div>
          <div><strong>负责人:</strong> {{ currentTask.assignee || '-' }}</div>
          <div><strong>截止日期:</strong> {{ formatDate(currentTask.due_date) }}</div>
        </div>
        <div>
          <strong>进度:</strong>
          <el-progress :percentage="currentTask.progress" :stroke-width="10" class="mt-1" />
        </div>
        <div class="flex justify-end space-x-2 pt-4 border-t">
          <el-button @click="editTask(currentTask)">编辑</el-button>
          <el-button type="danger" @click="deleteTask(currentTask)">删除</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  planType: { type: String, default: 'ops' }
})

const tasks = ref([])
const viewMode = ref('board')
const filterPriority = ref(null)
const filterStatus = ref(null)
const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const currentTask = ref(null)
const draggedTask = ref(null)

const formData = ref({ title: '', description: '', status: 'todo', priority: 2, assignee: '', due_date: '', progress: 0 })

const statusColumns = [
  { key: 'todo', label: '待办' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done', label: '已完成' }
]

const filteredTasks = computed(() => {
  return tasks.value.filter(t => {
    const matchPriority = !filterPriority.value || t.priority === filterPriority.value
    const matchStatus = !filterStatus.value || t.status === filterStatus.value
    return matchPriority && matchStatus
  })
})

const getFilteredTasksByStatus = (status) => {
  return filteredTasks.value.filter(t => t.status === status)
}

const fetchTasks = async () => {
  try {
    const res = await axios.get('/api/v1/plan-tasks', { params: { plan_type: props.planType } })
    if (res.data.code === 0) tasks.value = res.data.data
  } catch (e) { ElMessage.error('获取任务列表失败') }
}

const openCreateDialog = () => {
  formData.value = { title: '', description: '', status: 'todo', priority: 2, assignee: '', due_date: '', progress: 0 }
  showCreateDialog.value = true
}

const createTask = async () => {
  try {
    await axios.post('/api/v1/plan-tasks', { ...formData.value, plan_type: props.planType })
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    fetchTasks()
  } catch (e) { ElMessage.error('创建失败') }
}

const viewTaskDetail = (task) => { currentTask.value = task; showDetailDialog.value = true }

const editTask = (task) => {
  showDetailDialog.value = false
  formData.value = { ...task }
  showCreateDialog.value = true
}

const deleteTask = async (task) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${task.title}" 吗？`, '确认', { type: 'warning' })
    await axios.delete(`/api/v1/plan-tasks/${task.id}`)
    ElMessage.success('删除成功')
    fetchTasks()
    showDetailDialog.value = false
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const handleDragStart = (e, task) => {
  draggedTask.value = task
  e.dataTransfer.effectAllowed = 'move'
}

const handleDrop = async (e, newStatus) => {
  if (!draggedTask.value) return
  const task = draggedTask.value
  const oldStatus = task.status
  task.status = newStatus
  try {
    await axios.put(`/api/v1/plan-tasks/${task.id}`, { status: newStatus })
    ElMessage.success('状态已更新')
  } catch (e) {
    task.status = oldStatus
    ElMessage.error('更新失败')
  }
  draggedTask.value = null
}

const getPriorityLabel = (p) => ({ 3: '高', 2: '中', 1: '低' }[p] || '-')
const getPriorityType = (p) => ({ 3: 'danger', 2: 'warning', 1: 'info' }[p] || '')
const getStatusLabel = (s) => ({ todo: '待办', in_progress: '进行中', done: '已完成' }[s] || '-')
const getStatusType = (s) => ({ todo: 'info', in_progress: 'warning', done: 'success' }[s] || '')
const isOverdue = (d) => d && new Date(d) < new Date()
const formatDate = (d) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'

onMounted(fetchTasks)
</script>
