<script setup lang="ts">
import { Download, ImagePlus, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-vue-next'
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
import type { ProductDto } from '~/types/product'
import type { UploadResponseDto } from '~/types/upload'

const { data, pending, error } = await useAsyncData('inventory-products', () =>
  $fetch<ProductDto[]>('/api/products')
)

const products = computed(() => data.value ?? [])
const warningCount = computed(
  () => products.value.filter((item) => item.stock <= item.minStock).length
)
const healthyCount = computed(() => products.value.length - warningCount.value)

const submitting = ref(false)
const uploadingImage = ref(false)
const deletingId = ref('')
const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const feedback = ref('')
const formError = ref('')
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatPrice } = useFormat()
const { fetchAlerts } = useAlertCount()

const pageError = computed(() =>
  error.value ? getApiErrorMessage(error.value, '库存加载失败，请稍后重试') : ''
)

const form = reactive({
  name: '',
  sku: '',
  category: '',
  image: '',
  price: 0,
  memberPrice: 0,
  stock: 0,
  minStock: 0
})

const isEditMode = computed(() => Boolean(editingId.value))

const resetForm = () => {
  form.name = ''
  form.sku = ''
  form.category = ''
  form.image = ''
  form.price = 0
  form.memberPrice = 0
  form.stock = 0
  form.minStock = 0
}

const refreshInventory = async () => {
  clearNuxtData()
  await refreshNuxtData('inventory-products')
  fetchAlerts()
}

const openCreate = () => {
  editingId.value = null
  resetForm()
  formError.value = ''
  sheetOpen.value = true
}

const openEdit = (product: ProductDto) => {
  editingId.value = product.id
  form.name = product.name
  form.sku = product.sku
  form.category = product.category
  form.image = product.image ?? ''
  form.price = product.price
  form.memberPrice = product.memberPrice ?? 0
  form.stock = product.stock
  form.minStock = product.minStock
  formError.value = ''
  sheetOpen.value = true
}

const openImagePicker = () => {
  imageInputRef.value?.click()
}

const uploadImage = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  uploadingImage.value = true
  formError.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const result = await $fetch<UploadResponseDto>('/api/upload', {
      method: 'POST',
      body: formData
    })
    form.image = result.path
    toast({ title: '图片上传成功', variant: 'success', duration: 2500 })
  } catch (err) {
    formError.value = getApiErrorMessage(err, '图片上传失败')
  } finally {
    uploadingImage.value = false
  }
}

const submitForm = async () => {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''
  feedback.value = ''

  try {
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      image: form.image || null,
      price: Number(form.price),
      memberPrice: Number(form.memberPrice) > 0 ? Number(form.memberPrice) : null,
      stock: Math.floor(Number(form.stock)),
      minStock: Math.floor(Number(form.minStock))
    }

    if (isEditMode.value && editingId.value) {
      await $fetch(`/api/products/${editingId.value}`, {
        method: 'PATCH',
        body: payload
      })
      feedback.value = '商品已更新'
    } else {
      await $fetch('/api/products', {
        method: 'POST',
        body: payload
      })
      feedback.value = '商品已创建'
    }

    toast({ title: feedback.value, variant: 'success', duration: 2500 })
    await refreshInventory()
    sheetOpen.value = false
  } catch (err) {
    formError.value = getApiErrorMessage(err, '保存失败')
    toast({ title: formError.value, variant: 'error', duration: 2500 })
  } finally {
    submitting.value = false
  }
}

const deleteProduct = async (product: ProductDto) => {
  if (deletingId.value) return
  if (!window.confirm(`确认删除商品 ${product.name}？`)) return

  deletingId.value = product.id
  try {
    await $fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    toast({ title: '商品已删除', variant: 'success', duration: 2500 })
    await refreshInventory()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除失败'), variant: 'error', duration: 2500 })
  } finally {
    deletingId.value = ''
  }
}

