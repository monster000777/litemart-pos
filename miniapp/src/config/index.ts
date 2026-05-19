type ApiEnv = 'lan' | 'prod'

const DEFAULT_BASE_URL_BY_ENV: Record<ApiEnv, string> = {
  lan: 'http://192.168.1.100:3000',
  prod: 'https://YOUR_API_DOMAIN.com'
}

const normalizeApiEnv = (value: string): ApiEnv => {
  const normalized = value.trim().toLowerCase()

  // Match 'prod' or 'production' (from .env or Vite --mode production)
  if (normalized.includes('prod') || normalized === 'production') {
    return 'prod'
  }

  // Default to 'lan' for all other values (dev-lan, empty, etc.)
  return 'lan'
}

const resolveApiEnv = (): ApiEnv => {
  const envTag = String(import.meta.env.VITE_API_ENV || import.meta.env.MODE || '')
  return normalizeApiEnv(envTag)
}

const resolveRequestTimeout = () => {
  const timeout = Number(import.meta.env.VITE_REQUEST_TIMEOUT || 12000)
  return Number.isFinite(timeout) && timeout > 0 && timeout <= 60000 ? timeout : 12000
}

const apiEnv = resolveApiEnv()
const envBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim()

export const appConfig = {
  apiEnv,
  baseUrl: envBaseUrl || DEFAULT_BASE_URL_BY_ENV[apiEnv],
  requestTimeout: resolveRequestTimeout()
}
