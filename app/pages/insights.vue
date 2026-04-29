<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import type { InsightsAiSummaryDto, InsightsOverviewDto, InsightsStatsDto } from '~/types/insights'

const { getApiErrorMessage, removeKnownPrefix } = useApiError()

const { data: overview, pending: overviewPending } = await useAsyncData('insights-overview', () =>
  $fetch<InsightsOverviewDto>('/api/insights/overview')
)

const { data: stats, pending: statsPending } = await useAsyncData('insights-stats', () =>
  $fetch<InsightsStatsDto>('/api/insights/stats')
)

const metrics = computed(() => [
  {
    label: '今日成交额',
    value: `¥${(overview.value?.todayAmount ?? 0).toFixed(2)}`,
    highlight: true
  },
  {
    label: '今日单量',
    value: `${overview.value?.todayOrderCount ?? 0}`,
    highlight: true
  },
  {
    label: '库存预警数',
    value: `${overview.value?.warningCount ?? 0}`,
    danger: (overview.value?.warningCount ?? 0) > 0
  },
  {
    label: '累计成交总额',
    value: `¥${(overview.value?.grossAmount ?? 0).toFixed(2)}`
  },
  {
    label: '累计核销总单数',
    value: `${overview.value?.orderCount ?? 0}`
  },
  {
    label: '商品种类总数 (SKU)',
    value: `${overview.value?.productCount ?? 0}`
  }
])

const chartWidth = 900
const chartHeight = 260
const chartPadding = {
  top: 18,
  right: 8,
  bottom: 24,
  left: 8
}

const trend = computed(() => stats.value?.trend ?? [])
const maxAmount = computed(() => Math.max(...trend.value.map((item) => item.amount), 1))

const chartPoints = computed(() => {
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const total = trend.value.length || 1

  return trend.value.map((item, index) => {
    const x =
      chartPadding.left + (total === 1 ? innerWidth / 2 : (index * innerWidth) / (total - 1))
    const y =
      chartPadding.top +
      innerHeight -
      (maxAmount.value === 0 ? 0 : (item.amount / maxAmount.value) * innerHeight)
    return { ...item, x, y }
  })
})

const linePath = computed(() => {
  if (!chartPoints.value.length) return ''
  return chartPoints.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
})

const areaPath = computed(() => {
  if (!chartPoints.value.length) return ''
  const baseline = chartHeight - chartPadding.bottom
  const first = chartPoints.value[0]
  const last = chartPoints.value[chartPoints.value.length - 1]
  if (!first || !last) return ''
  return `${linePath.value} L ${last.x.toFixed(2)} ${baseline} L ${first.x.toFixed(2)} ${baseline} Z`
})

// --- Top Products ---
const topProducts = computed(() => stats.value?.topProducts ?? [])
const maxTopQuantity = computed(() => Math.max(...topProducts.value.map(p => p.quantity), 1))

// --- AI Summary Logic ---
const aiNonce = ref(Date.now())
const aiSummary = ref<InsightsAiSummaryDto | null>(null)
const aiPending = ref(false)
const aiError = ref<unknown>(null)

const fetchAiSummary = async () => {
  if (aiPending.value) {
    return
  }
  aiPending.value = true
  aiError.value = null
  try {
    aiSummary.value = await $fetch<InsightsAiSummaryDto>('/api/insights/ai-summary', {
      query: { nonce: aiNonce.value },
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache'
      }
    })
  } catch (error) {
    aiError.value = error
  } finally {
    aiPending.value = false
  }
}

const handleRefreshAiSummary = async () => {
  aiNonce.value = Date.now()
  await fetchAiSummary()
}

onMounted(async () => {
  await fetchAiSummary()
})

const aiErrorMessage = computed(() => {
  const message = getApiErrorMessage(aiError.value, 'AI 简报生成失败')
  return removeKnownPrefix(message, 'AI 简报生成失败')
})

const aiGeneratedLabel = computed(() => {
  if (!aiSummary.value?.generatedAt) {
    return ''
  }
  const date = new Date(aiSummary.value.generatedAt)
  return date.toLocaleString('zh-CN', {
    hour12: false
  })
})

const formattedAiSummary = computed(() => {
  let text = aiSummary.value?.summary || ''
  if (!text) return '暂无 AI 简报，请点击“重新生成”。'

  text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
  text = text.replace(/【(.*?)】/g, '<span class="inline-block mt-4 mb-1 font-bold text-indigo-600 text-base">【$1】</span><br/>')
  text = text.replace(/^(?:\d+\.|-)\s(.*$)/gim, '<div class="pl-4 relative before:content-[\'•\'] before:absolute before:left-0 before:text-slate-400">$1</div>')
  text = text.replace(/\n/g, '<br/>')
  text = text.replace(/(<br\/>){3,}/g, '<br/><br/>')
  
  return text
})
</script>

