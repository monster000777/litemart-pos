/* eslint-disable @typescript-eslint/no-explicit-any */
export type AiResponse = {
  reply?: string
  output_text?: string
  output?: {
    text?: string
  }
  choices?: Array<{
    delta?: {
      content?: string
      reasoning_content?: string
    }
    message?: {
      content?: string
      reasoning_content?: string
    }
  }>
  error?: {
    message?: string
  }
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

type DifyStreamEvent = {
  event?: string
  task_id?: string
  message_id?: string
  conversation_id?: string
  answer?: string
  created_at?: number
  metadata?: Record<string, any>
  status?: number
  code?: string
  message?: string
  [key: string]: any
}

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type MiniMaxLegacyMessage = {
  sender_type: 'USER' | 'BOT'
  sender_name: string
  text: string
}

type ExecuteAiTextRequest = {
  aiApiKey: string
  aiModel: string
  candidateUrls: string[]
  legacyCandidateUrls: string[]
  isMiniMaxProvider: boolean
  openAiMessages: OpenAiMessage[]
  legacyMessages: MiniMaxLegacyMessage[]
  systemPrompt: string
  botName: string
  temperature: number
  maxTokens: number
  preferLegacyFirst?: boolean
}

type ExecuteDifyTextRequest = {
  difyApiKey: string
  difyApiUrl: string
  query: string
  user: string
  inputs?: Record<string, any>
  conversationId?: string | null
  endpoint?: 'chat-messages' | 'completion-messages'
  /**
   * 是否过滤掉 Dify Agent 输出中的 <think>...</think> 推理块。
   * 默认 true，与项目内 chat.post.ts 的 MARKDOWN_OUTPUT_RULES 保持一致
   * （要求"不要输出思考过程、reasoning 内容、<think> 标签"）。
   */
  skipReasoning?: boolean
}

type ExecuteAiTextResult = {
  text: string
  remoteFailures: string[]
}

type ExecuteAiTextStreamHandlers = {
  onText: (text: string) => void | Promise<void>
}

const buildRequestHeaders = (aiApiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${aiApiKey}`
})

export const extractAiText = (response: AiResponse) =>
  response.reply?.trim() ||
  response.output_text?.trim() ||
  response.output?.text?.trim() ||
  response.choices?.[0]?.message?.content?.trim() ||
  ''

export const getAiErrorMessage = (error: unknown) => {
  const err = error as {
    data?: {
      base_resp?: { status_msg?: string }
      message?: string
    }
    error?: {
      message?: string
    }
    message?: string
  } | null

  return (
    err?.data?.base_resp?.status_msg ||
    err?.data?.message ||
    err?.error?.message ||
    err?.message ||
    'unknown error'
  )
}

export const isMiniMaxBotSettingError = (message: string) => {
  const normalized = message.toLowerCase()
  return normalized.includes('invalid params') && normalized.includes('bot_setting')
}

const assertSuccessfulAiResponse = (response: AiResponse, fallbackMessage: string) => {
  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  if (response.base_resp && response.base_resp.status_code !== 0) {
    throw new Error(response.base_resp.status_msg || fallbackMessage)
  }
}

const callOpenAiCompatible = (
  url: string,
  options: Pick<
    ExecuteAiTextRequest,
    'aiApiKey' | 'aiModel' | 'openAiMessages' | 'temperature' | 'maxTokens'
  >
) =>
  $fetch<AiResponse>(url, {
    method: 'POST',
    headers: buildRequestHeaders(options.aiApiKey),
    body: {
      model: options.aiModel,
      messages: options.openAiMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens
    }
  })

const extractAiStreamText = (payload: AiResponse) =>
  payload.choices?.[0]?.delta?.content || payload.choices?.[0]?.message?.content || ''

const callOpenAiCompatibleStream = async (
  url: string,
  options: Pick<
    ExecuteAiTextRequest,
    'aiApiKey' | 'aiModel' | 'openAiMessages' | 'temperature' | 'maxTokens'
  >,
  handlers: ExecuteAiTextStreamHandlers
) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildRequestHeaders(options.aiApiKey),
    body: JSON.stringify({
      model: options.aiModel,
      messages: options.openAiMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  if (!response.body) {
    throw new Error('empty stream response')
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let text = ''

  const handleLine = async (line: string) => {
    const normalized = line.trim()
    if (!normalized.startsWith('data:')) return false

    const rawData = normalized.slice(5).trim()
    if (!rawData || rawData === '[DONE]') return rawData === '[DONE]'

    const payload = JSON.parse(rawData) as AiResponse
    assertSuccessfulAiResponse(payload, 'AI 鎺ュ彛寮傚父')

    const delta = extractAiStreamText(payload)
    if (delta) {
      text += delta
      await handlers.onText(delta)
    }

    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (await handleLine(line)) {
        return text
      }
    }
  }

  if (buffer && (await handleLine(buffer))) {
    return text
  }

  return text
}

const callMiniMaxLegacy = (
  url: string,
  useArrayBotSetting: boolean,
  options: Pick<
    ExecuteAiTextRequest,
    | 'aiApiKey'
    | 'aiModel'
    | 'legacyMessages'
    | 'systemPrompt'
    | 'botName'
    | 'temperature'
    | 'maxTokens'
  >
) =>
  $fetch<AiResponse>(url, {
    method: 'POST',
    headers: buildRequestHeaders(options.aiApiKey),
    body: {
      model: options.aiModel,
      bot_setting: useArrayBotSetting
        ? [
            {
              bot_name: options.botName,
              content: options.systemPrompt
            }
          ]
        : {
            bot_name: options.botName,
            content: options.systemPrompt
          },
      messages: options.legacyMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens
    }
  })

const tryMiniMaxLegacy = async (options: ExecuteAiTextRequest, remoteFailures: string[]) => {
  for (const legacyUrl of options.legacyCandidateUrls) {
    try {
      const response = await callMiniMaxLegacy(legacyUrl, true, options)
      assertSuccessfulAiResponse(response, 'MiniMax 接口调用失败')
      const text = extractAiText(response)
      if (text) {
        return text
      }
    } catch (error) {
      if (isMiniMaxBotSettingError(getAiErrorMessage(error))) {
        try {
          const fallbackShapeResponse = await callMiniMaxLegacy(legacyUrl, false, options)
          assertSuccessfulAiResponse(fallbackShapeResponse, 'MiniMax 接口调用失败')
          const fallbackShapeText = extractAiText(fallbackShapeResponse)
          if (fallbackShapeText) {
            return fallbackShapeText
          }
        } catch (fallbackError) {
          remoteFailures.push(`legacy(${legacyUrl}): ${getAiErrorMessage(fallbackError)}`)
          continue
        }
      }

      remoteFailures.push(`legacy(${legacyUrl}): ${getAiErrorMessage(error)}`)
    }
  }

  return ''
}

export const executeAiTextRequest = async (
  options: ExecuteAiTextRequest
): Promise<ExecuteAiTextResult> => {
  const remoteFailures: string[] = []

  if (options.preferLegacyFirst && options.isMiniMaxProvider) {
    const legacyText = await tryMiniMaxLegacy(options, remoteFailures)
    if (legacyText) {
      return { text: legacyText, remoteFailures }
    }
  }

  for (const url of options.candidateUrls) {
    try {
      const response = await callOpenAiCompatible(url, options)
      assertSuccessfulAiResponse(response, 'AI 接口异常')
      const text = extractAiText(response)
      if (text) {
        return { text, remoteFailures }
      }
      remoteFailures.push(`openai-compatible(${url}): empty response`)
    } catch (error) {
      remoteFailures.push(`openai-compatible(${url}): ${getAiErrorMessage(error)}`)

      if (!options.isMiniMaxProvider || options.preferLegacyFirst) {
        continue
      }

      const message = getAiErrorMessage(error)
      if (!isMiniMaxBotSettingError(message)) {
        continue
      }

      const legacyText = await tryMiniMaxLegacy(options, remoteFailures)
      if (legacyText) {
        return { text: legacyText, remoteFailures }
      }
    }
  }

  return { text: '', remoteFailures }
}

export const executeAiTextStreamRequest = async (
  options: ExecuteAiTextRequest,
  handlers: ExecuteAiTextStreamHandlers
): Promise<ExecuteAiTextResult> => {
  const remoteFailures: string[] = []

  for (const url of options.candidateUrls) {
    let streamedText = ''

    try {
      const text = await callOpenAiCompatibleStream(url, options, {
        onText: async (delta) => {
          streamedText += delta
          await handlers.onText(delta)
        }
      })

      if (text) {
        return { text, remoteFailures }
      }

      remoteFailures.push(`openai-compatible-stream(${url}): empty response`)
    } catch (error) {
      remoteFailures.push(`openai-compatible-stream(${url}): ${getAiErrorMessage(error)}`)

      if (streamedText) {
        return { text: streamedText, remoteFailures }
      }
    }
  }

  const fallback = await executeAiTextRequest(options)
  if (fallback.text) {
    await handlers.onText(fallback.text)
  }

  return {
    text: fallback.text,
    remoteFailures: [...remoteFailures, ...fallback.remoteFailures]
  }
}

const buildDifyHeaders = (difyApiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${difyApiKey}`
})

