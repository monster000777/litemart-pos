import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async () => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [orderCount, refundedCount, productCount, todayOrderCount, todayTotals, products] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: ORDER_STATUS.REFUNDED } }),
    prisma.product.count(),
    prisma.order.count({
      where: {
        status: ORDER_STATUS.COMPLETED,
        createdAt: { gte: startOfDay, lt: nextDay }
      }
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: ORDER_STATUS.COMPLETED,
        createdAt: { gte: startOfDay, lt: nextDay }
      }
    }),
    prisma.product.findMany({
      select: {
        stock: true,
        minStock: true
      }
    })
  ])

  const totals = await prisma.order.aggregate({
    _sum: {
      totalAmount: true
    },
    where: {
      status: ORDER_STATUS.COMPLETED
    }
  })

  const warningCount = products.filter((item) => item.stock <= item.minStock).length

  return {
    orderCount,
    refundedCount,
    productCount,
    grossAmount: Number(totals._sum.totalAmount ?? 0),
    todayAmount: Number(todayTotals._sum.totalAmount ?? 0),
    todayOrderCount,
    warningCount
  }
})
