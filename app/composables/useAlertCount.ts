export const useAlertCount = () => {
  const alertCount = useState<number>('alert-count', () => 0)

  const fetchAlerts = async () => {
    try {
      const res = await $fetch<{ count: number }>('/api/products/alerts')
      alertCount.value = res.count
    } catch {
      alertCount.value = 0
    }
  }

  return { alertCount, fetchAlerts }
}
