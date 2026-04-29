import { H3Error } from 'h3'
import {
  createSessionToken,
  hashPin,
  isValidPinFormat,
  verifyPin
} from '~~/server/services/auth-service'
import { getAuthConfig, updateAuthConfig } from '~~/server/services/auth-config-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'
import { getPinRateLimiter } from '~~/server/utils/rate-limiter'
import { getClientIp } from '~~/server/utils/request'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'

type ResetPinBody = {
  oldPin?: string
  newPin?: string
  confirmPin?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ResetPinBody>(event)
    const oldPin = body.oldPin?.trim() ?? ''
    const newPin = body.newPin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''

    if (!isValidPinFormat(oldPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '旧 PIN 码格式错误'
      })
    }

    if (!isValidPinFormat(newPin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新 PIN 码格式错误'
      })
    }

    if (newPin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的新 PIN 不一致'
      })
    }

    if (oldPin === newPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新 PIN 不能与旧 PIN 相同'
      })
    }

    const config = useRuntimeConfig(event)
    const authSecret = String(config.authSecret || '').trim()

    if (!authSecret) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: '缺少 NUXT_AUTH_SECRET 配置'
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

    // 速率限制检查
    const limiter = getPinRateLimiter()
    const clientIp = getClientIp(event)
    const remainingLock = limiter.check(clientIp)
    if (remainingLock !== null) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: `操作过于频繁，请 ${remainingLock} 秒后重试`,
        data: { lockSeconds: remainingLock }
      })
    }

    const matched = await verifyPin(oldPin, authConfig.adminPin)
    if (!matched) {
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
        message: '旧 PIN 码错误'
      })
    }

    // 验证成功，清除限制
    limiter.reset(clientIp)

    const hashedNewPin = await hashPin(newPin)
    await updateAuthConfig(hashedNewPin)
    await writeAuditLog(AUDIT_ACTIONS.RESET_PIN, 'PIN 已重置', clientIp)

    // 重置后签发新 session
    const token = createSessionToken(authSecret)
    setCookie(event, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: !import.meta.dev,
      path: '/',
      maxAge: AUTH_MAX_AGE_SECONDS
    })

    return {
      success: true
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'PIN 重置失败，请稍后重试'
    })
  }
})
