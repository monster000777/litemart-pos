import { H3Error } from 'h3'
import { createSessionToken, hashPin, isValidPinFormat, verifyPin } from '~~/server/services/auth-service'
import { createAuthConfigIfMissing, getAuthConfig } from '~~/server/services/auth-config-service'
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '~~/shared/constants/auth'

type LoginBody = {
  pin?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<LoginBody>(event)
    const pin = body.pin?.trim() ?? ''

    if (!isValidPinFormat(pin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 码格式错误'
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
          message: '尚未初始化管理员 PIN，请先完成注册'
        })
      }

      const hashedPin = await hashPin(bootstrapPin)
      await createAuthConfigIfMissing(hashedPin)
      authConfig = await getAuthConfig()
      if (!authConfig) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          message: '初始化登录配置失败'
        })
      }
    }

    const matched = await verifyPin(pin, authConfig.adminPin)
    if (!matched) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'PIN 码错误'
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
      message: '登录失败，请稍后重试'
    })
  }
})
