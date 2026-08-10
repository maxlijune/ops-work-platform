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
          <el-option v-for="s in statusColumns" :key="s.key" :label="s.label" :value="s.key" />
        </el-select>
      </div>
    </div>

    <!-- Board View -->
    <div v-if="viewMode === 'board'" class="grid grid-cols-5 gap-4">
      <div v-for="status in statusColumns" :key="status.key" class="bg-gray-100 rounded-lg p-3 flex flex-col">
        <div class="flex items-center justify-between mb-3 pb-2 border-b-2" :style="{ borderColor: status.color }">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: status.color }"></span>
            <h3 class="font-semibold text-sm" :style="{ color: status.color }">{{ status.label }}</h3>
          </div>
          <span class="text-xs text-text-secondary bg-white px-2 py-0.5 rounded-full">{{ getFilteredTasksByStatus(status.key).length }}</span>
        </div>
        <div
          class="space-y-2 min-h-[300px] p-1 rounded transition-all flex-1"
          :class="dragOverStatus === status.key ? 'bg-primary/10 border-2 border-dashed border-primary' : ''"
          @dragover.prevent="onDragOver($event, status.key)"
          @dragleave="onDragLeave($event, status.key)"
          @drop="(e) => handleDrop(e, status.key)"
        >
          <div v-if="getFilteredTasksByStatus(status.key).length === 0" class="text-center text-xs text-text-secondary py-6 border-2 border-dashed border-gray-300 rounded">
            拖拽任务到这里
          </div>
          <div
            v-for="task in getFilteredTasksByStatus(status.key)"
            :key="task.id"
            draggable="true"
            class="bg-white p-3 rounded shadow-sm cursor-move hover:shadow transition-shadow border-l-4"
            :class="{ dragging: draggingTaskId === task.id }"
            :style="{ borderLeftColor: getPriorityColor(task.priority) }"
            @dragstart="(e) => handleDragStart(e, task)"
            @dragend="handleDragEnd"
            @click="viewTaskDetail(task)"
          >
            <div class="flex justify-between items-start">
              <span class="font-medium text-sm">{{ task.title }}</span>
              <el-tag :type="getPriorityType(task.priority)" size="small">{{ getPriorityLabel(task.priority) }}</el-tag>
            </div>
            <p class="text-xs text-text-secondary mt-1 line-clamp-2">{{ task.description }}</p>
            <div class="flex justify-between items-center mt-2 text-xs">
              <span class="text-text-secondary">{{ task.assignee || '未分配' }}</span>
              <span
                class="px-1.5 py-0.5 rounded"
                :class="isOverdue(task.due_date) ? 'bg-danger/10 text-danger font-medium' : 'text-text-secondary'"
              >
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
        <el-table-column label="操作" width="80" align="right">
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
      </el-table>
    </el-card>

    <!-- Create Dialog -->
    <el-dialog v-model="showCreateDialog" title="新增任务" width="500px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="标题"><el-input v-model="formData.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="formData.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="formData.status">
            <el-option v-for="s in statusColumns" :key="s.key" :label="s.label" :value="s.key" />
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
const draggingTaskId = ref(null)
const dragOverStatus = ref(null)

const formData = ref({ title: '', description: '', status: 'todo', priority: 2, assignee: '', due_date: '', progress: 0 })

const statusColumns = [
  { key: 'todo', label: '待办', color: '#6B7280' },
  { key: 'in_progress', label: '进行中', color: '#3B82F6' },
  { key: 'review', label: '待评审', color: '#E8B923' },
  { key: 'done', label: '已完成', color: '#22C55E' },
  { key: 'blocked', label: '已阻塞', color: '#EF4444' }
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

const handleAction = (cmd, row) => {
  switch (cmd) {
    case 'detail': viewTaskDetail(row); break
    case 'edit': editTask(row); break
    case 'delete': deleteTask(row); break
  }
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
  draggingTaskId.value = task.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(task.id))
}

const handleDragEnd = () => {
  draggingTaskId.value = null
  draggedTask.value = null
  dragOverStatus.value = null
}

const onDragOver = (e, status) => {
  e.dataTransfer.dropEffect = 'move'
  dragOverStatus.value = status
}

const onDragLeave = (e, status) => {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    if (dragOverStatus.value === status) dragOverStatus.value = null
  }
}

const handleDrop = async (e, newStatus) => {
  if (!draggedTask.value) return
  const task = draggedTask.value
  const oldStatus = task.status
  dragOverStatus.value = null
  if (oldStatus === newStatus) {
    draggedTask.value = null
    return
  }
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
const getPriorityColor = (p) => ({ 3: '#EF4444', 2: '#E8B923', 1: '#22C55E' }[p] || '#9CA3AF')
const getStatusLabel = (s) => {
  const col = statusColumns.find(c => c.key === s)
  return col ? col.label : '-'
}
const getStatusType = (s) => ({ todo: 'info', in_progress: 'primary', review: 'warning', done: 'success', blocked: 'danger' }[s] || '')
const isOverdue = (d) => d && new Date(d) < new Date()
const formatDate = (d) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'

onMounted(fetchTasks)
</script>

<style scoped>
.dragging {
  opacity: 0.5;
}
</style>
