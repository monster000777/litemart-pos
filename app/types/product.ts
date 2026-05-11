export type ProductDto = {
  id: string
  name: string
  sku: string
  image?: string | null
  category: string
  price: number
  memberPrice?: number | null
  stock: number
  minStock: number
  createdAt?: string | Date
}