const buildDifyEndpoint = (difyApiUrl: string, endpoint: 'chat-messages' | 'completion-messages') => {
  const baseUrl = (difyApiUrl || '').replace(/\/+$/, '')
  return `${baseUrl}/${endpoint}`
}

const buildDifyBlockingBody = (options: ExecuteDifyTextRequest) => {
  const endpoint = options.endpoint || 'chat-messages'
  const body: Record<string, any> = {
    inputs: options.inputs || {},
    user: options.user,
    response_mode: 'blocking'
  }

  if (endpoint === 'chat-messages') {
    body.query = options.query
    if (options.conversationId) {
      body.conversation_id = options.conversationId
    }
  }

  return { endpoint, body }
}

const buildDifyStreamingBody = (options: ExecuteDifyTextRequest) => {
  const endpoint = options.endpoint || 'chat-messages'
  const body: Record<string, any> = {
    inputs: options.inputs || {},
    user: options.user,
    response_mode: 'streaming'
  }

  if (endpoint === 'chat-messages') {
    body.query = options.query
    if (options.conversationId) {
      body.conversation_id = options.conversationId
    }
  }

  return { endpoint, body }
}

const extractDifyAnswer = (payload: DifyStreamEvent) => {
  if (typeof payload.answer === 'string' && payload.answer.length) {
    return payload.answer
  }
  return ''
}

