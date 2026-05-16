import { H3Error } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: { context: { auth?: { user?: { id?: string } } } }) => Promise<unknown>
type ReadBodyFn = (event: unknown) => Promise<unknown>

const createErrorMock = ({ statusCode, message }: { statusCode: number; message: string }) => {
  const error = new H3Error(message)
  error.statusCode = statusCode
  error.message = message
  return error
}

describe('insights chat handler', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createErrorMock)
    vi.stubGlobal('readBody', vi.fn())
    vi.stubGlobal('useRuntimeConfig', vi.fn().mockReturnValue({}))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should reject foreign session ids before calling AI', async () => {
    const readBody = vi.mocked(globalThis.readBody as unknown as ReadBodyFn)
    readBody.mockResolvedValue({ question: 'test', history: [], sessionId: 'session-2' })

    const requireOwnedChatSession = vi
      .fn()
      .mockRejectedValue(createErrorMock({ statusCode: 404, message: '会话不存在' }))
    const executeAiTextRequest = vi.fn()

    vi.doMock('../../server/lib/prisma', () => ({
      prisma: {}
    }))
    vi.doMock('../../server/services/chat-session-service', () => ({
      requireOwnedChatSession,
      persistChatExchange: vi.fn()
    }))
    vi.doMock('../../server/utils/ai-client', () => ({
      executeAiTextRequest,
      getAiErrorMessage: vi.fn().mockReturnValue('对话处理失败')
    }))
    vi.doMock('../../server/utils/ai-config', () => ({
      resolveAiConfig: vi.fn().mockReturnValue({
        aiApiKey: 'key',
        aiModel: 'model',
        candidateUrls: [],
        isMiniMaxProvider: false,
        legacyCandidateUrls: []
      })
    }))

    const handler = (await import('../../server/api/insights/chat.post'))
      .default as unknown as Handler

    await expect(
      handler({
        context: { auth: { user: { id: 'user-1' } } }
      })
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(executeAiTextRequest).not.toHaveBeenCalled()
  })

  it('should persist the chat exchange after a successful reply', async () => {
    const readBody = vi.mocked(globalThis.readBody as unknown as ReadBodyFn)
    readBody.mockResolvedValue({ question: 'test', history: [], sessionId: 'session-1' })

    const requireOwnedChatSession = vi.fn().mockResolvedValue(undefined)
    const persistChatExchange = vi.fn().mockResolvedValue(undefined)
    const executeAiTextRequest = vi.fn().mockResolvedValue({ text: 'reply', remoteFailures: [] })

    vi.doMock('../../server/lib/prisma', () => ({
      prisma: {
        order: { findMany: vi.fn().mockResolvedValue([]) },
        orderItem: { findMany: vi.fn().mockResolvedValue([]) },
        product: { findMany: vi.fn().mockResolvedValue([]) },
        auditLog: { findMany: vi.fn().mockResolvedValue([]) }
      }
    }))
    vi.doMock('../../server/services/chat-session-service', () => ({
      requireOwnedChatSession,
      persistChatExchange
    }))
    vi.doMock('../../server/utils/ai-client', () => ({
      executeAiTextRequest,
      getAiErrorMessage: vi.fn().mockReturnValue('对话处理失败')
    }))
    vi.doMock('../../server/utils/ai-config', () => ({
      resolveAiConfig: vi.fn().mockReturnValue({
        aiApiKey: 'key',
        aiModel: 'model',
        candidateUrls: [],
        isMiniMaxProvider: false,
        legacyCandidateUrls: []
      })
    }))

    const handler = (await import('../../server/api/insights/chat.post'))
      .default as unknown as Handler

    await expect(
      handler({
        context: { auth: { user: { id: 'user-1' } } }
      })
    ).resolves.toEqual({ reply: 'reply' })

    expect(requireOwnedChatSession).toHaveBeenCalled()
    expect(executeAiTextRequest).toHaveBeenCalled()
    expect(persistChatExchange).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      'user-1',
      'test',
      'reply'
    )
  })
})
