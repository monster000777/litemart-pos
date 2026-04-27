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
    return navigateTo('/login')
  }
})
