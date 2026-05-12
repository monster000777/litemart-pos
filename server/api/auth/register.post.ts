import { H3Error } from 'h3'
import { createSessionToken, hashPin, isValidPinFormat } from '~~/server/services/auth-service'
import { createAuthConfigIfMissing, getAuthConfig } from '~~/server/services/auth-config-service'
import {
  countAuthUsers,
  createAuthUser,
  findAuthUserByName
} from '~~/server/services/auth-user-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { USER_ROLES } from '~~/shared/constants/rbac'

type RegisterBody = {
  uid?: string
  pin?: string
  confirmPin?: string
  inviteCode?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<RegisterBody>(event)
    const uid = body.uid?.trim() ?? ''
    const pin = body.pin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''
    const inviteCode = body.inviteCode?.trim() ?? ''

    if (!uid || uid.length < 2 || uid.length > 20) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号名称长度须在 2~20 个字符之间'
      })
    }

    if (!isValidPinFormat(pin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 格式错误'
      })
    }

    if (pin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的 PIN 不一致'
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
        message: '系统已配置初始化 PIN，请直接登录'
      })
    }

    const existingConfig = await getAuthConfig()
    const userCount = await countAuthUsers()

    let finalRole = USER_ROLES.CASHIER

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

    const existingUser = await findAuthUserByName(uid)
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '该账号名已被使用，请换一个'
      })
    }

    const hashedPin = await hashPin(pin)

    if (userCount === 0) {
      // 生成初始邀请码
      const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      await createAuthConfigIfMissing(hashedPin, USER_ROLES.ADMIN, newInviteCode)
    }

    const userId = await createAuthUser({
      name: uid,
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

    await writeAuditLog(AUDIT_ACTIONS.REGISTER, `初始化首个管理员账号：${uid}`, getClientIp(event))

    return {
      success: true,
      role: USER_ROLES.ADMIN
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
