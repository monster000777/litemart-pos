<script setup lang="ts">
import { useAutoAnimate } from '@formkit/auto-animate/vue'
import {
  Building2,
  Download,
  LoaderCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck
} from 'lucide-vue-next'
import Sheet from '~/components/ui/sheet/Sheet.vue'
import SheetContent from '~/components/ui/sheet/SheetContent.vue'
import SheetDescription from '~/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '~/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '~/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '~/components/ui/sheet/SheetTitle.vue'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import type { SupplierDto } from '~/types/supplier'

const search = ref('')
const statusFilter = ref('')
const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const deletingId = ref('')
const formError = ref('')
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatDate } = useFormat()

const queryParams = computed(() => ({
  status: statusFilter.value || undefined,
  search: search.value.trim() || undefined
}))

const { data, pending, error, refresh } = await useAsyncData(
  'suppliers',
  () => $fetch<SupplierDto[]>('/api/suppliers', { params: queryParams.value }),
  { watch: [queryParams] }
)

const suppliers = computed(() => data.value ?? [])
const activeCount = computed(() => suppliers.value.filter((s) => s.status === 'ACTIVE').length)
const inactiveCount = computed(() => suppliers.value.filter((s) => s.status !== 'ACTIVE').length)

const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '供应商加载失败') : ''
)

const [listRef] = useAutoAnimate()

const form = reactive({
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
})

const isEditMode = computed(() => Boolean(editingId.value))
const formTitle = computed(() => (isEditMode.value ? '编辑供应商' : '新增供应商'))

const resetForm = () => {
  form.name = ''
  form.contactName = ''
  form.phone = ''
  form.email = ''
  form.address = ''
  form.notes = ''
}

const openCreate = () => {
  editingId.value = null
  resetForm()
  formError.value = ''
  sheetOpen.value = true
}

const openEdit = (supplier: SupplierDto) => {
  editingId.value = supplier.id
  form.name = supplier.name
  form.contactName = supplier.contactName || ''
  form.phone = supplier.phone || ''
  form.email = supplier.email || ''
  form.address = supplier.address || ''
  form.notes = supplier.notes || ''
  formError.value = ''
  sheetOpen.value = true
}

const submitForm = async () => {
  if (submitting.value) return
  if (!form.name.trim()) {
    formError.value = '供应商名称不能为空'
    return
  }

  submitting.value = true
  formError.value = ''

  try {
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null
    }

    if (isEditMode.value && editingId.value) {
      await $fetch(`/api/suppliers/${editingId.value}`, { method: 'PATCH', body: payload })
      toast({ title: '供应商更新成功', variant: 'success', duration: 3000 })
    } else {
      await $fetch('/api/suppliers', { method: 'POST', body: payload })
      toast({ title: '供应商新增成功', variant: 'success', duration: 3000 })
    }

    await refresh()
    sheetOpen.value = false
  } catch (err) {
    formError.value = getApiErrorMessage(err, '操作失败，请稍后重试')
    toast({ title: `操作失败：${formError.value}`, variant: 'error', duration: 3000 })
  } finally {
    submitting.value = false
  }
}

const deleteSupplier = async (supplier: SupplierDto) => {
  if (deletingId.value) return

  const ok = window.confirm(`确认删除供应商「${supplier.name}」？`)
  if (!ok) return

  deletingId.value = supplier.id
  try {
    await $fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' })
    toast({ title: '供应商已删除', variant: 'success', duration: 3000 })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除失败'), variant: 'error', duration: 3000 })
  } finally {
    deletingId.value = ''
  }
}

const toggleStatus = async (supplier: SupplierDto) => {
  const newStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    await $fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH',
      body: { status: newStatus }
    })
    toast({
      title: `供应商已${newStatus === 'ACTIVE' ? '启用' : '停用'}`,
      variant: 'success',
      duration: 3000
    })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '操作失败'), variant: 'error', duration: 3000 })
  }
}

