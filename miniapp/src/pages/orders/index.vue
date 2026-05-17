<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { orderService } from '../../services'
import type { Order } from '../../types'

const loading = ref(false)
const loadError = ref('')
const orders = ref<Order[]>([])

const totalAmount = computed(() =>
  orders.value.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
)

const orderCountLabel = computed(() => `${orders.value.length} 笔订单`)

const formatAmount = (amount: number) => `¥${Number(amount || 0).toFixed(2)}`

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

const loadOrders = async () => {
  if (loading.value) {
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const response = await orderService.getOrders()
    orders.value = Array.isArray(response?.orders) ? response.orders : []
  } catch (error) {
    orders.value = []
    loadError.value = (error as { message?: string })?.message || '订单加载失败，请稍后重试'
    uni.showToast({
      title: '订单加载失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

onShow(() => {
  void loadOrders()
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero-copy">
        <text class="hero-title">订单记录</text>
        <text class="hero-subtitle">查看最近成交订单和商品明细。</text>
      </view>
      <view class="hero-chip">
        <text class="hero-chip-value">{{ orderCountLabel }}</text>
        <text class="hero-chip-label">最近订单</text>
      </view>
    </view>

    <view class="summary-panel">
      <text class="summary-label">累计成交金额</text>
      <text class="summary-value">{{ formatAmount(totalAmount) }}</text>
    </view>

    <view v-if="loading" class="empty">
      <text class="empty-title">正在读取订单...</text>
      <text class="empty-subtitle">稍等一下，我们正在同步最近记录。</text>
    </view>

    <view v-else-if="loadError" class="error-card">
      <text class="error-title">订单暂时没有加载成功</text>
      <text class="error-message">{{ loadError }}</text>
      <button class="retry-button" @tap="loadOrders">重新加载</button>
    </view>

    <view v-else-if="!orders.length" class="empty">
      <text class="empty-title">还没有订单记录</text>
      <text class="empty-subtitle">完成一笔下单后，这里会自动展示最新成交。</text>
    </view>

    <view v-else class="list">
      <view v-for="order in orders" :key="order.id" class="card">
        <view class="head">
          <view>
            <text class="order-no">{{ order.orderNo }}</text>
            <text class="status">{{ order.status }} · {{ formatTime(order.createdAt) }}</text>
          </view>
          <text class="amount">{{ formatAmount(order.totalAmount) }}</text>
        </view>

        <view class="items">
          <text v-for="item in order.items" :key="item.id" class="item-text">
            {{ item.product.name }} × {{ item.quantity }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 28rpx;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: center;
  margin-bottom: 18rpx;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.hero-title {
  display: block;
  color: var(--lm-primary-deep);
  font-size: 44rpx;
  font-weight: 900;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.6;
}

.hero-chip {
  min-width: 162rpx;
  padding: 18rpx 22rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 245, 0.86);
  border: 2rpx solid var(--lm-border);
  text-align: center;
}

.hero-chip-value {
  display: block;
  color: var(--lm-primary-deep);
  font-size: 28rpx;
  font-weight: 900;
}

.hero-chip-label {
  display: block;
  margin-top: 6rpx;
  color: var(--lm-subtle);
  font-size: 20rpx;
}

.summary-panel {
  margin-bottom: 18rpx;
  padding: 26rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #7c2d12 0%, #b85a13 100%);
  color: #fffaf3;
  box-shadow: 0 24rpx 50rpx rgba(120, 50, 14, 0.18);
}

.summary-label {
  display: block;
  font-size: 22rpx;
  opacity: 0.82;
}

.summary-value {
  display: block;
  margin-top: 8rpx;
  font-size: 42rpx;
  font-weight: 900;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.card,
.error-card,
.empty {
  padding: 28rpx 24rpx;
  border: 2rpx solid var(--lm-border);
  border-radius: 30rpx;
  background: rgba(255, 250, 243, 0.92);
  box-shadow: var(--lm-shadow);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.order-no {
  display: block;
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
}

.status {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-subtle);
  font-size: 22rpx;
  line-height: 1.5;
}

.amount {
  flex-shrink: 0;
  color: var(--lm-primary-deep);
  font-size: 30rpx;
  font-weight: 900;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 18rpx;
}

.item-text,
.empty-subtitle,
.error-message {
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.7;
}

.empty-title,
.error-title {
  display: block;
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
  text-align: center;
}

.empty-subtitle,
.error-message {
  display: block;
  margin-top: 12rpx;
  text-align: center;
}

.retry-button {
  margin-top: 20rpx;
  border: none;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8f3f16 0%, #b85a13 100%);
  color: #fff9f0;
  font-size: 26rpx;
  font-weight: 700;
}

.retry-button::after {
  border: none;
}
</style>