const exportInventoryCsv = () => {
  if (!products.value.length) return
  const header = '商品名称,SKU,分类,售价,会员价,库存,预警值'
  const rows = products.value.map((p) =>
    [p.name, p.sku, p.category, p.price, p.memberPrice ?? '', p.stock, p.minStock].join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`
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
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Inventory</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">库存管理</h2>
        <p class="mt-2 text-sm text-slate-500">
          正常 <span class="font-medium text-emerald-600">{{ healthyCount }}</span> · 预警
          <span class="font-medium text-amber-600">{{ warningCount }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-slate-700"
          :disabled="!products.length"
          @click="exportInventoryCsv"
        >
          <Download class="h-4 w-4" />
          导出 CSV
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          新增商品
        </button>
      </div>
    </header>

    <p
      v-if="feedback"
      class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700"
    >
      {{ feedback }}
    </p>
    <p
      v-if="pageError"
      class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700"
    >
      {{ pageError }}
    </p>

    <div class="rounded-2xl border border-slate-100 bg-white p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>商品</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>售价</TableHead>
            <TableHead>会员价</TableHead>
            <TableHead>库存</TableHead>
            <TableHead>预警值</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="product in products" :key="product.id">
            <TableCell class="font-medium text-slate-900">
              <div class="flex items-center gap-3">
                <img
                  v-if="product.image"
                  :src="product.image"
                  :alt="product.name"
                  class="h-10 w-10 rounded-lg border border-slate-100 object-cover"
                />
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-zinc-50 text-slate-300"
                >
                  <ImagePlus class="h-4 w-4" />
                </div>
                <span>{{ product.name }}</span>
              </div>
            </TableCell>
            <TableCell>{{ product.sku }}</TableCell>
            <TableCell>{{ product.category }}</TableCell>
            <TableCell>{{ formatPrice(product.price) }}</TableCell>
            <TableCell>{{
              product.memberPrice == null ? '-' : formatPrice(product.memberPrice)
            }}</TableCell>
            <TableCell>{{ product.stock }}</TableCell>
            <TableCell>{{ product.minStock }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500"
                  @click="openEdit(product)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500 disabled:opacity-50"
                  :disabled="deletingId === product.id"
                  @click="deleteProduct(product)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-if="!pending && !products.length">
            <TableCell colspan="8">
              <p class="py-10 text-center text-sm text-slate-500">暂无库存数据</p>
            </TableCell>
          </TableRow>

          <TableRow v-if="pending">
            <TableCell colspan="8">
              <div class="space-y-3 py-4">
                <div v-for="item in 5" :key="item" class="grid grid-cols-8 gap-3 px-4">
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-full" />
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Sheet v-model:open="sheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{{ isEditMode ? '编辑商品' : '新增商品' }}</SheetTitle>
          <SheetDescription>支持设置会员价，收银台会员识别后会自动使用。</SheetDescription>
        </SheetHeader>

        <form class="mt-8 space-y-6" @submit.prevent="submitForm">
          <div class="space-y-3">
            <label class="text-sm font-medium text-slate-700">商品图片</label>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="uploadImage"
            />
            <div class="flex items-center gap-4">
              <div
                class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-zinc-50"
              >
                <img
                  v-if="form.image"
                  :src="form.image"
                  alt="商品预览"
                  class="h-full w-full object-cover"
                />
                <ImagePlus v-else class="h-5 w-5 text-slate-300" />
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700"
                :disabled="uploadingImage"
                @click="openImagePicker"
              >
                <LoaderCircle v-if="uploadingImage" class="h-4 w-4 animate-spin" />
                <ImagePlus v-else class="h-4 w-4" />
                <span>{{ uploadingImage ? '上传中...' : '上传图片' }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">商品名称</label>
            <input
              v-model.trim="form.name"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">SKU</label>
            <input
              v-model.trim="form.sku"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">分类</label>
            <input
              v-model.trim="form.category"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">售价</label>
              <input
                v-model.number="form.price"
                type="number"
                min="0"
                step="0.01"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
                required
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">会员价</label>
              <input
                v-model.number="form.memberPrice"
                type="number"
                min="0"
                step="0.01"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">库存</label>
              <input
                v-model.number="form.stock"
                type="number"
                min="0"
                step="1"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
                required
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">预警值</label>
              <input
                v-model.number="form.minStock"
                type="number"
                min="0"
                step="1"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm outline-none"
                required
              />
            </div>
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
              class="rounded-xl border border-slate-100 px-4 py-2.5 text-sm text-slate-600"
              @click="sheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)] disabled:bg-[var(--btn-disabled-bg)]"
              :disabled="submitting || uploadingImage"
            >
              <LoaderCircle v-if="submitting" class="mx-auto h-4 w-4 animate-spin" />
              <span v-else>保存商品</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </section>
</template>
