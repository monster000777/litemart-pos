type ToastVariant = 'success' | 'error'

type ToastInput = {
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
}

type ToastItem = ToastInput & {
  id: string
}

export const useToast = () => {
  const toasts = useState<ToastItem[]>('ui-toasts', () => [])

  const dismiss = (id: string) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  const toast = (input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const item: ToastItem = {
      ...input,
      id
    }
    toasts.value = [...toasts.value, item]

    const duration = input.duration ?? 3000
    setTimeout(() => dismiss(id), duration)
  }

  return {
    toasts,
    toast,
    dismiss
  }
}