const exportCsv = () => {
  if (!suppliers.value.length) return
  const header = '供应商名称,联系人,电话,邮箱,地址,状态,商品数,采购单数'
  const rows = suppliers.value.map((s) => {
    const status = s.status === 'ACTIVE' ? '合作中' : '已停用'
    return `${s.name},${s.contactName || '-'},${s.phone || '-'},${s.email || '-'},${s.address || '-'},${status},${s._count?.products || 0},${s._count?.purchaseOrders || 0}`
  })
  const csv = '\uFEFF' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `suppliers_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="space-y-6">
    <header
      class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-8"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          Supplier Management
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">供应商管理</h2>
        <p class="mt-2 text-sm text-slate-500">
          合作中 <span class="font-medium text-emerald-600">{{ activeCount }}</span> · 已停用
          <span class="font-medium text-slate-400">{{ inactiveCount }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
          :disabled="!suppliers.length"
          @click="exportCsv"
        >
          <Download class="h-4 w-4" />
          导出 CSV
        </button>
        <NuxtLink
          to="/purchase-orders"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
        >
          <Truck class="h-4 w-4" />
          采购管理
        </NuxtLink>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:text-slate-900"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          新增供应商
        </button>
      </div>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <label
        class="flex flex-1 items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2"
      >
        <Search class="h-4 w-4 text-slate-400" />
        <input
          v-model="search"
          type="text"
          placeholder="搜索供应商名称、联系人、电话..."
          class="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </label>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      >
        <option value="">全部状态</option>
        <option value="ACTIVE">合作中</option>
        <option value="INACTIVE">已停用</option>
      </select>
    </div>

    <div
      v-if="errorMsg"
      class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-sm text-rose-600"
    >
      {{ errorMsg }}
    </div>

    <div v-if="pending" class="space-y-3">
      <div v-for="i in 5" :key="i" class="rounded-2xl border border-slate-100 bg-white p-5">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <Skeleton class="h-5 w-40" />
            <Skeleton class="h-3 w-24" />
          </div>
          <Skeleton class="h-8 w-20" />
        </div>
      </div>
    </div>

    <div v-if="!pending && suppliers.length" ref="listRef" class="space-y-3">
      <div
        v-for="supplier in suppliers"
        :key="supplier.id"
        class="rounded-2xl border border-slate-100 bg-white p-5 transition-all hover:border-slate-200"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-zinc-50"
            >
              <Building2 class="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-slate-900">{{ supplier.name }}</h3>
                <span
                  class="rounded-full border px-2 py-0.5 text-xs font-medium"
                  :class="
                    supplier.status === 'ACTIVE'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  "
                >
                  {{ supplier.status === 'ACTIVE' ? '合作中' : '已停用' }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span v-if="supplier.contactName" class="flex items-center gap-1">
                  {{ supplier.contactName }}
                </span>
                <span v-if="supplier.phone" class="flex items-center gap-1">
                  <Phone class="h-3 w-3" />
                  {{ supplier.phone }}
                </span>
                <span v-if="supplier.email">
                  {{ supplier.email }}
                </span>
              </div>
              <div class="mt-3 flex items-center gap-3">
                <span class="rounded-full bg-zinc-50 px-2.5 py-1 text-xs text-slate-500">
                  商品 {{ supplier._count?.products || 0 }}
                </span>
                <span class="rounded-full bg-zinc-50 px-2.5 py-1 text-xs text-slate-500">
                  采购单 {{ supplier._count?.purchaseOrders || 0 }}
                </span>
                <span class="text-xs text-slate-400">
                  {{ formatDate(supplier.createdAt) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
              @click="toggleStatus(supplier)"
            >
              {{ supplier.status === 'ACTIVE' ? '停用' : '启用' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500 transition hover:text-slate-900"
              @click="openEdit(supplier)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500 transition hover:text-rose-600 disabled:opacity-50"
              :disabled="deletingId === supplier.id"
              @click="deleteSupplier(supplier)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!pending && !suppliers.length && !errorMsg"
      class="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500"
    >
      暂无供应商数据
    </div>

    <Sheet v-model:open="sheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{{ formTitle }}</SheetTitle>
          <SheetDescription>
            {{ isEditMode ? '修改供应商信息' : '添加新的供应商到系统' }}
          </SheetDescription>
        </SheetHeader>

        <form class="mt-8 space-y-5" @submit.prevent="submitForm">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">供应商名称 *</label>
            <input
              v-model.trim="form.name"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">联系人</label>
            <input
              v-model.trim="form.contactName"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">电话</label>
              <input
                v-model.trim="form.phone"
                type="text"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">邮箱</label>
              <input
                v-model.trim="form.email"
                type="email"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">地址</label>
            <input
              v-model.trim="form.address"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">备注</label>
            <textarea
              v-model.trim="form.notes"
              rows="3"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none resize-none"
            />
          </div>

          <p
            v-if="formError"
            class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {{ formError }}
          </p>

          <SheetFooter>
            <button
              type="button"
              class="rounded-xl border border-slate-100 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-zinc-50"
              @click="sheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              :disabled="submitting"
            >
              <LoaderCircle v-if="submitting" class="mx-auto h-4 w-4 animate-spin" />
              <span v-else>保存</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </section>
</template>
