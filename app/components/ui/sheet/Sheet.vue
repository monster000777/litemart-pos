<script setup lang="ts">
import { provide } from 'vue'

const open = defineModel<boolean>('open', { default: false })
const setOpen = (value: boolean) => {
  open.value = value
}

provide('sheet-open', open)
provide('sheet-set-open', setOpen)
</script>

<template>
  <slot />
</template>
