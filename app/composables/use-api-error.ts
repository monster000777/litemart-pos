type ApiErrorLike = {
  data?: {
    message?: string
  }
  message?: string
}

export const useApiError = () => {
  const getApiErrorMessage = (error: unknown, fallback: string) => {
    const err = error as ApiErrorLike | null
    const message = err?.data?.message?.trim() || err?.message?.trim()
    if (!message) {
      return fallback
    }
    return message
  }

  const removeKnownPrefix = (message: string, prefix: string) => {
    if (!message.startsWith(prefix)) {
      return message
    }
    return message.slice(prefix.length).trim().replace(/^[:：]\s*/, '')
  }

  return {
    getApiErrorMessage,
    removeKnownPrefix
  }
}
