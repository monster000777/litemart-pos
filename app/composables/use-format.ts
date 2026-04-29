export function useFormat() {
  const formatPrice = (value: number | string | null | undefined): string => {
    if (value == null) return '¥0.00'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return isNaN(num) ? '¥0.00' : `¥${num.toFixed(2)}`
  }

  const formatDate = (d: string | Date | null | undefined): string => {
    if (!d) return '-'
    const date = typeof d === 'string' ? new Date(d) : d
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  }

  const formatTime = (d: string | Date | null | undefined): string => {
    if (!d) return '-'
    const date = typeof d === 'string' ? new Date(d) : d
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${h}:${min}:${s}`
  }

  return {
    formatPrice,
    formatDate,
    formatTime
  }
}
