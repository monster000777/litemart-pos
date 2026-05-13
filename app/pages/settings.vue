<script setup lang="ts">
import {
  KeyRound,
  LoaderCircle,
  Pencil,
  QrCode,
  RefreshCw,
  Send,
  UserCircle
} from 'lucide-vue-next'
import { AUTH_PASSWORD_MAX_LENGTH } from '~~/shared/constants/auth'
import { roleHasAtLeast, USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const authRole = useState<UserRole | null>('auth:role')

const submittingPin = ref(false)
const refreshingCode = ref(false)

// Phone editing state
const isEditingPhone = ref(false)
const phoneEditForm = reactive({ newPhone: '', code: '' })
const sendingCode = ref(false)
const codeCooldown = ref(0)
const helperMessage = ref('')
let codeTimer: ReturnType<typeof setInterval> | null = null

const profileForm = reactive({ uid: '', phone: '' })
const pinForm = reactive({ oldPin: '', newPin: '', confirmPin: '' })

const inviteCode = ref<string | null>(null)
const initialUid = ref('')

onMounted(async () => {
  try {
    const session = await $fetch('/api/auth/session')
    profileForm.uid = session.user?.uid || ''
    profileForm.phone = session.user?.phone || ''
    initialUid.value = profileForm.uid

    if (roleHasAtLeast(authRole.value, USER_ROLES.MANAGER)) {
      const res = await $fetch('/api/auth/invite-code')
      inviteCode.value = res.inviteCode
    }
  } catch (err) {
    console.error('Failed to load settings data', err)
  }
})

onUnmounted(() => {
  if (codeTimer) clearInterval(codeTimer)
})

const startEditPhone = () => {
  isEditingPhone.value = true
  phoneEditForm.newPhone = ''
  phoneEditForm.code = ''
  helperMessage.value = ''
}

const cancelEditPhone = () => {
  isEditingPhone.value = false
  phoneEditForm.newPhone = ''
  phoneEditForm.code = ''
  helperMessage.value = ''
  if (codeTimer) {
    clearInterval(codeTimer)
    codeTimer = null
  }
  codeCooldown.value = 0
}

const sendPhoneCode = async () => {
  const phone = phoneEditForm.newPhone.trim()
  if (!phone || !/^1\d{10}$/.test(phone)) {
    helperMessage.value = '请输入正确的 11 位手机号'
    return
  }

  if (phone === profileForm.phone) {
    helperMessage.value = '新手机号不能与当前相同'
    return
  }

  sendingCode.value = true
  helperMessage.value = ''
  try {
    const res = await $fetch<{ success: boolean; message: string; mockCode?: string }>(
      '/api/auth/send-change-phone-otp',
      {
        method: 'POST',
        body: { phone }
      }
    )

    if (res.mockCode) {
      helperMessage.value = `验证码已发送。为了方便测试，验证码是: ${res.mockCode}`
    } else {
      helperMessage.value = '验证码已发送，请查收'
    }

    // Start countdown
    codeCooldown.value = 60
    codeTimer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) {
        codeCooldown.value = 0
        if (codeTimer) clearInterval(codeTimer)
      }
    }, 1000)
  } catch (err) {
    helperMessage.value = getApiErrorMessage(err, '发送验证码失败')
  } finally {
    sendingCode.value = false
  }
}

const submittingPhoneChange = ref(false)

const submitPhoneChange = async () => {
  const phone = phoneEditForm.newPhone.trim()
  const code = phoneEditForm.code.trim()

  if (!phone || !/^1\d{10}$/.test(phone)) {
    toast({ title: '请输入正确的手机号', variant: 'error', duration: 3000 })
    return
  }

  if (!code || !/^\d{6}$/.test(code)) {
    toast({ title: '请输入6位验证码', variant: 'error', duration: 3000 })
    return
  }

  submittingPhoneChange.value = true
  try {
    await $fetch('/api/auth/change-phone', {
      method: 'POST',
      body: { phone, code }
    })
    profileForm.phone = phone
    toast({ title: '手机号更换成功', variant: 'success', duration: 3000 })
    cancelEditPhone()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '更换手机号失败'), variant: 'error', duration: 3000 })
  } finally {
    submittingPhoneChange.value = false
  }
}

const submitPin = async () => {
  if (submittingPin.value || !pinForm.oldPin || !pinForm.newPin || !pinForm.confirmPin) return
  submittingPin.value = true
  try {
    await $fetch('/api/auth/reset-pin', {
      method: 'POST',
      body: {
        uid: initialUid.value,
        oldPin: pinForm.oldPin,
        newPin: pinForm.newPin,
        confirmPin: pinForm.confirmPin
      }
    })
    toast({ title: '密码修改成功', variant: 'success', duration: 3000 })
    pinForm.oldPin = ''
    pinForm.newPin = ''
    pinForm.confirmPin = ''
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '密码修改失败'), variant: 'error', duration: 3000 })
  } finally {
    submittingPin.value = false
  }
}

