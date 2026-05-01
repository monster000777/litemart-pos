import { H3Error } from 'h3'
import { cancelPurchaseOrder } from '~~/server/services/purchase-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少采购单 ID'
      })
    }

    const result = await cancelPurchaseOrder(id)

    await writeAuditLog(
      AUDIT_ACTIONS.PURCHASE_CANCEL,
      `采购单 ${result.orderNo} 已取消`,
      getClientIp(event)
    )

    return result
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '取消操作失败'
    })
  }
})
