import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { appConfig } from './config'
import App from './App.vue'

// Debug: Log current environment configuration (only in dev, not production)
if (import.meta.env.MODE === 'production') {
  // Production: silent
} else {
  console.log(`[LiteMart POS] Environment: ${appConfig.apiEnv}`)
  console.log(`[LiteMart POS] API BaseURL: ${appConfig.baseUrl}`)
  console.log(`[LiteMart POS] Request Timeout: ${appConfig.requestTimeout}ms`)
}

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()

  app.use(pinia)

  return {
    app
  }
}
