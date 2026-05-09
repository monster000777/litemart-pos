import { canAccessAppPath, type UserRole } from '~~/shared/constants/rbac'

export default defineNuxtRouteMiddleware(async (to) => {
  const authState = useState<boolean | null>('auth:verified', () => null)
  const authRole = useState<UserRole | null>('auth:role', () => null)
  const actualRole = useState<UserRole | null>('auth:actualRole', () => null)
  const authVerifiedAt = useState<number>('auth:verifiedAt', () => 0)
  const CLIENT_AUTH_CACHE_MS = 15_000

  const verifySession = async (force = false) => {
    const hasFreshClientCache =
      import.meta.client &&
      authState.value === true &&
      authRole.value !== null &&
      Date.now() - authVerifiedAt.value < CLIENT_AUTH_CACHE_MS

    if (!force && hasFreshClientCache) {
      return {
        authenticated: true as const,
        role: authRole.value,
        actualRole: actualRole.value
      }
    }
    try {
      const session = await $fetch<{ authenticated: true; role: UserRole; actualRole: UserRole }>(
        '/api/auth/session',
        {
          headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
        }
      )
      authState.value = true
      authRole.value = session.role
      actualRole.value = session.actualRole
      authVerifiedAt.value = Date.now()
      return session
    } catch {
      authState.value = false
      authRole.value = null
      actualRole.value = null
      authVerifiedAt.value = Date.now()
      return null
    }
  }

  if (to.path === '/login') {
    const session = await verifySession(authState.value === false)
    if (session) {
      return navigateTo('/')
    }
    return
  }

  const session = await verifySession()
  if (!session) {
    // 保存当前路由，登录后回跳
    const redirect = to.fullPath !== '/' ? to.fullPath : undefined
    return navigateTo({
      path: '/login',
      query: redirect ? { redirect } : undefined
    })
  }

  if (!canAccessAppPath(session.role, to.path)) {
    if (to.path !== '/') {
      return navigateTo('/')
    }
    return
  }
})
