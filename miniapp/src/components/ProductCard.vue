<script setup lang="ts">
import type { Product } from '../types'
import { toAbsoluteImage } from '../utils/request'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  add: [product: Product]
}>()

const formatAmount = (amount: number) => `¥${Number(amount || 0).toFixed(2)}`

const memberPriceLabel =
  props.product.memberPrice != null ? formatAmount(props.product.memberPrice) : ''
</script>

<template>
  <view class="card">
    <view class="media-shell">
      <image
        v-if="product.image"
        class="cover"
        :src="toAbsoluteImage(product.image)"
        mode="aspectFill"
      />
      <view v-else class="cover cover-empty">
        <text class="empty-mark">{{ product.category || 'LITEMART' }}</text>
      </view>

      <view class="category-chip">
        <text>{{ product.category }}</text>
      </view>
    </view>

    <view class="body">
      <view class="meta">
        <text class="name">{{ product.name }}</text>
        <text class="sku">货号 {{ product.sku }}</text>
      </view>

      <view class="price-row">
        <view class="price-wrap">
          <text class="price">{{ formatAmount(product.price) }}</text>
          <text v-if="memberPriceLabel" class="member-price">会员价 {{ memberPriceLabel }}</text>
        </view>

        <view class="stock-tag" :class="{ alert: product.stock <= product.minStock }">
          <text>{{
            product.stock <= product.minStock ? '补货提醒' : `库存 ${product.stock}`
          }}</text>
        </view>
      </view>

      <button class="add-btn" size="mini" @tap="emit('add', product)">加入购物车</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.card {
  overflow: hidden;
  border: 1px solid rgba(112, 61, 24, 0.08);
  border-radius: 30rpx;
  background: rgba(255, 251, 245, 0.96);
  box-shadow: var(--lm-shadow);
}

.media-shell {
  position: relative;
  padding: 12rpx 12rpx 0;
}

.cover {
  width: 100%;
  height: 224rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #f3ddbf 0%, #f7eee0 100%);
}

.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-mark {
  color: rgba(95, 43, 14, 0.5);
  letter-spacing: 4rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.category-chip {
  position: absolute;
  left: 24rpx;
  top: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 250, 244, 0.84);
  color: var(--lm-primary-deep);
  font-size: 20rpx;
  font-weight: 700;
}

.body {
  padding: 18rpx 18rpx 20rpx;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.name {
  min-height: 80rpx;
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.35;
}

.sku {
  color: var(--lm-subtle);
  font-size: 22rpx;
}

.price-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 18rpx;
}

.price-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.price {
  color: var(--lm-primary-deep);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1;
}

.member-price {
  color: var(--lm-subtle);
  font-size: 21rpx;
}

.stock-tag {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #f0e4d2;
  color: #7d5e48;
  font-size: 20rpx;
  font-weight: 700;
}

.stock-tag.alert {
  background: rgba(162, 59, 48, 0.12);
  color: var(--lm-danger);
}

.add-btn {
  margin: 18rpx 0 0;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8f4218 0%, #b35a20 100%);
  color: #fffaf3;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 10rpx 24rpx rgba(123, 60, 22, 0.16);
}
</style>
