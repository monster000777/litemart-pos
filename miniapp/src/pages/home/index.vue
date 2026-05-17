<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ProductCard from '../../components/ProductCard.vue'
import { appConfig } from '../../config'
import { productService } from '../../services'
import { useAuthStore } from '../../stores/auth'
import { useCartStore } from '../../stores/cart'
import type { Product } from '../../types'

const authStore = useAuthStore()
const cartStore = useCartStore()

const keyword = ref('')
const products = ref<Product[]>([])
const loading = ref(false)
const loadError = ref('')

const cartSummary = computed(() => `${cartStore.totalCount} 件待结算`)
const hasCartItems = computed(() => cartStore.totalCount > 0)
const apiHostLabel = computed(() => appConfig.baseUrl)
const featuredProducts = computed(() => products.value.slice(0, 5))
const lowStockProducts = computed(() =>
  products.value.filter((product) => product.stock <= product.minStock).slice(0, 3)
)
const greetingName = computed(() => authStore.user?.uid || '店员')

const goCart = () => {
  uni.switchTab({
    url: '/pages/cart/index'
  })
}

const ensureLoggedIn = () => {
  if (!authStore.ready) {
    return false
  }

  if (!authStore.authenticated) {
    uni.reLaunch({
      url: '/pages/login/index'
    })
    return false
  }

  return true
}

const loadProducts = async () => {
  if (!ensureLoggedIn()) {
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    products.value = await productService.getProducts(keyword.value.trim())
  } catch (error) {
    const message = (error as { message?: string }).message || '商品加载失败'
    loadError.value = message
    products.value = []
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    loading.value = false
  }
}

const addToCart = (product: Product) => {
  if (product.stock <= 0) {
    uni.showToast({ title: '库存不足', icon: 'none' })
    return
  }

  cartStore.addProduct(product)
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}

onShow(async () => {
  if (!authStore.ready) {
    await authStore.bootstrap()
  }

  await loadProducts()
})
</script>

<template>
  <view class="page">
    <view class="stage-card">
      <view class="stage-copy">
        <text class="stage-kicker">今日门店营业中</text>
        <text class="stage-title">{{ greetingName }}，开始点单</text>
        <text class="stage-desc"
          >把今天适合快速成交的商品先摆到前面，收银、加购和下单都从这里开始。</text
        >
      </view>

      <view class="stage-column">
        <view class="metric-card strong">
          <text class="metric-value">{{ products.length }}</text>
          <text class="metric-label">在售商品</text>
        </view>
        <view class="metric-card">
          <text class="metric-value">{{ cartStore.totalCount }}</text>
          <text class="metric-label">待结算</text>
        </view>
      </view>
    </view>

    <view class="search-panel">
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索商品名、货号或关键词"
          confirm-type="search"
          @confirm="loadProducts"
        />
      </view>
      <button class="search-btn" size="mini" @tap="loadProducts">查找</button>
    </view>

    <view class="cart-strip" :class="{ active: hasCartItems }" @tap="goCart">
      <view class="cart-strip-copy">
        <text class="cart-strip-kicker">收银区</text>
        <text class="cart-strip-title">{{ cartSummary }}</text>
      </view>
      <text class="cart-strip-total">¥{{ cartStore.totalAmount.toFixed(2) }}</text>
    </view>

    <view class="section-card">
      <view class="section-head">
        <view>
          <text class="section-kicker">今日陈列</text>
          <text class="section-title">{{
            keyword ? '搜索结果' : '优先展示适合快速成交的商品'
          }}</text>
        </view>
        <text class="section-meta">{{ keyword ? '已按关键词筛选' : '默认陈列' }}</text>
      </view>

      <scroll-view
        v-if="featuredProducts.length"
        class="feature-scroll"
        scroll-x
        show-scrollbar="false"
      >
        <view class="feature-row">
          <view
            v-for="product in featuredProducts"
            :key="`${product.id}-feature`"
            class="feature-pill"
          >
            <text class="feature-pill-name">{{ product.name }}</text>
            <text class="feature-pill-price">¥{{ product.price.toFixed(2) }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="lowStockProducts.length" class="notice-card">
      <view class="section-head compact">
        <view>
          <text class="section-kicker warning">补货提醒</text>
          <text class="section-title">这些商品库存偏低</text>
        </view>
      </view>
      <view class="notice-list">
        <view
          v-for="product in lowStockProducts"
          :key="`${product.id}-low-stock`"
          class="notice-item"
        >
          <text class="notice-name">{{ product.name }}</text>
          <text class="notice-stock">库存 {{ product.stock }}</text>
        </view>
      </view>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">商品暂时没有显示出来</text>
      <text class="error-text">当前请求地址：{{ apiHostLabel }}</text>
      <text class="error-text">错误信息：{{ loadError }}</text>
      <button class="retry-btn" size="mini" @tap="loadProducts">重新加载</button>
    </view>

    <view v-else-if="loading" class="empty">
      <text class="empty-title">正在整理货架...</text>
      <text class="empty-text">稍等一下，商品列表马上就到。</text>
    </view>

    <view v-else-if="!products.length" class="empty">
      <text class="empty-title">还没有取到商品</text>
      <text class="empty-text">先检查当前后端地址，或者换一个关键词重新搜索。</text>
    </view>

    <view v-else class="grid">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        @add="addToCart"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx 36rpx;
}

