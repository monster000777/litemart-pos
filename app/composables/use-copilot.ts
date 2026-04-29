// 智能助理全局状态 —— 独立于页面组件生命周期，路由切换不会打断进行中的请求
export interface CopilotMessage {
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
  pending: boolean // 每个会话独立的加载状态
}

// 使用模块级变量保持单例，避免每次调用 composable 时重新创建
let _initialized = false

const sessions = ref<CopilotSession[]>([])
const activeSessionId = ref<string>('')
const chatInput = ref('')

export function useCopilot() {
  const activeSession = computed(() => sessions.value.find((s) => s.id === activeSessionId.value))
  const chatHistory = computed(() => activeSession.value?.messages || [])
  // 当前活跃会话的加载状态（UI 层绑定此值）
  const chatPending = computed(() => activeSession.value?.pending ?? false)

  // 初始化 —— 只执行一次（从 localStorage 恢复数据）
  const initialize = () => {
    if (_initialized) return
    _initialized = true

    if (!import.meta.client) return

    const savedSessions = localStorage.getItem('litemart-copilot-sessions')
    if (savedSessions) {
      try {
        const parsed: CopilotSession[] = JSON.parse(savedSessions)
        // 确保老数据兼容：补全 pending 字段
        sessions.value = parsed.map((s) => ({ ...s, pending: false }))
        const firstSession = sessions.value.at(0)
        if (firstSession) {
          activeSessionId.value = firstSession.id
        } else {
          createNewSession()
        }
      } catch {
        createNewSession()
      }
    } else {
      // 兼容老版本历史记录
      const oldHistory = localStorage.getItem('litemart-copilot-history')
      if (oldHistory) {
        try {
          const messages = JSON.parse(oldHistory)
          if (messages.length > 0) {
            sessions.value = [
              {
                id: Date.now().toString(),
                title: '历史会话',
                updatedAt: Date.now(),
                messages,
                pending: false
              }
            ]
            const firstSession = sessions.value.at(0)
            if (firstSession) {
              activeSessionId.value = firstSession.id
            }
          } else {
            createNewSession()
          }
          localStorage.removeItem('litemart-copilot-history')
        } catch {
          createNewSession()
        }
      } else {
        createNewSession()
      }
    }

    // 持久化 watcher —— 序列化时排除运行时 pending 状态
    // 使用 detached effectScope 确保 watcher 不会随组件卸载而销毁，从而保证后台请求完成时仍能持久化
    const scope = effectScope(true)
    scope.run(() => {
      watch(
        sessions,
        (val) => {
          if (import.meta.client) {
            const serializable = val.map((session) => {
              const snapshot: CopilotSession = {
                ...session,
                messages: [...session.messages],
                pending: false
              }
              return {
                id: snapshot.id,
                title: snapshot.title,
                updatedAt: snapshot.updatedAt,
                messages: snapshot.messages
              }
            })
            localStorage.setItem('litemart-copilot-sessions', JSON.stringify(serializable))
          }
        },
        { deep: true }
      )
    })
  }

  const createNewSession = () => {
    // 查找是否已经存在空会话（避免堆积一堆"新对话"）
    const emptySession = sessions.value.find((s) => s.messages.length === 0)
    if (emptySession) {
      activeSessionId.value = emptySession.id
      return
    }

    const newSession: CopilotSession = {
      id: Date.now().toString(),
      title: '新对话',
      updatedAt: Date.now(),
      messages: [],
      pending: false
    }
    sessions.value.unshift(newSession)
    activeSessionId.value = newSession.id
  }

  const deleteSession = (id: string) => {
    const target = sessions.value.find((s) => s.id === id)
    // 阻止删除正在请求中的会话，避免请求完成后写入已销毁对象
    if (target?.pending) return

    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx !== -1) {
      sessions.value.splice(idx, 1)
      if (sessions.value.length === 0) {
        createNewSession()
      } else if (activeSessionId.value === id) {
        const firstSession = sessions.value.at(0)
        if (firstSession) {
          activeSessionId.value = firstSession.id
        }
      }
    }
  }

  const clearChat = () => {
    // 阻止在请求进行中时清空，避免产生孤立的 assistant 消息
    if (activeSession.value?.pending) return

    if (activeSession.value) {
      activeSession.value.messages = []
      activeSession.value.title = '新对话'
      activeSession.value.updatedAt = Date.now()
    }
    chatInput.value = ''
  }

  // 核心：发送消息 —— 此处的 $fetch 是在 composable 作用域执行的，
  // 即使页面组件被卸载，Promise 仍会正常 resolve 并写回 sessions 状态
  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeSession.value || activeSession.value.pending) return

    // 捕获发送时刻的会话引用，即使用户中途切换了活跃会话，
    // 回复仍然写入正确的会话对象
    const session = activeSession.value

    if (session.messages.length === 0) {
      session.title = text.slice(0, 15) + (text.length > 15 ? '...' : '')
    }

    session.messages.push({ role: 'user', content: text.trim() })
    session.updatedAt = Date.now()
    chatInput.value = ''
    session.pending = true

    try {
      const res = await $fetch<{ reply: string }>('/api/insights/chat', {
        method: 'POST',
        body: {
          question: text.trim(),
          history: session.messages.slice(0, -1)
        }
      })
      session.messages.push({ role: 'assistant', content: res.reply })
      session.updatedAt = Date.now()
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
    sendMessage
  }
}
