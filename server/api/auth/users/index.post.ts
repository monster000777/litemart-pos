import { H3Error } from 'h3'
import { hashPin, isValidPinFormat } from '~~/server/services/auth-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { createAuthUser, isPinInUse } from '~~/server/services/auth-user-service'
import { getClientIp } from '~~/server/utils/request'
import { isUserRole, USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

type CreateAuthUserBody = {
  phone?: string
  pin?: string
  confirmPin?: string
  role?: UserRole
}

const ALLOWED_CREATE_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.CASHIER
])

export default defineEventHandler(async (event) => {
  try {
    if (event.context.auth?.role !== USER_ROLES.ADMIN) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '仅管理员可管理账号'
      })
    }

    const body = await readBody<CreateAuthUserBody>(event)
    const phone = body.phone?.trim() ?? ''
    const pin = body.pin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''
    const role = body.role

    if (!phone || !/^1\d{10}$/.test(phone)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号格式错误'
      })
    }

    if (!isValidPinFormat(pin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 格式错误'
      })
    }

    if (pin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的 PIN 不一致'
      })
    }

    if (!isUserRole(role) || !ALLOWED_CREATE_ROLES.has(role)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号角色无效'
      })
    }

    if (await isPinInUse(pin)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'PIN 已被其他账号使用'
      })
    }

    const pinHash = await hashPin(pin)
    const uid = Math.floor(10000000 + Math.random() * 90000000).toString()
    await createAuthUser({ uid, phone, pinHash, role })
    await writeAuditLog(
      AUDIT_ACTIONS.AUTH_USER_CREATE,
      `新增账号：${uid}（${role}，手机号：${phone}）`,
      getClientIp(event)
    )

    return {
      success: true
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '新增账号失败，请稍后重试'
    })
  }
})
