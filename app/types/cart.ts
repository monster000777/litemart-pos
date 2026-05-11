export type CartItemDto = {
  id: string
  name: string
  sku: string
  price: number
  originalPrice?: number
  quantity: number
  image?: string | null
}

export type CartCustomerInfoDto = {
  customerTail: string
  memberId?: string
  memberName?: string | null
  memberPhone?: string
  memberPoints?: number
  memberLevel?: string
  pointsToUse?: number
}
