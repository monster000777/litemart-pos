export type AiResponse = {
  reply?: string
  output_text?: string
  output?: {
    text?: string
  }
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
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
    message?: string
  } | null

  return err?.data?.base_resp?.status_msg || err?.data?.message || err?.message || 'unknown error'
}

export const isMiniMaxBotSettingError = (message: string) => {
  const normalized = message.toLowerCase()
  return normalized.includes('invalid params') && normalized.includes('bot_setting')
}

const assertSuccessfulAiResponse = (response: AiResponse, fallbackMessage: string) => {
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
