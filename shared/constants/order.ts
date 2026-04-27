export const ORDER_STATUS = {
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED'
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]
