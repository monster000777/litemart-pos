<script setup lang="ts">
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-vue-next'
import type { UserRole } from '~~/shared/constants/rbac'

definePageMeta({ layout: false })

type AuthStatusDto = { initialized: boolean }
type AuthMutationResponse = { success: boolean; role: UserRole }

const MODE_LOGIN = 'login'
const MODE_REGISTER = 'register'
const MODE_RESET = 'reset'

const mode = ref<typeof MODE_LOGIN | typeof MODE_REGISTER | typeof MODE_RESET>(MODE_LOGIN)
const isInitialized = ref(false)
const checkingStatus = ref(true)
const submitting = ref(false)
const showPin = ref(false)
const showConfirmPin = ref(false)
const leaving = ref(false)
const lockSeconds = ref(0)
const lockTimer = ref<ReturnType<typeof setInterval> | null>(null)
const errorMessage = ref('')
const helperMessage = ref('')

const loginUid = ref('')
const loginPin = ref('')
const regPhone = ref('')
const regPin = ref('')
const regConfirmPin = ref('')
const regInviteCode = ref('')
const resetPhone = ref('')
const resetOtpCode = ref('')
const resetNewPin = ref('')
const resetConfirmPin = ref('')
const regOtpCode = ref('')

const otpCountdown = ref(0)
let otpTimer: ReturnType<typeof setInterval> | null = null

const { getApiErrorMessage } = useApiError()
const route = useRoute()
const authState = useState<boolean | null>('auth:verified', () => null)
const authRole = useState<UserRole | null>('auth:role', () => null)

const isLocked = computed(() => lockSeconds.value > 0)
const isDisabled = computed(() => submitting.value || checkingStatus.value || isLocked.value)

const startLockCountdown = (s: number) => {
  if (lockTimer.value) clearInterval(lockTimer.value)
  lockSeconds.value = s
  lockTimer.value = setInterval(() => {
    lockSeconds.value--
    if (lockSeconds.value <= 0 && lockTimer.value) {
      clearInterval(lockTimer.value)
      lockTimer.value = null
    }
  }, 1000)
}

const handleApiError = (error: unknown, fallback: string) => {
  const err = error as { data?: { data?: { lockSeconds?: number } } } | null
  if (err?.data?.data?.lockSeconds) startLockCountdown(err.data.data.lockSeconds)
  errorMessage.value = getApiErrorMessage(error, fallback)
}

const completeAuthFlow = async () => {
  authState.value = true
  leaving.value = true
  await new Promise((r) => setTimeout(r, 220))
  await navigateTo((route.query.redirect as string) || '/')
}

const login = async () => {
  errorMessage.value = ''
  if (!loginUid.value.trim()) {
    errorMessage.value = '请输入员工 UID 或手机号'
    return
  }
  if (loginPin.value.length !== 6) {
    errorMessage.value = '请输入 6 位 PIN'
    return
  }
  if (submitting.value || isLocked.value) return
  submitting.value = true
  try {
    const result = await $fetch<AuthMutationResponse>('/api/auth/login', {
      method: 'POST',
      body: { uid: loginUid.value.trim(), pin: loginPin.value }
    })
    authRole.value = result.role
    await completeAuthFlow()
  } catch (error) {
    handleApiError(error, '登录失败，请稍后重试')
    loginPin.value = ''
    authState.value = false
    authRole.value = null
  } finally {
    submitting.value = false
  }
}

const register = async () => {
  errorMessage.value = ''
  if (!regPhone.value.trim() || regPhone.value.trim().length !== 11) {
    errorMessage.value = '请输入 11 位手机号'
    return
  }
  if (!regOtpCode.value.trim() || regOtpCode.value.trim().length !== 6) {
    errorMessage.value = '请输入 6 位验证码'
    return
  }
  if (regPin.value.length !== 6) {
    errorMessage.value = '请输入 6 位 PIN'
    return
  }
  if (regPin.value !== regConfirmPin.value) {
    errorMessage.value = '两次 PIN 不一致'
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const result = await $fetch<AuthMutationResponse & { uid: string }>('/api/auth/register', {
      method: 'POST',
      body: {
        phone: regPhone.value.trim(),
        otpCode: regOtpCode.value.trim(),
        pin: regPin.value,
        confirmPin: regConfirmPin.value,
        inviteCode: regInviteCode.value.trim()
      }
    })
    window.alert(`注册成功！您的员工 UID 为：${result.uid}\n请妥善保管此 UID，您将使用它进行登录。`)
    authRole.value = result.role
    await completeAuthFlow()
  } catch (error) {
    handleApiError(error, '注册失败，请稍后重试')
    authState.value = false
    authRole.value = null
  } finally {
    submitting.value = false
  }
}

