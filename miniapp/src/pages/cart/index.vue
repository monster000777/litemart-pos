<script setup lang="ts">
import { computed, ref } from 'vue'
import { customerService, orderService } from '../../services'
import { useCartStore } from '../../stores/cart'
import { toAbsoluteImage } from '../../utils/request'

const cartStore = useCartStore()
const memberPhone = ref('')
const checkoutLoading = ref(false)

const canCheckout = computed(() => cartStore.items.length > 0)
const subtotal = computed(() => {
  return cartStore.items.reduce((sum, item) => {
    const unitPrice = cartStore.member && item.memberPrice != null ? item.memberPrice : item.price
    return sum + unitPrice * item.quantity
  }, 0)
})
const pointsDiscount = computed(() => Number((subtotal.value - cartStore.totalAmount).toFixed(2)))

const bindMember = async () => {
  if (!memberPhone.value.trim()) {
    uni.showToast({ title: '请输入会员手机号', icon: 'none' })
    return
  }

  try {
    const member = await customerService.lookupMember(memberPhone.value.trim())
    if (!member) {
      uni.showToast({ title: '未找到会员', icon: 'none' })
      return
    }

    cartStore.setMember(member)
    cartStore.setPointsToUse(0)
    uni.showToast({ title: '会员已绑定', icon: 'success' })
  } catch (error) {
    const message = (error as { message?: string }).message || '会员查询失败'
    uni.showToast({ title: message, icon: 'none' })
  }
}

const clearMember = () => {
  memberPhone.value = ''
  cartStore.setMember(null)
  uni.showToast({ title: '已取消会员识别', icon: 'none' })
}

const submitOrder = async () => {
  if (!canCheckout.value) {
    return
  }

  checkoutLoading.value = true
  try {
    const result = await orderService.checkout({
      items: cartStore.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      memberId: cartStore.member?.id,
      pointsToUse: cartStore.pointsToUse
    })

    cartStore.clearCart()
    uni.showModal({
      title: '下单成功',
      content: `订单号：${result.orderNo}\n实付：¥${Number(result.totalAmount).toFixed(2)}`,
      showCancel: false,
      success: () => {
        uni.switchTab({
          url: '/pages/orders/index'
        })
      }
    })
  } catch (error) {
    const message = (error as { message?: string }).message || '下单失败'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    checkoutLoading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="hero-kicker">结算台</text>
        <text class="hero-title">购物车</text>
        <text class="hero-subtitle">确认会员、商品数量和积分抵扣，再完成成交。</text>
      </view>
      <view class="hero-stat">
        <text class="hero-stat-value">{{ cartStore.totalCount }}</text>
        <text class="hero-stat-label">件商品</text>
      </view>
    </view>

    <view v-if="!cartStore.items.length" class="empty">
      <text class="empty-title">购物车还是空的</text>
      <text class="empty-desc">先去首页挑几件商品，再回来结算。</text>
    </view>

    <view v-else>
      <view class="member-panel">
        <view class="section-head">
          <view>
            <text class="section-kicker">会员识别</text>
            <text class="section-title">绑定会员后自动切换会员价</text>
          </view>
          <button v-if="cartStore.member" class="ghost-btn" size="mini" @tap="clearMember">
            清除
          </button>
        </view>

        <view class="member-row">
          <input
            v-model="memberPhone"
            class="member-input"
            placeholder="输入 11 位手机号"
            placeholder-class="input-placeholder"
          />
          <button class="member-btn" size="mini" @tap="bindMember">查询</button>
        </view>

        <view v-if="cartStore.member" class="member-info">
          <view class="member-avatar">会</view>
          <view class="member-copy">
            <text class="member-name">{{ cartStore.member.name || '未命名会员' }}</text>
            <text class="member-meta"
              >{{ cartStore.member.phone }} · {{ cartStore.member.level }}</text
            >
            <text class="member-meta">当前积分 {{ cartStore.member.points }}</text>
          </view>
        </view>
      </view>

      <view class="list">
        <view v-for="item in cartStore.items" :key="item.productId" class="item-card">
          <image
            v-if="item.image"
            class="thumb"
            :src="toAbsoluteImage(item.image)"
            mode="aspectFill"
          />
          <view v-else class="thumb thumb-empty">ITEM</view>

          <view class="content">
            <view class="item-head">
              <view class="copy">
                <text class="name">{{ item.name }}</text>
                <text class="stock-text">库存 {{ item.stock }}</text>
              </view>
              <text class="price">
                ¥{{
                  (cartStore.member && item.memberPrice != null
                    ? item.memberPrice
                    : item.price
                  ).toFixed(2)
                }}
              </text>
            </view>

            <view class="item-foot">
              <view class="quantity-box">
                <button
                  class="qty-btn"
                  size="mini"
                  @tap="cartStore.updateQuantity(item.productId, item.quantity - 1)"
                >
                  -
                </button>
                <text class="qty-value">{{ item.quantity }}</text>
                <button
                  class="qty-btn"
                  size="mini"
                  @tap="cartStore.updateQuantity(item.productId, item.quantity + 1)"
                >
                  +
                </button>
              </view>

              <text class="line-total">
                小计 ¥{{
                  (
                    (cartStore.member && item.memberPrice != null ? item.memberPrice : item.price) *
                    item.quantity
                  ).toFixed(2)
                }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="cartStore.member" class="points-panel">
        <view class="section-head">
          <view>
            <text class="section-kicker">积分抵扣</text>
            <text class="section-title">100 积分 = 1 元</text>
          </view>
          <text class="points-hint">最多抵扣订单金额的 50%</text>
        </view>

        <input
          class="points-input"
          type="number"
          :value="String(cartStore.pointsToUse)"
          placeholder="输入要使用的积分"
          placeholder-class="input-placeholder"
          @input="cartStore.setPointsToUse(Number($event.detail.value || 0))"
        />
      </view>

      <view class="summary-card">
        <view class="summary-head">
          <text class="summary-title">结算摘要</text>
          <text class="summary-badge">{{ cartStore.totalCount }} 件</text>
        </view>

        <view class="summary-row">
          <text>商品金额</text>
          <text>¥{{ subtotal.toFixed(2) }}</text>
        </view>
        <view v-if="pointsDiscount > 0" class="summary-row discount">
          <text>积分抵扣</text>
          <text>-¥{{ pointsDiscount.toFixed(2) }}</text>
        </view>
        <view class="summary-row total">
          <text>实付</text>
          <text>¥{{ cartStore.totalAmount.toFixed(2) }}</text>
        </view>
      </view>

      <button class="submit" :disabled="!canCheckout" :loading="checkoutLoading" @tap="submitOrder">
        提交订单
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx 40rpx;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.hero-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.hero-title {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-primary-deep);
  font-size: 46rpx;
  font-weight: 900;
}

.hero-subtitle {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.7;
}

.hero-stat {
  min-width: 148rpx;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(255, 250, 243, 0.88);
  text-align: center;
  box-shadow: var(--lm-shadow-soft);
}

.hero-stat-value {
  display: block;
  color: var(--lm-primary-deep);
  font-size: 34rpx;
  font-weight: 900;
}

.hero-stat-label {
  display: block;
  margin-top: 6rpx;
  color: var(--lm-subtle);
  font-size: 20rpx;
}

.empty,
.member-panel,
.points-panel,
.summary-card,
.item-card {
  border-radius: 30rpx;
  background: rgba(255, 250, 243, 0.9);
  box-shadow: var(--lm-shadow);
}

.empty {
  padding: 120rpx 40rpx;
  text-align: center;
}

.empty-title {
  display: block;
  color: var(--lm-primary-deep);
  font-size: 34rpx;
  font-weight: 800;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
}

.member-panel,
.points-panel,
.summary-card {
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.section-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
}

.section-title {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-ink);
  font-size: 28rpx;
  font-weight: 800;
}

.ghost-btn {
  margin: 0;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(240, 228, 210, 0.9);
  color: var(--lm-primary-deep);
  font-size: 22rpx;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.member-input,
.points-input {
  flex: 1;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(116, 74, 34, 0.08);
  font-size: 26rpx;
  color: var(--lm-ink);
}

.input-placeholder {
  color: #aa9a8b;
}

.member-btn {
  margin: 0;
  width: 132rpx;
  min-width: 132rpx;
  height: 86rpx;
  line-height: 86rpx;
  padding: 0;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #8f4218 0%, #b35a20 100%);
  color: #fffaf3;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 12rpx 24rpx rgba(123, 60, 22, 0.14);
}

.member-info {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(245, 236, 222, 0.84);
}

.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8d4219 0%, #b35a20 100%);
  color: #fff8f1;
  font-size: 28rpx;
  font-weight: 800;
}

.member-copy {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.member-name {
  color: var(--lm-primary-deep);
  font-size: 28rpx;
  font-weight: 800;
}

.member-meta,
.points-hint {
  color: var(--lm-subtle);
  font-size: 22rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-bottom: 18rpx;
}

.item-card {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
}

.thumb {
  width: 136rpx;
  height: 136rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #f2ddbf 0%, #f7efe2 100%);
}

.thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lm-subtle);
  font-size: 22rpx;
}

