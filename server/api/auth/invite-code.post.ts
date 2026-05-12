import { H3Error } from 'h3'
import { getAuthConfig, updateInviteCode } from '~~/server/services/auth-config-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { USER_ROLES, roleHasAtLeast } from '~~/shared/constants/rbac'

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.auth?.user
    if (!authUser || !roleHasAtLeast(authUser.role, USER_ROLES.MANAGER)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '仅店长和管理员可刷新邀请码'
      })
    }

    const config = await getAuthConfig()
    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '系统尚未初始化'
      })
    }

    const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    await updateInviteCode(newInviteCode)

    await writeAuditLog(
      AUDIT_ACTIONS.INVITE_CODE_UPDATE,
      `管理员刷新了员工注册邀请码`,
      getClientIp(event)
    )

    return {
      success: true,
      inviteCode: newInviteCode
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '刷新邀请码失败'
    })
  }
})
