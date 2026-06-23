import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ai-sdk/vue', async () => {
  const { ref } = await import('vue')
  class Chat {
    id: string
    private _messages: ReturnType<typeof ref<unknown[]>>
    private _status: ReturnType<typeof ref<string>>
    sendMessage: (input: { text: string }) => Promise<void>
    stop: () => Promise<void>
    clear: () => void
    regenerate: () => void
    addToolResult: (...args: unknown[]) => void
    addToolOutput: (...args: unknown[]) => void
    resumeStream: () => void

    constructor({ id }: { id: string }) {
      this.id = id
      this._messages = ref<unknown[]>([])
      this._status = ref<string>('ready')
      this.sendMessage = vi.fn(async ({ text }: { text: string }) => {
        this._status.value = 'streaming'
        const userMessage = {
          id: `u-${this._messages.value.length + 1}`,
          role: 'user',
          parts: [{ type: 'text', text }]
        }
        const assistantMessage = {
          id: `a-${this._messages.value.length + 1}`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'assistant reply' }]
        }
        this._messages.value = [...this._messages.value, userMessage, assistantMessage]
        this._status.value = 'ready'
      })
      this.stop = vi.fn(async () => {
        this._status.value = 'ready'
      })
      this.clear = vi.fn(() => {
        this._messages.value = []
        this._status.value = 'ready'
      })
      this.regenerate = vi.fn()
      this.addToolResult = vi.fn()
      this.addToolOutput = vi.fn()
      this.resumeStream = vi.fn()
    }

    get messages() {
      return this._messages.value
    }
    set messages(next: unknown[]) {
      this._messages.value = next
    }
    get status() {
      return this._status.value
    }
  }
  return { Chat }
})

vi.mock('ai', () => {
  class DefaultChatTransport {
    api: string
    body: () => unknown
    options: { api: string; body: () => unknown }
    constructor(opts: { api: string; body: () => unknown }) {
      this.api = opts.api
      this.body = opts.body
      this.options = opts
    }
  }
  return { DefaultChatTransport }
})

describe('useCopilot', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    })
    vi.stubGlobal('window', { localStorage: {} })
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

    const { useCopilot } = await import('../../app/composables/use-copilot')
    const copilot = useCopilot()

    await copilot.createNewSession()
    expect(copilot.sessions.value[0]?.isLocal).toBe(true)

    await copilot.sendMessage('hello')

    // sendMessage 应在本地 local session 上把 user + assistant 写到 session.messages
    const lastMessages = copilot.chatHistory.value
    expect(lastMessages.at(-1)).toEqual({
      id: 'a-1',
      role: 'assistant',
      content: 'assistant reply'
    })
    expect(lastMessages.at(-2)).toEqual({
      id: 'u-1',
      role: 'user',
      content: 'hello'
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
