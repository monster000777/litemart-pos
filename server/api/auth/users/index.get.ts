import { listAuthUsers } from '~~/server/services/auth-user-service'
import { USER_ROLES } from '~~/shared/constants/rbac'

export default defineEventHandler(async (event) => {
  if (event.context.auth?.role !== USER_ROLES.ADMIN) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: '仅管理员可管理账号'
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

  const users = await listAuthUsers()

  return {
    currentUserId: currentUser.id,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      status: user.status
    }))
  }
})
