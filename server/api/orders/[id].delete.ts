import { H3Error } from 'h3'
import { prisma } from '~~/server/lib/prisma'
import { writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

const AUDIT_ACTIONS = {
  DELETE: 'DELETE'
} as const

export default defineEventHandler(async (event) => {
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
    include: { items: true }
  })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '订单不存在'
    })
  }

  try {
    await prisma.order.delete({
      where: { id: orderId }
    })

    await writeAuditLog(
      AUDIT_ACTIONS.DELETE,
      `删除订单 ${order.orderNo}，金额 ￥${Number(order.totalAmount).toFixed(2)}，含 ${order.items.length} 个商品`,
      getClientIp(event)
    )

    return { success: true, orderNo: order.orderNo }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '删除订单失败'
    })
  }
})
