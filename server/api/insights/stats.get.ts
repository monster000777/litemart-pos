import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'

const formatDayKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatLabel = (dayKey: string) => {
  const [, month, day] = dayKey.split('-')
  return `${month}-${day}`
}

export default defineEventHandler(async () => {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const completedOrders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.COMPLETED,
      createdAt: { gte: startDate, lt: endDate }
    },
    select: {
      createdAt: true,
      totalAmount: true
    }
  })

  const amountMap = new Map<string, number>()
  for (const order of completedOrders) {
    const key = formatDayKey(order.createdAt)
    const nextAmount = (amountMap.get(key) ?? 0) + Number(order.totalAmount)
    amountMap.set(key, nextAmount)
  }

  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    const key = formatDayKey(date)

    return {
      date: key,
      label: formatLabel(key),
      amount: Number((amountMap.get(key) ?? 0).toFixed(2))
    }
  })

  const topItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: {
      order: {
        status: ORDER_STATUS.COMPLETED,
        createdAt: { gte: startDate, lt: endDate }
      }
    },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5
  })

  const productIds = topItems.map((tp) => tp.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  })

  const productMap = new Map(products.map((p) => [p.id, p.name]))

  const topProducts = topItems.map((tp) => ({
    name: productMap.get(tp.productId) || '未知商品',
    quantity: tp._sum.quantity || 0
  }))

  return {
    trend,
    topProducts
  }
})
