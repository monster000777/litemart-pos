import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  appendChatMessage,
  buildChatSessionTitle,
  clearChatSessionMessages,
  createChatSession,
  deleteChatSession,
  getChatSessionDetail,
  getDefaultChatSessionTitle,
  listChatSessions,
  persistChatExchange,
  renameChatSession,
  requireOwnedChatSession
} from '../../server/services/chat-session-service'

type ChatDb = Parameters<typeof requireOwnedChatSession>[0]

const createOwnedSession = (messageCount = 0) => ({
  id: 'session-1',
  title: '旧标题',
  updatedAt: new Date('2026-05-16T12:00:00Z'),
  _count: { messages: messageCount }
})

describe('chat-session-service', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('buildChatSessionTitle should trim and truncate long questions', () => {
    expect(buildChatSessionTitle('  这是一条很长很长的问题内容，需要被截断展示  ')).toBe(
      '这是一条很长很长的问题内容，需...'
    )
    expect(buildChatSessionTitle('   ')).toBe(getDefaultChatSessionTitle())
  })

  it('requireOwnedChatSession should reject missing userId', async () => {
    await expect(
      requireOwnedChatSession(
        {
          chatSession: { findFirst: vi.fn() }
        } as unknown as ChatDb,
        'session-1',
        undefined
      )
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('requireOwnedChatSession should reject foreign sessions', async () => {
    await expect(
      requireOwnedChatSession(
        {
          chatSession: { findFirst: vi.fn().mockResolvedValue(null) }
        } as unknown as ChatDb,
        'session-1',
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('listChatSessions should map timestamps and message counts', async () => {
    const db = {
      chatSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'session-1',
            title: '分析 1',
            updatedAt: new Date('2026-05-16T12:00:00Z'),
            _count: { messages: 3 }
          }
        ])
      }
    } as unknown as ChatDb

    await expect(listChatSessions(db, 'user-1')).resolves.toEqual([
      {
        id: 'session-1',
        title: '分析 1',
        updatedAt: new Date('2026-05-16T12:00:00Z').getTime(),
        messageCount: 3
      }
    ])
  })

  it('createChatSession should use the default title', async () => {
    const createdAt = new Date('2026-05-16T12:00:00Z')
    const db = {
      chatSession: {
        create: vi.fn().mockResolvedValue({
          id: 'session-1',
          title: getDefaultChatSessionTitle(),
          updatedAt: createdAt
        })
      }
    } as unknown as ChatDb

    await expect(createChatSession(db, 'user-1')).resolves.toEqual({
      id: 'session-1',
      title: getDefaultChatSessionTitle(),
      updatedAt: createdAt.getTime(),
      messages: []
    })
  })

  it('getChatSessionDetail should return ordered messages', async () => {
    const updatedAt = new Date('2026-05-16T12:00:00Z')
    const db = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'session-1',
          title: '分析 1',
          updatedAt,
          messages: [{ id: 'm1', role: 'user', content: 'hello' }]
        })
      }
    } as unknown as ChatDb

    await expect(getChatSessionDetail(db, 'session-1', 'user-1')).resolves.toEqual({
      id: 'session-1',
      title: '分析 1',
      updatedAt: updatedAt.getTime(),
      messages: [{ id: 'm1', role: 'user', content: 'hello' }]
    })
  })

  it('renameChatSession should keep the old title when body title is empty', async () => {
    const db = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession()),
        update: vi.fn().mockResolvedValue({ id: 'session-1', title: '旧标题' })
      }
    } as unknown as ChatDb

    await expect(renameChatSession(db, 'session-1', 'user-1', '   ')).resolves.toEqual({
      id: 'session-1',
      title: '旧标题'
    })
  })

  it('deleteChatSession should delete after ownership check', async () => {
    const db = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession()),
        delete: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ChatDb

    await expect(deleteChatSession(db, 'session-1', 'user-1')).resolves.toEqual({ success: true })
    expect(db.chatSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
  })

  it('appendChatMessage should validate role and trim content', async () => {
    const db = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession()),
        update: vi.fn().mockResolvedValue(undefined)
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'm1',
          role: 'assistant',
          content: 'reply',
          createdAt: new Date('2026-05-16T12:00:00Z')
        })
      },
      $transaction: vi
        .fn()
        .mockImplementation((items: unknown[]) => Promise.all(items as Promise<unknown>[]))
    } as unknown as ChatDb

    await expect(
      appendChatMessage(db, 'session-1', 'user-1', 'assistant', '  reply  ')
    ).resolves.toEqual({
      id: 'm1',
      role: 'assistant',
      content: 'reply',
      createdAt: new Date('2026-05-16T12:00:00Z').getTime()
    })

    await expect(
      appendChatMessage(db, 'session-1', 'user-1', 'system', 'oops')
    ).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('clearChatSessionMessages should delete messages and reset title', async () => {
    const tx = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession(2)),
        update: vi.fn().mockResolvedValue(undefined)
      },
      chatMessage: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    }
    const db = {
      $transaction: vi.fn().mockImplementation((runner: (arg: typeof tx) => unknown) => runner(tx))
    } as unknown as ChatDb

    await expect(clearChatSessionMessages(db, 'session-1', 'user-1')).resolves.toEqual({
      id: 'session-1',
      title: getDefaultChatSessionTitle(),
      messages: []
    })
    expect(tx.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 'session-1' } })
  })

  it('persistChatExchange should save both sides and rename only on the first round', async () => {
    const tx = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession(0)),
        update: vi.fn().mockResolvedValue(undefined)
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue(undefined)
      }
    }
    const db = {
      $transaction: vi.fn().mockImplementation((runner: (arg: typeof tx) => unknown) => runner(tx))
    } as unknown as ChatDb

    await expect(
      persistChatExchange(db, 'session-1', 'user-1', '  第一条问题需要被截断一下  ', '回答内容')
    ).resolves.toBeUndefined()

    expect(tx.chatMessage.create).toHaveBeenNthCalledWith(1, {
      data: { sessionId: 'session-1', role: 'user', content: '第一条问题需要被截断一下' }
    })
    expect(tx.chatMessage.create).toHaveBeenNthCalledWith(2, {
      data: { sessionId: 'session-1', role: 'assistant', content: '回答内容' }
    })
    expect(tx.chatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({
        title: buildChatSessionTitle('第一条问题需要被截断一下'),
        updatedAt: expect.any(Date)
      })
    })
  })

  it('persistChatExchange should preserve title for existing sessions', async () => {
    const tx = {
      chatSession: {
        findFirst: vi.fn().mockResolvedValue(createOwnedSession(4)),
        update: vi.fn().mockResolvedValue(undefined)
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue(undefined)
      }
    }
    const db = {
      $transaction: vi.fn().mockImplementation((runner: (arg: typeof tx) => unknown) => runner(tx))
    } as unknown as ChatDb

    await persistChatExchange(db, 'session-1', 'user-1', '继续提问', '继续回答')
    expect(tx.chatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({
        title: '旧标题',
        updatedAt: expect.any(Date)
      })
    })
  })
})
