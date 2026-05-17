export type AuthUser = {
  uid: string
  phone: string
}

export type SessionPayload = {
  authenticated: boolean
  role?: string
  actualRole?: string
  user?: AuthUser
}

export type LoginPayload = {
  uid: string
  pin: string
}

export type LoginResponse = {
  success: boolean
  role: string
  token: string
  expiresIn: number
  user: AuthUser
}

export type Product = {
  id: string
  name: string
  sku: string
  image: string | null
  category: string
  price: number
  memberPrice: number | null
  stock: number
  minStock: number
  createdAt: string
}

export type CartItem = {
  productId: string
  name: string
  image: string | null
  price: number
  memberPrice: number | null
  quantity: number
  stock: number
}

export type Customer = {
  id: string
  phone: string
  name: string | null
  points: number
  level: string
  createdAt: string
}

export type CheckoutPayload = {
  items: Array<{
    productId: string
    quantity: number
  }>
  memberId?: string
  pointsToUse?: number
}

export type CheckoutResult = {
  id: string
  orderNo: string
  totalAmount: number
  pointsEarned: number
  pointsUsed: number
  discountAmount: number
  status: string
  createdAt: string
}

export type Order = {
  id: string
  orderNo: string
  totalAmount: number
  status: string
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    product: {
      id: string
      name: string
      sku: string
    }
  }>
}

export type OrdersResponse = {
  orders: Order[]
  total: number
  page: number
  pageSize: number
}
