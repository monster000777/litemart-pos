import { H3Error } from 'h3'
import { deleteAuthUserSafely, findAuthUserById } from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'
import { USER_ROLES } from '~~/shared/constants/rbac'

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

    const deleted = await deleteAuthUserSafely(id, currentUser.id)
    if (!deleted) {
      if (id === currentUser.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: '不能删除当前登录账号'
        })
      }

      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: '系统至少需要保留一个启用中的管理员账号'
      })
    }

    await writeAuditLog(
      AUDIT_ACTIONS.AUTH_USER_DELETE,
      `删除账号：${targetUser.uid}（${targetUser.role}）`,
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
      message: '删除账号失败，请稍后重试'
    })
  }
})
