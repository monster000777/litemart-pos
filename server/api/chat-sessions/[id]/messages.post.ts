import { prisma } from '~~/server/lib/prisma'
import { appendChatMessage } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const body = await readBody<{ role: string; content: string }>(event)

  if (!sessionId) {
    throw createError({ statusCode: 400, message: '会话 ID 不能为空' })
  }

  return appendChatMessage(prisma, sessionId, event.context.auth?.user?.id, body.role, body.content)
})
