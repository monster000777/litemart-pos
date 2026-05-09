import { H3Error } from 'h3'
import { hashPin, isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import {
  findAuthUserById,
  findAuthUserByPin,
  isPinInUse,
  updateAuthUserPin
} from '~~/server/services/auth-user-service'
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

    // 速率限制检查（必须在任何昂贵 PIN 运算之前）
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

    // 支持两种路径：已认证（session）/ 未认证（旧 PIN 查找）
    const userId = event.context.auth?.user?.id
    let user = userId ? await findAuthUserById(userId) : null
    let pinAlreadyVerified = false

    if (!user) {
      user = await findAuthUserByPin(oldPin)
      pinAlreadyVerified = !!user // findAuthUserByPin 内部已做 verifyPin
    }

    if (!user || user.status !== 'ACTIVE') {
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
        message: '旧 PIN 码错误或账号已停用'
      })
    }

    // 通过 session 找到用户时，仍需验证旧 PIN；通过 PIN 找到时已验证，跳过
    if (!pinAlreadyVerified) {
      const matched = await verifyPin(oldPin, user.pinHash)
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
    }

    // 验证成功，清除限制
    limiter.reset(clientIp)

    if (await isPinInUse(newPin, { excludeUserId: user.id })) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '新 PIN 已被其他账号使用'
      })
    }

    const hashedNewPin = await hashPin(newPin)
    await updateAuthUserPin(user.id, hashedNewPin)
    await writeAuditLog(AUDIT_ACTIONS.RESET_PIN, `PIN 已重置：${user.name}`, clientIp)

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
