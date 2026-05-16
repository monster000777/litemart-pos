<script setup lang="ts">
import {
  Crown,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound
} from 'lucide-vue-next'
import Sheet from '~/components/ui/sheet/Sheet.vue'
import SheetContent from '~/components/ui/sheet/SheetContent.vue'
import SheetDescription from '~/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '~/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '~/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '~/components/ui/sheet/SheetTitle.vue'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import Table from '~/components/ui/table/Table.vue'
import TableBody from '~/components/ui/table/TableBody.vue'
import TableCell from '~/components/ui/table/TableCell.vue'
import TableHead from '~/components/ui/table/TableHead.vue'
import TableHeader from '~/components/ui/table/TableHeader.vue'
import TableRow from '~/components/ui/table/TableRow.vue'
import type { AuthUserDto, AuthUserListResponse } from '~/types/auth-user'
import { AUTH_PASSWORD_MAX_LENGTH } from '~~/shared/constants/auth'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

const { toast } = useToast()
const { getApiErrorMessage } = useApiError()

const { data, pending, error, refresh } = await useAsyncData('auth-users', () =>
  $fetch<AuthUserListResponse>('/api/auth/users')
)

const users = computed(() => data.value?.users ?? [])
const currentUserId = computed(() => data.value?.currentUserId ?? '')
const activeCount = computed(() => users.value.filter((user) => user.status === 'ACTIVE').length)
const inactiveCount = computed(() => users.value.filter((user) => user.status !== 'ACTIVE').length)
const adminCount = computed(
  () => users.value.filter((user) => user.role === USER_ROLES.ADMIN).length
)
const managerCount = computed(
  () => users.value.filter((user) => user.role === USER_ROLES.MANAGER).length
)
const cashierCount = computed(
  () => users.value.filter((user) => user.role === USER_ROLES.CASHIER).length
)
const activeAdminCount = computed(
  () =>
    users.value.filter((user) => user.role === USER_ROLES.ADMIN && user.status === 'ACTIVE').length
)
const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '账号列表加载失败，请稍后重试') : ''
)

const canDemoteOrDisable = (user: AuthUserDto) => {
  if (user.id === currentUserId.value) return false
  if (user.role === USER_ROLES.ADMIN && user.status === 'ACTIVE') {
    return activeAdminCount.value > 1
  }
  return true
}

const canDelete = (user: AuthUserDto) => canDemoteOrDisable(user)

const createSheetOpen = ref(false)
const resetSheetOpen = ref(false)
const editSheetOpen = ref(false)
const submitting = ref(false)
const resetting = ref(false)
const mutatingId = ref('')
const createError = ref('')
const resetError = ref('')
const editError = ref('')
const resetTarget = ref<AuthUserDto | null>(null)
const editTarget = ref<AuthUserDto | null>(null)

const createForm = reactive({
  phone: '',
  role: USER_ROLES.CASHIER as UserRole,
  pin: '',
  confirmPin: ''
})

const resetForm = reactive({
  newPin: '',
  confirmPin: ''
})

const editForm = reactive({
  phone: '',
  role: USER_ROLES.CASHIER as UserRole
})

const stats = computed(() => [
  {
    label: '启用账号',
    value: activeCount.value,
    note: `停用 ${inactiveCount.value}`,
    icon: ShieldCheck
  },
  {
    label: '管理员',
    value: adminCount.value,
    note: '拥有完整后台权限',
    icon: Crown
  },
  {
    label: '店长',
    value: managerCount.value,
    note: '可访问经营与库存',
    icon: UserCog
  },
  {
    label: '收银员',
    value: cashierCount.value,
    note: '用于前台收银',
    icon: UserRound
  }
])

const resetCreateForm = () => {
  createForm.phone = ''
  createForm.role = USER_ROLES.CASHIER
  createForm.pin = ''
  createForm.confirmPin = ''
}

const openCreateSheet = () => {
  resetCreateForm()
  createError.value = ''
  createSheetOpen.value = true
}

