import { H3Error } from 'h3'
import { receivePurchaseOrder } from '~~/server/services/purchase-service'
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

    const result = await receivePurchaseOrder(id)

    await writeAuditLog(
      AUDIT_ACTIONS.PURCHASE_RECEIVE,
      `采购单 ${result.orderNo} 已入库`,
      getClientIp(event)
    )

    return result
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '入库操作失败'
    })
  }
})
