import { H3Error } from 'h3'
import { findAuthUserByName, updateAuthUser } from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

type UpdateProfileBody = {
  name?: string
}

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.auth?.user
    if (!authUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: '未登录'
      })
    }

    const body = await readBody<UpdateProfileBody>(event)
    const name = body.name?.trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号名称不能为空'
      })
    }

    if (name.length < 2 || name.length > 20) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '账号名称长度须在 2~20 个字符之间'
      })
    }

    if (name !== authUser.name) {
      const existing = await findAuthUserByName(name)
      if (existing) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Conflict',
          message: '该账号名已被使用'
        })
      }

      await updateAuthUser(authUser.id, { name })
      await writeAuditLog(
        AUDIT_ACTIONS.AUTH_USER_UPDATE,
        `更新个人资料: 账号名改为 ${name}`,
        getClientIp(event)
      )
    }

    return {
      success: true,
      name
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '更新资料失败'
    })
  }
})
