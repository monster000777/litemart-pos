import { verifySessionToken } from '~~/server/services/auth-service'
import { AUTH_COOKIE_NAME } from '~~/shared/constants/auth'
import { ensureSchemaBootstrapped } from '~~/server/lib/schema-bootstrap'

const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/status',
  '/api/auth/logout',
  '/api/auth/reset-pin'
])

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (!pathname.startsWith('/api/')) {
    return
  }

  await ensureSchemaBootstrapped()

  if (PUBLIC_AUTH_PATHS.has(pathname) || PUBLIC_AUTH_PATHS.has(pathname.replace(/\/$/, ''))) {
    return
  }

  const authSecret = String(useRuntimeConfig(event).authSecret || '').trim()
  if (!authSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '缺少 NUXT_AUTH_SECRET 配置'
    })
  }

  const token = getCookie(event, AUTH_COOKIE_NAME)
  const session = verifySessionToken(token, authSecret)

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '未授权访问'
    })
  }
})
