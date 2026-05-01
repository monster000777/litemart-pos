<script setup lang="ts">
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Package,
  Plus,
  Trash2,
  Truck
} from 'lucide-vue-next'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import Sheet from '~/components/ui/sheet/Sheet.vue'
import SheetContent from '~/components/ui/sheet/SheetContent.vue'
import SheetHeader from '~/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '~/components/ui/sheet/SheetTitle.vue'
import type { PurchaseOrderDto, PurchaseOrderListResponse, SupplierDto } from '~/types/supplier'

const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = 20
const expandedOrderId = ref<string | null>(null)
const sheetOpen = ref(false)
const submitting = ref(false)
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatPrice, formatDate } = useFormat()

const queryParams = computed(() => ({
  status: statusFilter.value || undefined,
  page: currentPage.value,
  pageSize
}))

watch([statusFilter], () => {
  currentPage.value = 1
})

const { data, pending, error, refresh } = await useAsyncData(
  'purchase-orders',
  () => $fetch<PurchaseOrderListResponse>('/api/purchase-orders', { params: queryParams.value }),
  { watch: [queryParams] }
)

const orders = computed(() => data.value?.orders ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / pageSize))

const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '采购单加载失败') : ''
)

const { data: suppliersData } = await useAsyncData('suppliers-list', () =>
  $fetch<SupplierDto[]>('/api/suppliers')
)
const suppliers = computed(() => suppliersData.value ?? [])

type SupplierProduct = {
  id: string
  name: string
  sku: string
  price: number
  costPrice: number
  stock: number
  category: string
}

const supplierProducts = ref<SupplierProduct[]>([])
const loadingProducts = ref(false)

const form = reactive({
  supplierId: '',
  notes: '',
  items: [] as Array<{ productId: string; quantity: number; unitCost: number }>
})

const totalCost = computed(() =>
  form.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0)
)

const fetchSupplierProducts = async (supplierId: string) => {
  if (!supplierId) {
    supplierProducts.value = []
    return
  }

  loadingProducts.value = true
  try {
    supplierProducts.value = await $fetch<SupplierProduct[]>(
      `/api/suppliers/${supplierId}/products`
    )
  } catch {
    supplierProducts.value = []
    toast({ title: '获取商品列表失败', variant: 'error', duration: 3000 })
  } finally {
    loadingProducts.value = false
  }
}

watch(
  () => form.supplierId,
  async (newSupplierId) => {
    form.items = []
    await fetchSupplierProducts(newSupplierId)
    if (newSupplierId && supplierProducts.value.length > 0) {
      addItem()
    }
  }
)

const resetForm = () => {
  form.supplierId = ''
  form.notes = ''
  form.items = []
  supplierProducts.value = []
}

const openCreate = () => {
  resetForm()
  sheetOpen.value = true
}

const addItem = () => {
  form.items.push({ productId: '', quantity: 1, unitCost: 0 })
}

const removeItem = (index: number) => {
  form.items.splice(index, 1)
}

const updateItemProduct = (index: number, productId: string) => {
  const product = supplierProducts.value.find((p) => p.id === productId)
  const item = form.items[index]
  if (product && item) {
    item.productId = productId
    item.unitCost = product.costPrice
  }
}

const submitForm = async () => {
  if (submitting.value) return

  if (!form.supplierId) {
    toast({ title: '请选择供应商', variant: 'error', duration: 3000 })
    return
  }

  if (!form.items.length) {
    toast({ title: '请添加采购商品', variant: 'error', duration: 3000 })
    return
  }

  const invalidItem = form.items.find(
    (item) => !item.productId || item.quantity <= 0 || item.unitCost <= 0
  )
  if (invalidItem) {
    toast({ title: '请完善采购商品信息', variant: 'error', duration: 3000 })
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/purchase-orders', {
      method: 'POST',
      body: {
        supplierId: form.supplierId,
        items: form.items,
        notes: form.notes.trim() || undefined
      }
    })
    toast({ title: '采购单创建成功', variant: 'success', duration: 3000 })
    await refresh()
    sheetOpen.value = false
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '创建失败'), variant: 'error', duration: 3000 })
  } finally {
    submitting.value = false
  }
}

