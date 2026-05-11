import { H3Error } from 'h3'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { updateCustomer } from '~~/server/services/customer-service'
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

    const body = await readBody<{ name?: string; level?: string }>(event)
    const customer = await updateCustomer(id, body)

    await writeAuditLog(
      AUDIT_ACTIONS.MEMBER_UPDATE,
      `更新会员 ${customer.phone}`,
      getClientIp(event)
    )

    return customer
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '更新会员失败'
    })
  }
})
