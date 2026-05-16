import { H3Error } from 'h3'
import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'
import {
  persistChatExchange,
  requireOwnedChatSession
} from '~~/server/services/chat-session-service'
import { executeAiTextRequest, getAiErrorMessage } from '~~/server/utils/ai-client'
import { resolveAiConfig } from '~~/server/utils/ai-config'

const SYSTEM_PROMPT_TEMPLATE = `
你是一位专业的零售数据分析 AI 助手，专门为 LiteMart POS 系统提供 Natural Language BI 服务。请根据以下提供的当前门店经营数据上下文（JSON 格式），来回答用户的提问。
要求：
1. 你的回答必须完全基于提供的 JSON 数据。如果用户问及数据中没有的信息，请明确告知“当前上下文暂无该数据支持”。
2. 保持专业、简明扼要，直接给出结论，避免冗长的铺垫。
3. 如果问到退款率，请通过 (退款数量 / (销售数量 + 退款数量) * 100%) 来计算。如果商品没有卖出也没有退款，则无退款率。
4. 货币单位为人民币（元）。
5. 针对低库存商品，请给出明确的补货建议。
6. 你可以使用 Markdown 加粗（**文本**）来突出重点数据。
【上下文数据】：
###CONTEXT###
`.trim()

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { question, history = [], sessionId } = body

    if (!question) {
      throw createError({ statusCode: 400, message: '问题不能为空' })
    }

    const config = useRuntimeConfig(event)
    const userId = event.context.auth?.user?.id
    const { aiApiKey, aiModel, candidateUrls, isMiniMaxProvider, legacyCandidateUrls } =
      resolveAiConfig(config)

    if (sessionId) {
      await requireOwnedChatSession(prisma, sessionId, userId)
    }

    if (!aiApiKey) {
      return {
        reply:
          '系统未配置 AI API Key，无法进行数据分析。请配置 `NUXT_AI_API_KEY`（或兼容的 `NUXT_MINIMAX_API_KEY`）。'
      }
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart },
        status: { in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED] }
      },
      select: { createdAt: true, status: true, totalAmount: true }
    })

    const hourlyTraffic: Record<number, { orders: number; revenue: number }> = {}
    todayOrders.forEach((order) => {
      const hour = order.createdAt.getHours()
      if (!hourlyTraffic[hour]) hourlyTraffic[hour] = { orders: 0, revenue: 0 }
      hourlyTraffic[hour].orders += 1
      if (order.status === ORDER_STATUS.COMPLETED) {
        hourlyTraffic[hour].revenue += Number(order.totalAmount)
      }
    })

    const recentItems = await prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: weekStart } }
      },
      select: {
        quantity: true,
        unitPrice: true,
        order: { select: { status: true } },
        product: { select: { name: true } }
      }
    })

    const productStats: Record<
      string,
      { soldQuantity: number; soldAmount: number; refundedQuantity: number }
    > = {}
    recentItems.forEach((item) => {
      const name = item.product.name
      if (!productStats[name]) {
        productStats[name] = { soldQuantity: 0, soldAmount: 0, refundedQuantity: 0 }
      }

      if (item.order.status === ORDER_STATUS.COMPLETED) {
        productStats[name].soldQuantity += item.quantity
        productStats[name].soldAmount += item.quantity * Number(item.unitPrice)
      } else if (item.order.status === ORDER_STATUS.REFUNDED) {
        productStats[name].refundedQuantity += item.quantity
      }
    })

    const allProducts = await prisma.product.findMany({
      select: { name: true, stock: true, minStock: true }
    })
    const lowStockProducts = allProducts.filter((product) => product.stock <= product.minStock)

    const recentLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { action: true, detail: true, createdAt: true }
    })

    const contextData = {
      reportTime: now.toLocaleString('zh-CN'),
      todayHourlyStats: hourlyTraffic,
      recent7DaysProductStats: productStats,
      lowStockWarnings: lowStockProducts,
      recentAuditLogs: recentLogs
    }

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
      '###CONTEXT###',
      JSON.stringify(contextData)
    )

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((message: any) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content
      })),
      { role: 'user', content: question }
    ]

    const legacyMessages = history
      .map((message: any) => ({
        sender_type: message.role === 'user' ? 'USER' : 'BOT',
        sender_name: message.role === 'user' ? 'user' : 'bot',
        text: message.content
      }))
      .concat({ sender_type: 'USER', sender_name: 'user', text: question })

    const { text: reply, remoteFailures } = await executeAiTextRequest({
      aiApiKey,
      aiModel,
      candidateUrls,
      legacyCandidateUrls,
      isMiniMaxProvider,
      openAiMessages: messages,
      legacyMessages,
      systemPrompt,
      botName: 'bot',
      temperature: 0.1,
      maxTokens: 800
    })

    if (!reply) {
      const errMessage = remoteFailures.at(-1)?.replace(/^[^:]+:\s*/, '') || '解析大模型回复失败'
      throw createError({ statusCode: 500, message: errMessage })
    }

    if (sessionId && userId) {
      await persistChatExchange(prisma, sessionId, userId, question, reply)
    }

    return { reply }
  } catch (error: any) {
    console.error('Chat BI Error:', error)
    if (error instanceof H3Error) throw error

    const errMessage = getAiErrorMessage(error) || '对话处理失败'
    throw createError({ statusCode: 500, message: errMessage })
  }
})
