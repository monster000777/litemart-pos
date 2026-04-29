import { prisma } from '~~/server/lib/prisma'

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  REGISTER: 'REGISTER',
  LOGOUT: 'LOGOUT',
  RESET_PIN: 'RESET_PIN',
  CHECKOUT: 'CHECKOUT',
  REFUND: 'REFUND',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE'
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const writeAuditLog = async (action: AuditAction, detail?: string, ip?: string) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        detail: detail ?? null,
        ip: ip ?? null
      }
    })
  } catch (error) {
    // 审计日志写入失败不应影响主流程
    console.error(`[AuditLog] Failed to write: ${action}`, error)
  }
}
