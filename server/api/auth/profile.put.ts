import { H3Error } from 'h3'
import { findAuthUserByPhone, updateAuthUser } from '~~/server/services/auth-user-service'
import { AUDIT_ACTIONS, writeAuditLog } from '~~/server/services/audit-service'
import { getClientIp } from '~~/server/utils/request'

type UpdateProfileBody = {
  phone?: string
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
    const phone = body.phone?.trim()

    if (!phone) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号不能为空'
      })
    }

    if (!/^1\d{10}$/.test(phone)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '手机号格式错误'
      })
    }

    if (phone !== authUser.phone) {
      const existing = await findAuthUserByPhone(phone)
      if (existing) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Conflict',
          message: '该手机号已被注册'
        })
      }

      await updateAuthUser(authUser.id, { phone })
      await writeAuditLog(
        AUDIT_ACTIONS.AUTH_USER_UPDATE,
        `更新个人资料: 手机号改为 ${phone}`,
        getClientIp(event)
      )
    }

    return {
      success: true,
      phone
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
