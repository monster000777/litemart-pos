<script setup lang="ts">
import { LoaderCircle, RotateCcw, ArrowLeft } from 'lucide-vue-next'

definePageMeta({
  layout: false
})

type AuthStatusDto = {
  initialized: boolean
}

const MODE_LOGIN = 'login'
const MODE_REGISTER = 'register'
const MODE_RESET = 'reset'
const STEP_PIN = 'pin'
const STEP_CONFIRM = 'confirm'
const STEP_OLD = 'old'
const STEP_NEW = 'new'
const STEP_NEW_CONFIRM = 'new_confirm'

type Mode = typeof MODE_LOGIN | typeof MODE_REGISTER | typeof MODE_RESET
type RegisterStep = typeof STEP_PIN | typeof STEP_CONFIRM
type ResetStep = typeof STEP_OLD | typeof STEP_NEW | typeof STEP_NEW_CONFIRM

const mode = ref<Mode>(MODE_LOGIN)
const registerStep = ref<RegisterStep>(STEP_PIN)
const resetStep = ref<ResetStep>(STEP_OLD)

const loginPin = ref('')
const registerPin = ref('')
const confirmPin = ref('')
const resetOldPin = ref('')
const resetNewPin = ref('')
const resetConfirmPin = ref('')

const checkingStatus = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const helperMessage = ref('')
const leaving = ref(false)
const lockSeconds = ref(0)
const lockTimer = ref<ReturnType<typeof setInterval> | null>(null)
const isInitialized = ref(false)

const { getApiErrorMessage } = useApiError()
const route = useRoute()
const authState = useState<boolean | null>('auth:verified', () => null)

const activePin = computed({
  get: () => {
    if (mode.value === MODE_LOGIN) return loginPin.value
    if (mode.value === MODE_REGISTER) {
      return registerStep.value === STEP_PIN ? registerPin.value : confirmPin.value
    }
    // MODE_RESET
    if (resetStep.value === STEP_OLD) return resetOldPin.value
    if (resetStep.value === STEP_NEW) return resetNewPin.value
    return resetConfirmPin.value
  },
  set: (value: string) => {
    if (mode.value === MODE_LOGIN) { loginPin.value = value; return }
    if (mode.value === MODE_REGISTER) {
      if (registerStep.value === STEP_PIN) { registerPin.value = value; return }
      confirmPin.value = value; return
    }
    if (resetStep.value === STEP_OLD) { resetOldPin.value = value; return }
    if (resetStep.value === STEP_NEW) { resetNewPin.value = value; return }
    resetConfirmPin.value = value
  }
})

const displayPin = computed(() => activePin.value.padEnd(6, '•'))

const pageTitle = computed(() => {
  if (mode.value === MODE_LOGIN) return 'PIN 登录'
  if (mode.value === MODE_REGISTER) return 'PIN 注册'
  return '重置 PIN'
})

const pageDescription = computed(() => {
  if (mode.value === MODE_LOGIN) return '输入 6 位管理员 PIN 进入工作台'
  if (mode.value === MODE_REGISTER) {
    return registerStep.value === STEP_PIN ? '设置 6 位管理员 PIN' : '请再次输入 PIN 确认'
  }
  if (resetStep.value === STEP_OLD) return '输入当前 PIN 验证身份'
  if (resetStep.value === STEP_NEW) return '设置新的 6 位 PIN'
  return '再次输入新 PIN 确认'
})

const isLocked = computed(() => lockSeconds.value > 0)
const isDisabled = computed(() => submitting.value || checkingStatus.value || isLocked.value)

const resetMessages = () => {
  errorMessage.value = ''
  helperMessage.value = ''
}

const appendDigit = (digit: string) => {
  if (isDisabled.value || activePin.value.length >= 6) return
  resetMessages()
  activePin.value += digit
}

const removeLast = () => {
  if (isDisabled.value) return
  resetMessages()
  activePin.value = activePin.value.slice(0, -1)
}

