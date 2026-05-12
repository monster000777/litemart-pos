import { H3Error } from 'h3'
import { hashPin, isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import {
  findAuthUserByPhone,
  findAuthUserByUid,
  isPinInUse,
  updateAuthUserPin
} from '~~/server/services/auth-user-service'
import { verifyOtp } from '~~/server/services/otp-service'
import { getPinRateLimiter } from '~~/server/utils/rate-limiter'
import { getClientIp } from '~~/server/utils/request'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'

type ResetPinBody = {
  uid?: string
  phone?: string
  oldPin?: string
  newPin?: string
  confirmPin?: string
  otpCode?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ResetPinBody>(event)
    const uid = body.uid?.trim() ?? ''
    const phone = body.phone?.trim() ?? ''
    const oldPin = body.oldPin?.trim() ?? ''
    const newPin = body.newPin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''
    const otpCode = body.otpCode?.trim() ?? ''

    if (!uid && !phone) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '请输入员工 UID 或手机号'
      })
    }

    if (phone && !otpCode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '请输入短信验证码'
      })
    }

    if (uid && !isValidPinFormat(oldPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '旧 PIN 格式错误'
      })
    }

    if (!isValidPinFormat(newPin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新 PIN 格式错误'
      })
    }

    if (newPin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的新 PIN 不一致'
      })
    }

    if (uid && oldPin === newPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新 PIN 不能与旧 PIN 相同'
      })
    }

    const userId = event.context.auth?.user?.id

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

    const user = phone ? await findAuthUserByPhone(phone) : await findAuthUserByUid(uid)

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
        message: '账号不存在或已停用'
      })
    }

    // For UID reset, check if logged in user is resetting someone else's PIN
    if (uid && userId && user.id !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '只能修改自己的 PIN'
      })
    }

    // If using UID to reset (e.g. from settings page), verify old PIN
    if (uid) {
      const isOldPinValid = await verifyPin(oldPin, user.pinHash)
      if (!isOldPinValid) {
        const newLockSeconds = limiter.recordFailure(clientIp)
        if (newLockSeconds !== null) {
          throw createError({
            statusCode: 429,
            statusMessage: 'Too Many Requests',
            message: `旧 PIN 错误，连续输错 5 次，请 ${newLockSeconds} 秒后重试`,
            data: { lockSeconds: newLockSeconds }
          })
        }
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: '旧 PIN 错误'
        })
      }
    } else if (phone) {
      // If using phone to reset, verify OTP
      const isOtpValid = verifyOtp(phone, otpCode)
      if (!isOtpValid) {
        const newLockSeconds = limiter.recordFailure(clientIp)
        if (newLockSeconds !== null) {
          throw createError({
            statusCode: 429,
            statusMessage: 'Too Many Requests',
            message: `验证码错误，连续输错 5 次，请 ${newLockSeconds} 秒后重试`,
            data: { lockSeconds: newLockSeconds }
          })
        }
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: '验证码错误或已过期'
        })
      }
    }

    const isNewPinInUse = await isPinInUse(newPin, { excludeUserId: user.id })
    if (isNewPinInUse) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '该 PIN 已被其他账号使用，请使用更复杂的 PIN'
      })
    }

    const hashedNewPin = await hashPin(newPin)
    await updateAuthUserPin(user.id, hashedNewPin)
    limiter.reset(clientIp)

    await writeAuditLog(
      AUDIT_ACTIONS.PIN_RESET,
      `重置了 ${user.uid} (${user.phone}) 的 PIN`,
      clientIp
    )

    return {
      success: true,
      message: 'PIN 重置成功'
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
