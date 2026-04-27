export type CartItemDto = {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  image?: string | null
}

export type CartCustomerInfoDto = {
  customerTail: string
}
