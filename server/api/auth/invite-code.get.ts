import { H3Error } from 'h3'
import { getAuthConfig } from '~~/server/services/auth-config-service'
import { USER_ROLES, roleHasAtLeast } from '~~/shared/constants/rbac'

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.auth?.user
    if (!authUser || !roleHasAtLeast(authUser.role, USER_ROLES.MANAGER)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: '仅店长和管理员可查看邀请码'
      })
    }

    const config = await getAuthConfig()
    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: '系统尚未初始化'
      })
    }

    return {
      success: true,
      inviteCode: config.inviteCode || null
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '获取邀请码失败'
    })
  }
})
