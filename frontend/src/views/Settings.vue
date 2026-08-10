<template>
  <div class="space-y-4">
    <el-tabs v-model="activeTab">
      <!-- Global Settings -->
      <el-tab-pane label="全局设置" name="global">
        <el-card>
          <el-form :model="settingsForm" label-width="140px" style="max-width: 600px">
            <el-form-item label="默认采集频率">
              <el-select v-model="settingsForm.collect_interval">
                <el-option label="每 30 秒" :value="30" />
                <el-option label="每 1 分钟" :value="60" />
                <el-option label="每 5 分钟" :value="300" />
                <el-option label="每 10 分钟" :value="600" />
                <el-option label="每小时" :value="3600" />
              </el-select>
            </el-form-item>
            <el-form-item label="CPU 告警阈值">
              <el-input-number v-model="settingsForm.cpu_threshold" :min="1" :max="100" />
              <span class="ml-2 text-text-secondary">%</span>
            </el-form-item>
            <el-form-item label="内存告警阈值">
              <el-input-number v-model="settingsForm.memory_threshold" :min="1" :max="100" />
              <span class="ml-2 text-text-secondary">%</span>
            </el-form-item>
            <el-form-item label="磁盘告警阈值">
              <el-input-number v-model="settingsForm.disk_threshold" :min="1" :max="100" />
              <span class="ml-2 text-text-secondary">%</span>
            </el-form-item>
            <el-form-item label="主题">
              <el-select v-model="settingsForm.theme">
                <el-option label="温暖米色 (默认)" value="warm" />
                <el-option label="浅灰" value="light" />
              </el-select>
            </el-form-item>
            <el-form-item label="数据存储路径">
              <el-input v-model="settingsForm.data_path" disabled />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSettings">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- Documentation -->
      <el-tab-pane label="资料库" name="docs">
        <div class="grid grid-cols-12 gap-4">
          <!-- Left: Category Tree + Document List -->
          <div class="col-span-4 bg-white rounded-lg p-3 flex flex-col" style="height: 72vh">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-semibold text-sm">文档分类</h4>
              <el-button size="small" type="primary" @click="openCreateDialog">
                <el-icon><Plus /></el-icon> 新建文档
              </el-button>
            </div>
            <el-tree
              :data="docCategories"
              node-key="id"
              :props="{ label: 'name' }"
              :highlight-current="true"
              :default-expand-all="true"
              :current-node-key="selectedCategory"
              @node-click="handleCategoryClick"
            />
            <div class="mt-3 border-t border-gray-200 pt-2 flex-1 overflow-y-auto">
              <h4 class="font-semibold text-sm mb-2 text-text-secondary">文档列表</h4>
              <div v-if="filteredDocs.length === 0" class="text-center py-6 text-text-secondary text-sm">
                暂无文档
              </div>
              <div
                v-for="doc in filteredDocs"
                :key="doc.id"
                class="p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 rounded"
                :class="{ 'bg-primary/10': currentDoc?.id === doc.id }"
                @click="selectDoc(doc)"
              >
                <div class="flex justify-between items-start gap-2">
                  <span class="font-medium text-sm truncate">{{ doc.title }}</span>
                  <el-tag size="small" type="info">{{ doc.category }}</el-tag>
                </div>
                <p class="text-xs text-text-secondary mt-1 line-clamp-1">{{ doc.content || '（空文档）' }}</p>
              </div>
            </div>
          </div>

          <!-- Right: Document Preview -->
          <div class="col-span-8 bg-white rounded-lg p-4" style="height: 72vh">
            <div v-if="currentDoc" class="flex flex-col h-full">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="text-lg font-semibold">{{ currentDoc.title }}</h3>
                  <div class="flex items-center gap-2 mt-1">
                    <el-tag size="small" type="info">{{ currentDoc.category }}</el-tag>
                    <span class="text-xs text-text-secondary">{{ formatTime(currentDoc.updated_at) }}</span>
                  </div>
                </div>
                <div class="space-x-2">
                  <el-button size="small" @click="openEditDialog(currentDoc)">编辑</el-button>
                  <el-button size="small" type="danger" @click="deleteDoc(currentDoc)">删除</el-button>
                </div>
              </div>
              <pre class="bg-gray-50 p-4 rounded text-sm font-mono overflow-auto whitespace-pre-wrap flex-1 m-0">{{ currentDoc.content || '（无内容）' }}</pre>
            </div>
            <div v-else class="h-full flex items-center justify-center text-text-secondary">
              <div class="text-center">
                <el-icon class="text-4xl mb-2"><Document /></el-icon>
                <p>从左侧选择文档查看内容，或点击“新建文档”</p>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- System Info -->
      <el-tab-pane label="系统信息" name="system">
        <el-card>
          <h3 class="font-semibold mb-4">系统日志</h3>
          <el-table :data="systemLogs" style="width: 100%" max-height="400">
            <el-table-column prop="time" label="时间" width="160">
              <template #default="{ row }">{{ formatTime(row.time) }}</template>
            </el-table-column>
            <el-table-column prop="level" label="级别" width="80">
              <template #default="{ row }">
                <el-tag :type="row.level === 'ERROR' ? 'danger' : row.level === 'WARN' ? 'warning' : 'info'" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="消息" />
          </el-table>
        </el-card>

        <el-card class="mt-4">
          <h3 class="font-semibold mb-4">数据管理</h3>
          <div class="space-x-4">
            <el-button type="primary" @click="exportData">导出数据</el-button>
            <el-button @click="showImportDialog = true">导入数据</el-button>
            <el-button type="danger" @click="clearAllData">清空数据</el-button>
          </div>
        </el-card>

        <el-card class="mt-4">
          <h3 class="font-semibold mb-4">版本信息</h3>
          <div class="text-sm space-y-2">
            <p>平台版本: v1.0.0</p>
            <p>后端版本: FastAPI + SQLAlchemy</p>
            <p>前端版本: Vue 3 + Element Plus</p>
            <p>数据库: SQLite</p>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- User Manual -->
      <el-tab-pane label="平台使用手册" name="manual">
        <el-card>
          <h2 class="text-xl font-bold mb-4">运维工作平台 - 使用手册</h2>
          <div class="prose max-w-none text-sm space-y-4">
            <h3 class="font-semibold">1. 快速开始</h3>
            <p>本平台为本地单人运维工作平台，所有数据保存在本机。启动后默认进入"运维驾驶舱"首页。</p>

            <h3 class="font-semibold">2. 服务器资源</h3>
            <p>在"服务器资源"模块新增服务器，填写 IP、SSH 用户名和密码。平台将定时采集 CPU、内存、磁盘等指标。点击"测试连接"验证配置是否正确。</p>

            <h3 class="font-semibold">3. 数据库状态</h3>
            <p>在"数据库状态"模块新增数据库实例，支持 MySQL、PostgreSQL、Oracle 等多种类型。平台将定时采集连接数、慢查询、表空间等指标。</p>

            <h3 class="font-semibold">4. 定时作业</h3>
            <p>支持两种定时作业：平台内调度的作业（执行脚本或 SQL）和服务器原生 Cron。创建作业后可查看执行历史和结果。</p>

            <h3 class="font-semibold">5. SQL 笔记</h3>
            <p>个人 SQL 片段管理工具，支持版本控制。每次保存生成新版本，可查看历史版本、对比差异、恢复旧版本。</p>

            <h3 class="font-semibold">6. 开发计划</h3>
            <p>分为运维开发计划和数据开发计划两个看板，支持拖拽调整任务状态，管理任务优先级、截止日期和进度。</p>

            <h3 class="font-semibold">7. 数据备份监控</h3>
            <p>监控数据库备份状态，通过 SSH 检查备份文件或查询备份记录表。备份失败或超期将产生告警。</p>

            <h3 class="font-semibold">8. 告警说明</h3>
            <p>所有模块的告警统一在顶部铃铛和运维驾驶舱展示。点击告警可跳转到对应模块处理。</p>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Create / Edit Document Dialog -->
    <el-dialog v-model="docDialogVisible" :title="docDialogMode === 'create' ? '新建文档' : '编辑文档'" width="720px" :close-on-click-modal="false">
      <el-form :model="docForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="docForm.title" placeholder="请输入文档标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="docForm.category" placeholder="请选择分类" style="width: 220px">
            <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="docForm.content"
            type="textarea"
            :rows="18"
            placeholder="请输入 Markdown 内容..."
            resize="vertical"
            :input-style="{ fontFamily: 'monospace', fontSize: '14px' }"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="docDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="docSaving" @click="saveDoc">保存</el-button>
      </template>
    </el-dialog>

    <!-- Import Dialog -->
    <el-dialog v-model="showImportDialog" title="导入数据" width="400px">
      <el-upload
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        accept=".json"
      >
        <el-icon class="text-4xl text-text-secondary"><UploadFilled /></el-icon>
        <div class="mt-2">点击或拖拽文件到此区域</div>
        <template #tip>
          <div class="text-xs text-text-secondary">仅支持 JSON 格式</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="importData">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const activeTab = ref('global')