.stage-card,
.section-card,
.notice-card,
.cart-strip,
.error-panel,
.empty {
  border-radius: 30rpx;
  background: rgba(255, 250, 243, 0.9);
  box-shadow: var(--lm-shadow);
}

.stage-card {
  display: flex;
  gap: 16rpx;
  align-items: stretch;
  margin-bottom: 20rpx;
  padding: 24rpx;
}

.stage-copy {
  flex: 1;
  min-width: 0;
}

.stage-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.stage-title {
  display: block;
  margin-top: 12rpx;
  color: var(--lm-primary-deep);
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.08;
}

.stage-desc {
  display: block;
  margin-top: 14rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.72;
}

.stage-column {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  width: 182rpx;
}

.metric-card {
  flex: 1;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(243, 233, 217, 0.92);
}

.metric-card.strong {
  background: linear-gradient(180deg, #984716 0%, #b96224 100%);
  color: #fff8f1;
}

.metric-value {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
}

.metric-label {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: inherit;
  opacity: 0.9;
}

.search-panel {
  display: flex;
  gap: 14rpx;
  align-items: center;
  margin-bottom: 18rpx;
}

.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 92rpx;
  padding: 0 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 250, 243, 0.9);
  box-shadow: var(--lm-shadow-soft);
}

.search-icon {
  color: var(--lm-primary);
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  height: 100%;
  margin-left: 14rpx;
  font-size: 27rpx;
  color: var(--lm-ink);
}

.search-btn {
  margin: 0;
  min-width: 118rpx;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 245, 0.96);
  color: var(--lm-primary-deep);
  font-size: 26rpx;
  font-weight: 700;
  box-shadow: var(--lm-shadow-soft);
}

.cart-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 18rpx;
  padding: 22rpx 24rpx;
}

.cart-strip.active {
  background: linear-gradient(135deg, #7a3511 0%, #b65a20 100%);
  color: #fff8f1;
}

.cart-strip-copy {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.cart-strip-kicker {
  font-size: 21rpx;
  opacity: 0.82;
}

.cart-strip-title {
  font-size: 28rpx;
  font-weight: 800;
}

.cart-strip-total {
  font-size: 38rpx;
  font-weight: 900;
}

.section-card,
.notice-card,
.error-panel,
.empty {
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
}

.section-head.compact {
  align-items: center;
}

.section-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
}

.section-kicker.warning {
  color: var(--lm-danger);
}

.section-title {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-ink);
  font-size: 28rpx;
  font-weight: 800;
}

.section-meta {
  color: var(--lm-subtle);
  font-size: 22rpx;
}

.feature-scroll {
  width: 100%;
  margin-top: 18rpx;
  white-space: nowrap;
}

.feature-row {
  display: inline-flex;
  gap: 14rpx;
}

.feature-pill {
  min-width: 220rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(245, 236, 222, 0.9);
  box-shadow: var(--lm-shadow-soft);
}

.feature-pill-name {
  display: block;
  color: var(--lm-ink);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.45;
}

.feature-pill-price {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-primary);
  font-size: 24rpx;
  font-weight: 800;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.notice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 18rpx;
  border-radius: 22rpx;
  background: rgba(248, 239, 227, 0.94);
}

.notice-name {
  color: var(--lm-ink);
  font-size: 24rpx;
  font-weight: 700;
}

.notice-stock {
  color: var(--lm-danger);
  font-size: 22rpx;
  font-weight: 700;
}

.error-title,
.empty-title {
  display: block;
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
  text-align: center;
}

.error-text,
.empty-text {
  display: block;
  margin-top: 12rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.7;
  text-align: center;
  word-break: break-all;
}

.retry-btn {
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8f4218 0%, #b35a20 100%);
  color: #fffaf3;
  font-size: 24rpx;
  font-weight: 700;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}
</style>
