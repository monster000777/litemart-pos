<script setup lang="ts">
import {
  BarChart3,
  Bot,
  Boxes,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  IdCard,
  LogOut,
  MonitorPlay,
  ScrollText,
  Settings,
  ShoppingCart,
  Users
} from 'lucide-vue-next'
import ThemeToggle from '~/components/ThemeToggle.vue'
import { canAccessAppPath, ROLE_LABELS, type UserRole } from '~~/shared/constants/rbac'

const route = useRoute()
const loggingOut = ref(false)
const sidebarCollapsed = ref(false)
const authState = useState<boolean | null>('auth:verified', () => null)
const authRole = useState<UserRole | null>('auth:role', () => null)
const { alertCount, fetchAlerts } = useAlertCount()

const navItems = [
  { label: 'Checkout', title: '收银台', to: '/', icon: ShoppingCart },
  { label: 'Orders', title: '订单历史', to: '/orders', icon: ClipboardList },
  { label: 'Inventory', title: '库存管理', to: '/inventory', icon: Boxes, badge: true },
  { label: 'Suppliers', title: '供应商管理', to: '/suppliers', icon: Building2 },
  { label: 'Insights', title: '经营看板', to: '/insights', icon: BarChart3 },
  { label: 'Copilot', title: '智能助手', to: '/ai', icon: Bot },
  { label: 'Members', title: '会员管理', to: '/members', icon: IdCard },
  { label: 'Users', title: '账号管理', to: '/users', icon: Users },
  { label: 'Logs', title: '操作日志', to: '/logs', icon: ScrollText },
  { label: 'Dashboard', title: '实时大屏', to: '/dashboard', icon: MonitorPlay }
]

const visibleNavItems = computed(() =>
  navItems.filter((item) => canAccessAppPath(authRole.value, item.to))
)

const roleLabel = computed(() => (authRole.value ? ROLE_LABELS[authRole.value] : ''))

const isActive = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  if (import.meta.client) {
    localStorage.setItem('litemart-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0')
  }
}

let alertTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  sidebarCollapsed.value = localStorage.getItem('litemart-sidebar-collapsed') === '1'
  await fetchAlerts()
  alertTimer = setInterval(fetchAlerts, 60_000)
})

onUnmounted(() => {
  if (alertTimer) clearInterval(alertTimer)
})

const logout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    authState.value = false
    authRole.value = null
    await navigateTo('/login')
    loggingOut.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-zinc-50 text-slate-700 antialiased dark:bg-zinc-950 dark:text-zinc-300 [font-family:'Inter',sans-serif]"
  >
    <aside
      class="fixed inset-y-0 left-0 z-20 border-r border-slate-100 bg-zinc-50 transition-[width] duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950"
      :class="sidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div class="flex h-full flex-col px-4 py-6">
        <div class="mb-4 flex items-center gap-3 px-2">
          <div
            class="flex min-w-0 items-center gap-3"
            :class="sidebarCollapsed ? 'justify-center' : ''"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
            >
              <ShoppingCart class="h-5.5 w-5.5" />
            </div>
            <div
              v-if="!sidebarCollapsed"
              class="flex flex-col transition-all duration-300 ease-in-out"
            >
              <span
                class="text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-zinc-50"
              >
                LiteMart POS
              </span>
              <div class="mt-0.5 flex items-center gap-2">
                <span
                  class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500"
                >
                  {{ roleLabel || 'Workspace' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <nav class="mt-6 space-y-1.5">
          <NuxtLink
            v-for="item in visibleNavItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-300 ease-in-out"
            :title="sidebarCollapsed ? item.title : undefined"
            :class="
              isActive(item.to)
                ? 'border-slate-100 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-none ring-1 ring-slate-100/80 dark:ring-zinc-700/70'
                : 'text-slate-500 hover:border-slate-100 hover:bg-white/70 hover:text-slate-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
            "
          >
            <component
              :is="item.icon"
              class="h-5 w-5 shrink-0 transition-transform duration-300 ease-in-out"
              :class="sidebarCollapsed ? 'mx-auto' : ''"
            />
            <div
              v-if="!sidebarCollapsed"
              class="ml-3 flex-1 leading-tight transition-all duration-300 ease-in-out"
            >
              <p class="font-medium">{{ item.title }}</p>
              <p class="text-xs text-slate-400 dark:text-zinc-500">{{ item.label }}</p>
            </div>
            <span
              v-if="item.badge && alertCount > 0"
              class="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white"
            >
              {{ alertCount > 99 ? '99+' : alertCount }}
            </span>
          </NuxtLink>
        </nav>

        <div class="mt-auto space-y-3">
          <button
            type="button"
            class="inline-flex w-full items-center rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:bg-zinc-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            :class="sidebarCollapsed ? 'justify-center' : 'gap-2'"
            :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
            @click="toggleSidebar"
          >
            <ChevronsRight v-if="sidebarCollapsed" class="h-4.5 w-4.5" />
            <ChevronsLeft v-else class="h-4.5 w-4.5" />
            <span v-if="!sidebarCollapsed">{{
              sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'
            }}</span>
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-50"
            :class="sidebarCollapsed ? 'justify-center' : 'gap-2'"
            :title="sidebarCollapsed ? '退出登录' : undefined"
            :disabled="loggingOut"
            @click="logout"
          >
            <LogOut class="h-4.5 w-4.5" />
            <span v-if="!sidebarCollapsed">{{ loggingOut ? '退出中...' : '退出登录' }}</span>
          </button>
        </div>
      </div>
    </aside>

    <div
      class="flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out"
      :class="sidebarCollapsed ? 'pl-20' : 'pl-64'"
    >
      <header
        class="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div class="flex h-16 w-full items-center justify-between gap-4 px-8">
          <div class="flex items-center gap-2">
            <ShoppingCart class="h-4.5 w-4.5 text-slate-900 dark:text-zinc-50" />
            <h1 class="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
              LiteMart POS
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <ThemeToggle compact class="justify-center px-2.5" />
            <NuxtLink
              to="/settings"
              title="系统设置"
              class="inline-flex items-center justify-center rounded-xl border border-slate-100 bg-white px-2.5 py-2.5 text-sm text-slate-600 transition hover:bg-zinc-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            >
              <Settings class="h-4 w-4" />
            </NuxtLink>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <div class="min-h-[calc(100vh-4rem)] w-full p-6 md:p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
