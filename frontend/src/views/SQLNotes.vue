<template>
  <div class="h-screen flex flex-col">
    <!-- Toolbar -->
    <div class="flex justify-between items-center mb-4">
      <div class="flex space-x-2">
        <el-button type="primary" @click="createNote"><el-icon><Plus /></el-icon>新增笔记</el-button>
        <el-select v-model="filterDbType" placeholder="按类型筛选" clearable style="width: 140px">
          <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
        </el-select>
      </div>
      <el-input v-model="searchQuery" placeholder="搜索 SQL 笔记..." style="width: 250px" :prefix-icon="Search" />
    </div>

    <!-- Main Content -->
    <div class="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
      <!-- Left: Category Tree -->
      <div class="col-span-3 bg-white rounded-lg shadow-sm p-3 overflow-y-auto">
        <h3 class="font-semibold mb-2 text-sm text-text-secondary">分类</h3>
        <el-tree :data="categories" node-key="id" :props="{ label: 'name', children: 'children' }" />
      </div>

      <!-- Middle: Note List -->
      <div class="col-span-4 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
        <h3 class="font-semibold p-3 border-b border-border-light text-sm text-text-secondary">笔记列表</h3>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="p-3 border-b border-border-light cursor-pointer hover:bg-gray-50"
            :class="{ 'bg-primary/10': selectedNote?.id === note.id }"
            @click="selectNote(note)"
          >
            <div class="flex justify-between items-start">
              <span class="font-medium text-sm">{{ note.title }}</span>
              <el-tag size="small" v-if="note.db_type">{{ note.db_type }}</el-tag>
            </div>
            <p class="text-xs text-text-secondary mt-1 line-clamp-1">{{ note.content }}</p>
            <div class="flex justify-between items-center mt-2 text-xs text-text-secondary">
              <span>版本: v{{ note.version }}</span>
              <span>{{ formatTime(note.updated_at) }}</span>
            </div>
          </div>
          <div v-if="filteredNotes.length === 0" class="text-center py-8 text-text-secondary">
            暂无笔记
          </div>
        </div>
      </div>

      <!-- Right: Note Detail -->
      <div class="col-span-5 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div class="p-3 border-b border-border-light flex justify-between items-center">
          <h3 class="font-semibold text-sm">{{ selectedNote?.title || '笔记详情' }}</h3>
          <div v-if="selectedNote" class="space-x-2">
            <el-button size="small" @click="editMode = !editMode">{{ editMode ? '取消编辑' : '编辑' }}</el-button>
            <el-button size="small" @click="showVersions = true">版本历史</el-button>
            <el-button size="small" type="danger" @click="deleteNote(selectedNote)">删除</el-button>
          </div>
        </div>

        <!-- View Mode -->
        <div v-if="selectedNote && !editMode" class="flex-1 overflow-y-auto p-4">
          <div class="flex gap-2 mb-3">
            <el-tag v-if="selectedNote.db_type" size="small">{{ selectedNote.db_type }}</el-tag>
            <el-tag v-if="selectedNote.version" type="info" size="small">v{{ selectedNote.version }}</el-tag>
          </div>
          <pre class="bg-gray-50 p-4 rounded text-sm font-mono overflow-x-auto whitespace-pre-wrap">{{ selectedNote.content }}</pre>
        </div>

        <!-- Edit Mode -->
        <div v-else-if="selectedNote && editMode" class="flex-1 overflow-y-auto p-4">
          <el-form label-width="80px">
            <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
            <el-form-item label="类型">
              <el-select v-model="editForm.db_type">
                <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
              </el-select>
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="editForm.content" type="textarea" :rows="15" class="font-mono text-sm" />
            </el-form-item>
            <el-button type="primary" @click="saveEdit">保存新版本</el-button>
          </el-form>
        </div>

        <!-- No Selection -->
        <div v-else class="flex-1 flex items-center justify-center text-text-secondary">
          <div class="text-center">
            <el-icon class="text-4xl mb-2"><Document /></el-icon>
            <p>从左侧选择一条笔记查看</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Versions Dialog -->
    <el-dialog v-model="showVersions" title="版本历史" width="600px">
      <el-table :data="noteVersions">
        <el-table-column prop="version" label="版本" width="80">
          <template #default="{ row }">v{{ row.version }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" link @click="restoreVersion(row)">恢复</el-button>
            <el-button size="small" link @click="compareVersion(row)">对比</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const dbTypes = ['MySQL', 'PostgreSQL', 'Oracle', 'DM8', 'Vastbase', 'TDSQL', 'SQL Server', 'MongoDB', '通用']

const categories = ref([
  { id: 1, name: '按类型', children: dbTypes.map((t, i) => ({ id: i + 100, name: t })) },
  { id: 2, name: '自定义分类', children: [] }
])

const notes = ref([])
const searchQuery = ref('')
const filterDbType = ref('')
const selectedNote = ref(null)
const editMode = ref(false)
const showVersions = ref(false)
const noteVersions = ref([])

const editForm = ref({ title: '', db_type: '', content: '' })

const filteredNotes = computed(() => {
  return notes.value.filter(n => {
    const matchSearch = !searchQuery.value || n.title?.includes(searchQuery.value) || n.content?.includes(searchQuery.value)
    const matchType = !filterDbType.value || n.db_type === filterDbType.value
    return matchSearch && matchType
  })
})

const fetchNotes = async () => {
  try {
    const res = await axios.get('/api/v1/sql-notes')
    if (res.data.code === 0) notes.value = res.data.data
  } catch (e) { ElMessage.error('获取笔记失败') }
}

const selectNote = (note) => {
  selectedNote.value = note
  editMode.value = false
}

const createNote = () => {
  selectedNote.value = null
  editMode.value = true
  editForm.value = { title: '新笔记', db_type: 'MySQL', content: 'SELECT * FROM table;' }
}

const deleteNote = async (note) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${note.title}" 吗？`, '确认', { type: 'warning' })
    await axios.delete(`/api/v1/sql-notes/${note.id}`)
    ElMessage.success('删除成功')
    fetchNotes()
    selectedNote.value = null
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const saveEdit = async () => {
  try {
    if (selectedNote.value) {
      await axios.put(`/api/v1/sql-notes/${selectedNote.value.id}`, editForm.value)
      ElMessage.success('保存成功（新版本）')
    } else {
      await axios.post('/api/v1/sql-notes', editForm.value)
      ElMessage.success('创建成功')
    }
    editMode.value = false
    fetchNotes()
  } catch (e) { ElMessage.error('保存失败') }
}

const restoreVersion = async (version) => {
  try {
    await axios.post(`/api/v1/sql-notes/${selectedNote.value.id}/restore`, { version: version.version })
    ElMessage.success('已恢复到该版本')
    showVersions.value = false
    fetchNotes()
  } catch (e) { ElMessage.error('恢复失败') }
}

const compareVersion = (version) => {
  ElMessageBox.alert(`<pre style="white-space:pre-wrap;font-family:monospace;">版本 ${version.version} 内容对比功能</pre>`, '版本对比', { dangerouslyUseHTMLString: true })
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(fetchNotes)
</script>