const THINK_OPEN_TAG = '<think>'
const THINK_CLOSE_TAG = '</think>'

/**
 * 把 Dify Agent 流式 answer 中的 <think>...</think> 推理块剥掉。
 * 用状态机跨 chunk 处理：<think> 和 </think> 落在不同 chunk 也能正确拼接。
 */
const stripReasoning = (
  input: string,
  state: { insideThink: boolean }
): string => {
  if (!input) return ''
  let result = ''
  let remaining = input

  while (remaining.length) {
    if (state.insideThink) {
      const endIdx = remaining.indexOf(THINK_CLOSE_TAG)
      if (endIdx >= 0) {
        state.insideThink = false
        remaining = remaining.slice(endIdx + THINK_CLOSE_TAG.length)
      } else {
        // 整段 chunk 都在 think 内，丢弃
        remaining = ''
      }
    } else {
      const startIdx = remaining.indexOf(THINK_OPEN_TAG)
      if (startIdx >= 0) {
        // <think> 之前的内容保留
        result += remaining.slice(0, startIdx)
        state.insideThink = true
        remaining = remaining.slice(startIdx + THINK_OPEN_TAG.length)
      } else {
        const orphanEndIdx = remaining.indexOf(THINK_CLOSE_TAG)
        if (orphanEndIdx >= 0) {
          // 没有匹配的 <think>，直接丢弃到 </think> 之后
          remaining = remaining.slice(orphanEndIdx + THINK_CLOSE_TAG.length)
        } else {
          result += remaining
          remaining = ''
        }
      }
    }
  }

  return result
}

const callDifyBlocking = async (
  url: string,
  options: ExecuteDifyTextRequest
): Promise<string> => {
  const { endpoint, body } = buildDifyBlockingBody(options)
  const fullUrl = buildDifyEndpoint(url, endpoint)
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: buildDifyHeaders(options.difyApiKey),
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const payload = (await response.json()) as DifyStreamEvent

  if (payload?.error) {
    const errPayload = payload.error as { message?: string; code?: string }
    throw new Error(errPayload.message || errPayload.code || 'Dify 接口异常')
  }

  const rawAnswer = extractDifyAnswer(payload) || (payload as any)?.data?.answer || ''
  if (!rawAnswer) {
    throw new Error('Dify returned an empty response.')
  }

  if (options.skipReasoning !== false) {
    const filtered = stripReasoning(rawAnswer, { insideThink: false })
    if (!filtered) {
      throw new Error('Dify returned an empty response after reasoning filter.')
    }
    return filtered
  }
  return rawAnswer
}

