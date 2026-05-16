<script setup lang="ts">
import Toaster from '~/components/ui/toast/Toaster.vue'

const theme = useThemeStore()

useHead(() => ({
  htmlAttrs: {
    class: theme.resolved === 'dark' ? 'dark' : undefined
  },
  meta: [{ name: 'color-scheme', content: theme.resolved }]
}))

onMounted(() => {
  theme.applyTheme()
  theme.initSystemListener()
})
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster />
  </div>
</template>
