import { createError } from 'h3'
import { prisma } from '~~/server/lib/prisma'
import { ORDER_STATUS } from '~~/shared/constants/order'

export const refundOrderAtomic = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true
        }
      }
    }
  })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '订单不存在'
    })
  }

  if (order.status === ORDER_STATUS.REFUNDED) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: '该订单已退款'
    })
  }

  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '仅已完成订单可退款'
    })
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: ORDER_STATUS.COMPLETED },
      data: { status: ORDER_STATUS.REFUNDED }
    })

    if (updated.count === 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '订单状态已变更，请刷新后重试'
      })
    }

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity }
        }
      })
    }

    if (order.memberId) {
      const delta = order.pointsUsed - order.pointsEarned
      if (delta !== 0) {
        await tx.customer.update({
          where: { id: order.memberId },
          data: {
            points: { increment: delta }
          }
        })

        await tx.pointLog.create({
          data: {
            customerId: order.memberId,
            orderId: order.id,
            change: delta,
            reason: '退款积分回滚'
          }
        })
      }
    }
  })

  return order
}
