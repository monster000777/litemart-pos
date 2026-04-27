<script setup lang="ts">
import { useAutoAnimate } from '@formkit/auto-animate/vue'
import { ImagePlus, LoaderCircle, Pencil, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
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

const { data, pending, error } = await useAsyncData('inventory-products', () => $fetch<ProductDto[]>('/api/products'))
const products = computed(() => data.value ?? [])

const warningCount = computed(() => products.value.filter((item) => item.stock <= item.minStock).length)
const healthyCount = computed(() => products.value.length - warningCount.value)

const restockSuggestions = ref<
  Array<{
    id: string
    name: string
    sku: string
    suggestQty: number
  }>
>([])

const submitting = ref(false)
const uploadingImage = ref(false)
const deletingId = ref('')
const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const feedback = ref('')
const pageError = ref('')
const formError = ref('')
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const inventoryLoadErrorMessage = computed(() =>
  error.value ? getApiErrorMessage(error.value, '库存加载失败，请刷新重试') : ''
)

const form = reactive({
  name: '',
  price: 0,
  stock: 0,
  sku: '',
  category: '',
  minStock: 0,
  image: ''
})

const isEditMode = computed(() => Boolean(editingId.value))
const formTitle = computed(() => (isEditMode.value ? '编辑商品' : '新增商品'))
const formDescription = computed(() =>
  isEditMode.value ? '修改库存参数与商品信息，保存后立即生效。' : '新建一条商品记录并加入库存列表。'
)

const [suggestionRef] = useAutoAnimate()

const resetForm = () => {
  form.name = ''
  form.price = 0
  form.stock = 0
  form.sku = ''
  form.category = ''
  form.minStock = 0
  form.image = ''
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
  form.price = product.price
  form.stock = product.stock
  form.sku = product.sku
  form.category = product.category
  form.minStock = product.minStock
  form.image = product.image ?? ''
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
  if (!file) {
    return
  }

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
    toast({ title: '图片上传成功', variant: 'success', duration: 3000 })
  } catch (error) {
    formError.value = getApiErrorMessage(error, '图片上传失败，请稍后重试')
    toast({ title: `操作失败：${formError.value}`, variant: 'error', duration: 3000 })
  } finally {
    uploadingImage.value = false
  }
}

const generateSuggestions = () => {
  restockSuggestions.value = products.value
    .filter((item) => item.stock <= item.minStock)
    .map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      suggestQty: Math.max(item.minStock * 2 - item.stock, 1)
    }))
    .sort((a, b) => b.suggestQty - a.suggestQty)
}

const formatPrice = (value: number) => `¥${value.toFixed(2)}`

const refreshInventory = async () => {
  await refreshNuxtData('inventory-products')
}

const submitForm = async () => {
  if (submitting.value) {
    return
  }
  submitting.value = true
  feedback.value = ''
  formError.value = ''
  pageError.value = ''

  try {
    const payload = {
      name: form.name,
      price: Number(form.price),
      stock: Math.floor(Number(form.stock)),
      sku: form.sku,
      category: form.category,
      minStock: Math.floor(Number(form.minStock)),
      image: form.image || null
    }

    if (isEditMode.value && editingId.value) {
      await $fetch(`/api/products/${editingId.value}`, {
        method: 'PATCH',
        body: payload
      })
      feedback.value = '商品已更新'
      toast({ title: '商品保存成功', variant: 'success', duration: 3000 })
    } else {
      await $fetch('/api/products', {
        method: 'POST',
        body: payload
      })
      feedback.value = '商品已新增'
      toast({ title: '商品保存成功', variant: 'success', duration: 3000 })
    }

    await refreshInventory()
    sheetOpen.value = false
  } catch (error) {
    formError.value = getApiErrorMessage(error, '保存失败，请稍后重试')
    toast({ title: `操作失败：${formError.value}`, variant: 'error', duration: 3000 })
  } finally {
    submitting.value = false
  }
}

