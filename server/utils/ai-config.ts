const MINIMAX_OPENAI_COMPATIBLE_URL = 'https://api.minimax.chat/v1/text/chatcompletion_pro'
const MINIMAX_LEGACY_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const OPENAI_CHAT_COMPLETION_URL = 'https://api.openai.com/v1/chat/completions'

type AiRuntimeConfig = {
  aiProvider?: string
  aiApiKey?: string
  aiApiUrl?: string
  aiModel?: string
  minimaxApiKey?: string
  minimaxApiUrl?: string
  minimaxModel?: string
}

const trimConfigValue = (value: unknown) => String(value || '').trim()

const hasExplicitAiConfig = (config: AiRuntimeConfig) =>
  [config.aiProvider, config.aiApiKey, config.aiApiUrl, config.aiModel].some((value) =>
    Boolean(trimConfigValue(value))
  )

export const normalizeAiApiUrl = (
  rawUrl: string,
  isMiniMaxProvider: boolean,
  preferLegacy = false
) => {
  const url = trimConfigValue(rawUrl)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '')

    if (path === '') {
      parsed.pathname = isMiniMaxProvider
        ? preferLegacy
          ? '/v1/text/chatcompletion_v2'
          : '/v1/text/chatcompletion_pro'
        : '/v1/chat/completions'
      return parsed.toString()
    }

    if (/\/v1$/i.test(path)) {
      parsed.pathname = isMiniMaxProvider
        ? preferLegacy
          ? `${path}/text/chatcompletion_v2`
          : `${path}/text/chatcompletion_pro`
        : `${path}/chat/completions`
      return parsed.toString()
    }

    return parsed.toString()
  } catch {
    return url
  }
}

export const resolveAiConfig = (config: AiRuntimeConfig) => {
  const explicitAiConfig = hasExplicitAiConfig(config)
  const aiProvider = trimConfigValue(config.aiProvider).toLowerCase()
  const aiApiKey = explicitAiConfig
    ? trimConfigValue(config.aiApiKey)
    : trimConfigValue(config.minimaxApiKey)
  const aiApiUrl = explicitAiConfig
    ? trimConfigValue(config.aiApiUrl)
    : trimConfigValue(config.minimaxApiUrl)
  const legacyMiniMaxConfigured =
    !explicitAiConfig && Boolean(trimConfigValue(config.minimaxApiKey))
  const isMiniMaxProvider =
    aiProvider === 'minimax' ||
    (!aiProvider && (/api\.minimax\.chat/i.test(aiApiUrl) || legacyMiniMaxConfigured))
  const aiModel =
    (explicitAiConfig ? trimConfigValue(config.aiModel) : trimConfigValue(config.minimaxModel)) ||
    (isMiniMaxProvider ? 'abab6.5-chat' : 'gpt-4o-mini')
  const normalizedApiUrl = normalizeAiApiUrl(aiApiUrl, isMiniMaxProvider)

  const candidateUrls = Array.from(
    new Set(
      [
        normalizedApiUrl,
        isMiniMaxProvider ? MINIMAX_OPENAI_COMPATIBLE_URL : '',
        !normalizedApiUrl && !isMiniMaxProvider ? OPENAI_CHAT_COMPLETION_URL : ''
      ].filter(Boolean)
    )
  )

  const legacyCandidateUrls = isMiniMaxProvider
    ? Array.from(
        new Set(
          [
            normalizeAiApiUrl(aiApiUrl, true, true),
            MINIMAX_LEGACY_URL,
            MINIMAX_OPENAI_COMPATIBLE_URL
          ].filter(Boolean)
        )
      )
    : []

  return {
    aiProvider,
    aiApiKey,
    aiApiUrl,
    aiModel,
    candidateUrls,
    explicitAiConfig,
    isMiniMaxProvider,
    legacyCandidateUrls,
    normalizedApiUrl
  }
}
