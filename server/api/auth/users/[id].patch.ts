import { H3Error } from 'h3'
import {
  AUTH_USER_STATUS,
  countActiveAdminUsers,
  findAuthUserById,
  isAuthUserStatus,
  updateAuthUser
} from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { isUserRole, USER_ROLES, type UserRole } from '~~/shared/constants/rbac'

type UpdateAuthUserBody = {
  name?: string
  role?: UserRole
  status?: string
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

    const currentUser = event.context.auth?.user
    if (!currentUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: '登录状态已失效'
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

    const body = await readBody<UpdateAuthUserBody>(event)
    const nextName = body.name?.trim()
    const nextRole = body.role
    const nextStatus = body.status

    if (nextName === undefined && nextRole === undefined && nextStatus === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '未提供可更新字段'
      })
    }

    if (nextName !== undefined && !nextName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号名称不能为空'
      })
    }

    if (nextRole !== undefined && !isUserRole(nextRole)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号角色无效'
      })
    }

    if (nextStatus !== undefined && !isAuthUserStatus(nextStatus)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号状态无效'
      })
    }

    if (currentUser.id === targetUser.id) {
      if (nextStatus && nextStatus !== AUTH_USER_STATUS.ACTIVE) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '不能停用当前登录账号'
        })
      }

      if (nextRole && nextRole !== USER_ROLES.ADMIN) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '不能将当前登录账号降级为非管理员'
        })
      }
    }

    const changingAdminCapability =
      targetUser.role === USER_ROLES.ADMIN &&
      ((nextRole !== undefined && nextRole !== USER_ROLES.ADMIN) ||
        (nextStatus !== undefined && nextStatus !== AUTH_USER_STATUS.ACTIVE))

    if (changingAdminCapability && targetUser.status === AUTH_USER_STATUS.ACTIVE) {
      const activeAdminCount = await countActiveAdminUsers()
      if (activeAdminCount <= 1) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Conflict',
          message: '系统至少需要保留一个启用中的管理员账号'
        })
      }
    }

    await updateAuthUser(id, {
      name: nextName,
      role: nextRole,
      status: nextStatus
    })

    const detailParts: string[] = [`更新账号：${targetUser.name}`]
    if (nextName !== undefined) {
      detailParts.push(`名称 -> ${nextName}`)
    }
    if (nextRole !== undefined) {
      detailParts.push(`角色 -> ${nextRole}`)
    }
    if (nextStatus !== undefined) {
      detailParts.push(`状态 -> ${nextStatus}`)
    }

    await writeAuditLog(AUDIT_ACTIONS.AUTH_USER_UPDATE, detailParts.join('，'), getClientIp(event))

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
      message: '更新账号失败，请稍后重试'
    })
  }
})
