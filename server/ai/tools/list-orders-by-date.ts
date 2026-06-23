import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '~~/server/lib/prisma'

/**
 * 按日期范围查询订单列表（含订单号、金额、状态、创建时间、商品件数）。
 * 用于回答「6 月 2 日有哪些订单」这类无具体订单号的查询。
 */
export const listOrdersByDateTool = tool({
  description:
    '按日期范围查询订单列表。当用户问某一天 / 某一段时间有哪些订单时使用，返回订单号、状态、金额、创建时间和商品件数。',
  inputSchema: z.object({
    startDate: z.string().describe('起始日期，ISO 格式如 2026-06-01'),
    endDate: z.string().describe('结束日期，ISO 格式如 2026-06-30'),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .optional()
      .describe('最多返回条数，默认 50，上限 200')
  }),
  execute: async ({ startDate, endDate, limit = 50 }) => {
    // 用本地构造器（与 server/api/insights/overview.get.ts 一致），避免 ISO 字符串按 UTC 解析导致跨时区漏单
    const parseLocal = (value: string) => {
      const [y, m, d] = value.split('-').map(Number)
      return new Date(y, (m ?? 1) - 1, d ?? 1)
    }
    const start = parseLocal(startDate)
    start.setHours(0, 0, 0, 0)
    const end = parseLocal(endDate)
    end.setHours(23, 59, 59, 999)

    return prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        orderNo: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { quantity: true, unitPrice: true } }
      }
    })
  }
})
