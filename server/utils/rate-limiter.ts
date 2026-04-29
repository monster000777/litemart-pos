/**
 * 内存级速率限制器
 * 用于防止暴力破解 PIN 码
 */

type RateLimitEntry = {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

type RateLimiterOptions = {
  maxAttempts: number
  windowMs: number
  lockoutMs: number
  cleanupIntervalMs?: number
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000, // 5 分钟窗口
  lockoutMs: 60 * 1000, // 锁定 60 秒
  cleanupIntervalMs: 10 * 60 * 1000 // 每 10 分钟清理过期条目
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private options: RateLimiterOptions
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options?: Partial<RateLimiterOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.startCleanup()
  }

  /**
   * 检查指定 key 是否被限制
   * 返回 null 表示未限制，否则返回剩余锁定秒数
   */
  check(key: string): number | null {
    const entry = this.store.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()

    // 当前处于锁定期
    if (entry.lockedUntil > now) {
      return Math.ceil((entry.lockedUntil - now) / 1000)
    }

    // 窗口已过期，清除记录
    if (now - entry.firstAttemptAt > this.options.windowMs) {
      this.store.delete(key)
      return null
    }

    return null
  }

  /**
   * 记录一次失败尝试
   * 返回 null 表示尚未触发锁定，否则返回锁定秒数
   */
  recordFailure(key: string): number | null {
    const now = Date.now()
    let entry = this.store.get(key)

    if (!entry || now - entry.firstAttemptAt > this.options.windowMs) {
      entry = {
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: 0
      }
      this.store.set(key, entry)
      return null
    }

    entry.attempts++

    if (entry.attempts >= this.options.maxAttempts) {
      entry.lockedUntil = now + this.options.lockoutMs
      const lockSeconds = Math.ceil(this.options.lockoutMs / 1000)
      // 重置计数以便锁定结束后重新计算
      entry.attempts = 0
      entry.firstAttemptAt = now + this.options.lockoutMs
      return lockSeconds
    }

    return null
  }

  /**
   * 清除指定 key 的限制记录（登录成功时调用）
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * 定时清理过期条目，防止内存泄漏
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      return
    }
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store) {
        const isExpired =
          now - entry.firstAttemptAt > this.options.windowMs && entry.lockedUntil <= now
        if (isExpired) {
          this.store.delete(key)
        }
      }
    }, this.options.cleanupIntervalMs ?? DEFAULT_OPTIONS.cleanupIntervalMs!)
  }
}

// 全局单例：PIN 登录速率限制器
const globalForRateLimiter = globalThis as unknown as {
  pinRateLimiter?: RateLimiter
}

export const getPinRateLimiter = (): RateLimiter => {
  if (!globalForRateLimiter.pinRateLimiter) {
    globalForRateLimiter.pinRateLimiter = new RateLimiter({
      maxAttempts: 5,
      windowMs: 5 * 60 * 1000,
      lockoutMs: 60 * 1000
    })
  }
  return globalForRateLimiter.pinRateLimiter
}
