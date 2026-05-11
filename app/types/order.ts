export type CheckoutResponseDto = {
  id: string
  orderNo: string
  totalAmount: number
  pointsEarned?: number
  pointsUsed?: number
  discountAmount?: number
}

export type OrderItemDto = {
  id: string
  quantity: number
  unitPrice: number
  product: {
    id: string
    name: string
    sku: string
  }
}

export type OrderDto = {
  id: string
  orderNo: string
  totalAmount: number
  status: string
  createdAt: string
  items: OrderItemDto[]
}

export type OrderListResponse = {
  orders: OrderDto[]
  total: number
  page: number
  pageSize: number
}
