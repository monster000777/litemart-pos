export default defineNuxtRouteMiddleware(async (to) => {
  const authState = useState<boolean | null>('auth:verified', () => null)

  const verifySession = async () => {
    try {
      await $fetch('/api/auth/session', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      })
      authState.value = true
      return true
    } catch {
      authState.value = false
      return false
    }
  }

  if (to.path === '/login') {
    const authenticated = await verifySession()
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
