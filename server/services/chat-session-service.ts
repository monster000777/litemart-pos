import { Prisma, PrismaClient } from '@prisma/client'
import { createError } from 'h3'

type ChatDbClient = PrismaClient | Prisma.TransactionClient

const DEFAULT_CHAT_SESSION_TITLE = '新对话'

export const getDefaultChatSessionTitle = () => DEFAULT_CHAT_SESSION_TITLE

export const buildChatSessionTitle = (question: string) => {
  const normalized = question.trim()
  if (!normalized) return DEFAULT_CHAT_SESSION_TITLE
  return normalized.slice(0, 15) + (normalized.length > 15 ? '...' : '')
}

const ensureUserId = (userId?: string | null) => {
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录' })
  }
}

export const requireOwnedChatSession = async (
  db: ChatDbClient,
  sessionId: string,
  userId?: string | null
) => {
  ensureUserId(userId)

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: '会话不存在' })
  }

  return session
}

export const listChatSessions = async (db: ChatDbClient, userId?: string | null) => {
  ensureUserId(userId)

  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } }
    }
  })

  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.getTime(),
    messageCount: session._count.messages
  }))
}

export const createChatSession = async (db: ChatDbClient, userId?: string | null) => {
  ensureUserId(userId)

  const session = await db.chatSession.create({
    data: {
      userId,
      title: DEFAULT_CHAT_SESSION_TITLE
    }
  })

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.getTime(),
    messages: []
  }
}

export const getChatSessionDetail = async (
  db: ChatDbClient,
  sessionId: string,
  userId?: string | null
) => {
  ensureUserId(userId)

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: '会话不存在' })
  }

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.getTime(),
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.content
    }))
  }
}

export const renameChatSession = async (
  db: ChatDbClient,
  sessionId: string,
  userId: string | null | undefined,
  title?: string
) => {
  const session = await requireOwnedChatSession(db, sessionId, userId)
  const nextTitle = title?.trim() || session.title

  const updated = await db.chatSession.update({
    where: { id: sessionId },
    data: { title: nextTitle }
  })

  return {
    id: updated.id,
    title: updated.title
  }
}

export const deleteChatSession = async (
  db: ChatDbClient,
  sessionId: string,
  userId?: string | null
) => {
  await requireOwnedChatSession(db, sessionId, userId)
  await db.chatSession.delete({ where: { id: sessionId } })
  return { success: true }
}

export const clearChatSessionMessages = async (
  db: ChatDbClient,
  sessionId: string,
  userId?: string | null
) => {
  ensureUserId(userId)

  await db.$transaction(async (tx) => {
    await requireOwnedChatSession(tx, sessionId, userId)
    await tx.chatMessage.deleteMany({ where: { sessionId } })
    await tx.chatSession.update({
      where: { id: sessionId },
      data: {
        title: DEFAULT_CHAT_SESSION_TITLE,
        updatedAt: new Date()
      }
    })
  })

  return {
    id: sessionId,
    title: DEFAULT_CHAT_SESSION_TITLE,
    messages: []
  }
}

export const appendChatMessage = async (
  db: ChatDbClient,
  sessionId: string,
  userId: string | null | undefined,
  role: string,
  content: string
) => {
  const normalizedRole = role === 'assistant' ? 'assistant' : role === 'user' ? 'user' : ''
  const normalizedContent = content.trim()

  if (!normalizedRole || !normalizedContent) {
    throw createError({ statusCode: 400, message: 'role 和 content 不能为空' })
  }

  await requireOwnedChatSession(db, sessionId, userId)

  const [message] = await db.$transaction([
    db.chatMessage.create({
      data: {
        sessionId,
        role: normalizedRole,
        content: normalizedContent
      }
    }),
    db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    })
  ])

  return {
    id: message.id,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    createdAt: message.createdAt.getTime()
  }
}

export const persistChatExchange = async (
  db: ChatDbClient,
  sessionId: string,
  userId: string | null | undefined,
  question: string,
  reply: string
) => {
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion || !reply.trim()) {
    throw createError({ statusCode: 400, message: '消息内容不能为空' })
  }

  await db.$transaction(async (tx) => {
    const session = await requireOwnedChatSession(tx, sessionId, userId)

    await tx.chatMessage.create({
      data: { sessionId, role: 'user', content: normalizedQuestion }
    })
    await tx.chatMessage.create({
      data: { sessionId, role: 'assistant', content: reply }
    })

    await tx.chatSession.update({
      where: { id: sessionId },
      data: {
        title:
          session._count.messages === 0 ? buildChatSessionTitle(normalizedQuestion) : session.title,
        updatedAt: new Date()
      }
    })
  })
}
