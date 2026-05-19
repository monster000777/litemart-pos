<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false
  }
)

const theme = useThemeStore()
const mounted = ref(false)

const modes = ['light', 'dark', 'system'] as const
type ThemeMode = (typeof modes)[number]

const isThemeMode = (value: string): value is ThemeMode => modes.includes(value as ThemeMode)

const currentMode = computed<ThemeMode>(() => (isThemeMode(theme.mode) ? theme.mode : 'system'))

const modeLabelMap: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
}

const cycleTheme = () => {
  const currentIndex = modes.indexOf(currentMode.value)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  theme.setMode(nextMode as ThemeMode)
}

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:bg-zinc-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
    :title="`当前主题：${modeLabelMap[currentMode]}`"
    @click="cycleTheme"
  >
    <template v-if="mounted">
      <Sun v-if="currentMode === 'light'" class="h-4 w-4 flex-shrink-0" />
      <Moon v-else-if="currentMode === 'dark'" class="h-4 w-4 flex-shrink-0" />
      <Monitor v-else class="h-4 w-4 flex-shrink-0" />
      <span v-if="!props.compact">{{ modeLabelMap[currentMode] }}</span>
    </template>
    <template v-else>
      <Monitor class="h-4 w-4 flex-shrink-0" />
      <span v-if="!props.compact">跟随系统</span>
    </template>
  </button>
</template>
