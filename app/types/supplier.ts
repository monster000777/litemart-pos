export type SupplierDto = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: string
  notes: string | null
  createdAt: string
  _count?: {
    products: number
    purchaseOrders: number
  }
}

export type SupplierDetailDto = SupplierDto & {
  products?: Array<{
    id: string
    name: string
    sku: string
    stock: number
  }>
}

export type PurchaseOrderDto = {
  id: string
  orderNo: string
  supplierId: string
  supplier: {
    id: string
    name: string
  }
  totalAmount: number
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  items: PurchaseItemDto[]
}

export type PurchaseItemDto = {
  id: string
  purchaseOrderId: string
  productId: string
  product: {
    id: string
    name: string
    sku: string
    stock?: number
  }
  quantity: number
  unitCost: number
}

export type PurchaseOrderListResponse = {
  orders: PurchaseOrderDto[]
  total: number
  page: number
  pageSize: number
}
