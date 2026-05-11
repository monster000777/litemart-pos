import { prisma } from '~~/server/lib/prisma'

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  REGISTER: 'REGISTER',
  LOGOUT: 'LOGOUT',
  ROLE_SWITCH: 'ROLE_SWITCH',
  RESET_PIN: 'RESET_PIN',
  AUTH_USER_CREATE: 'AUTH_USER_CREATE',
  AUTH_USER_UPDATE: 'AUTH_USER_UPDATE',
  AUTH_USER_RESET_PIN: 'AUTH_USER_RESET_PIN',
  AUTH_USER_DELETE: 'AUTH_USER_DELETE',
  CHECKOUT: 'CHECKOUT',
  REFUND: 'REFUND',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE',
  MEMBER_CREATE: 'MEMBER_CREATE',
  MEMBER_UPDATE: 'MEMBER_UPDATE',
  MEMBER_DELETE: 'MEMBER_DELETE',
  MEMBER_POINTS_ADD: 'MEMBER_POINTS_ADD',
  MEMBER_POINTS_DEDUCT: 'MEMBER_POINTS_DEDUCT',
  SUPPLIER_CREATE: 'SUPPLIER_CREATE',
  SUPPLIER_UPDATE: 'SUPPLIER_UPDATE',
  SUPPLIER_DELETE: 'SUPPLIER_DELETE',
  PURCHASE_CREATE: 'PURCHASE_CREATE',
  PURCHASE_RECEIVE: 'PURCHASE_RECEIVE',
  PURCHASE_CANCEL: 'PURCHASE_CANCEL'
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
    console.error(`[AuditLog] Failed to write: ${action}`, error)
  }
}
