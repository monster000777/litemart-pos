import { prisma } from '~~/server/lib/prisma'
import { ORDER_STATUS } from '~~/shared/constants/order'

const parseDateInput = (input: string, fieldLabel: string) => {
  const value = input.trim()
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `${fieldLabel} 日期格式错误`
    })
  }
  return date
}

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
    if (status !== ORDER_STATUS.COMPLETED && status !== ORDER_STATUS.REFUNDED) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '订单状态参数不合法'
      })
    }
    where.status = status
  }

  if (search) {
    where.OR = [{ orderNo: { contains: search } }, { customerTail: { contains: search } }]
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    const parsedFrom = parseDateInput(dateFrom, '开始')
    const parsedTo = parseDateInput(dateTo, '结束')

    if (parsedFrom) {
      createdAt.gte = parsedFrom
    }
    if (parsedTo) {
      parsedTo.setHours(23, 59, 59, 999)
      createdAt.lte = parsedTo
    }

    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '开始日期不能晚于结束日期'
      })
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
