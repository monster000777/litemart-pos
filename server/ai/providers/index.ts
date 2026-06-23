import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV2 } from '@ai-sdk/provider'

export type RuntimeConfig = {
  aiProvider?: string
  aiApiKey?: string
  aiApiUrl?: string
  aiModel?: string
}

export type BiProviderName = string

export type BiProvider = {
  isConfigured: boolean
  providerName: BiProviderName
  model: LanguageModelV2 | null
}

const trim = (value: unknown): string => String(value ?? '').trim()

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

export const getBiProvider = (config: RuntimeConfig): BiProvider => {
  const providerName = trim(config.aiProvider) || 'openai'
  const apiKey = trim(config.aiApiKey)
  if (!apiKey) {
    return { isConfigured: false, providerName, model: null }
  }

  const baseURL = trim(config.aiApiUrl) || DEFAULT_BASE_URL
  const modelId = trim(config.aiModel) || DEFAULT_MODEL

  const sdkProvider = createOpenAICompatible({
    name: providerName,
    baseURL,
    apiKey
  })

  return {
    isConfigured: true,
    providerName,
    model: sdkProvider(modelId) as LanguageModelV2
  }
}
