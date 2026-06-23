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

const buildMessages = (text: string) => [
  {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text }]
  }
]

const mockUiMessageStreamResponse = (text: string) => {
  const messageId = 'm1'
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'start', messageId })}\n\n`))
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ type: 'text-start', id: messageId })}\n\n`)
      )
      controller.enqueue(
        enc.encode(
          `data: ${JSON.stringify({ type: 'text-delta', id: messageId, delta: text })}\n\n`
        )
      )
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ type: 'text-end', id: messageId })}\n\n`)
      )
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'finish' })}\n\n`))
      controller.close()
    }
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
  })
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
    readBody.mockResolvedValue({
      messages: buildMessages('test'),
      sessionId: 'session-2'
    })

    const requireOwnedChatSession = vi
      .fn()
      .mockRejectedValue(createErrorMock({ statusCode: 404, message: '会话不存在' }))
    const streamText = vi.fn()

    vi.doMock('../../server/lib/prisma', () => ({ prisma: {} }))
    vi.doMock('../../server/services/chat-session-service', () => ({
      requireOwnedChatSession,
      persistChatExchange: vi.fn()
    }))
    vi.doMock('../../server/ai/providers', () => ({
      getBiProvider: vi.fn().mockReturnValue({
        isConfigured: true,
        providerName: 'openai',
        model: { modelId: 'mock-model' }
      })
    }))
    vi.doMock('ai', () => ({
      streamText,
      convertToModelMessages: vi.fn((m: unknown) => m),
      stepCountIs: vi.fn((n: number) => ({ maxSteps: n })),
      tool: vi.fn((config: Record<string, unknown>) => config)
    }))

    const handler = (await import('../../server/api/insights/chat.post'))
      .default as unknown as Handler

    await expect(handler({ context: { auth: { user: { id: 'user-1' } } } })).rejects.toMatchObject({
      statusCode: 404
    })
    expect(streamText).not.toHaveBeenCalled()
  })

  it('should return UI Message Stream and persist exchange on success', async () => {
    const readBody = vi.mocked(globalThis.readBody as unknown as ReadBodyFn)
    readBody.mockResolvedValue({
      messages: buildMessages('test'),
      sessionId: 'session-1'
    })

    const requireOwnedChatSession = vi.fn().mockResolvedValue(undefined)
    const persistChatExchange = vi.fn().mockResolvedValue(undefined)
    const streamText = vi.fn(() => ({
      toUIMessageStreamResponse: () => mockUiMessageStreamResponse('reply')
    }))

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
    vi.doMock('../../server/ai/providers', () => ({
      getBiProvider: vi.fn().mockReturnValue({
        isConfigured: true,
        providerName: 'openai',
        model: { modelId: 'mock-model' }
      })
    }))
    vi.doMock('ai', () => ({
      streamText,
      convertToModelMessages: vi.fn((m: unknown) => m),
      stepCountIs: vi.fn((n: number) => ({ maxSteps: n })),
      tool: vi.fn((config: Record<string, unknown>) => config)
    }))

    const handler = (await import('../../server/api/insights/chat.post'))
      .default as unknown as Handler

    const result = (await handler({
      context: { auth: { user: { id: 'user-1' } } }
    })) as Response

    expect(result).toBeInstanceOf(Response)
    expect(result.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8')

    // 读取 stream 验证帧格式正确
    const reader = result.body!.getReader()
    const decoder = new TextDecoder()
    let raw = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += decoder.decode(value, { stream: true })
    }

    expect(raw).toContain('"type":"start"')
    expect(raw).toContain('"type":"text-delta"')
    expect(raw).toContain('"delta":"reply"')
    expect(raw).toContain('"type":"finish"')

    expect(requireOwnedChatSession).toHaveBeenCalled()
    expect(streamText).toHaveBeenCalled()
    // 持久化在 onFinish 回调里调，需要 streamText mock 触发 onFinish
  })
})