const openResetSheet = (user: AuthUserDto) => {
  resetTarget.value = user
  resetForm.newPin = ''
  resetForm.confirmPin = ''
  resetError.value = ''
  resetSheetOpen.value = true
}

const openEditSheet = (user: AuthUserDto) => {
  editTarget.value = user
  editForm.phone = user.phone
  editForm.role = user.role
  editError.value = ''
  editSheetOpen.value = true
}

const submitCreate = async () => {
  if (submitting.value) return

  submitting.value = true
  createError.value = ''
  try {
    await $fetch('/api/auth/users', {
      method: 'POST',
      body: {
        phone: createForm.phone,
        role: createForm.role,
        pin: createForm.pin,
        confirmPin: createForm.confirmPin
      }
    })
    toast({ title: '账号已创建', variant: 'success', duration: 3000 })
    createSheetOpen.value = false
    await refresh()
  } catch (err) {
    createError.value = getApiErrorMessage(err, '创建账号失败，请稍后重试')
    toast({ title: createError.value, variant: 'error', duration: 3000 })
  } finally {
    submitting.value = false
  }
}

const submitEdit = async () => {
  if (submitting.value || !editTarget.value) return

  submitting.value = true
  editError.value = ''
  try {
    await $fetch(`/api/auth/users/${editTarget.value.id}`, {
      method: 'PATCH',
      body: {
        phone: editForm.phone,
        role: editForm.role !== editTarget.value.role ? editForm.role : undefined
      }
    })
    toast({ title: '账号信息已更新', variant: 'success', duration: 3000 })
    editSheetOpen.value = false
    await refresh()
  } catch (err) {
    editError.value = getApiErrorMessage(err, '更新账号失败，请稍后重试')
    toast({ title: editError.value, variant: 'error', duration: 3000 })
  } finally {
    submitting.value = false
  }
}

const toggleRole = async (user: AuthUserDto) => {
  if (mutatingId.value) return

  const nextRole =
    user.role === USER_ROLES.ADMIN
      ? USER_ROLES.MANAGER
      : user.role === USER_ROLES.MANAGER
        ? USER_ROLES.CASHIER
        : USER_ROLES.MANAGER

  mutatingId.value = user.id
  try {
    await $fetch(`/api/auth/users/${user.id}`, {
      method: 'PATCH',
      body: { role: nextRole }
    })
    toast({
      title: `${user.uid} 已切换为 ${ROLE_LABELS[nextRole]}`,
      variant: 'success',
      duration: 3000
    })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '角色更新失败'), variant: 'error', duration: 3000 })
  } finally {
    mutatingId.value = ''
  }
}

const toggleStatus = async (user: AuthUserDto) => {
  if (mutatingId.value) return

  const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  mutatingId.value = user.id
  try {
    await $fetch(`/api/auth/users/${user.id}`, {
      method: 'PATCH',
      body: { status: nextStatus }
    })
    toast({
      title: `${user.uid} 已${nextStatus === 'ACTIVE' ? '启用' : '停用'}`,
      variant: 'success',
      duration: 3000
    })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '状态更新失败'), variant: 'error', duration: 3000 })
  } finally {
    mutatingId.value = ''
  }
}

const deleteUser = async (user: AuthUserDto) => {
  if (mutatingId.value || !canDelete(user)) return

  const confirmed = window.confirm(`确认删除账号「${user.uid}」？此操作不可恢复。`)
  if (!confirmed) return

  mutatingId.value = user.id
  try {
    await $fetch(`/api/auth/users/${user.id}`, {
      method: 'DELETE'
    })
    toast({
      title: `${user.uid} 已删除`,
      variant: 'success',
      duration: 3000
    })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除账号失败'), variant: 'error', duration: 3000 })
  } finally {
    mutatingId.value = ''
  }
}

