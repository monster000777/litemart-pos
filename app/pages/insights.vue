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
    aiSummary.value = await $fetch<InsightsAiSummaryDto>('/api/ai-summary', {
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

const metrics = computed(() => [
  {
    label: '今日成交额',
    value: `¥${(overview.value?.todayAmount ?? 0).toFixed(2)}`
  },
  {
    label: '今日单量',
    value: `${overview.value?.todayOrderCount ?? 0}`
  },
  {
    label: '库存预警数',
    value: `${overview.value?.warningCount ?? 0}`
  }
])

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
</script>

<template>
  <section class="space-y-6">
    <header class="rounded-2xl border border-slate-100 bg-white p-8">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">AI Insights</p>
      <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">经营洞察简报</h2>
    </header>

    <div v-if="overviewPending" class="grid grid-cols-3 gap-4">
      <article class="rounded-2xl border border-slate-100 bg-white px-6 py-5" v-for="item in 3" :key="item">
        <Skeleton class="h-3 w-20" />
        <Skeleton class="mt-4 h-8 w-28" />
      </article>
    </div>

    <div v-else class="grid grid-cols-3 gap-4">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-2xl border border-slate-100 bg-white px-6 py-5"
      >
        <p class="text-xs uppercase tracking-[0.14em] text-slate-400">{{ metric.label }}</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{{ metric.value }}</p>
      </article>
    </div>

    <article class="rounded-2xl border border-slate-100 bg-white p-8">
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
        <p v-else class="text-[1.05rem] leading-9 text-slate-700">
          {{ aiSummary?.summary || '暂无 AI 简报，请点击“重新生成”。' }}
        </p>
      </div>
    </article>
  </section>
</template>
