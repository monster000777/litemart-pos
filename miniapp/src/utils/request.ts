import { appConfig } from '../config'

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

type RequestOptions = {
  url: string
  method?: RequestMethod
  data?: Record<string, unknown> | Array<unknown>
}

type ApiError = {
  statusCode?: number
  message: string
}

const AUTH_TOKEN_KEY = 'lm_pos_token'
let reloginPending = false

const joinUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const baseUrl = String(appConfig.baseUrl || '')
    .trim()
    .replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!baseUrl) {
    return normalizedPath
  }

  return `${baseUrl}${normalizedPath}`
}

export const getAuthToken = () => uni.getStorageSync(AUTH_TOKEN_KEY) || ''

export const setAuthToken = (token: string) => {
  if (!token) {
    return
  }

  uni.setStorageSync(AUTH_TOKEN_KEY, token)
}

export const clearAuthToken = () => {
  uni.removeStorageSync(AUTH_TOKEN_KEY)
}

const handleUnauthorized = () => {
  clearAuthToken()

  if (reloginPending) {
    return
  }

  reloginPending = true
  uni.showToast({
    title: '登录状态已失效，请重新登录',
    icon: 'none'
  })

  setTimeout(() => {
    reloginPending = false
    uni.reLaunch({
      url: '/pages/login/index'
    })
  }, 300)
}

export const request = <T>(options: RequestOptions) =>
  new Promise<T>((resolve, reject) => {
    const token = getAuthToken()

    uni.request({
      url: joinUrl(options.url),
      method: options.method ?? 'GET',
      data: options.data,
      timeout: appConfig.requestTimeout,
      withCredentials: true,
      header: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined,
      success: (response) => {
        const { statusCode, data } = response

        if (statusCode >= 200 && statusCode < 300) {
          resolve(data as T)
          return
        }

        const payload = data as { message?: string; statusMessage?: string }
        if (statusCode === 401) {
          handleUnauthorized()
        }

        reject({
          statusCode,
          message: payload?.message || payload?.statusMessage || '请求失败，请稍后重试'
        } satisfies ApiError)
      },
      fail: () => {
        reject({
          message: '网络异常，请检查后端服务和小程序域名配置'
        } satisfies ApiError)
      }
    })
  })

export const toAbsoluteImage = (image: string | null) => {
  if (!image) {
    return ''
  }

  if (/^https?:\/\//.test(image)) {
    return image
  }

  return joinUrl(image)
}