const submitResetPin = async () => {
  if (resetting.value || !resetTarget.value) return

  resetting.value = true
  resetError.value = ''
  try {
    await $fetch(`/api/auth/users/${resetTarget.value.id}/reset-pin`, {
      method: 'POST',
      body: {
        newPin: resetForm.newPin,
        confirmPin: resetForm.confirmPin
      }
    })
    toast({
      title: `${resetTarget.value.uid} 的密码已重置`,
      variant: 'success',
      duration: 3000
    })
    resetSheetOpen.value = false
  } catch (err) {
    resetError.value = getApiErrorMessage(err, '密码重置失败，请稍后重试')
    toast({ title: resetError.value, variant: 'error', duration: 3000 })
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <header
      class="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-8 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          User Management
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">账号管理</h2>
        <p class="mt-2 text-sm text-slate-500">
          当前共 {{ users.length }} 个账号，其中启用 {{ activeCount }} 个，停用
          {{ inactiveCount }} 个。
        </p>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)]"
        @click="openCreateSheet"
      >
        <Plus class="h-4 w-4" />
        新增账号
      </button>
    </header>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <article
        v-for="item in stats"
        :key="item.label"
        class="rounded-2xl border border-slate-100 bg-white p-5"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500">{{ item.label }}</p>
            <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {{ item.value }}
            </p>
          </div>
          <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <component :is="item.icon" class="h-5 w-5" />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-400">{{ item.note }}</p>
      </article>
    </div>

    <div
      v-if="errorMsg"
      class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600"
    >
      {{ errorMsg }}
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>UID & 手机号</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>说明</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="pending">
            <TableRow v-for="i in 4" :key="`skeleton-${i}`">
              <TableCell colspan="5">
                <div class="flex items-center gap-3 py-2">
                  <Skeleton class="h-9 w-9 rounded-full" />
                  <div class="space-y-2">
                    <Skeleton class="h-4 w-24" />
                    <Skeleton class="h-3 w-16" />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </template>

          <template v-else>
            <TableRow v-for="user in users" :key="user.id">
              <TableCell class="font-medium text-slate-900">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                  >
                    <UserRound class="h-4 w-4" />
                  </div>
                  <div>
                    <p>{{ user.uid }}</p>
                    <p class="text-xs text-slate-400">
                      {{ user.phone }} &bull;
                      {{ user.id === currentUserId ? '当前登录账号' : '收银台账号' }}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="
                    user.role === USER_ROLES.ADMIN
                      ? 'border-violet-100 bg-violet-50 text-violet-700'
                      : user.role === USER_ROLES.MANAGER
                        ? 'border-sky-100 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                  "
                >
                  {{ ROLE_LABELS[user.role] }}
                </span>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="
                    user.status === 'ACTIVE'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  "
                >
                  {{ user.status === 'ACTIVE' ? '启用中' : '已停用' }}
                </span>
              </TableCell>
              <TableCell class="text-sm text-slate-500">
                {{
                  user.role === USER_ROLES.ADMIN ? '拥有完整后台权限' : '使用账号名称 + 密码登录'
                }}
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    @click="openEditSheet(user)"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                    编辑
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="mutatingId === user.id || !canDemoteOrDisable(user)"
                    :title="
                      !canDemoteOrDisable(user) ? '无法调整当前账号或最后一个启用中的管理员' : ''
                    "
                    @click="toggleRole(user)"
                  >
                    <template v-if="user.role === USER_ROLES.ADMIN">设为店长</template>
                    <template v-else>{{
                      user.role === USER_ROLES.MANAGER ? '设为收银员' : '设为店长'
                    }}</template>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="mutatingId === user.id || !canDemoteOrDisable(user)"
                    :title="
                      !canDemoteOrDisable(user) ? '无法停用当前账号或最后一个启用中的管理员' : ''
                    "
                    @click="toggleStatus(user)"
                  >
                    {{ user.status === 'ACTIVE' ? '停用' : '启用' }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    @click="openResetSheet(user)"
                  >
                    <KeyRound class="h-3.5 w-3.5" />
                    重置密码
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="mutatingId === user.id || !canDelete(user)"
                    :title="!canDelete(user) ? '无法删除当前账号或最后一个启用中的管理员' : ''"
                    @click="deleteUser(user)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </TableCell>
            </TableRow>
          </template>

          <TableRow v-if="!pending && !users.length">
            <TableCell colspan="5">
              <div class="py-10 text-center text-sm text-slate-500">暂无账号数据</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Sheet v-model:open="createSheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>新增账号</SheetTitle>
          <SheetDescription
            >创建一个新的收银员、店长或管理员账号，并分配独立密码。</SheetDescription
          >
        </SheetHeader>

        <form class="mt-6 space-y-4" @submit.prevent="submitCreate">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">手机号</span>
            <input
              v-model="createForm.phone"
              type="text"
              maxlength="11"
              placeholder="例如：13800138000"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">账号角色</span>
            <select
              v-model="createForm.role"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            >
              <option :value="USER_ROLES.CASHIER">{{ ROLE_LABELS[USER_ROLES.CASHIER] }}</option>
              <option :value="USER_ROLES.MANAGER">{{ ROLE_LABELS[USER_ROLES.MANAGER] }}</option>
              <option :value="USER_ROLES.ADMIN">{{ ROLE_LABELS[USER_ROLES.ADMIN] }}</option>
            </select>
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">登录密码</span>
              <input
                v-model="createForm.pin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                placeholder="请输入登录密码"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">确认密码</span>
              <input
                v-model="createForm.confirmPin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                placeholder="再次输入密码"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <p
            v-if="createError"
            class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {{ createError }}
          </p>

          <SheetFooter>
            <button
              type="button"
              class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 transition hover:text-slate-900"
              @click="createSheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              :disabled="submitting"
            >
              <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
              <span>{{ submitting ? '创建中...' : '创建账号' }}</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <Sheet v-model:open="resetSheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>重置账号密码</SheetTitle>
          <SheetDescription>为「{{ resetTarget?.uid || '-' }}」设置新的登录密码。</SheetDescription>
        </SheetHeader>

        <form class="mt-6 space-y-4" @submit.prevent="submitResetPin">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">新密码</span>
              <input
                v-model="resetForm.newPin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                placeholder="输入新的登录密码"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">确认密码</span>
              <input
                v-model="resetForm.confirmPin"
                type="password"
                :maxlength="AUTH_PASSWORD_MAX_LENGTH"
                placeholder="再次输入密码"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <p
            v-if="resetError"
            class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {{ resetError }}
          </p>

          <SheetFooter>
            <button
              type="button"
              class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 transition hover:text-slate-900"
              @click="resetSheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              :disabled="resetting"
            >
              <LoaderCircle v-if="resetting" class="h-4 w-4 animate-spin" />
              <span>{{ resetting ? '重置中...' : '确认重置' }}</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <Sheet v-model:open="editSheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>编辑账号</SheetTitle>
          <SheetDescription>编辑「{{ editTarget?.uid || '-' }}」的基本信息。</SheetDescription>
        </SheetHeader>

        <form class="mt-6 space-y-4" @submit.prevent="submitEdit">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">手机号</span>
            <input
              v-model="editForm.phone"
              type="text"
              maxlength="11"
              placeholder="例如：13800138000"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">账号角色</span>
            <select
              v-model="editForm.role"
              :disabled="!!editTarget && !canDemoteOrDisable(editTarget)"
              :title="
                !!editTarget && !canDemoteOrDisable(editTarget)
                  ? '无法调整当前账号或最后一个启用中的管理员'
                  : ''
              "
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option :value="USER_ROLES.CASHIER">{{ ROLE_LABELS[USER_ROLES.CASHIER] }}</option>
              <option :value="USER_ROLES.MANAGER">{{ ROLE_LABELS[USER_ROLES.MANAGER] }}</option>
              <option :value="USER_ROLES.ADMIN">{{ ROLE_LABELS[USER_ROLES.ADMIN] }}</option>
            </select>
          </label>

          <p
            v-if="editError"
            class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {{ editError }}
          </p>

          <SheetFooter>
            <button
              type="button"
              class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 transition hover:text-slate-900"
              @click="editSheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              :disabled="submitting || !editForm.phone.trim()"
            >
              <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
              <span>{{ submitting ? '保存中...' : '保存修改' }}</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </section>
</template>
