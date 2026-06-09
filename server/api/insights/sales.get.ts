import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'

/**
 * Dify HTTP Tool 专用接口：近7天销售明细 + 退款率
 * Dify Agent 在「看看今天销售 / 退款率」流程中调用此接口。
 */
export default defineEventHandler(async () => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  // 近7天分时订单（当日）
  const todayOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: todayStart },
      status: { in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED] }
    },
    select: { createdAt: true, status: true, totalAmount: true }
  })

  const hourlyTraffic: Record<number, { orders: number; revenue: number }> = {}
  for (const order of todayOrders) {
    const hour = order.createdAt.getHours()
    if (!hourlyTraffic[hour]) hourlyTraffic[hour] = { orders: 0, revenue: 0 }
    hourlyTraffic[hour].orders += 1
    if (order.status === ORDER_STATUS.COMPLETED) {
      hourlyTraffic[hour].revenue += Number(order.totalAmount)
    }
  }

  // 近7天商品维度销量+退款
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
    { sold_qty: number; sold_amount: number; refunded_qty: number }
  > = {}
  for (const item of recentItems) {
    const name = item.product.name
    if (!productStats[name]) {
      productStats[name] = { sold_qty: 0, sold_amount: 0, refunded_qty: 0 }
    }
    if (item.order.status === ORDER_STATUS.COMPLETED) {
      productStats[name].sold_qty += item.quantity
      productStats[name].sold_amount +=
        Math.round(item.quantity * Number(item.unitPrice) * 100) / 100
    } else if (item.order.status === ORDER_STATUS.REFUNDED) {
      productStats[name].refunded_qty += item.quantity
    }
  }

  // 整体退款率
  let totalSoldQty = 0
  let totalRefundedQty = 0
  for (const stat of Object.values(productStats)) {
    totalSoldQty += stat.sold_qty
    totalRefundedQty += stat.refunded_qty
  }
  const totalQty = totalSoldQty + totalRefundedQty
  const overallRefundRate = totalQty > 0
    ? Math.round((totalRefundedQty / totalQty) * 10000) / 100
    : null

  return {
    report_time: now.toLocaleString('zh-CN'),
    today_hourly_stats: hourlyTraffic,
    overall_refund_rate_pct: overallRefundRate,
    product_stats: productStats
  }
})
