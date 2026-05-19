/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API environment: 'lan' (192.168.1.x:3000), 'prod' (custom domain) */
  readonly VITE_API_ENV?: string
  /** Override API base URL. If empty, uses default for environment */
  readonly VITE_API_BASE_URL?: string
  /** Request timeout in milliseconds (default: 12000) */
  readonly VITE_REQUEST_TIMEOUT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
