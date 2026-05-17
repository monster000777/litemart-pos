<script setup lang="ts">
import { reactive, ref } from 'vue'
import { authService } from '../../services'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const form = reactive({
  uid: '',
  pin: ''
})

const submit = async () => {
  if (!form.uid.trim() || !form.pin.trim()) {
    uni.showToast({ title: '请输入 UID 和密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const result = await authService.login({
      uid: form.uid.trim(),
      pin: form.pin.trim()
    })

    authStore.applyLogin({
      token: result.token,
      role: result.role,
      user: result.user
    })

    uni.switchTab({
      url: '/pages/home/index'
    })
  } catch (error) {
    const message = (error as { message?: string }).message || '登录失败'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="login-page">
    <view class="topline">
      <text class="brand">LITEMART POS MINI</text>
      <view class="status-pill">
        <text class="status-dot"></text>
        <text class="status-text">门店前台已就绪</text>
      </view>
    </view>

    <view class="intro">
      <text class="intro-title">开始今天的门店营业</text>
      <text class="intro-desc"> 用员工账号进入前台，完成点单、购物车和订单流转。 </text>
    </view>

    <view class="scene-card">
      <view class="scene-copy">
        <text class="scene-kicker">开台模式</text>
        <text class="scene-title">轻前台 · 快成交</text>
        <text class="scene-desc">把已有系统的商品和订单能力，稳定接到小程序端。</text>
      </view>

      <view class="scene-metrics">
        <view class="metric">
          <text class="metric-value">01</text>
          <text class="metric-label">登录验证</text>
        </view>
        <view class="metric">
          <text class="metric-value">02</text>
          <text class="metric-label">进入点单</text>
        </view>
      </view>
    </view>

    <view class="panel">
      <text class="panel-title">员工登录</text>
      <text class="panel-subtitle">输入 UID 或手机号与 PIN 码，进入小程序前台。</text>

      <view class="field-group">
        <view class="field">
          <text class="label">员工 UID / 手机号</text>
          <input
            v-model="form.uid"
            class="input"
            placeholder="例如 ADMIN0001"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field">
          <text class="label">PIN 密码</text>
          <input
            v-model="form.pin"
            class="input"
            password
            placeholder="请输入 6-64 位密码"
            placeholder-class="input-placeholder"
          />
        </view>
      </view>

      <button class="submit" :loading="loading" @tap="submit">进入前台</button>

      <view class="footnote">
        <text class="footnote-label">登录说明</text>
        <text class="footnote-text"
          >当前小程序端优先使用 Bearer Token，登录态比 Cookie 更稳定。</text
        >
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  padding: 72rpx 28rpx 40rpx;
}

.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.brand {
  color: var(--lm-primary);
  letter-spacing: 6rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 250, 243, 0.82);
  box-shadow: var(--lm-shadow-soft);
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #4c8b48;
}

.status-text {
  color: var(--lm-subtle);
  font-size: 21rpx;
  font-weight: 600;
}

.intro {
  margin-top: 34rpx;
}

.intro-title {
  display: block;
  max-width: 560rpx;
  color: var(--lm-primary-deep);
  font-size: 62rpx;
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -1rpx;
}

.intro-desc {
  display: block;
  max-width: 620rpx;
  margin-top: 16rpx;
  color: var(--lm-subtle);
  font-size: 27rpx;
  line-height: 1.72;
}

.scene-card,
.panel {
  margin-top: 28rpx;
  border-radius: 34rpx;
  background: rgba(255, 250, 243, 0.9);
  box-shadow: var(--lm-shadow);
}

.scene-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx;
}

.scene-copy {
  flex: 1;
  min-width: 0;
}

.scene-kicker {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.scene-title {
  display: block;
  margin-top: 12rpx;
  color: var(--lm-ink);
  font-size: 34rpx;
  font-weight: 800;
}

.scene-desc {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-subtle);
  font-size: 23rpx;
  line-height: 1.7;
}

.scene-metrics {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  width: 176rpx;
}

.metric {
  flex: 1;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, rgba(164, 83, 30, 0.1) 0%, rgba(164, 83, 30, 0.04) 100%);
}

.metric-value {
  display: block;
  color: var(--lm-primary-deep);
  font-size: 34rpx;
  font-weight: 900;
}

.metric-label {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-subtle);
  font-size: 21rpx;
}

.panel {
  padding: 30rpx 28rpx 28rpx;
}

.panel-title {
  display: block;
  color: var(--lm-ink);
  font-size: 32rpx;
  font-weight: 800;
}

.panel-subtitle {
  display: block;
  margin-top: 10rpx;
  color: var(--lm-subtle);
  font-size: 23rpx;
  line-height: 1.7;
}

.field-group {
  margin-top: 24rpx;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.field + .field {
  margin-top: 22rpx;
}

.label {
  color: var(--lm-ink);
  font-size: 24rpx;
  font-weight: 700;
}

.input {
  height: 94rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(116, 74, 34, 0.08);
  font-size: 28rpx;
  color: var(--lm-ink);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.input-placeholder {
  color: #aa9a8b;
}

.submit {
  margin-top: 28rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8f4218 0%, #b35a20 100%);
  color: #fffaf3;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: 0 16rpx 34rpx rgba(123, 60, 22, 0.16);
}

.footnote {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1px solid rgba(116, 74, 34, 0.08);
}

.footnote-label {
  display: block;
  color: var(--lm-primary);
  font-size: 21rpx;
  font-weight: 700;
}

.footnote-text {
  display: block;
  margin-top: 8rpx;
  color: var(--lm-subtle);
  font-size: 22rpx;
  line-height: 1.7;
}
</style>
