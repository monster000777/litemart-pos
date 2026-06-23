import { computed, effectScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Chat as VueChat } from '@ai-sdk/vue'
import type { ChatInit, ChatTransport, HttpChatTransportInitOptions, UIMessage } from 'ai'

export interface CopilotMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

type ApiErrorLike = {
  data?: {
    message?: string
  }
  message?: string
}

export interface CopilotSession {
  id: string
  title: string
  updatedAt: number
  messages: CopilotMessage[]
  messageCount?: number
  pending: boolean
  isLocal?: boolean
}

type UIMessagePart = { type: 'text'; text: string } | { type: string; [key: string]: unknown }

type UIMessageLike = {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: UIMessagePart[]
}

type ChatLike = {
  id: string
  messages: UIMessageLike[]
  status: string
  sendMessage: (input: { text: string }) => Promise<void>
  stop: () => Promise<void>
}

const DEFAULT_SESSION_TITLE = '新对话'

let initialized = false

const sessions: Ref<CopilotSession[]> = ref<CopilotSession[]>([])
const activeSessionId: Ref<string> = ref<string>('')
const chatInput: Ref<string> = ref<string>('')

const mapRemoteSession = <
  T extends {
    id: string
    title: string
    updatedAt: number
    messages?: CopilotMessage[]
    messageCount?: number
  }
>(
  session: T
): CopilotSession => ({
  id: session.id,
  title: session.title,
  updatedAt: session.updatedAt,
  messages: session.messages || [],
  messageCount: session.messageCount ?? session.messages?.length ?? 0,
  pending: false,
  isLocal: false
})

const isDraftSession = (session: CopilotSession) =>
  (session.messageCount ?? session.messages.length) === 0

// 懒加载 SDK —— 避免 SSR 阶段拉入 Node-only 依赖
const loadSdk = async () => {
  const vueSdk = await import('@ai-sdk/vue')
  const aiSdk = await import('ai')
  return { Chat: vueSdk.Chat, DefaultChatTransport: aiSdk.DefaultChatTransport }
}

const assistantContent = (parts: UIMessagePart[]): string =>
  parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')

const toUiMessages = (messages: CopilotMessage[]): UIMessageLike[] =>
  messages.map((message, index) => ({
    id: message.id ?? `${message.role}-${index}`,
    role: message.role,
    parts: [{ type: 'text', text: message.content }]
  }))