<template>
  <section class="space-y-6">
    <header class="rounded-2xl border border-slate-100 bg-white p-8">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Insights</p>
      <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">经营看板</h2>
    </header>

    <div v-if="overviewPending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <article class="rounded-2xl border border-slate-100 bg-white px-6 py-5" v-for="item in 6" :key="item">
        <Skeleton class="h-3 w-20" />
        <Skeleton class="mt-4 h-8 w-28" />
      </article>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-2xl border bg-white px-6 py-5 transition-all"
        :class="metric.danger ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100'"
      >
        <p 
          class="text-xs uppercase tracking-[0.14em]"
          :class="metric.danger ? 'text-rose-500' : 'text-slate-400'"
        >
          {{ metric.label }}
        </p>
        <p 
          class="mt-3 text-3xl font-semibold tracking-tight"
          :class="[
            metric.danger ? 'text-rose-600' : 'text-slate-900',
            metric.highlight ? 'text-indigo-600' : ''
          ]"
        >
          {{ metric.value }}
        </p>
      </article>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 销售趋势 -->
      <article class="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-8">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">近 7 日销售趋势</h3>
        </div>

        <div v-if="statsPending" class="space-y-4">
          <Skeleton class="h-[260px] w-full rounded-2xl" />
          <div class="grid grid-cols-7 gap-2">
            <Skeleton class="h-3 w-full" v-for="item in 7" :key="item" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="h-[260px] w-full rounded-2xl bg-zinc-50/40"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sales-area-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="rgb(15 23 42)" stop-opacity="0.12" />
                <stop offset="100%" stop-color="rgb(15 23 42)" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <path :d="areaPath" fill="url(#sales-area-gradient)" />
            <path :d="linePath" fill="none" stroke="rgb(15 23 42)" stroke-width="1.2" stroke-linecap="round" />
          </svg>

          <div class="grid grid-cols-7 gap-2 px-1">
            <p v-for="item in trend" :key="item.date" class="text-center text-xs text-slate-400">
              {{ item.label }}
            </p>
          </div>
        </div>
      </article>

      <!-- 热销排行 -->
      <article class="rounded-2xl border border-slate-100 bg-white p-8">
        <h3 class="mb-5 text-sm font-medium uppercase tracking-[0.14em] text-slate-400">热销商品排行 (近 7 日)</h3>
        
        <div v-if="statsPending" class="space-y-6 mt-8">
          <Skeleton class="h-10 w-full rounded-lg" v-for="i in 5" :key="i" />
        </div>
        
        <div v-else class="space-y-5 mt-6">
          <div v-if="topProducts.length === 0" class="text-slate-400 text-sm py-8 text-center">暂无近期销售数据</div>
          <div v-for="item in topProducts" :key="item.name" class="relative group">
            <div class="flex justify-between items-end mb-2">
              <span class="text-slate-700 text-[0.95rem] font-medium truncate pr-4">{{ item.name }}</span>
              <span class="text-slate-900 font-semibold shrink-0">{{ item.quantity }}<span class="text-xs text-slate-400 font-normal ml-1">件</span></span>
            </div>
            <div class="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
              <div 
                class="h-full bg-indigo-500 rounded-full transition-all duration-500 group-hover:bg-indigo-600" 
                :style="{ width: `${(item.quantity / maxTopQuantity) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- AI 经营简报 -->
    <article class="rounded-2xl border border-slate-100 bg-white p-8">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">AI 周报建议</h3>
          <p v-if="aiSummary?.batch" class="mt-2 text-xs text-slate-400">
            批次 {{ aiSummary.batch }} · 生成于 {{ aiGeneratedLabel }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="aiPending"
          @click="handleRefreshAiSummary"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="aiPending ? 'animate-spin' : ''" />
          重新生成
        </button>
      </div>

      <div class="min-h-[22rem] rounded-2xl border border-slate-100 bg-zinc-50/70 p-8">
        <div v-if="aiPending" class="space-y-3">
          <Skeleton class="h-5 w-1/3" />
          <Skeleton class="h-5 w-full" />
          <Skeleton class="h-5 w-11/12" />
          <Skeleton class="h-5 w-10/12" />
          <Skeleton class="h-5 w-4/5" />
        </div>
        <p v-else-if="aiError" class="text-lg leading-8 text-rose-600">
          AI 简报生成失败：{{ aiErrorMessage }}
        </p>
        <div v-else class="text-[1.05rem] leading-8 text-slate-600" v-html="formattedAiSummary"></div>
      </div>
    </article>
  </section>
</template>