const receiveOrder = async (order: PurchaseOrderDto) => {
  const ok = window.confirm(`确认入库采购单「${order.orderNo}」？库存将自动更新。`)
  if (!ok) return

  try {
    await $fetch(`/api/purchase-orders/${order.id}/receive`, { method: 'POST' })
    toast({ title: '采购单已入库', variant: 'success', duration: 3000 })
    clearNuxtData()
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '入库失败'), variant: 'error', duration: 3000 })
  }
}

const cancelOrder = async (order: PurchaseOrderDto) => {
  const ok = window.confirm(`确认取消采购单「${order.orderNo}」？`)
  if (!ok) return

  try {
    await $fetch(`/api/purchase-orders/${order.id}/cancel`, { method: 'POST' })
    toast({ title: '采购单已取消', variant: 'success', duration: 3000 })
    await refresh()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '取消失败'), variant: 'error', duration: 3000 })
  }
}

const toggleExpand = (id: string) => {
  expandedOrderId.value = expandedOrderId.value === id ? null : id
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    PENDING: '待入库',
    RECEIVED: '已入库',
    CANCELLED: '已取消'
  }
  return map[s] || s
}

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
    RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200'
  }
  return map[s] || 'bg-slate-100 text-slate-600 border-slate-200'
}

const goPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}
</script>

