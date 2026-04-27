import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async () => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
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
  })

  return orders.map((order) => ({
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
  }))
})