const clearPin = () => {
  if (isDisabled.value) return
  resetMessages()
  activePin.value = ''
}

const startLockCountdown = (seconds: number) => {
  if (lockTimer.value) clearInterval(lockTimer.value)
  lockSeconds.value = seconds
  lockTimer.value = setInterval(() => {
    lockSeconds.value--
    if (lockSeconds.value <= 0) {
      if (lockTimer.value) clearInterval(lockTimer.value)
      lockTimer.value = null
    }
  }, 1000)
}

const completeAuthFlow = async () => {
  authState.value = true
  leaving.value = true
  await new Promise((resolve) => setTimeout(resolve, 220))
  const redirect = route.query.redirect as string | undefined
  await navigateTo(redirect || '/')
}

const handleApiError = (error: unknown, fallback: string) => {
  const err = error as { data?: { data?: { lockSeconds?: number }; message?: string }; message?: string } | null
  if (err?.data?.data?.lockSeconds) {
    startLockCountdown(err.data.data.lockSeconds)
  }
  errorMessage.value = getApiErrorMessage(error, fallback)
}

const login = async () => {
  if (submitting.value) return
  if (loginPin.value.length !== 6) {
    errorMessage.value = '请输入 6 位 PIN 码'
    return
  }
  submitting.value = true
  resetMessages()
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { pin: loginPin.value } })
    await completeAuthFlow()
  } catch (error) {
    handleApiError(error, '登录失败，请稍后重试')
    loginPin.value = ''
    authState.value = false
  } finally {
    submitting.value = false
  }
}

const register = async () => {
  if (submitting.value) return
  if (registerPin.value.length !== 6 || confirmPin.value.length !== 6) {
    errorMessage.value = '请完成两次 6 位 PIN 输入'
    return
  }
  submitting.value = true
  resetMessages()
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { pin: registerPin.value, confirmPin: confirmPin.value }
    })
    await completeAuthFlow()
  } catch (error) {
    handleApiError(error, '注册失败，请稍后重试')
    confirmPin.value = ''
    authState.value = false
  } finally {
    submitting.value = false
  }
}

const resetPin = async () => {
  if (submitting.value) return
  submitting.value = true
  resetMessages()
  try {
    await $fetch('/api/auth/reset-pin', {
      method: 'POST',
      body: {
        oldPin: resetOldPin.value,
        newPin: resetNewPin.value,
        confirmPin: resetConfirmPin.value
      }
    })
    await completeAuthFlow()
  } catch (error) {
    handleApiError(error, 'PIN 重置失败，请稍后重试')
    if (resetStep.value === STEP_OLD) {
      resetOldPin.value = ''
    } else {
      resetConfirmPin.value = ''
    }
  } finally {
    submitting.value = false
  }
}

const submitCurrent = async () => {
  if (mode.value === MODE_LOGIN) {
    await login()
    return
  }

  if (mode.value === MODE_REGISTER) {
    if (registerStep.value === STEP_PIN) {
      if (registerPin.value.length !== 6) return
      registerStep.value = STEP_CONFIRM
      helperMessage.value = '请再次输入同一 PIN 进行确认'
      return
    }
    if (registerPin.value !== confirmPin.value) {
      errorMessage.value = '两次输入的 PIN 不一致，请重新确认'
      confirmPin.value = ''
      return
    }
    await register()
    return
  }

  // MODE_RESET
  if (resetStep.value === STEP_OLD) {
    if (resetOldPin.value.length !== 6) return
    resetStep.value = STEP_NEW
    helperMessage.value = '请输入新的 6 位 PIN'
    return
  }
  if (resetStep.value === STEP_NEW) {
    if (resetNewPin.value.length !== 6) return
    resetStep.value = STEP_NEW_CONFIRM
    helperMessage.value = '再次输入新 PIN 确认'
    return
  }
  if (resetNewPin.value !== resetConfirmPin.value) {
    errorMessage.value = '两次新 PIN 不一致'
    resetConfirmPin.value = ''
    return
  }
  await resetPin()
}

