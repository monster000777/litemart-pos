import { prisma } from '~~/server/lib/prisma'

/**
 * Dify HTTP Tool 专用接口：最近操作审计日志
 * Dify Agent 在需要了解门店近期事件时调用。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100)

  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      action: true,
      detail: true,
      createdAt: true
    }
  })

  return {
    logs: logs.map((log) => ({
      action: log.action,
      detail: log.detail,
      created_at: log.createdAt.toISOString()
    }))
  }
})
