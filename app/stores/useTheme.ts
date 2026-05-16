type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'litemart-theme-mode'

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    if (import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  }

  return mode
}

export const useThemeStore = defineStore(
  'theme',
  () => {
    const mode = ref<ThemeMode>('system')
    const systemListener = ref<((event: MediaQueryListEvent) => void) | null>(null)

    const resolved = computed<ResolvedTheme>(() => resolveTheme(mode.value))

    const applyTheme = () => {
      if (!import.meta.client) return
      const isDark = resolved.value === 'dark'
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }

    const setMode = (nextMode: ThemeMode) => {
      mode.value = nextMode
      applyTheme()
    }

    const initSystemListener = () => {
      if (!import.meta.client || systemListener.value) return
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => {
        if (mode.value === 'system') {
          applyTheme()
        }
      }
      media.addEventListener('change', listener)
      systemListener.value = listener
    }

    return {
      mode,
      resolved,
      setMode,
      applyTheme,
      initSystemListener
    }
  },
  {
    persist: {
      key: STORAGE_KEY,
      storage: piniaPluginPersistedstate.localStorage(),
      pick: ['mode']
    }
  }
)
