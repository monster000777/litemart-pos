import { H3Error } from 'h3'
import { updateSupplier } from '~~/server/services/supplier-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少供应商 ID'
      })
    }

    const body = await readBody(event)
    const supplier = await updateSupplier(id, body)

    await writeAuditLog(
      AUDIT_ACTIONS.SUPPLIER_UPDATE,
      `更新供应商「${supplier.name}」`,
      getClientIp(event)
    )

    return supplier
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '更新供应商失败'
    })
  }
})
