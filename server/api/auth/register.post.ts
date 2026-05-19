import { H3Error } from 'h3'
import { createSessionToken, hashPin, isValidPinFormat } from '~~/server/services/auth-service'
import { verifyOtp } from '~~/server/services/otp-service'
import { createAuthConfigIfMissing, getAuthConfig } from '~~/server/services/auth-config-service'
import {
  countAuthUsers,
  createAuthUser,
  findAuthUserByPhone
} from '~~/server/services/auth-user-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

type RegisterBody = {
  phone?: string
  pin?: string
  confirmPin?: string
  inviteCode?: string
  otpCode?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<RegisterBody>(event)
    const phone = body.phone?.trim() ?? ''
    const pin = body.pin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''
    const inviteCode = body.inviteCode?.trim() ?? ''

    if (!phone || !/^1\d{10}$/.test(phone)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号格式错误（需为 11 位数字）'
      })
    }

    // Verify OTP
    const otpCode = body.otpCode?.trim() ?? ''
    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '验证码格式错误'
      })
    }
    const otpValid = verifyOtp(phone, otpCode)
    if (!otpValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '验证码错误或已过期'
      })
    }

    if (!isValidPinFormat(pin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '密码格式错误'
      })
    }

    if (pin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的密码不一致'
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

    if (isValidPinFormat(bootstrapPin)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '系统已配置初始化管理员密码，请直接登录'
      })
    }

    const existingConfig = await getAuthConfig()
    const userCount = await countAuthUsers()

    let finalRole: UserRole = USER_ROLES.CASHIER

    if (userCount === 0) {
      // 首次初始化，不需要邀请码，直接注册为 ADMIN
      finalRole = USER_ROLES.ADMIN
    } else {
      // 非首次初始化，必须提供正确的邀请码
      if (!inviteCode) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '需要邀请码才能注册员工账号'
        })
      }

      if (!existingConfig || existingConfig.inviteCode !== inviteCode) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden',
          message: '邀请码错误或已失效'
        })
      }
    }

    const existingUser = await findAuthUserByPhone(phone)
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '该手机号已被注册'
      })
    }

    const hashedPin = await hashPin(pin)

    if (userCount === 0) {
      // 生成初始邀请码
      const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      await createAuthConfigIfMissing(hashedPin, USER_ROLES.ADMIN, newInviteCode)
    }

    const uid = Math.floor(10000000 + Math.random() * 90000000).toString()

    const userId = await createAuthUser({
      uid,
      phone,
      pinHash: hashedPin,
      role: finalRole
    })

    const token = createSessionToken(authSecret, userId)
    setCookie(event, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: !import.meta.dev,
      path: '/',
      maxAge: AUTH_MAX_AGE_SECONDS
    })

    await writeAuditLog(
      AUDIT_ACTIONS.REGISTER,
      `注册新用户：${uid} (手机号: ${phone})`,
      getClientIp(event)
    )

    return {
      success: true,
      role: finalRole,
      uid
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '注册失败，请稍后重试'
    })
  }
})