.content {
  flex: 1;
  min-width: 0;
}

.item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.copy {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  color: var(--lm-ink);
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1.4;
}

.stock-text {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-subtle);
  font-size: 21rpx;
}

.price {
  flex-shrink: 0;
  color: var(--lm-primary-deep);
  font-size: 32rpx;
  font-weight: 900;
}

.item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 18rpx;
}

.quantity-box {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: rgba(245, 236, 222, 0.92);
}

.qty-btn {
  margin: 0;
  width: 58rpx;
  min-width: 58rpx;
  height: 58rpx;
  line-height: 58rpx;
  border-radius: 50%;
  background: rgba(255, 250, 243, 0.96);
  color: var(--lm-primary-deep);
  font-size: 28rpx;
  font-weight: 800;
}

.qty-value {
  min-width: 44rpx;
  text-align: center;
  color: var(--lm-ink);
  font-size: 25rpx;
  font-weight: 700;
}

.line-total {
  color: var(--lm-subtle);
  font-size: 22rpx;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.summary-title {
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
}

.summary-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(240, 228, 210, 0.9);
  color: var(--lm-primary-deep);
  font-size: 20rpx;
  font-weight: 700;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
  color: var(--lm-ink);
  font-size: 25rpx;
}

.summary-row.discount {
  color: var(--lm-primary);
}

.summary-row.total {
  margin-top: 8rpx;
  padding-top: 18rpx;
  border-top: 1px dashed rgba(116, 74, 34, 0.12);
  font-size: 30rpx;
  font-weight: 900;
}

.submit {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8f4218 0%, #b35a20 100%);
  color: #fffaf3;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: 0 16rpx 34rpx rgba(123, 60, 22, 0.16);
}
</style>
