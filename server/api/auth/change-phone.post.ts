import { H3Error } from 'h3'
import { verifyOtp } from '~~/server/services/otp-service'
import { findAuthUserByPhone, updateAuthUser } from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

type ChangePhoneBody = {
  phone: string
  code: string
}

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.auth?.user
    if (!authUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: '未登录'
      })
    }

    const body = await readBody<ChangePhoneBody>(event)
    const { phone, code } = body

    if (!phone || !/^1\d{10}$/.test(phone)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号格式错误'
      })
    }

    if (!code || !/^\d{6}$/.test(code)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '验证码格式错误'
      })
    }

    // Verify OTP
    const otpValid = verifyOtp(phone, code)
    if (!otpValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '验证码错误或已过期'
      })
    }

    // Check if phone already registered
    const existing = await findAuthUserByPhone(phone)
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '该手机号已被注册'
      })
    }

    // Update phone
    await updateAuthUser(authUser.id, { phone })
    await writeAuditLog(
      AUDIT_ACTIONS.AUTH_USER_UPDATE,
      `更换绑定手机号: ${authUser.phone} -> ${phone}`,
      getClientIp(event)
    )

    return {
      success: true,
      phone
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '更换手机号失败'
    })
  }
})
