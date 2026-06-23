import { ORDER_STATUS } from '~~/shared/constants/order'
import type { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

const getTodayStart = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate())

const getWeekStart = (todayStart: Date) => new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

export const buildBiContext = async (prisma: DbClient) => {
  const now = new Date()
  const todayStart = getTodayStart(now)
  const weekStart = getWeekStart(todayStart)

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

  const recentItems = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: weekStart } } },
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
  for (const item of recentItems) {
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
  }

  const allProducts = await prisma.product.findMany({
    select: { name: true, stock: true, minStock: true }
  })
  const lowStockProducts = allProducts.filter((product) => product.stock <= product.minStock)

  const recentLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { action: true, detail: true, createdAt: true }
  })

  return {
    reportTime: now.toLocaleString('zh-CN'),
    todayHourlyStats: hourlyTraffic,
    recent7DaysProductStats: productStats,
    lowStockWarnings: lowStockProducts,
    recentAuditLogs: recentLogs
  }
}
