import { H3Error } from 'h3'
import {
  createSessionToken,
  hashPin,
  isValidPinFormat,
  verifyPin
} from '~~/server/services/auth-service'
import { createAuthConfigIfMissing, getAuthConfig } from '~~/server/services/auth-config-service'
import {
  createAuthUser,
  ensureLegacyAdminUserMigrated,
  findAuthUserByName
} from '~~/server/services/auth-user-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'
import { getPinRateLimiter } from '~~/server/utils/rate-limiter'
import { getClientIp } from '~~/server/utils/request'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { USER_ROLES } from '~~/shared/constants/rbac'

type LoginBody = {
  uid?: string
  pin?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<LoginBody>(event)
    const uid = body.uid?.trim() ?? ''
    const pin = body.pin?.trim() ?? ''

    if (!uid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '请输入账号名称'
      })
    }

    if (!isValidPinFormat(pin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 格式错误'
      })
    }

    const limiter = getPinRateLimiter()
    const clientIp = getClientIp(event)
    const lockSeconds = limiter.check(clientIp)
    if (lockSeconds !== null) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: `操作过于频繁，请 ${lockSeconds} 秒后重试`,
        data: { lockSeconds }
      })
    }

    const config = useRuntimeConfig(event)
    const authSecret = String(config.authSecret || '').trim()
    const bootstrapPin = String(config.adminPin || '').trim()

    if (!authSecret) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: '缺少 NUXT_AUTH_SECRET 配置'
      })
    }

    let authConfig = await getAuthConfig()

    if (!authConfig) {
      if (!bootstrapPin || !isValidPinFormat(bootstrapPin)) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Conflict',
          message: '系统尚未初始化管理员 PIN，请先完成注册'
        })
      }

      const hashedPin = await hashPin(bootstrapPin)
      await createAuthConfigIfMissing(hashedPin)
      await createAuthUser({ name: '管理员', pinHash: hashedPin, role: USER_ROLES.ADMIN })
      authConfig = await getAuthConfig()
      if (!authConfig) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          message: '初始化登录配置失败'
        })
      }
    }

    await ensureLegacyAdminUserMigrated()

    const user = await findAuthUserByName(uid)
    if (!user || user.status !== 'ACTIVE') {
      await writeAuditLog(AUDIT_ACTIONS.LOGIN_FAILED, `账号不存在或已停用：${uid}`, clientIp)
      const newLockSeconds = limiter.recordFailure(clientIp)
      if (newLockSeconds !== null) {
        throw createError({
          statusCode: 429,
          statusMessage: 'Too Many Requests',
          message: `连续输错 5 次，请 ${newLockSeconds} 秒后重试`,
          data: { lockSeconds: newLockSeconds }
        })
      }
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: '账号不存在或已停用'
      })
    }

    const pinValid = await verifyPin(pin, user.pinHash)
    if (!pinValid) {
      await writeAuditLog(AUDIT_ACTIONS.LOGIN_FAILED, `PIN 错误：${uid}`, clientIp)
      const newLockSeconds = limiter.recordFailure(clientIp)
      if (newLockSeconds !== null) {
        throw createError({
          statusCode: 429,
          statusMessage: 'Too Many Requests',
          message: `连续输错 5 次，请 ${newLockSeconds} 秒后重试`,
          data: { lockSeconds: newLockSeconds }
        })
      }
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'PIN 错误'
      })
    }

    limiter.reset(clientIp)
    await writeAuditLog(AUDIT_ACTIONS.LOGIN, `登录成功：${user.name}`, clientIp)

    const token = createSessionToken(authSecret, user.id)
    setCookie(event, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: !import.meta.dev,
      path: '/',
      maxAge: AUTH_MAX_AGE_SECONDS
    })

    return {
      success: true,
      role: user.role
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '登录失败，请稍后重试'
    })
  }
})
