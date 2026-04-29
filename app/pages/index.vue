<script setup lang="ts">
import { useAutoAnimate } from '@formkit/auto-animate/vue'
import {
  ImagePlus,
  LoaderCircle,
  Minus,
  PackageSearch,
  Plus,
  Search,
  Trash2,
  Printer
} from 'lucide-vue-next'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import type { CartItemDto } from '~/types/cart'
import type { CheckoutResponseDto } from '~/types/order'
import type { ProductDto } from '~/types/product'
import { onMounted, onUnmounted } from 'vue'

const keyword = ref('')
const selectedCategory = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isSubmitting = ref(false)
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const cartStore = useCartStore()

// 存储上一单记录，用于打印小票
const lastOrder = ref<{
  orderNo: string
  items: CartItemDto[]
  totalAmount: number
  customerTail?: string
  time: string
} | null>(null)

// 扫码枪缓冲区
const barcodeBuffer = ref('')
let barcodeTimeout: ReturnType<typeof setTimeout> | null = null

const { data, pending, error, refresh } = await useAsyncData('products', () =>
  $fetch<ProductDto[]>('/api/products')
)

const products = computed(() => data.value ?? [])
const productLoadErrorMessage = computed(() =>
  error.value ? getApiErrorMessage(error.value, '商品加载失败，请刷新重试') : ''
)
const productMap = computed(() => new Map(products.value.map((product) => [product.id, product])))
const cart = computed(() => cartStore.items)
const customerTail = computed({
  get: () => cartStore.customerInfo.customerTail,
  set: (value: string) => cartStore.setCustomerTail(value)
})

const categories = computed(() => {
  const set = new Set(products.value.map((p) => p.category))
  return Array.from(set).sort()
})

const filteredProducts = computed(() => {
  let list = products.value
  const cat = selectedCategory.value
  if (cat) {
    list = list.filter((p) => p.category === cat)
  }
  const q = keyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }
  return list
})

const totalAmount = computed(() =>
  cartStore.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
)

const orderCount = computed(() => cartStore.items.reduce((sum, item) => sum + item.quantity, 0))

const canCheckout = computed(
  () => cartStore.items.length > 0 && !isSubmitting.value && !pending.value
)

const [productListRef] = useAutoAnimate()
const [cartListRef] = useAutoAnimate()
const [feedbackRef] = useAutoAnimate()

const clearFeedback = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const addToCart = (product: ProductDto) => {
  clearFeedback()
  const existing = cartStore.items.find((item) => item.id === product.id)
  if (existing) {
    if (existing.quantity >= product.stock) {
      errorMessage.value = `“${product.name}” 库存不足`
      return
    }
    cartStore.updateQuantity(product.id, existing.quantity + 1)
    return
  }

  if (product.stock <= 0) {
    errorMessage.value = `“${product.name}” 已无库存`
    return
  }

  cartStore.addItem(product)
}

const increaseQty = (id: string) => {
  clearFeedback()
  const item = cartStore.items.find((entry) => entry.id === id)
  if (!item) {
    return
  }
  const product = productMap.value.get(id)
  const stock = product?.stock ?? 0
  if (item.quantity >= stock) {
    errorMessage.value = `“${item.name}” 库存不足`
    return
  }
  cartStore.updateQuantity(id, item.quantity + 1)
}

const decreaseQty = (id: string) => {
  clearFeedback()
  const item = cartStore.items.find((entry) => entry.id === id)
  if (!item) {
    return
  }
  if (item.quantity <= 1) {
    cartStore.removeItem(id)
    return
  }
  cartStore.updateQuantity(id, item.quantity - 1)
}

const removeItem = (id: string) => {
  clearFeedback()
  cartStore.removeItem(id)
}

const clearAllItems = () => {
  clearFeedback()
  cartStore.clearCart()
}

const checkout = async () => {
  if (!canCheckout.value) {
    return
  }

  clearFeedback()
  isSubmitting.value = true
  try {
    const payload = {
      items: cartStore.items.map((item) => ({
        productId: item.id,
        quantity: item.quantity
      })),
      customerTail: customerTail.value.length === 4 ? customerTail.value : undefined
    }

    const result = await $fetch<CheckoutResponseDto>('/api/orders/checkout', {
      method: 'POST',
      body: payload
    })

    successMessage.value = `核销成功，订单号 ${result.orderNo}`

    // 保存记录以供打印
    lastOrder.value = {
      orderNo: result.orderNo,
      items: JSON.parse(JSON.stringify(cartStore.items)),
      totalAmount: totalAmount.value,
      customerTail: customerTail.value.length === 4 ? customerTail.value : undefined,
      time: new Date().toLocaleString()
    }

    toast({
      title: '核销成功，已自动更新库存',
      variant: 'success',
      duration: 3000
    })
    cartStore.clearCart()
    clearNuxtData() // 清空全局缓存，确保切换到其他页面时能拉取最新数据
    await refresh()
  } catch (e) {
    const message = getApiErrorMessage(e, '核销失败，请稍后重试')
    errorMessage.value = message
    toast({
      title: message.includes('库存不足') ? '操作失败：库存不足' : `操作失败：${message}`,
      variant: 'error',
      duration: 3000
    })
  } finally {
    isSubmitting.value = false
  }
}

