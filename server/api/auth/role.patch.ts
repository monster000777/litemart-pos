import { H3Error } from 'h3'
import { createSessionToken, isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'
import { isUserRole, ROLE_LABELS, USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

type UpdateRoleBody = {
  role?: UserRole
  pin?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<UpdateRoleBody>(event)
    const nextRole = body.role
    const pin = body.pin?.trim() ?? ''

    if (!isUserRole(nextRole)) {
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

    const authUser = event.context.auth?.user
    if (!authUser || authUser.role !== USER_ROLES.ADMIN) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '仅管理员可切换角色视图'
      })
    }

    const matched = await verifyPin(pin, authUser.pinHash)
    if (!matched) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'PIN 码错误'
      })
    }

    if (event.context.auth?.role === nextRole) {
      return {
        success: true,
        role: nextRole
      }
    }

    const authSecret = String(useRuntimeConfig(event).authSecret || '').trim()
    if (!authSecret) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: '缺少 NUXT_AUTH_SECRET 配置'
      })
    }

    const token = createSessionToken(authSecret, authUser.id, {
      viewRole: nextRole === USER_ROLES.ADMIN ? undefined : nextRole
    })
    setCookie(event, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: !import.meta.dev,
      path: '/',
      maxAge: AUTH_MAX_AGE_SECONDS
    })

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
