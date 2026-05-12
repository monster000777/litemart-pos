import { H3Error } from 'h3'
import { hashPin, isValidPinFormat } from '~~/server/services/auth-service'
import {
  findAuthUserById,
  isPinInUse,
  updateAuthUserPin
} from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { USER_ROLES } from '~~/shared/constants/rbac'

type ResetManagedUserPinBody = {
  newPin?: string
  confirmPin?: string
}

export default defineEventHandler(async (event) => {
  try {
    if (event.context.auth?.role !== USER_ROLES.ADMIN) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '仅管理员可管理账号'
      })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '缺少账号 ID'
      })
    }

    const body = await readBody<ResetManagedUserPinBody>(event)
    const newPin = body.newPin?.trim() ?? ''
    const confirmPin = body.confirmPin?.trim() ?? ''

    if (!isValidPinFormat(newPin) || !isValidPinFormat(confirmPin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'PIN 格式错误'
      })
    }

    if (newPin !== confirmPin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '两次输入的 PIN 不一致'
      })
    }

    const targetUser = await findAuthUserById(id)
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '账号不存在'
      })
    }

    if (await isPinInUse(newPin, { excludeUserId: targetUser.id })) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'PIN 已被其他账号使用'
      })
    }

    const pinHash = await hashPin(newPin)
    await updateAuthUserPin(targetUser.id, pinHash)
    await writeAuditLog(
      AUDIT_ACTIONS.AUTH_USER_RESET_PIN,
      `重置账号 PIN：${targetUser.uid}`,
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
      message: '重置账号 PIN 失败，请稍后重试'
    })
  }
})
