<script setup lang="ts">
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LogOut,
  ScrollText,
  ShoppingCart,
  MonitorPlay,
  Bot
} from 'lucide-vue-next'

const route = useRoute()
const loggingOut = ref(false)
const authState = useState<boolean | null>('auth:verified', () => null)
const alertCount = ref(0)

const navItems = [
  { label: 'Checkout', title: '核销工作台', to: '/', icon: ShoppingCart },
  { label: 'Orders', title: '订单历史', to: '/orders', icon: ClipboardList },
  { label: 'Inventory', title: '库存矩阵', to: '/inventory', icon: Boxes, badge: true },
  { label: 'Suppliers', title: '供应商管理', to: '/suppliers', icon: Building2 },
  { label: 'Insights', title: '经营看板', to: '/insights', icon: BarChart3 },
  { label: 'Copilot', title: '智能助理', to: '/ai', icon: Bot },
  { label: 'Logs', title: '操作日志', to: '/logs', icon: ScrollText },
  { label: 'Dashboard', title: '实时大屏', to: '/dashboard', icon: MonitorPlay }
]

const isActive = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}

const fetchAlerts = async () => {
  try {
    const res = await $fetch<{ count: number }>('/api/products/alerts')
    alertCount.value = res.count
  } catch {
    alertCount.value = 0
  }
}

let alertTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchAlerts()
  // 每 60 秒轮询一次
  alertTimer = setInterval(fetchAlerts, 60_000)
})

onUnmounted(() => {
  if (alertTimer) clearInterval(alertTimer)
})

const logout = async () => {
  if (loggingOut.value) {
    return
  }
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })
  } finally {
    authState.value = false
    await navigateTo('/login')
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-50 text-slate-700 antialiased [font-family:'Inter',sans-serif]">
    <aside class="fixed inset-y-0 left-0 z-20 w-64 border-r border-slate-100 bg-zinc-50">
      <div class="flex h-full flex-col px-4 py-6">
        <div class="mb-4 flex items-center gap-3 px-2">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm"
          >
            <ShoppingCart class="h-5 w-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-[15px] font-bold tracking-tight text-slate-900 leading-tight"
              >LiteMart POS</span
            >
            <span class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5"
              >Workspace</span
            >
          </div>
        </div>

        <nav class="mt-6 space-y-1.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-200"
            :class="
              isActive(item.to)
                ? 'border-slate-100 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-500 hover:border-slate-100 hover:bg-white/70 hover:text-slate-900'
            "
          >
            <component :is="item.icon" class="h-4 w-4" />
            <div class="flex-1 leading-tight">
              <p class="font-medium">{{ item.title }}</p>
              <p class="text-xs text-slate-400">{{ item.label }}</p>
            </div>
            <span
              v-if="item.badge && alertCount > 0"
              class="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white"
            >
              {{ alertCount > 99 ? '99+' : alertCount }}
            </span>
          </NuxtLink>
        </nav>

        <button
          type="button"
          class="mt-auto inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loggingOut"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
          <span>{{ loggingOut ? '退出中...' : '退出登录' }}</span>
        </button>
      </div>
    </aside>

    <div class="pl-64 flex flex-col min-h-screen">
      <header class="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div class="flex h-16 w-full items-center gap-2 px-8">
          <ShoppingCart class="h-4 w-4 text-slate-900" />
          <h1 class="text-sm font-semibold tracking-tight text-slate-900">LiteMart POS</h1>
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
