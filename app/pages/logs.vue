<script setup lang="ts">
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'

type AuditLogDto = {
  id: string
  action: string
  detail: string | null
  ip: string | null
  createdAt: string
}

type AuditLogResponse = {
  logs: AuditLogDto[]
  total: number
  page: number
  pageSize: number
}

const actionFilter = ref('')
const currentPage = ref(1)
const pageSize = 30

const { getApiErrorMessage } = useApiError()

// 筛选条件变化时重置页码
watch(actionFilter, () => {
  currentPage.value = 1
})

const queryParams = computed(() => ({
  page: currentPage.value,
  pageSize,
  action: actionFilter.value || undefined
}))

const { data, pending, error } = await useAsyncData(
  'audit-logs',
  () => $fetch<AuditLogResponse>('/api/audit-logs', { params: queryParams.value }),
  { watch: [queryParams] }
)

const logs = computed(() => data.value?.logs ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / pageSize))

const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '日志加载失败') : ''
)

const goPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) currentPage.value = p
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: '登录',
  LOGIN_FAILED: '登录失败',
  REGISTER: '注册',
  LOGOUT: '登出',
  RESET_PIN: 'PIN 重置',
  CHECKOUT: '核销',
  REFUND: '退款',
  PRODUCT_CREATE: '新增商品',
  PRODUCT_UPDATE: '更新商品',
  PRODUCT_DELETE: '删除商品'
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LOGIN_FAILED: 'bg-rose-50 text-rose-700 border-rose-100',
  REGISTER: 'bg-blue-50 text-blue-700 border-blue-100',
  LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
  RESET_PIN: 'bg-amber-50 text-amber-700 border-amber-100',
  CHECKOUT: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  REFUND: 'bg-orange-50 text-orange-700 border-orange-100',
  PRODUCT_CREATE: 'bg-teal-50 text-teal-700 border-teal-100',
  PRODUCT_UPDATE: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  PRODUCT_DELETE: 'bg-rose-50 text-rose-700 border-rose-100'
}

const actionLabel = (a: string) => ACTION_LABELS[a] || a
const actionColor = (a: string) => ACTION_COLORS[a] || 'bg-slate-50 text-slate-600 border-slate-100'

const { formatDate } = useFormat()

const actionOptions = Object.entries(ACTION_LABELS)
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold tracking-tight text-slate-900">操作日志</h2>
      <p class="mt-1 text-sm text-slate-500">共 {{ total }} 条记录</p>
    </div>

    <!-- 筛选 -->
    <div class="flex items-center gap-3">
      <select
        v-model="actionFilter"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      >
        <option value="">全部操作</option>
        <option v-for="[key, label] in actionOptions" :key="key" :value="key">
          {{ label }}
        </option>
      </select>
    </div>

    <!-- 错误 -->
    <div
      v-if="errorMsg"
      class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-sm text-rose-600"
    >
      {{ errorMsg }}
    </div>

    <!-- 骨架 -->
    <div v-if="pending" class="space-y-2">
      <div v-for="i in 8" :key="i" class="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3">
        <Skeleton class="h-5 w-16 rounded-full" />
        <Skeleton class="h-4 w-48" />
        <Skeleton class="ml-auto h-3 w-28" />
      </div>
    </div>

    <!-- 日志列表 -->
    <div v-if="!pending && logs.length" class="space-y-2">
      <div
        v-for="log in logs"
        :key="log.id"
        class="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3"
      >
        <span
          class="inline-block min-w-[4.5rem] rounded-full border px-2 py-0.5 text-center text-xs font-medium"
          :class="actionColor(log.action)"
        >
          {{ actionLabel(log.action) }}
        </span>
        <span class="flex-1 text-sm text-slate-700">{{ log.detail || '-' }}</span>
        <span v-if="log.ip" class="text-xs text-slate-400">{{ log.ip }}</span>
        <span class="text-xs text-slate-400">{{ formatDate(log.createdAt) }}</span>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!pending && !logs.length && !errorMsg"
      class="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500"
    >
      暂无操作日志
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        上一页
      </button>
      <span class="text-xs text-slate-500">{{ currentPage }} / {{ totalPages }}</span>
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </section>
</template>