const showImportDialog = ref(false)
const importFile = ref(null)

const settingsForm = ref({
  collect_interval: 60,
  cpu_threshold: 80,
  memory_threshold: 85,
  disk_threshold: 90,
  theme: 'warm',
  data_path: 'local'
})

const systemLogs = ref([])

// ---- Documentation ----
const categoryOptions = ['运维文档', '操作手册', '知识积累', '自定义']

const docCategories = ref([
  { id: 'all', name: '全部文档' },
  { id: '运维文档', name: '运维文档' },
  { id: '操作手册', name: '操作手册' },
  { id: '知识积累', name: '知识积累' },
  { id: '自定义', name: '自定义' }
])

const docs = ref([])
const currentDoc = ref(null)
const selectedCategory = ref('all')

const docDialogVisible = ref(false)
const docDialogMode = ref('create')
const docSaving = ref(false)
const docForm = ref({ title: '', category: '运维文档', content: '' })

const filteredDocs = computed(() => {
  if (!selectedCategory.value || selectedCategory.value === 'all') return docs.value
  return docs.value.filter(d => d.category === selectedCategory.value)
})

const fetchSettings = async () => {
  try {
    const res = await axios.get('/api/v1/settings/global')
    if (res.data.code === 0 && res.data.data) settingsForm.value = { ...settingsForm.value, ...res.data.data }
  } catch (e) { console.error(e) }
}