<template>
  <section class="space-y-6">
    <header
      class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-8"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          Purchase Orders
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">采购管理</h2>
        <p class="mt-2 text-sm text-slate-500">共 {{ total }} 条记录</p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          to="/suppliers"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft class="h-4 w-4" />
          供应商管理
        </NuxtLink>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:text-slate-900"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          新建采购单
        </button>
      </div>
    </header>

    <div class="flex items-center gap-3">
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
      >
        <option value="">全部状态</option>
        <option value="PENDING">待入库</option>
        <option value="RECEIVED">已入库</option>
        <option value="CANCELLED">已取消</option>
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
          <Skeleton class="h-6 w-16" />
        </div>
      </div>
    </div>

    <div v-if="!pending && orders.length" class="space-y-3">
      <div
        v-for="order in orders"
        :key="order.id"
        class="rounded-2xl border border-slate-100 bg-white transition-all"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between p-5 text-left"
          @click="toggleExpand(order.id)"
        >
          <div class="flex items-center gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-zinc-50"
            >
              <Truck class="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-slate-900">{{ order.orderNo }}</p>
                <span
                  class="rounded-full border px-2 py-0.5 text-xs font-medium"
                  :class="statusClass(order.status)"
                >
                  {{ statusLabel(order.status) }}
                </span>
              </div>
              <div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>{{ order.supplier.name }}</span>
                <span>{{ order.items.length }} 项商品</span>
                <span>{{ formatDate(order.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-slate-900">
              {{ formatPrice(order.totalAmount) }}
            </span>
            <component
              :is="expandedOrderId === order.id ? ChevronUp : ChevronDown"
              class="h-4 w-4 text-slate-400"
            />
          </div>
        </button>

        <div v-if="expandedOrderId === order.id" class="border-t border-slate-100 px-5 py-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400">
                <th class="pb-2 font-medium">商品</th>
                <th class="pb-2 font-medium">SKU</th>
                <th class="pb-2 text-right font-medium">单位成本</th>
                <th class="pb-2 text-right font-medium">数量</th>
                <th class="pb-2 text-right font-medium">小计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id" class="border-t border-slate-50">
                <td class="py-2 text-slate-800">{{ item.product.name }}</td>
                <td class="py-2 text-slate-400">{{ item.product.sku }}</td>
                <td class="py-2 text-right text-slate-600">{{ formatPrice(item.unitCost) }}</td>
                <td class="py-2 text-right text-slate-600">{{ item.quantity }}</td>
                <td class="py-2 text-right font-medium text-slate-900">
                  {{ formatPrice(item.unitCost * item.quantity) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="order.notes" class="mt-3 rounded-lg bg-zinc-50 p-3 text-xs text-slate-500">
            备注：{{ order.notes }}
          </div>

          <div
            v-if="order.status === 'PENDING'"
            class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
              @click.stop="cancelOrder(order)"
            >
              取消采购
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
              @click.stop="receiveOrder(order)"
            >
              <Package class="h-3.5 w-3.5" />
              确认入库
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!pending && !orders.length && !errorMsg"
      class="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500"
    >
      暂无采购单记录
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        上一页
      </button>
      <span class="text-xs text-slate-500">{{ currentPage }} / {{ totalPages }}</span>
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        下一页
      </button>
    </div>

    <Sheet v-model:open="sheetOpen">
      <SheetContent>
        <SheetHeader class="pb-3 border-b border-slate-100">
          <SheetTitle class="text-lg">新建采购单</SheetTitle>
        </SheetHeader>

        <form class="mt-4 flex flex-col h-[calc(100%-4rem)]" @submit.prevent="submitForm">
          <div class="flex-1 space-y-4 overflow-y-auto pr-1">
            <div class="space-y-1.5">
              <label class="text-xs font-medium uppercase tracking-wider text-slate-400"
                >供应商</label
              >
              <select
                v-model="form.supplierId"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-slate-400 focus:outline-none"
                required
              >
                <option value="" disabled>选择供应商</option>
                <option
                  v-for="supplier in suppliers.filter((s) => s.status === 'ACTIVE')"
                  :key="supplier.id"
                  :value="supplier.id"
                >
                  {{ supplier.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-medium uppercase tracking-wider text-slate-400"
                >备注</label
              >
              <textarea
                v-model.trim="form.notes"
                rows="3"
                placeholder="可选..."
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none resize-none"
              />
            </div>

            <!-- 采购商品 -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium uppercase tracking-wider text-slate-400">
                  采购商品
                </label>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="!form.supplierId"
                  @click="addItem"
                >
                  <Plus class="h-3 w-3" />
                  添加
                </button>
              </div>

              <div class="space-y-2">
                <!-- 商品列表 -->
                <div
                  v-for="(item, index) in form.items"
                  :key="index"
                  class="rounded-lg border border-slate-150 bg-white p-2.5"
                >
                  <div class="flex items-start gap-2">
                    <div class="flex-1 space-y-1.5">
                      <select
                        :value="item.productId"
                        class="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                        @change="
                          updateItemProduct(index, ($event.target as HTMLSelectElement).value)
                        "
                      >
                        <option value="" disabled>选择商品</option>
                        <option
                          v-for="product in supplierProducts"
                          :key="product.id"
                          :value="product.id"
                        >
                          {{ product.name }}
                        </option>
                      </select>
                      <div class="grid grid-cols-2 gap-1.5">
                        <input
                          v-model.number="item.quantity"
                          type="number"
                          min="1"
                          placeholder="数量"
                          class="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
                        />
                        <div class="relative">
                          <span class="absolute left-2 top-1.5 text-xs text-slate-400">¥</span>
                          <input
                            v-model.number="item.unitCost"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="单价"
                            class="w-full rounded-md border border-slate-200 bg-white pl-5 pr-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="rounded p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      @click="removeItem(index)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <!-- 空状态 -->
                <div
                  v-if="!form.items.length"
                  class="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Package class="h-10 w-10 text-slate-200 mb-2" />
                  <p class="text-xs text-slate-400">
                    <template v-if="!form.supplierId">请先选择供应商</template>
                    <template v-else-if="loadingProducts">加载中...</template>
                    <template v-else-if="supplierProducts.length === 0">该供应商暂无商品</template>
                    <template v-else>点击"添加"按钮</template>
                  </p>
                </div>
              </div>
            </div>

            <!-- 汇总信息 -->
            <div class="rounded-lg bg-slate-50 p-3 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-slate-500">商品种类</span>
                <span class="font-medium text-slate-700">{{ form.items.length }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-slate-500">采购总额</span>
                <span class="font-semibold text-slate-900">{{ formatPrice(totalCost) }}</span>
              </div>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="border-t border-slate-100 pt-3 mt-3 flex gap-2">
            <button
              type="button"
              class="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              @click="sheetOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="flex-1 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              :disabled="submitting || !form.supplierId || !form.items.length"
            >
              <LoaderCircle v-if="submitting" class="mr-1.5 h-4 w-4 animate-spin" />
              <span v-else>确认创建</span>
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  </section>
</template>
