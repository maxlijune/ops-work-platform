import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Cockpit',
    component: () => import('../views/Cockpit.vue'),
    meta: { title: '运维驾驶舱', icon: 'Odometer' }
  },
  {
    path: '/servers',
    name: 'Servers',
    component: () => import('../views/Servers.vue'),
    meta: { title: '服务器资源', icon: 'Monitor' }
  },
  {
    path: '/databases',
    name: 'Databases',
    component: () => import('../views/Databases.vue'),
    meta: { title: '数据库状态', icon: 'Coin' }
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('../views/Jobs.vue'),
    meta: { title: '定时作业', icon: 'Timer' }
  },
  {
    path: '/sql-notes',
    name: 'SQLNotes',
    component: () => import('../views/SQLNotes.vue'),
    meta: { title: 'SQL笔记', icon: 'Document' }
  },
  {
    path: '/plan-ops',
    name: 'PlanOps',
    component: () => import('../views/PlanOps.vue'),
    meta: { title: '运维开发计划', icon: 'Tools' },
    props: { planType: 'ops' }
  },
  {
    path: '/plan-data',
    name: 'PlanData',
    component: () => import('../views/PlanData.vue'),
    meta: { title: '数据开发计划', icon: 'DataAnalysis' },
    props: { planType: 'data' }
  },
  {
    path: '/backup',
    name: 'Backup',
    component: () => import('../views/Backup.vue'),
    meta: { title: '数据备份监控', icon: 'FolderChecked' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: '资料与设置', icon: 'Setting' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