watch(
  products,
  (nextProducts) => {
    const nextMap = new Map(nextProducts.map((product) => [product.id, product]))
    for (const item of [...cartStore.items]) {
      const latest = nextMap.get(item.id)
      if (!latest || latest.stock <= 0) {
        cartStore.removeItem(item.id)
        continue
      }
      if (item.quantity > latest.stock) {
        cartStore.updateQuantity(item.id, latest.stock)
      }
    }
  },
  { immediate: true }
)

const { formatPrice } = useFormat()

// --- 扫码枪逻辑 ---
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && barcodeBuffer.value.length >= 3) {
    const sku = barcodeBuffer.value
    const product = products.value.find((p) => p.sku === sku)

    if (product) {
      addToCart(product)
      toast({
        title: `扫码成功：已添加 ${product.name}`,
        variant: 'success',
        duration: 2000
      })
      // 如果焦点在搜索框内，清空错误输入的条码
      if (
        document.activeElement?.tagName === 'INPUT' &&
        document.activeElement === document.querySelector('input[type="text"]')
      ) {
        keyword.value = keyword.value.replace(sku, '')
      }
    } else {
      toast({
        title: `未找到 SKU 为 ${sku} 的商品`,
        variant: 'error',
        duration: 3000
      })
    }
    barcodeBuffer.value = ''
    return
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    barcodeBuffer.value += e.key
    if (barcodeTimeout) clearTimeout(barcodeTimeout)
    // 扫码枪输入间隔通常小于 50ms，超时则重置（过滤普通手敲键盘）
    barcodeTimeout = setTimeout(() => {
      barcodeBuffer.value = ''
    }, 50)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (barcodeTimeout) {
    clearTimeout(barcodeTimeout)
    barcodeTimeout = null
  }
})

// 主动触发重打最后一单小票
const reprintReceipt = () => {
  if (lastOrder.value) {
    window.print()
  } else {
    toast({
      title: '暂无上一单记录',
      variant: 'error',
      duration: 2000
    })
  }
}
</script>