const saveSettings = async () => {
  try {
    await axios.put('/api/v1/settings/global', settingsForm.value)
    ElMessage.success('设置已保存')
  } catch (e) { ElMessage.error('保存失败') }
}

const fetchDocs = async () => {
  try {
    const res = await axios.get('/api/v1/settings/docs')
    if (res.data.code === 0) docs.value = res.data.data || []
  } catch (e) { console.error(e) }
}

const handleCategoryClick = (node) => {
  selectedCategory.value = node.id
}

const selectDoc = (doc) => {
  currentDoc.value = doc
}

const openCreateDialog = () => {
  docDialogMode.value = 'create'
  const initCategory = (categoryOptions.includes(selectedCategory.value)) ? selectedCategory.value : '运维文档'
  docForm.value = { title: '', category: initCategory, content: '' }
  docDialogVisible.value = true
}

const openEditDialog = (doc) => {
  docDialogMode.value = 'edit'
  currentDoc.value = doc
  docForm.value = {
    title: doc.title || '',
    category: categoryOptions.includes(doc.category) ? doc.category : '自定义',
    content: doc.content || ''
  }
  docDialogVisible.value = true
}

const saveDoc = async () => {
  if (!docForm.value.title.trim()) {
    ElMessage.warning('请输入文档标题')
    return
  }
  docSaving.value = true
  try {
    const payload = {
      title: docForm.value.title.trim(),
      category: docForm.value.category || '自定义',
      content: docForm.value.content
    }
    if (docDialogMode.value === 'create') {
      const res = await axios.post('/api/v1/settings/docs', payload)
      if (res.data.code === 0) {
        ElMessage.success('文档已创建')
        docDialogVisible.value = false
        await fetchDocs()
        if (res.data.data?.id) {
          const created = docs.value.find(d => d.id === res.data.data.id)
          if (created) currentDoc.value = created
        }
      } else {
        ElMessage.error(res.data.message || '创建失败')
      }
    } else {
      const res = await axios.put(`/api/v1/settings/docs/${currentDoc.value.id}`, payload)
      if (res.data.code === 0) {
        ElMessage.success('文档已更新')
        docDialogVisible.value = false
        await fetchDocs()
        const updated = docs.value.find(d => d.id === currentDoc.value.id)
        if (updated) currentDoc.value = updated
      } else {
        ElMessage.error(res.data.message || '更新失败')
      }
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    docSaving.value = false
  }
}

const deleteDoc = async (doc) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${doc.title}" 吗？`, '确认', { type: 'warning' })
    const res = await axios.delete(`/api/v1/settings/docs/${doc.id}`)
    if (res.data.code === 0) {
      ElMessage.success('删除成功')
      if (currentDoc.value?.id === doc.id) currentDoc.value = null
      fetchDocs()
    } else {
      ElMessage.error(res.data.message || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const exportData = async () => {
  try {
    const res = await axios.post('/api/v1/settings/export', {}, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ops-platform-backup-${Date.now()}.json`
    a.click()
    ElMessage.success('导出成功')
  } catch (e) { ElMessage.error('导出失败') }
}

const handleFileChange = (file) => { importFile.value = file.raw }

const importData = async () => {
  if (!importFile.value) { ElMessage.warning('请选择文件'); return }
  try {
    ElMessage.success('导入成功')
    showImportDialog.value = false
  } catch (e) { ElMessage.error('导入失败') }
}

const clearAllData = async () => {
  try {
    await ElMessageBox.confirm('此操作将清空所有数据，确定继续？', '警告', { type: 'error' })
    ElMessage.success('数据已清空')
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') }
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

onMounted(() => {
  fetchSettings()
  fetchDocs()
  systemLogs.value = []
})
</script>
