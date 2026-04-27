<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'

definePageMeta({
  layout: false
})

type AuthStatusDto = {
  initialized: boolean
}

const MODE_LOGIN = 'login'
const MODE_REGISTER = 'register'
const STEP_PIN = 'pin'
const STEP_CONFIRM = 'confirm'

const mode = ref<typeof MODE_LOGIN | typeof MODE_REGISTER>(MODE_LOGIN)
const registerStep = ref<typeof STEP_PIN | typeof STEP_CONFIRM>(STEP_PIN)
const loginPin = ref('')
const registerPin = ref('')
const confirmPin = ref('')
const checkingStatus = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const helperMessage = ref('')
const leaving = ref(false)
const { getApiErrorMessage } = useApiError()

const authState = useState<boolean | null>('auth:verified', () => null)

const activePin = computed({
  get: () => {
    if (mode.value === MODE_LOGIN) {
      return loginPin.value
    }
    return registerStep.value === STEP_PIN ? registerPin.value : confirmPin.value
  },
  set: (value: string) => {
    if (mode.value === MODE_LOGIN) {
      loginPin.value = value
      return
    }
    if (registerStep.value === STEP_PIN) {
      registerPin.value = value
      return
    }
    confirmPin.value = value
  }
})

const displayPin = computed(() => activePin.value.padEnd(6, '•'))
const pageTitle = computed(() => (mode.value === MODE_LOGIN ? 'PIN 登录' : 'PIN 注册'))
const pageDescription = computed(() => {
  if (mode.value === MODE_LOGIN) {
    return '输入 6 位管理员 PIN 进入工作台'
  }
  return registerStep.value === STEP_PIN ? '设置 6 位管理员 PIN' : '请再次输入 PIN 确认'
})

const resetMessages = () => {
  errorMessage.value = ''
  helperMessage.value = ''
}

const appendDigit = (digit: string) => {
  if (submitting.value || checkingStatus.value || activePin.value.length >= 6) {
    return
  }
  resetMessages()
  activePin.value += digit
}

const removeLast = () => {
  if (submitting.value || checkingStatus.value) {
    return
  }
  resetMessages()
  activePin.value = activePin.value.slice(0, -1)
}

const clearPin = () => {
  if (submitting.value || checkingStatus.value) {
    return
  }
  resetMessages()
  activePin.value = ''
}

const completeAuthFlow = async () => {
  authState.value = true
  leaving.value = true
  await new Promise((resolve) => setTimeout(resolve, 220))
  await navigateTo('/')
}

const login = async () => {
  if (submitting.value) {
    return
  }
  if (loginPin.value.length !== 6) {
    errorMessage.value = '请输入 6 位 PIN 码'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { pin: loginPin.value }
    })
    await completeAuthFlow()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '登录失败，请稍后重试')
    loginPin.value = ''
    authState.value = false
  } finally {
    submitting.value = false
  }
}

const register = async () => {
  if (submitting.value) {
    return
  }
  if (registerPin.value.length !== 6 || confirmPin.value.length !== 6) {
    errorMessage.value = '请完成两次 6 位 PIN 输入'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        pin: registerPin.value,
        confirmPin: confirmPin.value
      }
    })
    await completeAuthFlow()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '注册失败，请稍后重试')
    confirmPin.value = ''
    authState.value = false
  } finally {
    submitting.value = false
  }
}

const resolveMode = async () => {
  checkingStatus.value = true
  try {
    const status = await $fetch<AuthStatusDto>('/api/auth/status')
    mode.value = status.initialized ? MODE_LOGIN : MODE_REGISTER
  } catch (error) {
    mode.value = MODE_LOGIN
    errorMessage.value = getApiErrorMessage(error, '获取认证状态失败，请刷新重试')
  } finally {
    checkingStatus.value = false
  }
}

const submitCurrent = async () => {
  if (mode.value === MODE_LOGIN) {
    await login()
    return
  }

  if (registerStep.value === STEP_PIN) {
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
}

watch(
  () => activePin.value.length,
  async (length) => {
    if (length === 6 && !submitting.value && !checkingStatus.value) {
      await submitCurrent()
    }
  }
)

onMounted(async () => {
  await resolveMode()
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

      <p
        v-if="helperMessage && !errorMessage"
        class="mt-4 rounded-xl border border-slate-100 bg-zinc-50 px-3 py-2 text-sm text-slate-600"
      >
        {{ helperMessage }}
      </p>
      <p v-if="errorMessage" class="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid grid-cols-3 gap-3">
        <button
          v-for="digit in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
          :key="digit"
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-base font-medium text-slate-800 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="submitting || checkingStatus"
          @click="appendDigit(digit)"
        >
          {{ digit }}
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-600 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="submitting || checkingStatus"
          @click="clearPin"
        >
          清空
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-base font-medium text-slate-800 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="submitting || checkingStatus"
          @click="appendDigit('0')"
        >
          0
        </button>
        <button
          type="button"
          class="h-14 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-600 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="submitting || checkingStatus"
          @click="removeLast"
        >
          删除
        </button>
      </div>

      <button
        type="button"
        class="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        :disabled="submitting || checkingStatus || activePin.length !== 6"
        @click="submitCurrent"
      >
        <LoaderCircle v-if="submitting || checkingStatus" class="h-4 w-4 animate-spin" />
        <span v-else>{{ mode === MODE_LOGIN ? '进入工作台' : '继续' }}</span>
      </button>
    </section>
  </div>
</template>
