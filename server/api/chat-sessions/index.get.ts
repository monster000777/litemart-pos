import { prisma } from '~~/server/lib/prisma'
import { listChatSessions } from '~~/server/services/chat-session-service'

export default defineEventHandler(async (event) => {
  return listChatSessions(prisma, event.context.auth?.user?.id)
})
