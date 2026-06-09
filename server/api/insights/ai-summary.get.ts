import { H3Error } from 'h3'
import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'
import {
  executeAiTextRequest,
  executeDifyTextRequest,
  getAiErrorMessage
} from '~~/server/utils/ai-client'
import { resolveAiConfig } from '~~/server/utils/ai-config'

const SYSTEM_PROMPT = `
你是一位拥有 10 年经验的零售数据分析专家。
你将收到一段本周销售 JSON，包含商品名、销量、库存余量等字段。

输出要求：
1. 严禁废话，不要寒暄，不要解释模型能力。
2. 严格输出三个模块，且按以下标题顺序：
【经营红榜】
【库存预警】
【策略建议】
3. 【经营红榜】只写卖得最好的关键信息，聚焦销售额与销量贡献。
4. 【库存预警】只写快断货商品及风险。
5. 【策略建议】给出下周可执行动作，必须包含库存动作与销售动作。
6. 语气专业、冷静、大气，文字要有穿透力。
`.trim()

const getWeekStart = (date: Date) => {
  const day = date.getDay()
  const offset = (day + 6) % 7
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const nonce = typeof query.nonce === 'string' ? query.nonce.trim() : ''
    const config = useRuntimeConfig(event)
    const aiConfig = resolveAiConfig(config)
    const {
      aiApiKey,
      aiModel,
      candidateUrls,
      isMiniMaxProvider,
      legacyCandidateUrls,
      isDifyProvider,
      difyApiKey,
      difyApiUrl,
      difyAppId
    } = aiConfig

    const now = new Date()
    const weekStart = getWeekStart(now)

    const [weeklyOrderItems, products, weeklyOrderCount] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          order: {
            status: ORDER_STATUS.COMPLETED,
            createdAt: { gte: weekStart }
          }
        },
        select: {
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stock: true,
              minStock: true
            }
          }
        }
      }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          minStock: true
        },
        orderBy: [{ stock: 'asc' }, { minStock: 'desc' }]
      }),
      prisma.order.count({
        where: {
          status: ORDER_STATUS.COMPLETED,
          createdAt: { gte: weekStart }
        }
      })
    ])

    const salesMap = new Map<
      string,
      {
        productId: string
        name: string
        sku: string
        soldQuantity: number
        salesAmount: number
        stock: number
        minStock: number
      }
    >()

    for (const item of weeklyOrderItems) {
      const key = item.product.id
      const current = salesMap.get(key)
      const amount = Number(item.unitPrice) * item.quantity
      if (current) {
        current.soldQuantity += item.quantity
        current.salesAmount += amount
      } else {
        salesMap.set(key, {
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          soldQuantity: item.quantity,
          salesAmount: amount,
          stock: item.product.stock,
          minStock: item.product.minStock
        })
      }
    }

    const weeklySales = Array.from(salesMap.values())
      .map((item) => ({
        ...item,
        salesAmount: Number(item.salesAmount.toFixed(2))
      }))
      .sort((a, b) => b.salesAmount - a.salesAmount)

    const top3BySalesAmount = weeklySales.slice(0, 3)
    const inventoryWarnings = products
      .filter((item) => item.stock <= item.minStock)
      .map((item) => ({
        productId: item.id,
        name: item.name,
        sku: item.sku,
        stock: item.stock,
        minStock: item.minStock
      }))

    const payload = {
      nonce,
      weekStart,
      weekEnd: now,
      weeklyOrderCount,
      weeklySales,
      top3BySalesAmount,
      inventoryWarnings
    }

    const userPrompt = `
以下是本周销售 JSON，请严格按照 System Prompt 输出：
${JSON.stringify(payload)}
`.trim()

    const toMoney = (value: number) => `¥${value.toFixed(2)}`

    const buildFallbackSummary = () => {
      const weeklyAmount = Number(
        weeklySales.reduce((sum, item) => sum + item.salesAmount, 0).toFixed(2)
      )
      const topItem = top3BySalesAmount[0]
      const warningPreview = inventoryWarnings.slice(0, 3)
      const warningText = warningPreview.length
        ? warningPreview.map((item) => `${item.name}(${item.stock}/${item.minStock})`).join('、')
        : '当前无低于预警线商品'

      return [
        '【经营红榜】',
        topItem
          ? `本周累计成交 ${toMoney(weeklyAmount)}，共 ${weeklyOrderCount} 单；Top1 为 ${topItem.name}，销量 ${topItem.soldQuantity}，销售额 ${toMoney(topItem.salesAmount)}。`
          : `本周累计成交 ${toMoney(weeklyAmount)}，共 ${weeklyOrderCount} 单；暂无明显热销商品。`,
        '',
        '【库存预警】',
        `${warningText}。`,
        '',
        '【策略建议】',
        '库存动作：对预警商品按近 7 日销量补货，优先保障 Top 商品不断货；销售动作：围绕 Top 商品做组合促销并同步提高关联品曝光。'
      ].join('\n')
    }

    let summaryText = ''
    let remoteFailures: string[] = []
    let source: 'dify' | 'remote' | 'fallback' = 'fallback'

    if (isDifyProvider) {
      if (!difyApiKey) {
        remoteFailures = ['Dify API Key is not configured. Please set NUXT_DIFY_API_KEY.']
      } else {
        const difyUser = difyAppId ? `user_${difyAppId}:ai-summary` : 'user_ai-summary'
        const { text, remoteFailures: difyFailures } = await executeDifyTextRequest({
          difyApiKey,
          difyApiUrl,
          query: '请根据以下数据生成周报，严格按照你被设定的角色输出经营红榜、库存预警、策略建议三个模块。',
          user: difyUser,
          inputs: {
            report_time: now.toLocaleString('zh-CN'),
            week_start: weekStart.toLocaleString('zh-CN'),
            week_end: now.toLocaleString('zh-CN'),
            weekly_order_count: String(weeklyOrderCount),
            weekly_sales: JSON.stringify(weeklySales),
            top3_by_sales_amount: JSON.stringify(top3BySalesAmount),
            inventory_warnings: JSON.stringify(inventoryWarnings)
          }
        })
        summaryText = text
        remoteFailures = difyFailures
        source = text ? 'dify' : 'fallback'
      }
    } else if (aiApiKey) {
      const result = await executeAiTextRequest({
        aiApiKey,
        aiModel,
        candidateUrls,
        legacyCandidateUrls,
        isMiniMaxProvider,
        openAiMessages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        legacyMessages: [{ sender_type: 'USER', sender_name: 'user', text: userPrompt }],
        systemPrompt: SYSTEM_PROMPT,
        botName: 'LiteMart POS',
        temperature: 0.3,
        maxTokens: 1500,
        preferLegacyFirst: true
      })
      summaryText = result.text
      remoteFailures = result.remoteFailures
      source = result.text ? 'remote' : 'fallback'
    }

    let summary = summaryText
    const usedFallback = !summary
    if (usedFallback) {
      summary = buildFallbackSummary()
    }

    return {
      summary,
      batch: nonce || String(Date.now()),
      generatedAt: now.toISOString(),
      source,
      failureCount: remoteFailures.length,
      weekStart,
      weeklyOrderCount,
      top3BySalesAmount,
      inventoryWarnings
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '生成 AI 简报失败'
    })
  }
})
