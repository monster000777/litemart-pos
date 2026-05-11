import { H3Error } from 'h3'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { deleteCustomer } from '~~/server/services/customer-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少会员 ID'
      })
    }

    await deleteCustomer(id)

    await writeAuditLog(AUDIT_ACTIONS.MEMBER_DELETE, `删除会员 ${id}`, getClientIp(event))

    return { success: true }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '删除会员失败'
    })
  }
})
