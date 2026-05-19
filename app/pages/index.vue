<script setup lang="ts">
import { LoaderCircle, Minus, Plus, Search, Trash2, UserSearch } from 'lucide-vue-next'
import type { MemberDto } from '~/types/member'
import type { CheckoutResponseDto } from '~/types/order'
import type { ProductDto } from '~/types/product'

const keyword = ref('')
const memberPhone = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isSubmitting = ref(false)
const isLookingUpMember = ref(false)
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatPrice } = useFormat()
const { fetchAlerts } = useAlertCount()
const cartStore = useCartStore()

const { data, pending, error, refresh } = await useAsyncData('products', () =>
  $fetch<ProductDto[]>('/api/products')
)

const products = computed(() => data.value ?? [])
const filteredProducts = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(
    (product) => product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q)
  )
})

const cart = computed(() => cartStore.items)
const member = computed(() =>
  cartStore.customerInfo.memberId
    ? {
        id: cartStore.customerInfo.memberId,
        phone: cartStore.customerInfo.memberPhone || '',
        name: cartStore.customerInfo.memberName || null,
        points: cartStore.customerInfo.memberPoints || 0,
        level: cartStore.customerInfo.memberLevel || ''
      }
    : null
)
const subtotal = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
)
const maxDiscountAmount = computed(() => {
  const byPoints = Math.floor((cartStore.customerInfo.memberPoints || 0) / 100)
  const byOrder = Math.floor(subtotal.value * 0.5)
  return Math.min(byPoints, byOrder)
})
const discountAmount = computed(() => {
  const requested = Math.floor((cartStore.customerInfo.pointsToUse || 0) / 100)
  return Math.min(requested, maxDiscountAmount.value)
})
const totalAmount = computed(() => Math.max(0, subtotal.value - discountAmount.value))
const canCheckout = computed(() => cart.value.length > 0 && !isSubmitting.value && !pending.value)

const applyProductPrices = () => {
  cartStore.refreshCartPrices(products.value)
}

watch(
  products,
  () => {
    applyProductPrices()
  },
  { immediate: true }
)

const clearFeedback = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const addToCart = (product: ProductDto) => {
  clearFeedback()
  const existing = cart.value.find((item) => item.id === product.id)
  if (existing && existing.quantity >= product.stock) {
    errorMessage.value = '库存不足'
    return
  }
  if (!existing && product.stock <= 0) {
    errorMessage.value = '库存不足'
    return
  }
  cartStore.addItem(product)
}

const updateQuantity = (id: string, next: number) => {
  clearFeedback()
  if (next <= 0) {
    cartStore.removeItem(id)
    return
  }
  const product = products.value.find((item) => item.id === id)
  if (!product) return
  if (next > product.stock) {
    errorMessage.value = '库存不足'
    return
  }
  cartStore.updateQuantity(id, next)
}

const lookupMember = async () => {
  const phone = memberPhone.value.trim()
  if (!phone) return
  isLookingUpMember.value = true
  clearFeedback()
  try {
    const result = await $fetch<MemberDto | null>('/api/customers/lookup', {
      params: { phone }
    })
    if (!result) {
      cartStore.setMember(null)
      applyProductPrices()
      errorMessage.value = '未找到会员'
      return
    }
    cartStore.setMember(result)
    applyProductPrices()
    successMessage.value = `已识别会员 ${result.name || result.phone}`
  } catch (err) {
    errorMessage.value = getApiErrorMessage(err, '会员查询失败')
  } finally {
    isLookingUpMember.value = false
  }
}

const clearMember = () => {
  cartStore.setMember(null)
  memberPhone.value = ''
  applyProductPrices()
}

const clearAllItems = () => {
  cartStore.clearCart()
  memberPhone.value = ''
  clearFeedback()
}

