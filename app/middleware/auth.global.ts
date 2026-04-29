export default defineNuxtRouteMiddleware(async (to) => {
  const authState = useState<boolean | null>('auth:verified', () => null)
  const authVerifiedAt = useState<number>('auth:verifiedAt', () => 0)
  const CLIENT_AUTH_CACHE_MS = 15_000

  const verifySession = async (force = false) => {
    const hasFreshClientCache =
      import.meta.client &&
      authState.value !== null &&
      Date.now() - authVerifiedAt.value < CLIENT_AUTH_CACHE_MS

    if (!force && hasFreshClientCache) {
      return authState.value
    }
    try {
      await $fetch('/api/auth/session', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      })
      authState.value = true
      authVerifiedAt.value = Date.now()
      return true
    } catch {
      authState.value = false
      authVerifiedAt.value = Date.now()
      return false
    }
  }

  if (to.path === '/login') {
    const authenticated = await verifySession(authState.value === false)
    if (authenticated) {
      return navigateTo('/')
    }
    return
  }

  const authenticated = await verifySession()
  if (!authenticated) {
    // 保存当前路由，登录后回跳
    const redirect = to.fullPath !== '/' ? to.fullPath : undefined
    return navigateTo({
      path: '/login',
      query: redirect ? { redirect } : undefined
    })
  }
})
