export type ProductDto = {
  id: string
  name: string
  sku: string
  image?: string | null
  category: string
  price: number
  stock: number
  minStock: number
  createdAt?: string | Date
}
