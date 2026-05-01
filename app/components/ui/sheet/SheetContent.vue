<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, type Ref } from 'vue'
import { X } from 'lucide-vue-next'

const open = inject<Ref<boolean>>('sheet-open')
const setOpen = inject<(value: boolean) => void>('sheet-set-open')

if (!open || !setOpen) {
  throw new Error('SheetContent must be used inside Sheet')
}

const onEsc = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    setOpen(false)
  }
}

onMounted(() => window.addEventListener('keydown', onEsc))
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        @click="setOpen(false)"
      />
    </Transition>
    <Transition name="sheet-slide">
      <aside
        v-if="open"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-100 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)]"
      >
        <div class="relative flex-1 overflow-y-auto p-8">
          <button
            type="button"
            class="sticky top-0 float-right rounded-md p-1 text-slate-400 transition hover:bg-zinc-50 hover:text-slate-700 z-10"
            @click="setOpen(false)"
          >
            <X class="h-4 w-4" />
          </button>
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition:
    transform 0.24s ease,
    opacity 0.24s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateX(22px);
  opacity: 0;
}
</style>
