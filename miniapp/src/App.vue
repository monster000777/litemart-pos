<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from './stores/auth'

onLaunch(() => {
  const authStore = useAuthStore()
  authStore.bootstrap()
})
</script>

<style lang="scss">
@import './uni.scss';

page {
  background:
    radial-gradient(circle at 20% 0%, rgba(198, 129, 54, 0.13), transparent 24%),
    radial-gradient(circle at 86% 8%, rgba(142, 72, 25, 0.08), transparent 20%),
    linear-gradient(180deg, #fbf4ea 0%, #f1e4d0 100%);
  color: var(--lm-ink);
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

view,
text,
button,
input,
image {
  box-sizing: border-box;
}

button::after {
  border: none;
}
</style>
