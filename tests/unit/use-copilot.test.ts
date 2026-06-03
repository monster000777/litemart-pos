import { computed, effectScope, ref, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCopilot', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('effectScope', effectScope)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should keep chat usable when remote session creation fails', async () => {
    const remoteFetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('create failed'))
      .mockRejectedValueOnce(new Error('create failed again'))
    vi.stubGlobal('$fetch', remoteFetchMock)

    const encoder = new TextEncoder()
    const chunks = [
      encoder.encode(
        'data: {"type":"delta","delta":"assistant reply"}\n\ndata: {"type":"done"}\n\n'
      )
    ]
    let readCount = 0
    const chatFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn(async () =>
            readCount++ === 0 ? { done: false, value: chunks[0] } : { done: true }
          )
        })
      }
    })
    vi.stubGlobal('fetch', chatFetchMock)

    const { useCopilot } = await import('../../app/composables/use-copilot')
    const copilot = useCopilot()

    await copilot.createNewSession()
    expect(copilot.sessions.value[0]?.isLocal).toBe(true)

    await copilot.sendMessage('hello')

    expect(chatFetchMock).toHaveBeenCalledWith(
      '/api/insights/chat',
      expect.objectContaining({
        method: 'POST'
      })
    )
    const chatBody = JSON.parse(chatFetchMock.mock.calls[0]?.[1]?.body as string)
    expect(chatBody).toEqual(
      expect.objectContaining({
        question: 'hello',
        stream: true
      })
    )
    expect(chatBody).not.toHaveProperty('sessionId')
    expect(copilot.chatHistory.value.at(-1)).toEqual({
      role: 'assistant',
      content: 'assistant reply'
    })
  })

  it('should clear remote sessions through the messages delete endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'session-1',
        title: '新对话',
        updatedAt: Date.now(),
        messages: []
      })
      .mockResolvedValueOnce(undefined)
    vi.stubGlobal('$fetch', fetchMock)

    const { useCopilot } = await import('../../app/composables/use-copilot')
    const copilot = useCopilot()

    await copilot.createNewSession()
    copilot.sessions.value[0].messages.push({ role: 'user', content: 'hello' })
    copilot.sessions.value[0].title = 'hello'

    await copilot.clearChat()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/chat-sessions/session-1/messages', {
      method: 'DELETE'
    })
    expect(copilot.chatHistory.value).toEqual([])
    expect(copilot.activeSession.value?.title).toBe('新对话')
  })
})
