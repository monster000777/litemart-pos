import { H3Error } from 'h3'
import { generateMockOtp } from '~~/server/services/otp-service'
import { findAuthUserByPhone } from '~~/server/services/auth-user-service'
import { getPinRateLimiter } from '~~/server/utils/rate-limiter'
import { getClientIp } from '~~/server/utils/request'

type SendOtpBody = {
  phone?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<SendOtpBody>(event)
    const phone = body.phone?.trim() ?? ''

    if (!phone || !/^1\d{10}$/.test(phone)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号格式错误（需为 11 位数字）'
      })
    }

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

    // For change phone scenario, we need to check the phone is NOT already registered
    const existing = await findAuthUserByPhone(phone)
    if (existing) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '该手机号已被注册'
      })
    }

    // Generate and send mock OTP
    const code = await generateMockOtp(phone)

    return {
      success: true,
      message: '验证码发送成功',
      mockCode: import.meta.dev ? code : undefined
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '发送验证码失败，请稍后重试'
    })
  }
})