const switchToReset = () => {
  mode.value = MODE_RESET
  resetStep.value = STEP_OLD
  resetOldPin.value = ''
  resetNewPin.value = ''
  resetConfirmPin.value = ''
  resetMessages()
  helperMessage.value = '输入当前 PIN 以验证身份'
}

const backToLogin = () => {
  mode.value = MODE_LOGIN
  loginPin.value = ''
  resetMessages()
}

const resolveMode = async () => {
  checkingStatus.value = true
  try {
    const status = await $fetch<AuthStatusDto>('/api/auth/status')
    isInitialized.value = status.initialized
    mode.value = status.initialized ? MODE_LOGIN : MODE_REGISTER
  } catch (error) {
    mode.value = MODE_LOGIN
    errorMessage.value = getApiErrorMessage(error, '获取认证状态失败，请刷新重试')
  } finally {
    checkingStatus.value = false
  }
}

watch(
  () => activePin.value.length,
  async (length) => {
    if (length === 6 && !submitting.value && !checkingStatus.value && !isLocked.value) {
      await submitCurrent()
    }
  }
)

// 物理键盘支持
const onKeydown = (e: KeyboardEvent) => {
  if (e.key >= '0' && e.key <= '9') appendDigit(e.key)
  else if (e.key === 'Backspace') removeLast()
  else if (e.key === 'Enter') submitCurrent()
}

onMounted(async () => {
  await resolveMode()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (lockTimer.value) clearInterval(lockTimer.value)
})
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-zinc-50 px-6 transition-opacity duration-300"
    :class="leaving ? 'opacity-0' : 'opacity-100'"
  >
    <section class="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8">
      <header class="text-center">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">LiteMart POS</p>
        <h1 class="mt-2 text-xl font-semibold tracking-tight text-slate-900">{{ pageTitle }}</h1>
        <p class="mt-2 text-sm text-slate-500">{{ pageDescription }}</p>
      </header>

      <div class="mt-6 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-3 text-center">
        <p class="font-mono text-2xl tracking-[0.4em] text-slate-800">{{ displayPin }}</p>
      </div>

      <!-- 消息提示（互斥展示） -->
      <p
        v-if="isLocked"
        class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
      >
        操作过于频繁，请 {{ lockSeconds }} 秒后重试
      </p>
      <p
        v-else-if="errorMessage"
        class="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      >
        {{ errorMessage }}
      </p>
      <p
        v-else-if="helperMessage"
        class="mt-4 rounded-xl border border-slate-100 bg-zinc-50 px-3 py-2 text-sm text-slate-600"
      >
        {{ helperMessage }}
      </p>

      <div class="mt-6 grid grid-cols-3 gap-3">
        <button
          v-for="digit in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
          :key="digit"
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-base font-medium text-slate-800 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDisabled"
          @click="appendDigit(digit)"
        >
          {{ digit }}
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-600 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDisabled"
          @click="clearPin"
        >
          清空
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-base font-medium text-slate-800 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDisabled"
          @click="appendDigit('0')"
        >
          0
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-600 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isDisabled"
          @click="removeLast"
        >
          删除
        </button>
      </div>

      <button
        type="button"
        class="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        :disabled="isDisabled || activePin.length !== 6"
        @click="submitCurrent"
      >
        <LoaderCircle v-if="submitting || checkingStatus" class="h-4 w-4 animate-spin" />
        <span v-else>{{ mode === MODE_LOGIN ? '进入工作台' : '继续' }}</span>
      </button>

      <!-- 底部操作链接 -->
      <div class="mt-4 flex justify-center">
        <button
          v-if="mode === MODE_LOGIN && isInitialized"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-600"
          @click="switchToReset"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          重置 PIN
        </button>
        <button
          v-if="mode === MODE_RESET"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-600"
          @click="backToLogin"
        >
          <ArrowLeft class="h-3.5 w-3.5" />
          返回登录
        </button>
      </div>
    </section>
  </div>
</template>
