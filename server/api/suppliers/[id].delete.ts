import { H3Error } from 'h3'
import { deleteSupplier, getSupplierById } from '~~/server/services/supplier-service'
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

    const supplier = await getSupplierById(id)
    if (!supplier) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '供应商不存在'
      })
    }

    await deleteSupplier(id)

    await writeAuditLog(
      AUDIT_ACTIONS.SUPPLIER_DELETE,
      `删除供应商「${supplier.name}」`,
      getClientIp(event)
    )

    return { success: true }
  } catch (error) {
    if (error instanceof H3Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '删除供应商失败'
    })
  }
})
