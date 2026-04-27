import { H3Error } from 'h3'
import { getAuthConfig } from '~~/server/services/auth-config-service'
import { isValidPinFormat } from '~~/server/services/auth-service'

export default defineEventHandler(async (event) => {
  try {
    const authConfig = await getAuthConfig()
    const bootstrapPin = String(useRuntimeConfig(event).adminPin || '').trim()

    return {
      initialized: Boolean(authConfig) || isValidPinFormat(bootstrapPin)
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '获取认证状态失败'
    })
  }
})
