<script setup lang="ts">
import { LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import type { MemberDto, MemberListResponse } from '~/types/member'

const search = ref('')
const level = ref('')
const submitting = ref(false)
const deletingId = ref('')
const editingId = ref('')
const formError = ref('')
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatDate } = useFormat()

const form = reactive({
  phone: '',
  name: '',
  level: 'NORMAL'
})

const query = computed(() => ({
  search: search.value.trim() || undefined,
  level: level.value || undefined,
  page: 1,
  pageSize: 100
}))

const { data, pending, error, refresh } = await useAsyncData(
  'members',
  () => $fetch<MemberListResponse>('/api/customers', { params: query.value }),
  { watch: [query] }
)

const members = computed(() => data.value?.items ?? [])
const isEditMode = computed(() => Boolean(editingId.value))
const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '会员列表加载失败') : ''
)

const resetForm = () => {
  form.phone = ''
  form.name = ''
  form.level = 'NORMAL'
  editingId.value = ''
  formError.value = ''
}

const startCreate = () => {
  resetForm()
}

const startEdit = (member: MemberDto) => {
  editingId.value = member.id
  form.phone = member.phone
  form.name = member.name ?? ''
  form.level = member.level
  formError.value = ''
}

const submitForm = async () => {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''

  try {
    if (isEditMode.value) {
      await $fetch(`/api/customers/${editingId.value}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          level: form.level
        }
      })
      toast({ title: '会员已更新', variant: 'success', duration: 2500 })
    } else {
      await $fetch('/api/customers', {
        method: 'POST',
        body: {
          phone: form.phone,
          name: form.name
        }
      })
      toast({ title: '会员已创建', variant: 'success', duration: 2500 })
    }

    await refresh()
    resetForm()
  } catch (err) {
    formError.value = getApiErrorMessage(err, '保存失败')
    toast({ title: formError.value, variant: 'error', duration: 2500 })
  } finally {
    submitting.value = false
  }
}

const removeMember = async (member: MemberDto) => {
  if (deletingId.value) return
  if (!window.confirm(`确认删除会员 ${member.phone}？`)) return

  deletingId.value = member.id
  try {
    await $fetch(`/api/customers/${member.id}`, { method: 'DELETE' })
    toast({ title: '会员已删除', variant: 'success', duration: 2500 })
    await refresh()
    if (editingId.value === member.id) {
      resetForm()
    }
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除失败'), variant: 'error', duration: 2500 })
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="rounded-2xl border border-slate-100 bg-white p-6">
      <h2 class="text-2xl font-semibold tracking-tight text-slate-900">会员管理</h2>
      <p class="mt-2 text-sm text-slate-500">支持会员建档、筛选、编辑、删除和积分查看。</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-4 rounded-2xl border border-slate-100 bg-white p-6">
        <div class="flex flex-wrap gap-3">
          <label
            class="flex flex-1 items-center gap-2 rounded-xl border border-slate-100 px-3 py-2"
          >
            <Search class="h-4 w-4 text-slate-400" />
            <input
              v-model="search"
              type="text"
              placeholder="搜索手机号或姓名"
              class="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select v-model="level" class="rounded-xl border border-slate-100 px-3 py-2 text-sm">
            <option value="">全部等级</option>
            <option value="NORMAL">NORMAL</option>
            <option value="SILVER">SILVER</option>
            <option value="GOLD">GOLD</option>
          </select>
        </div>

        <div
          v-if="errorMsg"
          class="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600"
        >
          {{ errorMsg }}
        </div>

        <div v-if="pending" class="py-8 text-sm text-slate-500">加载中...</div>

        <div v-else class="space-y-3">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center justify-between rounded-xl border border-slate-100 p-4"
          >
            <div>
              <p class="font-medium text-slate-900">{{ member.name || '未命名会员' }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ member.phone }}</p>
              <p class="mt-1 text-xs text-slate-400">
                {{ member.level }} · {{ member.points }} 积分 · {{ formatDate(member.createdAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-200 p-2 text-slate-600"
                @click="startEdit(member)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 p-2 text-rose-600 disabled:opacity-50"
                :disabled="deletingId === member.id"
                @click="removeMember(member)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            v-if="!members.length"
            class="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"
          >
            暂无会员
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-slate-900">
            {{ isEditMode ? '编辑会员' : '新增会员' }}
          </h3>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            @click="startCreate"
          >
            <Plus class="h-4 w-4" />
            新建会员
          </button>
        </div>

        <div class="space-y-3">
          <input
            v-model="form.phone"
            type="text"
            placeholder="手机号"
            :disabled="isEditMode"
            class="w-full rounded-xl border border-slate-100 px-3 py-2 text-sm outline-none disabled:bg-slate-50"
          />
          <input
            v-model="form.name"
            type="text"
            placeholder="姓名，可选"
            class="w-full rounded-xl border border-slate-100 px-3 py-2 text-sm outline-none"
          />
          <select
            v-model="form.level"
            class="w-full rounded-xl border border-slate-100 px-3 py-2 text-sm outline-none"
          >
            <option value="NORMAL">NORMAL</option>
            <option value="SILVER">SILVER</option>
            <option value="GOLD">GOLD</option>
          </select>
        </div>

        <p v-if="formError" class="mt-3 text-sm text-rose-600">{{ formError }}</p>

        <button
          type="button"
          class="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
          :disabled="submitting"
          @click="submitForm"
        >
          <LoaderCircle v-if="submitting" class="mx-auto h-4 w-4 animate-spin" />
          <span v-else>{{ isEditMode ? '保存修改' : '创建会员' }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
