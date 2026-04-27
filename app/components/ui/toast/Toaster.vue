<script setup lang="ts">
import { AlertCircle, CheckCircle2, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-6 top-6 z-[80] w-full max-w-sm space-y-2">
      <TransitionGroup name="toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
          :class="
            item.variant === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
              : 'border-rose-100 bg-rose-50 text-rose-900'
          "
        >
          <div class="flex items-start gap-3">
            <CheckCircle2 v-if="item.variant === 'success'" class="mt-0.5 h-4 w-4 shrink-0" />
            <AlertCircle v-else class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium leading-5">{{ item.title }}</p>
              <p v-if="item.description" class="mt-1 text-xs opacity-80">{{ item.description }}</p>
            </div>
            <button
              type="button"
              class="rounded-md p-0.5 opacity-60 transition hover:bg-white/50 hover:opacity-100"
              @click="dismiss(item.id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
