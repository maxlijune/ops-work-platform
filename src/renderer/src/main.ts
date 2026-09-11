import { createApp } from 'vue'
import App from './App.vue'
import './assets/app.css'
import { ensureApiMock } from './api-mock'
import type { Api } from '../../shared/ipc'

// 浏览器预览模式下（无 Electron preload）注入桩数据桥
ensureApiMock()

// 类型化 window.api（由 preload 注入）
declare global {
  interface Window {
    api: Api
  }
}

createApp(App).mount('#app')