<template>
  <section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div class="lg:col-span-2 space-y-6">
      <div class="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-xl">
        <label
          class="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-4"
        >
          <Search class="h-5 w-5 text-slate-400" />
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索商品名称或 SKU..."
            class="w-full bg-transparent text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      </div>

      <!-- 分类标签栏 -->
      <div v-if="categories.length > 1" class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
          :class="
            selectedCategory === ''
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          "
          @click="selectedCategory = ''"
        >
          全部
        </button>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
          :class="
            selectedCategory === cat
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          "
          @click="selectedCategory = cat"
        >
          {{ cat }}
        </button>
      </div>

      <div
        ref="productListRef"
        class="grid max-h-[calc(100vh-15.5rem)] grid-cols-1 gap-3 overflow-y-auto pr-1"
      >
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          type="button"
          :disabled="product.stock === 0"
          class="rounded-2xl border border-slate-100 bg-white p-4 text-left transition-all"
          :class="
            product.stock === 0
              ? 'cursor-not-allowed grayscale opacity-60'
              : 'hover:-translate-y-[2px] hover:border-slate-300'
          "
          @click="addToCart(product)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-3">
              <div
                class="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-zinc-50"
              >
                <img
                  v-if="product.image"
                  :src="product.image"
                  :alt="product.name"
                  class="h-full w-full object-cover"
                />
                <ImagePlus v-else class="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <p class="text-base font-semibold text-slate-900">{{ product.name }}</p>
                <p class="mt-1 text-xs text-slate-400">SKU {{ product.sku }}</p>
              </div>
            </div>
            <p class="text-sm font-semibold text-slate-900">{{ formatPrice(product.price) }}</p>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs">
            <span
              class="rounded-full border border-slate-100 bg-zinc-50 px-2.5 py-1 text-slate-500"
            >
              库存 {{ product.stock }}
            </span>
            <span
              class="rounded-full px-2.5 py-1"
              :class="
                product.stock === 0
                  ? 'bg-slate-100 text-slate-500'
                  : product.stock <= product.minStock
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
              "
            >
              {{
                product.stock === 0 ? '缺货' : product.stock <= product.minStock ? '预警' : '正常'
              }}
            </span>
          </div>
        </button>

        <div
          v-if="!pending && !filteredProducts.length"
          class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
        >
          {{ keyword.trim() ? '未找到匹配商品' : '暂无商品，请前往库存矩阵新增商品' }}
        </div>

        <div v-if="pending" class="space-y-3">
          <div
            v-for="item in 6"
            :key="item"
            class="rounded-2xl border border-slate-100 bg-white p-4"
          >
            <div class="flex items-start justify-between">
              <div class="space-y-2">
                <Skeleton class="h-4 w-40" />
                <Skeleton class="h-3 w-24" />
              </div>
              <Skeleton class="h-4 w-16" />
            </div>
            <div class="mt-3 flex items-center justify-between">
              <Skeleton class="h-6 w-16 rounded-full" />
              <Skeleton class="h-6 w-14 rounded-full" />
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center text-sm text-rose-600"
        >
          {{ productLoadErrorMessage }}
        </div>
      </div>
    </div>

    <aside class="lg:col-span-1">
      <div
        class="sticky top-24 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Receipt</p>
            <h2 class="mt-2 text-xl font-semibold tracking-tight text-slate-900">结算预览</h2>
          </div>
          <div class="flex gap-2">
            <button
              v-if="cart.length > 0"
              type="button"
              class="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-rose-600"
              title="清空商品"
              @click="clearAllItems"
            >
              <Trash2 class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              title="重打上一单小票"
              @click="reprintReceipt"
            >
              <Printer class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref="feedbackRef" class="mt-4 space-y-2">
          <p
            v-if="successMessage"
            class="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            {{ successMessage }}
          </p>
          <p
            v-if="errorMessage"
            class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {{ errorMessage }}
          </p>
        </div>

        <div ref="cartListRef" class="mt-6 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
          <div
            v-for="item in cart"
            :key="item.id"
            class="rounded-xl border border-slate-100 bg-zinc-50 p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-slate-900">{{ item.name }}</p>
                <p class="mt-1 text-xs text-slate-400">SKU {{ item.sku }}</p>
              </div>
              <button
                type="button"
                class="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
                @click="removeItem(item.id)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-md border border-slate-200 bg-white p-1 text-slate-600 transition hover:text-slate-900"
                  @click="decreaseQty(item.id)"
                >
                  <Minus class="h-3.5 w-3.5" />
                </button>
                <span class="w-8 text-center text-sm font-medium text-slate-900">{{
                  item.quantity
                }}</span>
                <button
                  type="button"
                  class="rounded-md border border-slate-200 bg-white p-1 text-slate-600 transition hover:text-slate-900"
                  @click="increaseQty(item.id)"
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
              </div>
              <p class="text-sm font-semibold text-slate-900">
                {{ formatPrice(item.price * item.quantity) }}
              </p>
            </div>
          </div>

          <div
            v-if="!cart.length"
            class="rounded-xl border border-dashed border-slate-200 bg-zinc-50/70 p-8 text-center"
          >
            <PackageSearch class="mx-auto h-8 w-8 text-slate-300" />
            <p class="mt-3 text-sm text-slate-500">暂无待办，请选择商品</p>
          </div>
        </div>

        <div class="mt-6 border-t border-dashed border-slate-200 pt-4">
          <div class="mb-3 space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-[0.12em] text-slate-400"
              >手机号尾号</label
            >
            <input
              v-model="customerTail"
              type="text"
              inputmode="numeric"
              maxlength="4"
              placeholder="可选，4位"
              class="w-full rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
            />
          </div>
          <div class="flex items-center justify-between text-sm text-slate-500">
            <span>件数</span>
            <span>{{ orderCount }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-sm text-slate-500">总计</span>
            <span class="text-2xl font-semibold tracking-tight text-slate-900">
              {{ formatPrice(totalAmount) }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
          :disabled="!canCheckout"
          @click="checkout"
        >
          <LoaderCircle v-if="isSubmitting" class="mx-auto h-4 w-4 animate-spin" />
          <span v-else>确认核销</span>
        </button>
      </div>
    </aside>

    <!-- 打印专用的小票结构 -->
    <div v-if="lastOrder" class="print-receipt hidden text-black p-4 text-sm font-sans w-[300px]">
      <div class="text-center font-bold text-xl mb-4 tracking-widest">LiteMart POS</div>
      <div class="mb-2 text-xs">订单号：{{ lastOrder.orderNo }}</div>
      <div class="mb-2 text-xs">时间：{{ lastOrder.time }}</div>
      <div v-if="lastOrder.customerTail" class="mb-4 text-xs">
        客户(尾号)：{{ lastOrder.customerTail }}
      </div>

      <div class="border-t-2 border-b-2 border-black border-dashed py-3 mb-3">
        <div class="flex justify-between font-bold text-xs mb-2">
          <div class="flex-1">商品</div>
          <div class="w-10 text-center">数量</div>
          <div class="w-16 text-right">小计</div>
        </div>
        <div
          v-for="item in lastOrder.items"
          :key="item.id"
          class="flex justify-between mb-2 text-xs"
        >
          <div class="flex-1 pr-2 break-all">{{ item.name }}</div>
          <div class="w-10 text-center">x{{ item.quantity }}</div>
          <div class="w-16 text-right">{{ formatPrice(item.price * item.quantity) }}</div>
        </div>
      </div>

      <div class="flex justify-between font-bold text-base mt-2">
        <span>合计金额</span>
        <span>{{ formatPrice(lastOrder.totalAmount) }}</span>
      </div>
      <div class="text-center mt-10 text-xs text-gray-500 pb-8">谢谢惠顾，欢迎再次光临</div>
    </div>
  </section>
</template>
