import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '~~/server/lib/prisma'

/**
 * 通过业务订单号（orderNo，如 LM20260623987908）查询订单详情。
 *
 * 骨架示例 —— 用于验证 tool calling 链路打通。
 * 后续可按需在 `~~/server/ai/tools/` 下新增更多 tool 并在 chat.post.ts 注册。
 */
export const lookupOrderTool = tool({
  description: '通过业务订单号（如 LM20260623987908）查询订单详情，包含商品明细与状态。',
  inputSchema: z.object({
    orderNo: z.string().min(1).describe('业务订单号，格式如 LM20260623987908')
  }),
  execute: async ({ orderNo }) => {
    const order = await prisma.order.findUnique({
      where: { orderNo },
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
