import type { H3Event } from 'h3'

import { getRequestIP } from 'h3'

/**
 * 从请求中提取客户端 IP 地址
 * 使用 h3 内置的 getRequestIP，更加安全合规，防止直接伪造 X-Forwarded-For
 */
export const getClientIp = (event: H3Event): string => {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}
