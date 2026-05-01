import { H3Error } from 'h3'
import { createPurchaseOrder } from '~~/server/services/purchase-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const order = await createPurchaseOrder(body)

    await writeAuditLog(
      AUDIT_ACTIONS.PURCHASE_CREATE,
      `创建采购单 ${order.orderNo}，供应商「${order.supplier.name}」，金额 ¥${order.totalAmount.toFixed(2)}`,
      getClientIp(event)
    )

    return order
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '创建采购单失败'
    })
  }
})
