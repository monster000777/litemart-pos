<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Clock3,
  DollarSign,
  MonitorPlay,
  ShoppingBag,
  Sparkles
} from 'lucide-vue-next'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import type { InsightsOverviewDto, InsightsStatsDto } from '~/types/insights'
import type { OrderListResponse } from '~/types/order'
import type { ProductDto } from '~/types/product'

definePageMeta({ layout: false })

const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null
let dataTimer: ReturnType<typeof setInterval> | null = null

const { formatPrice, formatDate, formatTime } = useFormat()

const { data: overview, pending: overviewPending, refresh: refreshOverview } = await useAsyncData(
  'dashboard-overview',
  () => $fetch<InsightsOverviewDto>('/api/insights/overview')
)
const { data: stats, pending: statsPending, refresh: refreshStats } = await useAsyncData(
  'dashboard-stats',
  () => $fetch<InsightsStatsDto>('/api/insights/stats')
)
const { data: orderData, pending: ordersPending, refresh: refreshOrders } = await useAsyncData(
  'dashboard-orders',
  () => $fetch<OrderListResponse>('/api/orders', { params: { pageSize: 12 } })
)
const { data: productData, pending: productsPending, refresh: refreshProducts } = await useAsyncData(
  'dashboard-products',
  () => $fetch<ProductDto[]>('/api/products')
)

const trend = computed(() => stats.value?.trend ?? [])
const topProducts = computed(() => stats.value?.topProducts ?? [])
const recentOrders = computed(() => orderData.value?.orders ?? [])
const warningProducts = computed(() =>
  (productData.value ?? [])
    .filter((item) => item.stock <= item.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
)

const totalProducts = computed(() => productData.value?.length ?? 0)
const warningCount = computed(() => overview.value?.warningCount ?? 0)
const healthyCount = computed(() => Math.max(totalProducts.value - warningCount.value, 0))
const healthyRate = computed(() =>
  totalProducts.value > 0 ? Math.round((healthyCount.value / totalProducts.value) * 100) : 100
)

const donutRadius = 42
const donutCircumference = 2 * Math.PI * donutRadius
const donutHealthyDash = computed(() => (healthyRate.value / 100) * donutCircumference)

const categoryDistribution = computed(() => {
  const categoryMap = new Map<string, number>()
  for (const product of productData.value ?? []) {
    const key = product.category || '未分类'
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1)
  }
  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
})
const maxCategoryCount = computed(() => Math.max(...categoryDistribution.value.map((item) => item.count), 1))

const hourBuckets = computed(() => {
  const raw = Array.from({ length: 8 }, (_, index) => ({
    label: `${String(index * 3).padStart(2, '0')}-${String(index * 3 + 2).padStart(2, '0')}`,
    count: 0
  }))
  for (const order of recentOrders.value) {
    const hour = new Date(order.createdAt).getHours()
    const bucketIndex = Math.min(7, Math.floor(hour / 3))
    raw[bucketIndex]!.count += 1
  }
  return raw
})
const maxHourCount = computed(() => Math.max(...hourBuckets.value.map((item) => item.count), 1))

const chartWidth = 860
const chartHeight = 280
const chartPadding = { top: 24, right: 22, bottom: 32, left: 20 }
const maxTrendAmount = computed(() => Math.max(...trend.value.map((item) => item.amount), 1))
const trendPoints = computed(() => {
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const total = trend.value.length || 1
  return trend.value.map((item, index) => {
    const x = chartPadding.left + (total === 1 ? innerWidth / 2 : (index * innerWidth) / (total - 1))
    const y = chartPadding.top + innerHeight - (item.amount / maxTrendAmount.value) * innerHeight
    return { ...item, x, y }
  })
})
const trendLinePath = computed(() => {
  if (!trendPoints.value.length) {
    return ''
  }
  return trendPoints.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
})
const trendAreaPath = computed(() => {
  if (!trendPoints.value.length) {
    return ''
  }
  const baseline = chartHeight - chartPadding.bottom
  const first = trendPoints.value[0]
  const last = trendPoints.value[trendPoints.value.length - 1]
  if (!first || !last) {
    return ''
  }
  return `${trendLinePath.value} L ${last.x.toFixed(2)} ${baseline} L ${first.x.toFixed(2)} ${baseline} Z`
})

