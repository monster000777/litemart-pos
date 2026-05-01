import { H3Error } from 'h3'
import { createSupplier } from '~~/server/services/supplier-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body.name?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '供应商名称不能为空'
      })
    }

    const supplier = await createSupplier(body)
    await writeAuditLog(
      AUDIT_ACTIONS.SUPPLIER_CREATE,
      `新增供应商「${supplier.name}」`,
      getClientIp(event)
    )
    return supplier
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '新增供应商失败'
    })
  }
})