const refreshInviteCode = async () => {
  if (refreshingCode.value) return
  const confirmed = window.confirm('刷新邀请码后，旧的邀请码将立即失效。确认刷新？')
  if (!confirmed) return

  refreshingCode.value = true
  try {
    const res = await $fetch<{ inviteCode: string }>('/api/auth/invite-code', { method: 'POST' })
    inviteCode.value = res.inviteCode
    toast({ title: '邀请码已刷新', variant: 'success', duration: 3000 })
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '刷新邀请码失败'), variant: 'error', duration: 3000 })
  } finally {
    refreshingCode.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-6">
    <header class="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-8">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Settings</p>
      <h2 class="text-2xl font-semibold tracking-tight text-slate-900">系统设置</h2>
    </header>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- 个人信息 -->
      <article class="flex flex-col rounded-2xl border border-slate-100 bg-white p-6">
        <div class="mb-6 flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
          >
            <UserCircle class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-medium text-slate-900">个人资料</h3>
            <p class="text-xs text-slate-500">修改您的登录账号名称</p>
          </div>
        </div>

        <div class="flex flex-1 flex-col space-y-4">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">账号 UID</span>
            <input
              v-model="profileForm.uid"
              type="text"
              readonly
              class="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed"
            />
          </label>
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">绑定手机号</span>
            <div class="flex items-center gap-2">
              <span
                class="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500"
              >
                {{ profileForm.phone || '未绑定' }}
              </span>
              <button
                v-if="!isEditingPhone"
                type="button"
                class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                @click="startEditPhone"
              >
                <Pencil class="h-4 w-4" />
                <span>编辑</span>
              </button>
            </div>
          </label>

          <!-- Phone edit panel -->
          <div
            v-if="isEditingPhone"
            class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">新手机号</span>
              <div class="flex gap-2">
                <input
                  v-model="phoneEditForm.newPhone"
                  type="text"
                  inputmode="numeric"
                  maxlength="11"
                  placeholder="请输入新手机号"
                  class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                  :disabled="sendingCode || codeCooldown > 0"
                  @click="sendPhoneCode"
                >
                  <LoaderCircle v-if="sendingCode" class="h-4 w-4 animate-spin" />
                  <Send v-else class="h-4 w-4" />
                  <span>{{ codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码' }}</span>
                </button>
              </div>
            </label>
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">验证码</span>
              <input
                v-model="phoneEditForm.code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="请输入6位验证码"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <!-- Helper message -->
            <p v-if="helperMessage" class="text-xs text-slate-500">{{ helperMessage }}</p>
            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                @click="cancelEditPhone"
              >
                取消
              </button>
              <button
                type="button"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                :disabled="submittingPhoneChange || !phoneEditForm.code"
                @click="submitPhoneChange"
              >
                <LoaderCircle v-if="submittingPhoneChange" class="h-4 w-4 animate-spin" />
                <span>确认更换</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      <!-- 修改密码 -->
      <article class="flex flex-col rounded-2xl border border-slate-100 bg-white p-6">
        <div class="mb-6 flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
          >
            <KeyRound class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-medium text-slate-900">修改登录密码</h3>
            <p class="text-xs text-slate-500">凭旧密码设置新的登录密码</p>
          </div>
        </div>

        <form class="flex flex-1 flex-col space-y-4" @submit.prevent="submitPin">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">当前密码</span>
            <input
              v-model="pinForm.oldPin"
              type="password"
              :maxlength="AUTH_PASSWORD_MAX_LENGTH"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">新密码</span>
              <input
                v-model="pinForm.newPin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">确认新密码</span>
              <input
                v-model="pinForm.confirmPin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
          </div>
          <div class="mt-auto pt-4">
            <button
              type="submit"
              class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
              :disabled="submittingPin || !pinForm.oldPin || !pinForm.newPin || !pinForm.confirmPin"
            >
              <LoaderCircle v-if="submittingPin" class="h-4 w-4 animate-spin" />
              <span>确认修改</span>
            </button>
          </div>
        </form>
      </article>

      <!-- 员工邀请码 (仅店长/管理员) -->
      <article
        v-if="roleHasAtLeast(authRole, USER_ROLES.MANAGER)"
        class="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 md:col-span-2"
      >
        <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
            >
              <QrCode class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-slate-900">员工注册邀请码</h3>
              <p class="text-xs text-slate-500">新员工需凭此 6 位邀请码完成自助注册</p>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
            :disabled="refreshingCode"
            @click="refreshInviteCode"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': refreshingCode }" />
            <span>刷新邀请码</span>
          </button>
        </div>

        <div
          class="flex items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 py-10"
        >
          <span
            v-if="inviteCode"
            class="font-mono text-4xl font-bold tracking-[0.25em] text-emerald-700"
            >{{ inviteCode }}</span
          >
          <LoaderCircle v-else class="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </article>
    </div>
  </section>
</template>
