import { H3Error } from 'h3'
import { getAuthConfig } from '~~/server/services/auth-config-service'
import { countAuthUsers } from '~~/server/services/auth-user-service'
import { isValidPinFormat } from '~~/server/services/auth-service'

export default defineEventHandler(async (event) => {
  try {
    const authConfig = await getAuthConfig()
    const userCount = await countAuthUsers()
    const bootstrapPin = String(useRuntimeConfig(event).adminPin || '').trim()

    return {
      initialized: userCount > 0 || Boolean(authConfig) || isValidPinFormat(bootstrapPin)
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
