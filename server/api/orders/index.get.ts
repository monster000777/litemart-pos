import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const search = String(query.search || '').trim()
  const status = String(query.status || '').trim()
  const dateFrom = String(query.dateFrom || '').trim()
  const dateTo = String(query.dateTo || '').trim()

  // 构建 where 条件
  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status
  }

  if (search) {
    where.OR = [
      { orderNo: { contains: search } },
      { customerTail: { contains: search } }
    ]
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) {
      createdAt.gte = new Date(dateFrom)
    }
    if (dateTo) {
      // dateTo 设为当天结束
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      createdAt.lte = end
    }
    where.createdAt = createdAt
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        }
      }
    }),
    prisma.order.count({ where })
  ])

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      customerTail: order.customerTail,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: item.product
      }))
    })),
    total,
    page,
    pageSize
  }
})
