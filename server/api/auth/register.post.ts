import { H3Error } from 'h3'
import { createSessionToken, hashPin, isValidPinFormat } from '~~/server/services/auth-service'
import { createAuthConfigIfMissing, getAuthConfig } from '~~/server/services/auth-config-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'

type RegisterBody = {
  pin?: string
  confirmPin?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<RegisterBody>(event)
    const pin = body.pin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''

    if (!isValidPinFormat(pin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 码格式错误'
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

    const existing = await getAuthConfig()
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '管理员 PIN 已初始化，请直接登录'
      })
    }

    const hashedPin = await hashPin(pin)
    await createAuthConfigIfMissing(hashedPin)

    const created = await getAuthConfig()
    if (!created) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: '注册失败，请稍后重试'
      })
    }

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
      message: '注册失败，请稍后重试'
    })
  }
})