const resetPin = async () => {
  errorMessage.value = ''
  if (
    !resetPhone.value.trim() ||
    !resetOtpCode.value.trim() ||
    resetNewPin.value.length !== 6 ||
    resetConfirmPin.value.length !== 6
  ) {
    errorMessage.value = '请完整填写所有字段'
    return
  }
  if (resetNewPin.value !== resetConfirmPin.value) {
    errorMessage.value = '新 PIN 两次输入不一致'
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    await $fetch('/api/auth/reset-pin', {
      method: 'POST',
      body: {
        phone: resetPhone.value.trim(),
        otpCode: resetOtpCode.value.trim(),
        newPin: resetNewPin.value,
        confirmPin: resetConfirmPin.value
      }
    })
    mode.value = MODE_LOGIN
    resetPhone.value = ''
    resetOtpCode.value = ''
    resetNewPin.value = ''
    resetConfirmPin.value = ''
    helperMessage.value = 'PIN 重置成功，请重新登录'
  } catch (error) {
    handleApiError(error, 'PIN 重置失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

const resolveMode = async () => {
  checkingStatus.value = true
  try {
    const status = await $fetch<AuthStatusDto>('/api/auth/status')
    isInitialized.value = status.initialized
    mode.value = status.initialized ? MODE_LOGIN : MODE_REGISTER
  } catch {
    mode.value = MODE_LOGIN
  } finally {
    checkingStatus.value = false
  }
}

const switchMode = (m: typeof MODE_LOGIN | typeof MODE_REGISTER | typeof MODE_RESET) => {
  mode.value = m
  errorMessage.value = ''
  helperMessage.value = ''
  if (m === MODE_LOGIN && otpTimer) {
    clearInterval(otpTimer)
    otpCountdown.value = 0
  }
  if (m === MODE_REGISTER) {
    regOtpCode.value = ''
  }
  if (m === MODE_RESET) {
    resetOtpCode.value = ''
  }
  if (m === MODE_LOGIN) {
    regPhone.value = ''
    regPin.value = ''
    regConfirmPin.value = ''
    regInviteCode.value = ''
  }
  if (m !== MODE_RESET) {
    resetPhone.value = ''
    resetOtpCode.value = ''
    resetNewPin.value = ''
    resetConfirmPin.value = ''
  }
}

const sendOtp = async () => {
  errorMessage.value = ''
  helperMessage.value = ''
  const isRegister = mode.value === MODE_REGISTER
  const phone = isRegister ? regPhone.value.trim() : resetPhone.value.trim()
  if (!phone || phone.length !== 11) {
    errorMessage.value = '请输入 11 位手机号'
    return
  }
  if (otpCountdown.value > 0) return

  try {
    const endpoint = isRegister ? '/api/auth/send-change-phone-otp' : '/api/auth/send-otp'
    const res = await $fetch<{ success: boolean; message: string; mockCode?: string }>(endpoint, {
      method: 'POST',
      body: { phone }
    })

    // Start countdown
    otpCountdown.value = 60
    otpTimer = setInterval(() => {
      otpCountdown.value--
      if (otpCountdown.value <= 0 && otpTimer) {
        clearInterval(otpTimer)
        otpTimer = null
      }
    }, 1000)

    if (res.mockCode) {
      helperMessage.value = `验证码已发送。为了方便测试，验证码是: ${res.mockCode}`
    } else {
      helperMessage.value = '验证码已发送，请查收'
    }
  } catch (error) {
    handleApiError(error, '发送验证码失败')
  }
}

onMounted(resolveMode)
onUnmounted(() => {
  if (lockTimer.value) clearInterval(lockTimer.value)
  if (otpTimer) clearInterval(otpTimer)
})
</script>

<template>
  <div class="login-root" :class="leaving ? 'fading' : ''">
    <!-- 左侧氛围区 -->
    <div class="scene-panel">
      <div class="scene-image" />
      <div class="scene-overlay" />
      <div class="scene-content">
        <div class="scene-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" class="scene-logo">
            <rect width="40" height="40" rx="10" fill="white" fill-opacity="0.12" />
            <path
              d="M12 16h16M14 16l2-6h8l2 6M12 16l2 14h12l2-14"
              stroke="white"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <path d="M17 22h6M17 26h6" stroke="white" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span class="scene-brand-name">LiteMart</span>
        </div>
        <div class="scene-quote">
          <p class="quote-text">简约即美</p>
          <p class="quote-sub">从容掌控每一次交易</p>
        </div>
      </div>
    </div>

    <!-- 右侧表单区 -->
    <div class="form-panel">
      <div class="form-card">
        <!-- 标题 -->
        <div class="card-heading">
          <h2 class="heading-title">
            {{
              mode === MODE_LOGIN
                ? '登录'
                : mode === MODE_REGISTER
                  ? isInitialized
                    ? '员工注册'
                    : '初始化账号'
                  : '重置 PIN'
            }}
          </h2>
          <p class="heading-sub">
            {{
              mode === MODE_LOGIN
                ? '输入账号与 PIN 开始工作'
                : mode === MODE_REGISTER
                  ? isInitialized
                    ? '请输入邀请码完成注册'
                    : '首次使用，请设置管理员账号'
                  : '验证身份后设置新 PIN'
            }}
          </p>
        </div>

        <!-- 提示 -->
        <div v-if="isLocked" class="msg msg-warn">{{ lockSeconds }} 秒后可重试</div>
        <div v-else-if="errorMessage" class="msg msg-error">{{ errorMessage }}</div>
        <div v-else-if="helperMessage" class="msg msg-info">{{ helperMessage }}</div>

        <!-- 登录表单 -->
        <template v-if="mode === MODE_LOGIN">
          <div class="fields">
            <div class="field">
              <input
                v-model="loginUid"
                type="text"
                placeholder="员工 UID 或 手机号"
                maxlength="20"
                autocomplete="username"
                class="field-input"
                :disabled="isDisabled"
                @keydown.enter="login"
              />
            </div>
            <div class="field">
              <div class="pin-wrap">
                <input
                  v-model="loginPin"
                  :type="showPin ? 'text' : 'password'"
                  placeholder="PIN 码"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="current-password"
                  class="field-input pin-input"
                  :disabled="isDisabled"
                  @keydown.enter="login"
                />
                <button
                  type="button"
                  class="pin-toggle"
                  :disabled="isDisabled"
                  @click="showPin = !showPin"
                >
                  <EyeOff v-if="showPin" class="icon" />
                  <Eye v-else class="icon" />
                </button>
              </div>
            </div>
          </div>
          <button class="btn-primary" :disabled="isDisabled" @click="login">
            <LoaderCircle v-if="submitting || checkingStatus" class="spin icon" />
            <span v-else>进入</span>
          </button>
          <div
            v-if="isInitialized"
            class="card-links"
            style="display: flex; justify-content: space-between"
          >
            <button type="button" class="link-btn" @click="switchMode(MODE_REGISTER)">
              员工注册
            </button>
            <button type="button" class="link-btn" @click="switchMode(MODE_RESET)">忘记 PIN</button>
          </div>
        </template>

        <!-- 注册表单 -->
        <template v-else-if="mode === MODE_REGISTER">
          <div class="fields">
            <div v-if="isInitialized" class="field">
              <input
                v-model="regInviteCode"
                type="text"
                placeholder="6位邀请码"
                maxlength="6"
                class="field-input"
                :disabled="isDisabled"
                style="text-transform: uppercase"
              />
            </div>
            <div class="field">
              <input
                v-model="regPhone"
                type="text"
                placeholder="手机号"
                maxlength="11"
                class="field-input"
                :disabled="isDisabled"
              />
            </div>
            <div class="otp-row">
              <input
                v-model="regOtpCode"
                type="text"
                placeholder="短信验证码"
                maxlength="6"
                class="field-input"
                :disabled="isDisabled"
              />
              <button
                type="button"
                class="otp-btn"
                :disabled="isDisabled || otpCountdown > 0 || !regPhone || regPhone.length !== 11"
                @click="sendOtp"
              >
                {{ otpCountdown > 0 ? `${otpCountdown}s` : '获取验证码' }}
              </button>
            </div>
            <div class="field">
              <div class="pin-wrap">
                <input
                  v-model="regPin"
                  :type="showPin ? 'text' : 'password'"
                  placeholder="设置 PIN 码"
                  maxlength="6"
                  inputmode="numeric"
                  class="field-input pin-input"
                  :disabled="isDisabled"
                />
                <button
                  type="button"
                  class="pin-toggle"
                  :disabled="isDisabled"
                  @click="showPin = !showPin"
                >
                  <EyeOff v-if="showPin" class="icon" />
                  <Eye v-else class="icon" />
                </button>
              </div>
            </div>
            <div class="field">
              <div class="pin-wrap">
                <input
                  v-model="regConfirmPin"
                  :type="showConfirmPin ? 'text' : 'password'"
                  placeholder="确认 PIN 码"
                  maxlength="6"
                  inputmode="numeric"
                  class="field-input pin-input"
                  :disabled="isDisabled"
                  @keydown.enter="register"
                />
                <button
                  type="button"
                  class="pin-toggle"
                  :disabled="isDisabled"
                  @click="showConfirmPin = !showConfirmPin"
                >
                  <EyeOff v-if="showConfirmPin" class="icon" />
                  <Eye v-else class="icon" />
                </button>
              </div>
            </div>
          </div>
          <button class="btn-primary" :disabled="isDisabled" @click="register">
            <LoaderCircle v-if="submitting" class="spin icon" />
            <span v-else>{{ isInitialized ? '完成注册' : '完成初始化' }}</span>
          </button>
          <div v-if="isInitialized" class="card-links">
            <button type="button" class="link-btn link-btn-arrow" @click="switchMode(MODE_LOGIN)">
              <ArrowLeft class="icon-sm" /> 返回登录
            </button>
          </div>
        </template>

        <!-- 重置表单 -->
        <template v-else-if="mode === MODE_RESET">
          <div class="fields">
            <div class="field">
              <input
                v-model="resetPhone"
                type="text"
                placeholder="手机号"
                maxlength="11"
                class="field-input"
                :disabled="isDisabled"
              />
            </div>
            <div class="otp-row">
              <input
                v-model="resetOtpCode"
                type="text"
                placeholder="短信验证码"
                maxlength="6"
                class="field-input"
                :disabled="isDisabled"
              />
              <button
                type="button"
                class="otp-btn"
                :disabled="
                  isDisabled || otpCountdown > 0 || !resetPhone || resetPhone.length !== 11
                "
                @click="sendOtp"
              >
                {{ otpCountdown > 0 ? `${otpCountdown}s` : '获取验证码' }}
              </button>
            </div>
            <div class="field">
              <div class="pin-wrap">
                <input
                  v-model="resetNewPin"
                  :type="showPin ? 'text' : 'password'"
                  placeholder="新 PIN"
                  maxlength="6"
                  inputmode="numeric"
                  class="field-input pin-input"
                  :disabled="isDisabled"
                />
                <button
                  type="button"
                  class="pin-toggle"
                  :disabled="isDisabled"
                  @click="showPin = !showPin"
                >
                  <EyeOff v-if="showPin" class="icon" />
                  <Eye v-else class="icon" />
                </button>
              </div>
            </div>
            <div class="field">
              <div class="pin-wrap">
                <input
                  v-model="resetConfirmPin"
                  :type="showConfirmPin ? 'text' : 'password'"
                  placeholder="确认新 PIN"
                  maxlength="6"
                  inputmode="numeric"
                  class="field-input pin-input"
                  :disabled="isDisabled"
                  @keydown.enter="resetPin"
                />
                <button
                  type="button"
                  class="pin-toggle"
                  :disabled="isDisabled"
                  @click="showConfirmPin = !showConfirmPin"
                >
                  <EyeOff v-if="showConfirmPin" class="icon" />
                  <Eye v-else class="icon" />
                </button>
              </div>
            </div>
          </div>
          <button class="btn-primary" :disabled="isDisabled" @click="resetPin">
            <LoaderCircle v-if="submitting" class="spin icon" />
            <span v-else>确认重置</span>
          </button>
          <div class="card-links">
            <button type="button" class="link-btn link-btn-arrow" @click="switchMode(MODE_LOGIN)">
              <ArrowLeft class="icon-sm" /> 返回登录
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 整体布局 ===== */
.login-root {
  display: flex;
  min-height: 100vh;
  transition: opacity 0.25s ease;
}
.login-root.fading {
  opacity: 0;
}

/* ===== 左侧氛围区 ===== */
.scene-panel {
  position: relative;
  flex: 0 0 67%;
  overflow: hidden;
}

/* 氛围背景：使用实拍图片 */
.scene-image {
  position: absolute;
  inset: 0;
  background-image: url('/images/山谷.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.scene-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10, 8, 6, 0.25) 0%,
    rgba(10, 8, 6, 0.1) 35%,
    rgba(10, 8, 6, 0.55) 100%
  );
}

.scene-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 3rem 3.25rem;
}

.scene-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.scene-logo {
  opacity: 0.85;
}

.scene-brand-name {
  font-family: var(--font-serif);
  font-size: 1.575rem;
  font-weight: 600;
  color: white;
  letter-spacing: 0.1em;
  opacity: 0.85;
}

.scene-quote {
  margin-bottom: 0.25rem;
}

.quote-text {
  font-family: var(--font-serif);
  font-size: 2.75rem;
  font-weight: 600;
  color: white;
  letter-spacing: -0.01em;
  margin: 0 0 0.625rem;
  line-height: 1.15;
}

.quote-sub {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  letter-spacing: 0.06em;
}

/* ===== 右侧表单区 ===== */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafaf9;
  padding: 2rem 2.5rem;
}

.form-card {
  width: 100%;
  max-width: 320px;
  animation: form-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes form-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标题 */
.card-heading {
  margin-bottom: 2rem;
}

.heading-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: #1c1917;
  letter-spacing: -0.01em;
  margin: 0 0 0.375rem;
}

.heading-sub {
  font-size: 0.8125rem;
  color: #78716c;
  margin: 0;
}

/* 消息 */
.msg {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  margin-bottom: 0.875rem;
  text-align: center;
  border: 1px solid;
}
.msg-warn {
  background: #fefce8;
  border-color: #fde68a;
  color: #92400e;
}
.msg-error {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}
.msg-info {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

/* 字段 */
.fields {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-bottom: 1.125rem;
}

.field {
  display: flex;
  flex-direction: column;
}

.field-input {
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgba(28, 25, 23, 0.08);
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  color: #1c1917;
  background: white;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}
.field-input:focus {
  border-color: rgba(28, 25, 23, 0.2);
  box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.04);
}
.field-input:disabled {
  background: #f5f4f2;
  color: #a8a29e;
  cursor: not-allowed;
}
.field-input::placeholder {
  color: #a8a29e;
}

/* PIN */
.pin-wrap {
  position: relative;
}
.pin-input {
  padding-right: 2.75rem;
}
.pin-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #a8a29e;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.pin-toggle:hover:not(:disabled) {
  color: #78716c;
}
.pin-toggle:disabled {
  cursor: not-allowed;
}