const checkout = async () => {
  if (!canCheckout.value) return
  isSubmitting.value = true
  clearFeedback()

  try {
    const result = await $fetch<CheckoutResponseDto>('/api/orders/checkout', {
      method: 'POST',
      body: {
        items: cart.value.map((item) => ({
          productId: item.id,
          quantity: item.quantity
        })),
        memberId: member.value?.id || undefined,
        pointsToUse: cartStore.customerInfo.pointsToUse || 0
      }
    })

    successMessage.value = `结算成功，订单号 ${result.orderNo}`
    toast({ title: successMessage.value, variant: 'success', duration: 2500 })
    cartStore.clearCart()
    memberPhone.value = ''
    clearNuxtData()
    await refresh()
    fetchAlerts()
  } catch (err) {
    errorMessage.value = getApiErrorMessage(err, '结算失败')
    toast({ title: errorMessage.value, variant: 'error', duration: 2500 })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
    <div class="space-y-4">
      <div class="rounded-2xl border border-slate-100 bg-white p-4">
        <label class="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-3">
          <Search class="h-4 w-4 text-slate-400" />
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索商品名或 SKU"
            class="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div class="grid gap-3">
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          type="button"
          class="rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-slate-300"
          :disabled="product.stock <= 0"
          @click="addToCart(product)"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-semibold text-slate-900">{{ product.name }}</p>
              <p class="mt-1 text-xs text-slate-400">SKU {{ product.sku }}</p>
              <p class="mt-2 text-xs text-slate-500">库存 {{ product.stock }}</p>
            </div>
            <div class="text-right">
              <p class="font-semibold text-slate-900">
                {{
                  formatPrice(
                    member && product.memberPrice != null ? product.memberPrice : product.price
                  )
                }}
              </p>
              <p
                v-if="
                  member && product.memberPrice != null && product.memberPrice !== product.price
                "
                class="mt-1 text-xs text-slate-400 line-through"
              >
                {{ formatPrice(product.price) }}
              </p>
            </div>
          </div>
        </button>

        <div
          v-if="!pending && !filteredProducts.length"
          class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
        >
          暂无匹配商品
        </div>

        <div
          v-if="error"
          class="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600"
        >
          {{ getApiErrorMessage(error, '商品加载失败') }}
        </div>
      </div>
    </div>

    <aside class="rounded-2xl border border-slate-100 bg-white p-6">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-slate-900">结算</h2>
        <button
          v-if="cart.length"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          @click="clearAllItems"
        >
          <Trash2 class="h-3.5 w-3.5" />
          清空商品
        </button>
      </div>

      <div class="mt-4 flex gap-2">
        <input
          v-model="memberPhone"
          type="text"
          placeholder="输入会员手机号"
          class="flex-1 rounded-xl border border-slate-100 px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
          :disabled="isLookingUpMember"
          @click="lookupMember"
        >
          <UserSearch v-if="!isLookingUpMember" class="h-4 w-4" />
          <LoaderCircle v-else class="h-4 w-4 animate-spin" />
        </button>
      </div>

      <div
        v-if="member"
        class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"
      >
        <div class="flex items-center justify-between">
          <span>{{ member.name || member.phone }}</span>
          <button type="button" class="text-xs text-emerald-700" @click="clearMember">清除</button>
        </div>
        <p class="mt-1 text-xs">{{ member.level }} · {{ member.points }} 积分</p>
      </div>

      <div v-if="member" class="mt-3">
        <label class="text-xs text-slate-500">使用积分</label>
        <input
          :value="cartStore.customerInfo.pointsToUse || 0"
          type="number"
          min="0"
          step="100"
          class="mt-1 w-full rounded-xl border border-slate-100 px-3 py-2 text-sm outline-none"
          @input="cartStore.setPointsToUse(Number(($event.target as HTMLInputElement).value))"
        />
        <p class="mt-1 text-xs text-slate-400">100 积分抵 1 元，最多抵扣订单金额的 50%</p>
      </div>

      <div
        v-if="successMessage"
        class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="errorMessage"
        class="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"
      >
        {{ errorMessage }}
      </div>

      <div class="mt-4 space-y-3">
        <div
          v-for="item in cart"
          :key="item.id"
          class="rounded-xl border border-slate-100 bg-zinc-50 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-slate-900">{{ item.name }}</p>
              <p class="mt-1 text-xs text-slate-400">SKU {{ item.sku }}</p>
            </div>
            <button type="button" class="text-slate-400" @click="cartStore.removeItem(item.id)">
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-200 bg-white p-1"
                @click="updateQuantity(item.id, item.quantity - 1)"
              >
                <Minus class="h-3.5 w-3.5" />
              </button>
              <span class="w-8 text-center text-sm">{{ item.quantity }}</span>
              <button
                type="button"
                class="rounded-md border border-slate-200 bg-white p-1"
                @click="updateQuantity(item.id, item.quantity + 1)"
              >
                <Plus class="h-3.5 w-3.5" />
              </button>
            </div>
            <div class="text-right">
              <p class="font-semibold text-slate-900">
                {{ formatPrice(item.price * item.quantity) }}
              </p>
              <p
                v-if="item.originalPrice && item.originalPrice !== item.price"
                class="text-xs text-slate-400 line-through"
              >
                {{ formatPrice(item.originalPrice * item.quantity) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 border-t border-dashed border-slate-200 pt-4 text-sm">
        <div class="flex items-center justify-between text-slate-500">
          <span>小计</span>
          <span>{{ formatPrice(subtotal) }}</span>
        </div>
        <div class="mt-2 flex items-center justify-between text-slate-500">
          <span>积分抵扣</span>
          <span>-{{ formatPrice(discountAmount) }}</span>
        </div>
        <div class="mt-2 flex items-center justify-between text-lg font-semibold text-slate-900">
          <span>合计</span>
          <span>{{ formatPrice(totalAmount) }}</span>
        </div>
      </div>

      <button
        type="button"
        class="mt-6 w-full rounded-xl bg-[var(--btn-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover)] disabled:bg-[var(--btn-disabled-bg)]"
        :disabled="!canCheckout"
        @click="checkout"
      >
        <LoaderCircle v-if="isSubmitting" class="mx-auto h-4 w-4 animate-spin" />
        <span v-else>确认结算</span>
      </button>
    </aside>
  </section>
</template>
