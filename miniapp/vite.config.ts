import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// Vite automatically loads .env files based on --mode parameter:
// - .env (common variables for all modes)
// - .env.local (local overrides for all modes, git-ignored)
// - .env.{mode} (environment-specific, e.g., .env.dev-lan, .env.production)
// - .env.{mode}.local (environment-specific overrides, git-ignored)
//
// Current modes:
// - dev-lan (development via LAN, for WeChat DevTools)
// - production (production build)

export default defineConfig({
  plugins: [uni()],
  define: {
    // Ensure import.meta.env works correctly
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})
