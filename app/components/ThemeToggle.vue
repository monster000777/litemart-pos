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

const modes = ['light', 'dark', 'system'] as const

const modeLabelMap = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
} as const

const modeIcon = computed(() => {
  if (theme.mode === 'light') return Sun
  if (theme.mode === 'dark') return Moon
  return Monitor
})

const cycleTheme = () => {
  const currentIndex = modes.indexOf(theme.mode)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  theme.setMode(nextMode)
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:bg-zinc-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
    :title="`当前主题：${modeLabelMap[theme.mode]}`"
    @click="cycleTheme"
  >
    <component :is="modeIcon" class="h-4 w-4" />
    <span v-if="!props.compact">{{ modeLabelMap[theme.mode] }}</span>
  </button>
</template>
