import type { InsightsAiSummaryDto } from '~/types/insights'

// AI 周报全局状态 —— 模块级单例，路由切换不重置，不重复拉取
const aiSummary = ref<InsightsAiSummaryDto | null>(null)
const aiNonce = ref(Date.now())
const aiPending = ref(false)
const aiError = ref<unknown>(null)
let aiAbortController: AbortController | null = null

export function useAiSummary() {
  const doFetch = () =>
    $fetch<InsightsAiSummaryDto>('/api/insights/ai-summary', {
      query: { nonce: aiNonce.value },
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
      signal: aiAbortController!.signal
    })

  const fetchAiSummary = async () => {
    if (aiPending.value || aiSummary.value) return

    aiPending.value = true
    aiError.value = null
    aiAbortController = new AbortController()

    try {
      aiSummary.value = await doFetch()
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        aiError.value = error
      }
    } finally {
      aiPending.value = false
    }
  }

  const handleRefreshAiSummary = async () => {
    aiAbortController?.abort()

    aiPending.value = true
    aiError.value = null
    aiNonce.value = Date.now()
    aiAbortController = new AbortController()

    try {
      aiSummary.value = await doFetch()
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        aiError.value = error
      }
    } finally {
      aiPending.value = false
    }
  }

  return {
    aiSummary: readonly(aiSummary),
    aiPending: readonly(aiPending),
    aiError: readonly(aiError),
    fetchAiSummary,
    handleRefreshAiSummary
  }
}
