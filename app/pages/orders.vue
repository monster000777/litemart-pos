<script setup lang="ts">
import { onUnmounted } from 'vue'
import { ChevronDown, ChevronUp, Download, Search, Undo2 } from 'lucide-vue-next'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import type { OrderListResponse } from '~/types/order'

const refundingId = ref('')
const { toast } = useToast()

const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const currentPage = ref(1)
const pageSize = 20
const expandedOrderId = ref<string | null>(null)

const { getApiErrorMessage } = useApiError()

// 搜索防抖 300ms
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = val.trim()
  }, 300)
})

// 筛选条件变化时重置页码
watch([debouncedSearch, statusFilter, dateFrom, dateTo], () => {
  currentPage.value = 1
})

const queryParams = computed(() => ({
  page: currentPage.value,
  pageSize,
  search: debouncedSearch.value || undefined,
  status: statusFilter.value || undefined,
  dateFrom: dateFrom.value || undefined,
  dateTo: dateTo.value || undefined
}))

const { data, pending, error } = await useAsyncData(
  'orders',
  () => $fetch<OrderListResponse>('/api/orders', { params: queryParams.value }),
  { watch: [queryParams] }
)

const orders = computed(() => data.value?.orders ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / pageSize))

const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '订单加载失败') : ''
)

const toggleExpand = (id: string) => {
  expandedOrderId.value = expandedOrderId.value === id ? null : id
}

const resetFilters = () => {
  search.value = ''
  debouncedSearch.value = ''
  statusFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  currentPage.value = 1
}

const goPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const { formatPrice, formatDate } = useFormat()

const statusLabel = (s: string) => (s === 'REFUNDED' ? '已退款' : '已完成')
const statusClass = (s: string) =>
  s === 'REFUNDED'
    ? 'bg-rose-50 text-rose-600 border-rose-100'
    : 'bg-emerald-50 text-emerald-600 border-emerald-100'

const exportCsv = () => {
  if (!orders.value.length) return
  const header = '订单号,状态,总金额,客户尾号,下单时间,商品明细'
  const rows = orders.value.map((o) => {
    const items = o.items.map((i) => `${i.product.name}×${i.quantity}`).join('; ')
    return `${o.orderNo}\t,${statusLabel(o.status)},${o.totalAmount},${o.customerTail || '-'},${formatDate(o.createdAt)}\t,"${items}"`
  })
  const csv = '\uFEFF' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const refundOrder = async (orderId: string, orderNo: string) => {
  if (refundingId.value) return
  const ok = window.confirm(`确认退款订单「${orderNo}」？库存将自动恢复。`)
  if (!ok) return
  refundingId.value = orderId
  try {
    await $fetch(`/api/orders/${orderId}/refund`, { method: 'POST' })
    toast({ title: `订单 ${orderNo} 已退款`, variant: 'success', duration: 3000 })
    clearNuxtData() // 清空全局缓存，确保切换页面时同步
    await refreshNuxtData('orders')
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '退款失败'), variant: 'error', duration: 3000 })
  } finally {
    refundingId.value = ''
  }
}

onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold tracking-tight text-slate-900">订单历史</h2>
        <p class="mt-1 text-sm text-slate-500">共 {{ total }} 条记录</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
        :disabled="!orders.length"
        @click="exportCsv"
      >
        <Download class="h-4 w-4" />
        导出 CSV
      </button>
    </div>

    <!-- 筛选栏 -->
    <div class="flex flex-wrap items-end gap-3">
      <label
        class="flex flex-1 items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2"
      >
        <Search class="h-4 w-4 text-slate-400" />
        <input
          v-model="search"
          type="text"
          placeholder="订单号 / 客户尾号"
          class="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </label>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      >
        <option value="">全部状态</option>
        <option value="COMPLETED">已完成</option>
        <option value="REFUNDED">已退款</option>
      </select>
      <input
        v-model="dateFrom"
        type="date"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      />
      <span class="text-sm text-slate-400">至</span>
      <input
        v-model="dateTo"
        type="date"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      />
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
        @click="resetFilters"
      >
        重置
      </button>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="errorMsg"
      class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-sm text-rose-600"
    >
      {{ errorMsg }}
    </div>

    <!-- 加载骨架 -->
    <div v-if="pending" class="space-y-3">
      <div v-for="i in 5" :key="i" class="rounded-2xl border border-slate-100 bg-white p-4">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <Skeleton class="h-4 w-36" />
            <Skeleton class="h-3 w-20" />
          </div>
          <Skeleton class="h-5 w-16" />
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div v-if="!pending && orders.length" class="space-y-3">
      <div
        v-for="order in orders"
        :key="order.id"
        class="rounded-2xl border border-slate-100 bg-white transition-all"
      >
        <!-- 订单头部 -->
        <button
          type="button"
          class="flex w-full items-center justify-between p-4 text-left"
          @click="toggleExpand(order.id)"
        >
          <div class="flex items-center gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ order.orderNo }}</p>
              <p class="mt-0.5 text-xs text-slate-400">{{ formatDate(order.createdAt) }}</p>
            </div>
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-medium"
              :class="statusClass(order.status)"
            >
              {{ statusLabel(order.status) }}
            </span>
            <span v-if="order.customerTail" class="text-xs text-slate-400">
              尾号 {{ order.customerTail }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-slate-900">{{
              formatPrice(order.totalAmount)
            }}</span>
            <component
              :is="expandedOrderId === order.id ? ChevronUp : ChevronDown"
              class="h-4 w-4 text-slate-400"
            />
          </div>
        </button>

        <!-- 订单明细（展开） -->
        <div v-if="expandedOrderId === order.id" class="border-t border-slate-100 px-4 py-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400">
                <th class="pb-2 font-medium">商品</th>
                <th class="pb-2 font-medium">SKU</th>
                <th class="pb-2 text-right font-medium">单价</th>
                <th class="pb-2 text-right font-medium">数量</th>
                <th class="pb-2 text-right font-medium">小计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id" class="border-t border-slate-50">
                <td class="py-2 text-slate-800">{{ item.product.name }}</td>
                <td class="py-2 text-slate-400">{{ item.product.sku }}</td>
                <td class="py-2 text-right text-slate-600">{{ formatPrice(item.unitPrice) }}</td>
                <td class="py-2 text-right text-slate-600">{{ item.quantity }}</td>
                <td class="py-2 text-right font-medium text-slate-900">
                  {{ formatPrice(item.unitPrice * item.quantity) }}
                </td>
              </tr>
            </tbody>
          </table>
          <!-- 退款按钮 -->
          <div
            v-if="order.status === 'COMPLETED'"
            class="mt-3 flex justify-end border-t border-slate-100 pt-3"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
              :disabled="refundingId === order.id"
              @click.stop="refundOrder(order.id, order.orderNo)"
            >
              <Undo2 class="h-3.5 w-3.5" />
              {{ refundingId === order.id ? '退款中...' : '整单退款' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!pending && !orders.length && !errorMsg"
      class="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500"
    >
      暂无订单记录
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
