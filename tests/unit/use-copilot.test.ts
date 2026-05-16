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
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('create failed'))
      .mockRejectedValueOnce(new Error('create failed again'))
      .mockResolvedValueOnce({ reply: 'assistant reply' })
    vi.stubGlobal('$fetch', fetchMock)

    const { useCopilot } = await import('../../app/composables/use-copilot')
    const copilot = useCopilot()

    await copilot.createNewSession()
    expect(copilot.sessions.value[0]?.isLocal).toBe(true)

    await copilot.sendMessage('hello')

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/insights/chat',
      expect.objectContaining({
        body: expect.objectContaining({
          question: 'hello',
          sessionId: undefined
        })
      })
    )
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
