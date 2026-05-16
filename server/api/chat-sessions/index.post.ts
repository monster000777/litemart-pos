import { prisma } from '~~/server/lib/prisma'
import { createChatSession } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  return createChatSession(prisma, event.context.auth?.user?.id)
})
