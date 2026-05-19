import { H3Error } from 'h3'
import { hashPin, isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import {
  findAuthUserByPhone,
  findAuthUserByUid,
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
        message: '旧密码格式错误'
      })
    }

    if (!isValidPinFormat(newPin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新密码格式错误'
      })
    }

    if (newPin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的新密码不一致'
      })
    }

    if (uid && oldPin === newPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '新密码不能与旧密码相同'
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

    // For UID reset, check if logged in user is resetting someone else's password
    if (uid && userId && user.id !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '只能修改自己的密码'
      })
    }

    // If using UID to reset (e.g. from settings page), verify old password
    if (uid) {
      const isOldPinValid = await verifyPin(oldPin, user.pinHash)
      if (!isOldPinValid) {
        const newLockSeconds = limiter.recordFailure(clientIp)
        if (newLockSeconds !== null) {
          throw createError({
            statusCode: 429,
            statusMessage: 'Too Many Requests',
            message: `旧密码错误，连续输错 5 次，请 ${newLockSeconds} 秒后重试`,
            data: { lockSeconds: newLockSeconds }
          })
        }
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: '旧密码错误'
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

    const hashedNewPin = await hashPin(newPin)
    await updateAuthUserPin(user.id, hashedNewPin)
    limiter.reset(clientIp)

    await writeAuditLog(
      AUDIT_ACTIONS.RESET_PIN,
      `重置了 ${user.uid} (${user.phone}) 的密码`,
      clientIp
    )

    return {
      success: true,
      message: '密码重置成功'
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '密码重置失败，请稍后重试'
    })
  }
})
