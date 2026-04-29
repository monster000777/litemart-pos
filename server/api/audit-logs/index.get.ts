import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 30))
  const action = String(query.action || '').trim()

  const where: Record<string, unknown> = {}
  if (action) {
    where.action = action
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.auditLog.count({ where })
  ])

  return {
    logs,
    total,
    page,
    pageSize
  }
})
