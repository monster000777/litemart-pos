export type InsightsOverviewDto = {
  todayAmount: number
  todayOrderCount: number
  warningCount: number
  grossAmount: number
  orderCount: number
  refundedCount: number
  productCount: number
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
  topProducts: Array<{
    name: string
    quantity: number
  }>
}
