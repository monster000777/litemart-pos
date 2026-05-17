<script setup lang="ts">
import { computed, ref } from 'vue'
import { authService } from '../../services'
import { useAuthStore } from '../../stores/auth'
import { useCartStore } from '../../stores/cart'

const authStore = useAuthStore()
const cartStore = useCartStore()
const logoutLoading = ref(false)

const roleText = computed(() => authStore.role || '未识别')
const userName = computed(() => authStore.user?.uid || '未登录用户')
const phoneText = computed(() => authStore.user?.phone || '-')
const cartCount = computed(() => cartStore.totalCount)
const cartAmount = computed(() => `¥${cartStore.totalAmount.toFixed(2)}`)

const relaunchLogin = async () => {
  logoutLoading.value = true
  try {
    await authService.logout()
  } catch {
    // Ignore remote logout failures and always clear local state.
  } finally {
    authStore.logoutLocal()
    cartStore.clearCart()
    logoutLoading.value = false
    uni.reLaunch({
      url: '/pages/login/index'
    })
  }
}
</script>

<template>
  <view class="page">
    <view class="hero-card">
      <view class="hero-top">
        <view class="avatar">店</view>
        <view class="hero-copy">
          <text class="hero-kicker">当前值班账号</text>
          <text class="hero-name">{{ userName }}</text>
          <text class="hero-meta">{{ phoneText }} · {{ roleText }}</text>
        </view>
      </view>

      <view class="hero-grid">
        <view class="hero-metric">
          <text class="hero-metric-value">{{ cartCount }}</text>
          <text class="hero-metric-label">购物车商品</text>
        </view>
        <view class="hero-metric">
          <text class="hero-metric-value">{{ cartAmount }}</text>
          <text class="hero-metric-label">待结算金额</text>
        </view>
      </view>
    </view>

    <view class="panel">
      <text class="panel-kicker">工作状态</text>
      <text class="panel-title">小程序前台已经接入基础点单闭环</text>
      <text class="panel-line">现在可以完成商品浏览、加购、会员识别、积分抵扣和订单提交。</text>
      <text class="panel-line">如果购物车里还有商品，建议先回到收银区继续完成结算。</text>
    </view>

    <view class="panel muted">
      <text class="panel-kicker">登录说明</text>
      <text class="panel-title">当前环境优先使用 Bearer Token</text>
      <text class="panel-line">适合小程序端维持稳定登录态，退出时也会一并清理本地状态。</text>
    </view>

    <button class="logout" :loading="logoutLoading" @tap="relaunchLogin">退出登录</button>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx 40rpx;
}

.hero-card,
.panel {
  border-radius: 30rpx;
  box-shadow: var(--lm-shadow);
}

.hero-card {
  margin-bottom: 18rpx;
  padding: 24rpx;
  background: linear-gradient(160deg, #7f3512 0%, #b55a20 100%);
  color: #fff8f1;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: rgba(255, 248, 241, 0.18);
  font-size: 34rpx;
  font-weight: 900;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.hero-kicker {
  display: block;
  font-size: 21rpx;
  opacity: 0.8;
}

.hero-name {
  display: block;
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 900;
}

.hero-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  opacity: 0.9;
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.hero-metric {
  padding: 18rpx;
  border-radius: 22rpx;
  background: rgba(255, 248, 241, 0.14);
}

.hero-metric-value {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}

.hero-metric-label {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  opacity: 0.88;
}

.panel {
  margin-bottom: 18rpx;
  padding: 24rpx;
  background: rgba(255, 250, 243, 0.9);
}

.panel.muted {
  background: rgba(246, 239, 228, 0.9);
}

.panel-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
}

.panel-title {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-ink);
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.45;
}

.panel-line {
  display: block;
  margin-top: 12rpx;
  color: var(--lm-subtle);
  font-size: 24rpx;
  line-height: 1.72;
}

.logout {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: rgba(234, 220, 205, 0.96);
  color: var(--lm-primary-deep);
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: var(--lm-shadow-soft);
}
</style>
