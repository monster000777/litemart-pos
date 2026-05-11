import { H3Error } from 'h3'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { createCustomer } from '~~/server/services/customer-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ phone?: string; name?: string }>(event)
    const customer = await createCustomer({
      phone: body.phone || '',
      name: body.name
    })

    await writeAuditLog(
      AUDIT_ACTIONS.MEMBER_CREATE,
      `新增会员 ${customer.phone}`,
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
      message: '新增会员失败'
    })
  }
})