const summaryCards = computed(() => [
  {
    key: 'todayAmount',
    label: '今日销售额',
    value: formatPrice(overview.value?.todayAmount ?? 0),
    sub: `累计营收 ${formatPrice(overview.value?.grossAmount ?? 0)}`,
    icon: DollarSign,
    tone: 'indigo'
  },
  {
    key: 'todayOrders',
    label: '今日核销单',
    value: String(overview.value?.todayOrderCount ?? 0),
    sub: `历史总单 ${overview.value?.orderCount ?? 0}`,
    icon: ShoppingBag,
    tone: 'emerald'
  },
  {
    key: 'skuCount',
    label: '在售 SKU',
    value: String(overview.value?.productCount ?? 0),
    sub: `预警 ${overview.value?.warningCount ?? 0}`,
    icon: Boxes,
    tone: 'sky'
  },
  {
    key: 'refundCount',
    label: '退款单数',
    value: String(overview.value?.refundedCount ?? 0),
    sub: '近期开单波动稳定',
    icon: Activity,
    tone: 'amber'
  }
] as const)

const toneClassMap = {
  indigo: { icon: 'text-indigo-600 bg-indigo-50 border-indigo-100', value: 'text-indigo-700' },
  emerald: { icon: 'text-emerald-600 bg-emerald-50 border-emerald-100', value: 'text-emerald-700' },
  sky: { icon: 'text-sky-600 bg-sky-50 border-sky-100', value: 'text-sky-700' },
  amber: { icon: 'text-amber-600 bg-amber-50 border-amber-100', value: 'text-amber-700' }
} as const