export function useCopilot() {
  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value)
  )
  const chatHistory = computed(() => activeSession.value?.messages || [])

  let chat: ChatLike | null = null
  // 动态 import 的 SDK 构造函数 —— 用 ChatInit 直接定义签名，避开 abstract 类的 ConstructorParameters 限制
  type ChatMessage = UIMessage<unknown, never, never>
  type ChatCtorType = new (init: ChatInit<ChatMessage>) => VueChat<ChatMessage>
  type TransportCtorType = new (
    opts: HttpChatTransportInitOptions<ChatMessage>
  ) => ChatTransport<ChatMessage>
  let ChatCtor: ChatCtorType | null = null
  let DefaultChatTransport: TransportCtorType | null = null

  const isClient = () => typeof window !== 'undefined'

  // 显式 effectScope —— sendMessage 是 async，watch 必须挂在显式 scope 上才能跨 await 生效
  const chatScope = effectScope()
  const backupScope = effectScope(true)

  // 组件卸载时清理 —— 停止轮询、释放 chat 同步 scope
  // 注意：backupScope 是 detached（effectScope(true)），承载 sessions→localStorage 持久化 watch，
  // 必须跨挂载存活 —— initialize() 因模块级 initialized 标志不会重跑，此处停止会导致 remount 后新增会话丢失持久化
  onScopeDispose(() => {
    stopPolling()
    chatScope.stop()
  })

  const syncFromChat = (instance: ChatLike) => {
    const session = activeSession.value
    if (!session) return
    session.messages = instance.messages.map((m) => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: assistantContent(m.parts ?? [])
    }))
    session.messageCount = session.messages.length
    session.updatedAt = Date.now()
  }

  const ensureChat = async () => {
    if (!isClient()) return null
    if (chat) return chat
    const sdk = await loadSdk()
    ChatCtor = sdk.Chat
    DefaultChatTransport = sdk.DefaultChatTransport
    const transport = new DefaultChatTransport({
      api: '/api/insights/chat',
      body: () => ({ sessionId: activeSessionId.value || undefined })
    })
    chat = new ChatCtor({
      id: activeSessionId.value || 'pending',
      transport,
      onError: (error: unknown) => {
        const session = activeSession.value
        if (!session) return
        const lastMessage = session.messages[session.messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          if (lastMessage.content) {
            lastMessage.content += `\n\n> ⚠️ ${(error as Error)?.message ?? error ?? '对话失败'}`
          } else {
            lastMessage.content = `[发送失败] ${(error as Error)?.message ?? error ?? '对话失败'}`
          }
          session.updatedAt = Date.now()
        }
      },
      onFinish: () => {
        if (chat) syncFromChat(chat)
        stopPolling()
      }
    }) as ChatLike
    return chat
  }

  const pendingFlag: Ref<boolean> = ref(false)
  const chatPending = computed(() => pendingFlag.value || !!activeSession.value?.pending)

  // 显式 scope 内挂 watch —— 必须同步执行才能建立响应式追踪
  let watchSetup = false
  const setupMessageSync = (instance: ChatLike) => {
    if (watchSetup) return
    watchSetup = true
    chatScope.run(() => {
      watch(
        () => instance.messages,
        () => syncFromChat(instance),
        { deep: true }
      )
      watch(
        () => instance.status,
        (status) => {
          pendingFlag.value = status === 'submitted' || status === 'streaming'
          if (status === 'submitted' || status === 'streaming') {
            startPolling()
          } else {
            stopPolling()
          }
        }
      )
    })
  }

  // 轮询兜底 —— 如果 watch 因为某些原因没触发，强制每 200ms 同步一次
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const startPolling = () => {
    if (pollTimer || !isClient()) return
    pollTimer = setInterval(() => {
      if (chat) syncFromChat(chat)
    }, 200)
  }
  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const persistLocalBackup = () => {
    if (!isClient()) return

    const serializable = sessions.value.map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      messages: session.messages,
      messageCount: session.messageCount ?? session.messages.length,
      isLocal: session.isLocal ?? false
    }))
    localStorage.setItem('litemart-copilot-sessions', JSON.stringify(serializable))
  }

  const syncSessionsFromDb = async () => {
    try {
      return await $fetch<
        Array<{ id: string; title: string; updatedAt: number; messageCount: number }>
      >('/api/chat-sessions')
    } catch {
      return []
    }
  }

  const loadSessionDetail = async (id: string): Promise<CopilotSession | null> => {
    try {
      const session = await $fetch<{
        id: string
        title: string
        updatedAt: number
        messages: CopilotMessage[]
      }>(`/api/chat-sessions/${id}`)
      return mapRemoteSession(session)
    } catch {
      return null
    }
  }

  const initialize = async () => {
    if (initialized) return
    initialized = true

    if (!isClient()) return

    const chatInstance = await ensureChat()

    try {
      const list = await syncSessionsFromDb()

      if (list.length > 0 && list[0]) {
        const firstSession = await loadSessionDetail(list[0].id)
        if (firstSession) {
          sessions.value = list.map((session) =>
            session.id === firstSession.id
              ? firstSession
              : mapRemoteSession({ ...session, messages: [] })
          )
          activeSessionId.value = firstSession.id
          if (chatInstance && firstSession.messages.length > 0) {
            chatInstance.messages = toUiMessages(firstSession.messages)
          }
        } else {
          sessions.value = list.map((session) => mapRemoteSession({ ...session, messages: [] }))
          activeSessionId.value = list[0].id
        }
      } else {
        await createNewSession()
      }
    } catch {
      await createNewSession()
    }

    backupScope.run(() => {
      watch(sessions, persistLocalBackup, { deep: true, immediate: true })
    })
  }

  const ensureRemoteSession = async (session: CopilotSession) => {
    if (!session.isLocal) return session

    try {
      const previousId = session.id
      const created = await $fetch<{ id: string; title: string; updatedAt: number; messages: [] }>(
        '/api/chat-sessions',
        { method: 'POST' }
      )

      session.id = created.id
      session.updatedAt = created.updatedAt
      session.messageCount = 0
      session.isLocal = false

      if (session.title !== DEFAULT_SESSION_TITLE) {
        await $fetch(`/api/chat-sessions/${session.id}`, {
          method: 'PATCH',
          body: { title: session.title }
        }).catch(() => undefined)
      }

      if (activeSessionId.value === previousId || activeSession.value === session) {
        activeSessionId.value = session.id
      }

      return session
    } catch {
      return null
    }
  }

  const createNewSession = async () => {
    const draftSession = sessions.value.find(
      (session) => isDraftSession(session) && !session.pending
    )
    if (draftSession) {
      activeSessionId.value = draftSession.id
      return
    }

    try {
      const session = await $fetch<{ id: string; title: string; updatedAt: number; messages: [] }>(
        '/api/chat-sessions',
        { method: 'POST' }
      )
      sessions.value.unshift(mapRemoteSession(session))
      activeSessionId.value = session.id
    } catch {
      const localId = `local-${Date.now()}`
      sessions.value.unshift({
        id: localId,
        title: DEFAULT_SESSION_TITLE,
        updatedAt: Date.now(),
        messages: [],
        messageCount: 0,
        pending: false,
        isLocal: true
      })
      activeSessionId.value = localId
    }
  }

  const deleteSession = async (id: string) => {
    const target = sessions.value.find((session) => session.id === id)
    if (!target || target.pending) return

    const idx = sessions.value.findIndex((session) => session.id === id)
    if (idx === -1) return

    sessions.value.splice(idx, 1)

    if (activeSessionId.value === id) {
      if (sessions.value.length === 0) {
        await createNewSession()
      } else {
        const next = sessions.value[0]
        if (next) {
          activeSessionId.value = next.id
          if (!next.isLocal && isDraftSession(next)) {
            const detail = await loadSessionDetail(next.id)
            if (detail) {
              const nextIdx = sessions.value.findIndex((session) => session.id === next?.id)
              if (nextIdx !== -1) sessions.value[nextIdx] = detail
            }
          }
        }
      }
    }

    if (target.isLocal) return

    try {
      await $fetch(`/api/chat-sessions/${id}`, { method: 'DELETE' })
    } catch {
      sessions.value.splice(idx, 0, target)
    }
  }

  const clearChat = async () => {
    if (!activeSession.value || activeSession.value.pending) return

    const session = activeSession.value
    const snapshot = {
      title: session.title,
      updatedAt: session.updatedAt,
      messages: [...session.messages]
    }

    session.messages = []
    session.messageCount = 0
    session.title = DEFAULT_SESSION_TITLE
    session.updatedAt = Date.now()
    chatInput.value = ''

    if (chat) {
      try {
        await chat.stop()
        chat.messages = []
        stopPolling()
      } catch {
        // 静默失败 —— 本地状态已重置
      }
    }

    if (session.isLocal) return

    try {
      await $fetch(`/api/chat-sessions/${session.id}/messages`, { method: 'DELETE' })
    } catch {
      session.messages = snapshot.messages
      session.messageCount = snapshot.messages.length
      session.title = snapshot.title
      session.updatedAt = snapshot.updatedAt
    }
  }

  const switchToSession = async (id: string) => {
    if (activeSessionId.value === id) return

    const session = sessions.value.find((item) => item.id === id)
    if (!session) return

    activeSessionId.value = id
    if (chat) {
      try {
        await chat.stop()
        chat.messages = toUiMessages(session.messages)
      } catch {
        // 切换失败时静默 —— 本地 activeSessionId 已切换
      }
    }
    if (session.isLocal || session.messages.length > 0) return

    const detail = await loadSessionDetail(id)
    if (detail) {
      const idx = sessions.value.findIndex((item) => item.id === id)
      if (idx !== -1) sessions.value[idx] = detail
      if (chat) {
        try {
          chat.messages = toUiMessages(detail.messages)
        } catch {
          // 静默
        }
      }
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeSession.value || activeSession.value.pending) return

    const session = activeSession.value
    const normalizedText = text.trim()
    const isFirstMessage = session.messages.length === 0
    const titleForFirstMessage =
      normalizedText.slice(0, 15) + (normalizedText.length > 15 ? '...' : '')

    chatInput.value = ''
    session.pending = true

    try {
      const remoteSession = await ensureRemoteSession(session)
      const sessionId = remoteSession?.isLocal ? undefined : remoteSession?.id

      const instance = await ensureChat()
      if (!instance) {
        throw new Error('Chat instance unavailable')
      }
      setupMessageSync(instance) // idempotent —— 内部判断是否已挂 watch

      // 历史上下文（不含本条新消息，sendMessage 会自动追加）
      instance.messages = toUiMessages(session.messages)

      // 立即在本地反映用户消息（不依赖 watch 时序），提升体感
      session.messages.push({ role: 'user', content: normalizedText })
      session.messageCount = session.messages.length
      session.updatedAt = Date.now()
      if (isFirstMessage) session.title = titleForFirstMessage

      await instance.sendMessage({ text: normalizedText })

      // 强制最终同步 —— 兜底（如果 watch 因为某些原因没触发）
      syncFromChat(instance)

      // 持久化首条消息的标题
      if (isFirstMessage && sessionId) {
        await $fetch(`/api/chat-sessions/${sessionId}`, {
          method: 'PATCH',
          body: { title: session.title }
        }).catch(() => undefined)
      }
    } catch (error: unknown) {
      const err = error as ApiErrorLike
      const msg = err.data?.message || err.message || '发送失败'
      const lastMessage = session.messages[session.messages.length - 1]

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
        lastMessage.content += `\n\n> ⚠️ ${msg}`
      } else if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = `[发送失败] ${msg}`
      } else {
        session.messages.push({ role: 'assistant', content: `[发送失败] ${msg}` })
      }

      session.messageCount = session.messages.length
      session.updatedAt = Date.now()
    } finally {
      session.pending = false
    }
  }

  return {
    sessions,
    activeSessionId,
    chatPending,
    chatInput,
    activeSession,
    chatHistory,
    initialize,
    createNewSession,
    deleteSession,
    clearChat,
    sendMessage,
    switchToSession
  }
}
