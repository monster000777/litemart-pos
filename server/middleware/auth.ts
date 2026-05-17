import { verifySessionToken } from '~~/server/services/auth-service'
import { assertApiRouteAccess, getCurrentAuthContext } from '~~/server/services/rbac-service'
import { AUTH_COOKIE_NAME } from '~~/shared/constants/auth'
import { ensureSchemaBootstrapped } from '~~/server/lib/schema-bootstrap'

const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/status',
  '/api/auth/logout',
  '/api/auth/reset-pin',
  '/api/auth/send-otp',
  '/api/auth/send-change-phone-otp'
])

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const method = event.method.toUpperCase()

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

  const authHeader = getRequestHeader(event, 'authorization')
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''
  const token = bearerToken || getCookie(event, AUTH_COOKIE_NAME)
  const session = verifySessionToken(token, authSecret)

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '未授权访问'
    })
  }

  const auth = await getCurrentAuthContext(session)
  event.context.auth = {
    session,
    user: auth.user,
    role: auth.role
  }

  assertApiRouteAccess(auth.role, pathname, method)
})
