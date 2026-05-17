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

const DEFAULT_SESSION_TITLE = '新对话'

let initialized = false

const sessions = ref<CopilotSession[]>([])
const activeSessionId = ref<string>('')
const chatInput = ref('')

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

export function useCopilot() {
  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value)
  )
  const chatHistory = computed(() => activeSession.value?.messages || [])
  const chatPending = computed(() => activeSession.value?.pending ?? false)

  const persistLocalBackup = () => {
    if (!import.meta.client) return

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

    if (!import.meta.client) return

    try {
      const list = await syncSessionsFromDb()

      if (list.length > 0) {
        const firstSession = await loadSessionDetail(list[0].id)
        if (firstSession) {
          sessions.value = list.map((session) =>
            session.id === firstSession.id
              ? firstSession
              : mapRemoteSession({ ...session, messages: [] })
          )
          activeSessionId.value = firstSession.id
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

    const scope = effectScope(true)
    scope.run(() => {
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
        activeSessionId.value = next.id
        if (!next.isLocal && isDraftSession(next)) {
          const detail = await loadSessionDetail(next.id)
          if (detail) {
            const nextIdx = sessions.value.findIndex((session) => session.id === next.id)
            if (nextIdx !== -1) sessions.value[nextIdx] = detail
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
    if (session.isLocal || session.messages.length > 0) return

    const detail = await loadSessionDetail(id)
    if (detail) {
      const idx = sessions.value.findIndex((item) => item.id === id)
      if (idx !== -1) sessions.value[idx] = detail
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeSession.value || activeSession.value.pending) return

    const session = activeSession.value
    const normalizedText = text.trim()
    const isFirstMessage = session.messages.length === 0

    if (isFirstMessage) {
      session.title = normalizedText.slice(0, 15) + (normalizedText.length > 15 ? '...' : '')
    }

    session.messages.push({ role: 'user', content: normalizedText })
    session.messageCount = session.messages.length
    session.updatedAt = Date.now()
    chatInput.value = ''
    session.pending = true

    try {
      const remoteSession = await ensureRemoteSession(session)
      const sessionId = remoteSession?.isLocal ? undefined : remoteSession?.id

      const res = await $fetch<{ reply: string }>('/api/insights/chat', {
        method: 'POST',
        body: {
          question: normalizedText,
          history: session.messages.slice(0, -1).map((message) => ({
            role: message.role,
            content: message.content
          })),
          sessionId
        }
      })

      session.messages.push({ role: 'assistant', content: res.reply })
      session.messageCount = session.messages.length
      session.updatedAt = Date.now()

      if (isFirstMessage && sessionId) {
        await $fetch(`/api/chat-sessions/${sessionId}`, {
          method: 'PATCH',
          body: { title: session.title }
        }).catch(() => undefined)
      }
    } catch (error: unknown) {
      const err = error as ApiErrorLike
      const msg = err.data?.message || err.message || '发送失败'
      session.messages.push({ role: 'assistant', content: `[发送失败] ${msg}` })
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
