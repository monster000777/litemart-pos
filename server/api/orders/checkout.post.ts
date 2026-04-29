import { H3Error } from 'h3'
import { createOrderAtomic, type CreateOrderInput } from '~~/server/services/order-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateOrderInput>(event)
    const result = await createOrderAtomic(body)

    await writeAuditLog(
      AUDIT_ACTIONS.CHECKOUT,
      `订单 ${result.orderNo}，金额 ¥${result.totalAmount.toFixed(2)}`,
      getClientIp(event)
    )

    return {
      id: result.id,
      orderNo: result.orderNo,
      totalAmount: result.totalAmount,
      status: result.status,
      createdAt: result.createdAt
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '核销失败，请稍后重试'
    })
  }
})
