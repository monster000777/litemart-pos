import { prisma } from '~~/server/lib/prisma'
import { getChatSessionDetail } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: '会话 ID 不能为空' })
  }

  return getChatSessionDetail(prisma, id, event.context.auth?.user?.id)
})
