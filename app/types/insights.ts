export type InsightsOverviewDto = {
  todayAmount: number
  todayOrderCount: number
  warningCount: number
}

export type InsightsAiSummaryDto = {
  summary: string
  batch: string
  generatedAt: string
  source?: 'remote' | 'fallback'
  failureCount?: number
}

export type InsightsStatsDto = {
  trend: Array<{
    date: string
    label: string
    amount: number
  }>
}