/* 按钮 */
.btn-primary {
  width: 100%;
  height: 2.75rem;
  background: #1c1917;
  color: #fafaf9;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    background 0.15s,
    transform 0.1s;
  letter-spacing: 0.01em;
}
.btn-primary:hover:not(:disabled) {
  background: #292524;
}
.btn-primary:active:not(:disabled) {
  transform: scale(0.99);
}
.btn-primary:disabled {
  background: #d6d3d1;
  color: #fafaf9;
  cursor: not-allowed;
}

/* 链接 */
.card-links {
  margin-top: 0.875rem;
  display: flex;
  justify-content: center;
}

.link-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #a8a29e;
  padding: 0;
  transition: color 0.15s;
}
.link-btn:hover {
  color: #78716c;
}
.link-btn-arrow {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* 图标 */
.icon {
  width: 1rem;
  height: 1rem;
}
.icon-sm {
  width: 0.875rem;
  height: 0.875rem;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 验证码行 */
.otp-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.otp-row .field-input {
  flex: 1;
  min-width: 0;
}

.otp-btn {
  flex-shrink: 0;
  height: 2.625rem;
  padding: 0 0.875rem;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 0.375rem;
  background: white;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #57534e;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
  white-space: nowrap;
}
.otp-btn:hover:not(:disabled) {
  border-color: rgba(28, 25, 23, 0.25);
  color: #1c1917;
  background: #fafaf9;
}
.otp-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .scene-panel {
    display: none;
  }
  .form-panel {
    flex: 1;
  }
}
</style>
