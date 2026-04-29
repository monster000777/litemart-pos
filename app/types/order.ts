export type CheckoutResponseDto = {
  id: string
  orderNo: string
  totalAmount: number
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
  customerTail: string | null
  createdAt: string
  items: OrderItemDto[]
}

export type OrderListResponse = {
  orders: OrderDto[]
  total: number
  page: number
  pageSize: number
}
