import { prisma } from '~~/server/lib/prisma'
import { renameChatSession } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ title?: string }>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: '会话 ID 不能为空' })
  }

  return renameChatSession(prisma, id, event.context.auth?.user?.id, body.title)
})
