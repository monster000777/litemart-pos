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
