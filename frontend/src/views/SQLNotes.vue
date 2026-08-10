<template>
  <div class="h-screen flex flex-col">
    <!-- Toolbar -->
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center space-x-2">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>新增笔记
        </el-button>
        <el-select v-model="filterDbType" placeholder="按类型筛选" clearable style="width: 140px">
          <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
        </el-select>
        <el-tag v-if="filterTag" closable size="small" @close="filterTag = ''">标签: {{ filterTag }}</el-tag>
        <el-button v-if="filterDbType || filterTag || searchQuery" link @click="clearFilters">清除筛选</el-button>
      </div>
      <el-input v-model="searchQuery" placeholder="搜索 SQL 笔记..." style="width: 250px" :prefix-icon="Search" />
    </div>

    <!-- Main Content -->
    <div class="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
      <!-- Left: Category Tree -->
      <div class="col-span-3 bg-white rounded-lg shadow-sm p-3 overflow-y-auto">
        <h3 class="font-semibold mb-2 text-sm text-text-secondary">分类</h3>
        <el-tree
          :data="categories"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          default-expand-all
          @node-click="handleNodeClick"
        >
          <template #default="{ node, data }">
            <span class="flex items-center justify-between w-full pr-2">
              <span>{{ node.label }}</span>
              <span v-if="data.count !== undefined" class="text-xs text-text-secondary">{{ data.count }}</span>
            </span>
          </template>
        </el-tree>
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
            <div v-if="note.tags && note.tags.length" class="flex flex-wrap gap-1 mt-2">
              <el-tag v-for="tag in note.tags" :key="tag" size="small" type="info" effect="plain">{{ tag }}</el-tag>
            </div>
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
            <el-button size="small" @click="openEditDialog">编辑</el-button>
            <el-button size="small" @click="openVersions">版本历史</el-button>
            <el-button size="small" type="danger" @click="deleteNote(selectedNote)">删除</el-button>
          </div>
        </div>

        <!-- View Mode -->
        <div v-if="selectedNote" class="flex-1 overflow-y-auto p-4">
          <div class="flex flex-wrap gap-2 mb-3">
            <el-tag v-if="selectedNote.db_type" size="small">{{ selectedNote.db_type }}</el-tag>
            <el-tag v-if="selectedNote.version" type="info" size="small">v{{ selectedNote.version }}</el-tag>
            <el-tag
              v-for="tag in (selectedNote.tags || [])"
              :key="tag"
              size="small"
              type="success"
              effect="plain"
            >{{ tag }}</el-tag>
          </div>
          <pre class="bg-gray-50 p-4 rounded text-sm font-mono overflow-x-auto whitespace-pre-wrap">{{ selectedNote.content }}</pre>
        </div>

        <!-- No Selection -->
        <div v-else class="flex-1 flex items-center justify-center text-text-secondary">
          <div class="text-center">
            <el-icon class="text-4xl mb-2"><Document /></el-icon>
            <p>从左侧选择一条笔记查看</p>
            <el-button type="primary" class="mt-4" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>新增第一条笔记
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <el-dialog
      v-model="showFormDialog"
      :title="formMode === 'create' ? '新增笔记' : '编辑笔记'"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="90px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入笔记标题" />
        </el-form-item>
        <el-form-item label="数据库类型">
          <el-select v-model="form.db_type" placeholder="请选择数据库类型" style="width: 100%">
            <el-option v-for="type in dbTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            placeholder="输入标签后回车创建，或选择已有标签"
            style="width: 100%"
          >
            <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item label="SQL 内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            placeholder="请输入 SQL 内容..."
            :input-style="{ fontFamily: 'Courier New, Consolas, monospace', fontSize: '13px' }"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFormDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">
          {{ formMode === 'create' ? '保存' : '保存新版本' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Versions Dialog -->
    <el-dialog v-model="showVersions" title="版本历史" width="600px">
      <el-table :data="noteVersions" v-loading="loadingVersions">
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
      <template #footer>
        <el-button @click="showVersions = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import axios from 'axios'

const dbTypes = ['MySQL', 'PostgreSQL', 'Oracle', 'DM8', 'Vastbase', 'TDSQL', 'SQL Server', 'MongoDB', '通用']

const notes = ref([])
const searchQuery = ref('')
const filterDbType = ref('')
const filterTag = ref('')
const selectedNote = ref(null)

// Form dialog state
const showFormDialog = ref(false)
const formMode = ref('create') // 'create' | 'edit'
const form = ref({ title: '', db_type: 'MySQL', tags: [], content: '' })
const saving = ref(false)

// Versions dialog state
const showVersions = ref(false)
const noteVersions = ref([])
const loadingVersions = ref(false)

const allTags = computed(() => {
  const set = new Set()
  notes.value.forEach(n => (n.tags || []).forEach(t => set.add(t)))
  return Array.from(set).sort()
})

const categories = computed(() => [
  {
    id: 'type',
    name: '按类型',
    children: [
      { id: 'type-all', name: '全部', count: notes.value.length, filterKind: 'db', filterType: '' },
      ...dbTypes.map((t) => ({
        id: `type-${t}`,
        name: t,
        count: notes.value.filter(n => n.db_type === t).length,
        filterKind: 'db',
        filterType: t
      }))
    ]
  },
  {
    id: 'tag',
    name: '按标签',
    children: allTags.value.length
      ? allTags.value.map((t) => ({
          id: `tag-${t}`,
          name: t,
          count: notes.value.filter(n => (n.tags || []).includes(t)).length,
          filterKind: 'tag',
          filterType: t
        }))
      : [{ id: 'tag-empty', name: '暂无标签' }]
  }
])

const filteredNotes = computed(() => {
  return notes.value.filter(n => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    const matchType = !filterDbType.value || n.db_type === filterDbType.value
    const matchTag = !filterTag.value || (n.tags || []).includes(filterTag.value)
    return matchSearch && matchType && matchTag
  })
})

const fetchNotes = async () => {
  try {
    const res = await axios.get('/api/v1/sql-notes')
    if (res.data.code === 0) {
      notes.value = (res.data.data || []).map(n => ({ ...n, tags: Array.isArray(n.tags) ? n.tags : [] }))
      if (selectedNote.value) {
        const updated = notes.value.find(n => n.id === selectedNote.value.id)
        if (updated) selectedNote.value = updated
        else selectedNote.value = null
      }
    }
  } catch (e) { ElMessage.error('获取笔记失败') }
}

const selectNote = (note) => {
  selectedNote.value = note
}

const handleNodeClick = (data) => {
  if (!data.filterKind) return
  if (data.filterKind === 'db') {
    filterDbType.value = data.filterType
    filterTag.value = ''
  } else if (data.filterKind === 'tag') {
    filterTag.value = data.filterType
    filterDbType.value = ''
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  filterDbType.value = ''
  filterTag.value = ''
}

const openCreateDialog = () => {
  formMode.value = 'create'
  form.value = { title: '', db_type: 'MySQL', tags: [], content: '' }
  showFormDialog.value = true
}

const openEditDialog = () => {
  if (!selectedNote.value) return
  formMode.value = 'edit'
  form.value = {
    title: selectedNote.value.title || '',
    db_type: selectedNote.value.db_type || 'MySQL',
    tags: [...(selectedNote.value.tags || [])],
    content: selectedNote.value.content || ''
  }
  showFormDialog.value = true
}

const saveForm = async () => {
  if (!form.value.title?.trim()) { ElMessage.warning('请输入标题'); return }
  if (!form.value.content?.trim()) { ElMessage.warning('请输入 SQL 内容'); return }
  saving.value = true
  try {
    const payload = {
      title: form.value.title.trim(),
      db_type: form.value.db_type,
      tags: form.value.tags,
      content: form.value.content
    }
    let newId = null
    if (formMode.value === 'create') {
      const res = await axios.post('/api/v1/sql-notes', payload)
      if (res.data.code !== 0) { ElMessage.error(res.data.message || '创建失败'); return }
      ElMessage.success('创建成功')
      newId = res.data.data?.id ?? null
    } else {
      const res = await axios.put(`/api/v1/sql-notes/${selectedNote.value.id}`, payload)
      if (res.data.code !== 0) { ElMessage.error(res.data.message || '保存失败'); return }
      ElMessage.success('保存成功（新版本）')
    }
    showFormDialog.value = false
    await fetchNotes()
    if (newId != null) {
      const created = notes.value.find(n => n.id === newId)
      if (created) selectedNote.value = created
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const deleteNote = async (note) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${note.title}" 吗？`, '确认', { type: 'warning' })
    const res = await axios.delete(`/api/v1/sql-notes/${note.id}`)
    if (res.data.code === 0) {
      ElMessage.success('删除成功')
      if (selectedNote.value?.id === note.id) selectedNote.value = null
      fetchNotes()
    } else {
      ElMessage.error(res.data.message || '删除失败')
    }
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const openVersions = async () => {
  if (!selectedNote.value) return
  showVersions.value = true
  noteVersions.value = []
  loadingVersions.value = true
  try {
    const res = await axios.get(`/api/v1/sql-notes/${selectedNote.value.id}/versions`)
    if (res.data.code === 0) noteVersions.value = res.data.data || []
  } catch (e) { ElMessage.error('获取版本历史失败') }
  finally { loadingVersions.value = false }
}

const restoreVersion = async (version) => {
  try {
    const res = await axios.post(`/api/v1/sql-notes/${selectedNote.value.id}/restore`, { version: version.version })
    if (res.data.code === 0) {
      ElMessage.success('已恢复到该版本')
      showVersions.value = false
      fetchNotes()
    } else {
      ElMessage.error(res.data.message || '恢复失败')
    }
  } catch (e) { ElMessage.error('恢复失败') }
}

const compareVersion = (version) => {
  ElMessageBox.alert(`<pre style="white-space:pre-wrap;font-family:monospace;">版本 ${version.version} 内容对比功能</pre>`, '版本对比', { dangerouslyUseHTMLString: true })
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(fetchNotes)
</script>