const refreshAll = async () => {
  await Promise.all([refreshOverview(), refreshStats(), refreshOrders(), refreshProducts()])
}

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
  dataTimer = setInterval(() => {
    void refreshAll()
  }, 30_000)
})

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
  }
  if (dataTimer) {
    clearInterval(dataTimer)
  }
})
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-zinc-50 text-slate-700">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -left-24 top-0 h-64 w-64 rounded-full bg-indigo-200/35 blur-3xl" />
      <div class="absolute right-12 top-40 h-72 w-72 rounded-full bg-sky-200/25 blur-3xl" />
      <div class="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
    </div>

    <div class="relative mx-auto w-full max-w-[1900px] p-6 md:p-8 xl:p-10">
      <header class="mb-6 rounded-3xl border border-slate-100 bg-white/90 px-6 py-5 backdrop-blur-sm md:px-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-zinc-50 text-slate-700">
              <MonitorPlay class="h-6 w-6" />
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">LiteMart 实时经营大屏</h1>
              <p class="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                实时监控中 · 每 30 秒自动刷新
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="rounded-2xl border border-slate-100 bg-zinc-50 px-4 py-2 text-right">
              <p class="text-2xl font-semibold tabular-nums tracking-wider text-slate-900">{{ formatTime(now) }}</p>
              <p class="text-xs text-slate-500">{{ formatDate(now) }}</p>
            </div>
            <NuxtLink
              to="/insights"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-zinc-50 hover:text-slate-900"
            >
              <ArrowLeft class="h-4 w-4" />
              返回看板
            </NuxtLink>
          </div>
        </div>
      </header>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article v-for="card in summaryCards" :key="card.key" class="rounded-3xl border border-slate-100 bg-white p-6">
          <div v-if="overviewPending" class="space-y-3">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-9 w-32" />
            <Skeleton class="h-3 w-28" />
          </div>
          <template v-else>
            <div class="mb-4 flex items-center justify-between">
              <p class="text-xs uppercase tracking-[0.14em] text-slate-400">{{ card.label }}</p>
              <div class="rounded-xl border p-2" :class="toneClassMap[card.tone].icon">
                <component :is="card.icon" class="h-4 w-4" />
              </div>
            </div>
            <p class="text-3xl font-semibold tracking-tight" :class="toneClassMap[card.tone].value">{{ card.value }}</p>
            <p class="mt-3 text-sm text-slate-500">{{ card.sub }}</p>
          </template>
        </article>
      </section>

      <section class="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-12">
        <article class="rounded-3xl border border-slate-100 bg-white p-6 2xl:col-span-7">
          <div class="mb-5 flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-indigo-500" />
            <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">近 7 日营收波形图</h2>
          </div>

          <div v-if="statsPending" class="space-y-4">
            <Skeleton class="h-[320px] w-full rounded-2xl" />
          </div>
          <div v-else class="rounded-2xl border border-slate-100 bg-zinc-50/70 p-4">
            <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="h-[320px] w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="revenue-area-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="rgb(79 70 229)" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="rgb(79 70 229)" stop-opacity="0.02" />
                </linearGradient>
              </defs>

              <g v-for="line in 4" :key="line">
                <line
                  x1="16"
                  :x2="chartWidth - 16"
                  :y1="(chartHeight / 5) * line"
                  :y2="(chartHeight / 5) * line"
                  stroke="rgb(226 232 240)"
                  stroke-dasharray="3 5"
                />
              </g>

              <path :d="trendAreaPath" fill="url(#revenue-area-gradient)" />
              <path :d="trendLinePath" fill="none" stroke="rgb(79 70 229)" stroke-width="2.2" stroke-linecap="round" />

              <g v-for="point in trendPoints" :key="point.date">
                <circle :cx="point.x" :cy="point.y" r="4.5" fill="white" stroke="rgb(79 70 229)" stroke-width="2" />
              </g>
            </svg>
            <div class="grid grid-cols-7 px-2">
              <p v-for="item in trend" :key="item.date" class="text-center text-xs text-slate-500">{{ item.label }}</p>
            </div>
          </div>
        </article>

        <article class="rounded-3xl border border-slate-100 bg-white p-6 2xl:col-span-5">
          <div class="mb-5 flex items-center gap-2">
            <Activity class="h-4 w-4 text-emerald-500" />
            <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">库存健康雷达</h2>
          </div>

          <div v-if="productsPending" class="space-y-4">
            <Skeleton class="h-[140px] w-full rounded-xl" />
            <Skeleton class="h-[140px] w-full rounded-xl" />
          </div>
          <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-100 bg-zinc-50 p-4">
              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">库存健康环</div>
              <div class="flex items-center gap-4">
                <svg viewBox="0 0 120 120" class="h-28 w-28">
                  <circle cx="60" cy="60" :r="donutRadius" fill="none" stroke="rgb(226 232 240)" stroke-width="10" />
                  <circle
                    cx="60"
                    cy="60"
                    :r="donutRadius"
                    fill="none"
                    stroke="rgb(16 185 129)"
                    stroke-width="10"
                    stroke-linecap="round"
                    :stroke-dasharray="`${donutHealthyDash} ${donutCircumference}`"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div>
                  <p class="text-3xl font-semibold text-emerald-600">{{ healthyRate }}%</p>
                  <p class="text-sm text-slate-500">健康库存占比</p>
                  <p class="mt-2 text-xs text-slate-400">健康 {{ healthyCount }} · 预警 {{ warningCount }}</p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-100 bg-zinc-50 p-4">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-slate-400">品类分布</div>
              <div class="space-y-3">
                <div v-for="item in categoryDistribution" :key="item.name">
                  <div class="mb-1 flex items-center justify-between text-xs">
                    <span class="truncate text-slate-600">{{ item.name }}</span>
                    <span class="text-slate-500">{{ item.count }}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-slate-200">
                    <div
                      class="h-1.5 rounded-full bg-emerald-500"
                      :style="{ width: `${(item.count / maxCategoryCount) * 100}%` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-12">
        <article class="rounded-3xl border border-slate-100 bg-white p-6 2xl:col-span-4">
          <div class="mb-5 flex items-center gap-2">
            <Clock3 class="h-4 w-4 text-indigo-500" />
            <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">实时核销流水</h2>
          </div>

          <div class="h-[300px] overflow-y-auto pr-1">
            <div v-if="ordersPending" class="space-y-3">
              <Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-xl" />
            </div>
            <div v-else class="space-y-3">
              <p v-if="!recentOrders.length" class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                暂无核销记录
              </p>
              <div v-for="order in recentOrders" :key="order.id" class="rounded-xl border border-slate-100 bg-zinc-50 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <p class="font-mono text-xs text-slate-500">{{ order.orderNo }}</p>
                  <p class="text-xs text-indigo-600">
                    {{ new Date(order.createdAt).toLocaleTimeString('zh-CN', { hour12: false }) }}
                  </p>
                </div>
                <div class="flex items-center justify-between">
                  <p class="text-sm text-slate-600">{{ order.items.length }} 件商品</p>
                  <p class="text-sm font-semibold text-slate-900">{{ formatPrice(order.totalAmount) }}</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-3xl border border-slate-100 bg-white p-6 2xl:col-span-4">
          <div class="mb-5 flex items-center gap-2">
            <Activity class="h-4 w-4 text-sky-500" />
            <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">热销商品</h2>
          </div>

          <div v-if="statsPending" class="space-y-3">
            <Skeleton v-for="i in 6" :key="i" class="h-11 w-full rounded-xl" />
          </div>
          <div v-else class="space-y-4">
            <p v-if="!topProducts.length" class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              暂无销售数据
            </p>
            <div v-for="item in topProducts" :key="item.name" class="rounded-xl border border-slate-100 bg-zinc-50 p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium text-slate-800">{{ item.name }}</p>
                <p class="text-xs text-slate-500">{{ item.quantity }} 件</p>
              </div>
              <div class="h-2 rounded-full bg-slate-200">
                <div
                  class="h-2 rounded-full bg-sky-500 transition-all duration-500"
                  :style="{ width: `${(item.quantity / Math.max(topProducts[0]?.quantity || 1, 1)) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-3xl border border-slate-100 bg-white p-6 2xl:col-span-4">
          <div class="mb-5 flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-amber-500" />
            <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">分时交易热度</h2>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-zinc-50 p-4">
            <div class="grid grid-cols-8 items-end gap-2">
              <div v-for="item in hourBuckets" :key="item.label" class="flex flex-col items-center">
                <div class="flex h-40 w-full items-end">
                  <div
                    class="w-full rounded-t-md bg-amber-400/85 transition-all duration-500"
                    :style="{ height: `${Math.max((item.count / maxHourCount) * 100, item.count ? 16 : 6)}%` }"
                  />
                </div>
                <p class="mt-2 text-[10px] text-slate-500">{{ item.label }}</p>
                <p class="text-[10px] font-medium text-slate-600">{{ item.count }}</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="mt-6 rounded-3xl border border-slate-100 bg-white p-6">
        <div class="mb-5 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-500" />
          <h2 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">库存预警明细</h2>
        </div>

        <div v-if="productsPending" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton v-for="i in 8" :key="i" class="h-20 w-full rounded-xl" />
        </div>
        <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <p
            v-if="!warningProducts.length"
            class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700 md:col-span-2 xl:col-span-4"
          >
            当前无库存预警商品，库存健康。
          </p>
          <article v-for="item in warningProducts" :key="item.id" class="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
            <p class="truncate text-sm font-medium text-slate-900">{{ item.name }}</p>
            <p class="mt-1 text-xs text-slate-500">SKU {{ item.sku }}</p>
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="rounded-full bg-white px-2 py-1 text-slate-600">当前库存 {{ item.stock }}</span>
              <span class="rounded-full bg-white px-2 py-1 text-amber-700">预警线 {{ item.minStock }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
