import { AUTH_COOKIE_NAME } from '~~/shared/constants/auth'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

export default defineEventHandler(async (event) => {
  await writeAuditLog(AUDIT_ACTIONS.LOGOUT, '退出登录', getClientIp(event))

  deleteCookie(event, AUTH_COOKIE_NAME, {
    path: '/'
  })

  return {
    success: true
  }
})
