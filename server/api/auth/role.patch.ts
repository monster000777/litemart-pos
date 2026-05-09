import { H3Error } from 'h3'
import { isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getAuthConfig, updateAuthRole } from '~~/server/services/auth-config-service'
import { getClientIp } from '~~/server/utils/request'
import { ALL_USER_ROLES, isUserRole, ROLE_LABELS, type UserRole } from '~~/shared/constants/rbac'

type UpdateRoleBody = {
  role?: UserRole
  pin?: string
}

const ALLOWED_ROLES = new Set<UserRole>(ALL_USER_ROLES)

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<UpdateRoleBody>(event)
    const nextRole = body.role
    const pin = body.pin?.trim() ?? ''

    if (!isUserRole(nextRole) || !ALLOWED_ROLES.has(nextRole)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '角色参数无效'
      })
    }

    if (!isValidPinFormat(pin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 码格式错误'
      })
    }

    const authConfig = await getAuthConfig()
    if (!authConfig) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '尚未初始化管理员 PIN，请先完成注册'
      })
    }

    const matched = await verifyPin(pin, authConfig.adminPin)
    if (!matched) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'PIN 码错误'
      })
    }

    if (authConfig.role === nextRole) {
      return {
        success: true,
        role: nextRole
      }
    }

    await updateAuthRole(nextRole)
    await writeAuditLog(
      AUDIT_ACTIONS.ROLE_SWITCH,
      `角色切换为「${ROLE_LABELS[nextRole]}」`,
      getClientIp(event)
    )

    return {
      success: true,
      role: nextRole
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '切换角色失败，请稍后重试'
    })
  }
})
