<script setup lang="ts">
import { BarChart3, Boxes, LogOut, ShoppingCart } from 'lucide-vue-next'

const route = useRoute()
const loggingOut = ref(false)
const authState = useState<boolean | null>('auth:verified', () => null)

const navItems = [
  { label: 'Checkout', title: '核销工作台', to: '/', icon: ShoppingCart },
  { label: 'Inventory', title: '库存矩阵', to: '/inventory', icon: Boxes },
  { label: 'Insights', title: '经营看板', to: '/insights', icon: BarChart3 }
]

const isActive = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}

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
        <div class="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">LiteMart POS</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">Desktop Workspace</p>
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
            <div class="leading-tight">
              <p class="font-medium">{{ item.title }}</p>
              <p class="text-xs text-slate-400">{{ item.label }}</p>
            </div>
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

    <div class="pl-64">
      <header class="sticky top-0 z-10 border-b border-slate-100 bg-zinc-50/90 backdrop-blur">
        <div class="mx-auto flex h-16 w-full max-w-7xl items-center px-8">
          <h1 class="text-sm font-medium text-slate-900">LiteMart POS</h1>
        </div>
      </header>

      <main class="bg-white">
        <div class="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