const callDifyStream = async (
  url: string,
  options: ExecuteDifyTextRequest,
  handlers: ExecuteAiTextStreamHandlers
): Promise<string> => {
  const { endpoint, body } = buildDifyStreamingBody(options)
  const fullUrl = buildDifyEndpoint(url, endpoint)
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: buildDifyHeaders(options.difyApiKey),
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  if (!response.body) {
    throw new Error('empty Dify stream response')
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let text = ''
  let finished = false
  // 跨 chunk 跟踪是否在 <think> 内部（仅在 skipReasoning !== false 时维护）
  const reasoningState = { insideThink: false }
  const shouldStripReasoning = options.skipReasoning !== false

  const dispatchEvent = async (rawData: string): Promise<boolean> => {
    const payload = JSON.parse(rawData) as DifyStreamEvent
    const eventName = payload.event || ''

    if (eventName === 'error') {
      throw new Error(payload.message || payload.code || 'Dify 流式接口异常')
    }

    // 仅 Dify 真正的终止事件才停流
    // 注意：agent_thought / agent_message_end / message_replace / workflow_started /
    // node_started / ping 等都属于"中间事件"，必须忽略内容而不是终止流，
    // 否则 Agent 模式下首条 agent_thought 就会把整条流杀掉。
    if (eventName === 'message_end' || eventName === 'workflow_finished') {
      finished = true
      return true
    }

    if (eventName === 'message' || eventName === 'agent_message') {
      const rawDelta = extractDifyAnswer(payload)
      if (rawDelta) {
        const delta = shouldStripReasoning
          ? stripReasoning(rawDelta, reasoningState)
          : rawDelta
        if (delta) {
          text += delta
          await handlers.onText(delta)
        }
      }
    }

    return false
  }

  const handleLine = async (line: string) => {
    const normalized = line.trim()
    if (!normalized) return false

    if (normalized.startsWith('data:')) {
      const rawData = normalized.slice(5).trim()
      if (!rawData || rawData === '[DONE]') {
        return rawData === '[DONE]'
      }
      return dispatchEvent(rawData)
    }

    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      const shouldStop = await handleLine(line)
      if (shouldStop || finished) {
        return text
      }
    }
  }

  if (buffer) {
    const shouldStop = await handleLine(buffer)
    if (shouldStop) {
      return text
    }
  }

  return text
}

export const executeDifyTextRequest = async (
  options: ExecuteDifyTextRequest
): Promise<ExecuteAiTextResult> => {
  const remoteFailures: string[] = []
  const endpoint = options.endpoint || 'chat-messages'

  try {
    const text = await callDifyBlocking(options.difyApiUrl, options)
    return { text, remoteFailures }
  } catch (error) {
    remoteFailures.push(`dify-${endpoint}(${options.difyApiUrl}): ${getAiErrorMessage(error)}`)
    return { text: '', remoteFailures }
  }
}

export const executeDifyTextStreamRequest = async (
  options: ExecuteDifyTextRequest,
  handlers: ExecuteAiTextStreamHandlers
): Promise<ExecuteAiTextResult> => {
  const remoteFailures: string[] = []
  const endpoint = options.endpoint || 'chat-messages'
  let streamedText = ''

  try {
    const text = await callDifyStream(options.difyApiUrl, options, {
      onText: async (delta) => {
        streamedText += delta
        await handlers.onText(delta)
      }
    })

    if (text) {
      return { text, remoteFailures }
    }

    remoteFailures.push(`dify-stream-${endpoint}(${options.difyApiUrl}): empty response`)
  } catch (error) {
    remoteFailures.push(`dify-stream-${endpoint}(${options.difyApiUrl}): ${getAiErrorMessage(error)}`)

    if (streamedText) {
      return { text: streamedText, remoteFailures }
    }
  }

  const fallback = await executeDifyTextRequest(options)
  if (fallback.text) {
    await handlers.onText(fallback.text)
  }

  return {
    text: fallback.text,
    remoteFailures: [...remoteFailures, ...fallback.remoteFailures]
  }
}
