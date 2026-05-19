import { prisma } from '~~/server/lib/prisma'
import { clearChatSession } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  if (!sessionId) {
    throw createError({ statusCode: 400, message: '会话 ID 不能为空' })
  }

  return clearChatSession(prisma, sessionId, event.context.auth?.user?.id)
})
