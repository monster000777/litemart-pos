import { H3Error } from 'h3'
import { prisma } from '~~/server/lib/prisma'
import { ORDER_STATUS } from '~~/shared/constants/order'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const orderId = getRouterParam(event, 'id')
    if (!orderId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少订单 ID'
      })
    }

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
        message: '该订单已退款，不可重复操作'
      })
    }

    if (order.status !== ORDER_STATUS.COMPLETED) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '仅已完成的订单可以退款'
      })
    }

    // 事务：原子检查状态 + 更新订单 + 恢复库存
    // 使用 updateMany + where status 条件防止并发重复退款 (TOCTOU)
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: ORDER_STATUS.COMPLETED },
        data: { status: ORDER_STATUS.REFUNDED }
      })

      if (updated.count === 0) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Conflict',
          message: '该订单已退款或状态已变更，请刷新后重试'
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
    })

    await writeAuditLog(
      AUDIT_ACTIONS.REFUND,
      `退款订单 ${order.orderNo}，金额 ¥${Number(order.totalAmount).toFixed(2)}`,
      getClientIp(event)
    )

    return {
      success: true,
      orderNo: order.orderNo
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '退款失败，请稍后重试'
    })
  }
})
