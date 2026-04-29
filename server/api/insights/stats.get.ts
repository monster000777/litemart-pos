import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'

type DailyRow = {
  day: string
  amount: number | string | null
}

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

  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT
      strftime('%Y-%m-%d', "createdAt", 'localtime') AS day,
      COALESCE(SUM("totalAmount"), 0) AS amount
    FROM "Order"
    WHERE "status" = ${ORDER_STATUS.COMPLETED}
      AND "createdAt" >= ${startDate}
      AND "createdAt" < ${endDate}
    GROUP BY strftime('%Y-%m-%d', "createdAt", 'localtime')
    ORDER BY day ASC
  `

  const amountMap = new Map(
    rows.map((row) => [row.day, Number(row.amount ?? 0)])
  )

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

  const productIds = topItems.map(tp => tp.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  })
  
  const productMap = new Map(products.map(p => [p.id, p.name]))

  const topProducts = topItems.map(tp => ({
    name: productMap.get(tp.productId) || '未知商品',
    quantity: tp._sum.quantity || 0
  }))

  return {
    trend,
    topProducts
  }
})
