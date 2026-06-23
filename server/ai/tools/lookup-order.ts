import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '~~/server/lib/prisma'

/**
 * 通过订单 ID 查询订单详情，包含商品明细与状态。
 *
 * 骨架示例 —— 用于验证 tool calling 链路打通。
 * 后续可按需在 `~~/server/ai/tools/` 下新增更多 tool 并在 chat.post.ts 注册。
 */
export const lookupOrderTool = tool({
  description: '通过订单 ID 查询订单详情，包含商品明细与状态。',
  inputSchema: z.object({
    orderId: z.string().min(1).describe('订单 ID')
  }),
  execute: async ({ orderId }) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true } }
          }
        }
      }
    })
    return order ?? null
  }
})