const deleteProduct = async (product: ProductDto) => {
  if (deletingId.value) {
    return
  }

  const ok = window.confirm(`确认删除商品「${product.name}」？`)
  if (!ok) {
    return
  }

  deletingId.value = product.id
  feedback.value = ''
  pageError.value = ''
  try {
    await $fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    feedback.value = '商品已删除'
    toast({ title: '商品已删除', variant: 'success', duration: 3000 })
    await refreshInventory()
  } catch (error) {
    pageError.value = getApiErrorMessage(error, '删除失败，请稍后重试')
    toast({ title: `操作失败：${pageError.value}`, variant: 'error', duration: 3000 })
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-8">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Inventory Matrix</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">库存矩阵</h2>
        <p class="mt-2 text-sm text-slate-500">
          充足 <span class="font-medium text-emerald-600">{{ healthyCount }}</span> · 预警
          <span class="font-medium text-amber-600">{{ warningCount }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
          @click="generateSuggestions"
        >
          <Sparkles class="h-4 w-4" />
          一键补货建议
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:text-slate-900"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          新增商品
        </button>
      </div>
    </header>

    <div class="space-y-2">
      <p v-if="feedback" class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
        {{ feedback }}
      </p>
      <p v-if="pageError" class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
        {{ pageError }}
      </p>
      <p
        v-if="inventoryLoadErrorMessage"
        class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700"
      >
        {{ inventoryLoadErrorMessage }}
      </p>
    </div>

    <div ref="suggestionRef" class="space-y-3">
      <div
        v-for="item in restockSuggestions"
        :key="item.id"
        class="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-700"
      >
        建议补货：<span class="font-medium">{{ item.name }}</span>（{{ item.sku }}）× {{ item.suggestQty }}
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>商品</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>单价</TableHead>
            <TableHead>库存状态</TableHead>
            <TableHead>当前库存</TableHead>
            <TableHead>预警线</TableHead>
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
            <TableCell>
              <div class="inline-flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  :class="
                    product.stock <= product.minStock
                      ? 'bg-amber-500 shadow-[0_0_0_6px_rgba(245,158,11,0.14)] animate-pulse'
                      : 'bg-emerald-500'
                  "
                />
                <span :class="product.stock <= product.minStock ? 'text-amber-700' : 'text-emerald-700'">
                  {{ product.stock <= product.minStock ? '预警' : '库存充足' }}
                </span>
              </div>
            </TableCell>
            <TableCell>{{ product.stock }}</TableCell>
            <TableCell>{{ product.minStock }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500 transition hover:text-slate-900"
                  @click="openEdit(product)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-100 bg-white p-1.5 text-slate-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
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
          <SheetTitle>{{ formTitle }}</SheetTitle>
          <SheetDescription>{{ formDescription }}</SheetDescription>
        </SheetHeader>

        <form class="mt-8 space-y-6" @submit.prevent="submitForm">
          <div class="space-y-3">
            <label class="text-sm font-medium text-slate-700">商品图片</label>
            <input ref="imageInputRef" type="file" accept="image/*" class="hidden" @change="uploadImage" />
            <div class="flex items-center gap-4">
              <div class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-zinc-50">
                <img v-if="form.image" :src="form.image" alt="商品预览" class="h-full w-full object-cover" />
                <ImagePlus v-else class="h-5 w-5 text-slate-300" />
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
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
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">SKU</label>
            <input
              v-model.trim="form.sku"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">分类</label>
            <input
              v-model.trim="form.category"
              type="text"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">价格</label>
              <input
                v-model.number="form.price"
                type="number"
                min="0"
                step="0.01"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
                required
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">库存</label>
              <input
                v-model.number="form.stock"
                type="number"
                min="0"
                step="1"
                class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
                required
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">预警值</label>
            <input
              v-model.number="form.minStock"
              type="number"
              min="0"
              step="1"
              class="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-sm focus:border-slate-300 focus:outline-none"
              required
            />
          </div>

          <p v-if="formError" class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
