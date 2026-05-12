import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  receivePurchaseOrder,
  cancelPurchaseOrder
} from '~~/server/services/purchase-service'
import { prisma } from '~~/server/lib/prisma'
import type { Supplier, Product } from '@prisma/client'

describe('Purchase Order Service', () => {
  let supplier: Supplier
  let product: Product

  beforeEach(async () => {
    await prisma.purchaseItem.deleteMany()
    await prisma.purchaseOrder.deleteMany()
    await prisma.product.deleteMany()
    await prisma.supplier.deleteMany()

    supplier = await prisma.supplier.create({
      data: { name: 'Supplier for PO' }
    })

    product = await prisma.product.create({
      data: {
        name: 'Product 1',
        sku: 'PO-PROD-1',
        price: 15,
        category: 'Test',
        supplierId: supplier.id
      }
    })
  })

  it('can create a purchase order', async () => {
    const input = {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 8.5 }],
      notes: 'Initial stock'
    }

    const order = await createPurchaseOrder(input)

    expect(order.id).toBeDefined()
    expect(order.status).toBe('PENDING')
    expect(order.totalAmount).toBe(85)
    expect(order.items).toHaveLength(1)
    expect(order.items[0].unitCost).toBe(8.5)
  })

  it('fails if product does not belong to supplier', async () => {
    const anotherSupplier = await prisma.supplier.create({
      data: { name: 'Another Supplier' }
    })

    const input = {
      supplierId: anotherSupplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 8.5 }]
    }

    await expect(createPurchaseOrder(input)).rejects.toThrow(/不属于该供应商/)
  })

  it('can receive a purchase order, updating stock and cost', async () => {
    const order = await createPurchaseOrder({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 20, unitCost: 9.0 }]
    })

    await receivePurchaseOrder(order.id)

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(updatedProduct?.stock).toBe(20)
    expect(Number(updatedProduct?.costPrice)).toBe(9.0)

    const updatedOrder = await getPurchaseOrderById(order.id)
    expect(updatedOrder?.status).toBe('RECEIVED')
  })

  it('fails to receive an already cancelled order', async () => {
    const order = await createPurchaseOrder({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 8.5 }]
    })

    await cancelPurchaseOrder(order.id)
    await expect(receivePurchaseOrder(order.id)).rejects.toThrow(/已取消/)
  })

  it('can cancel a pending purchase order', async () => {
    const order = await createPurchaseOrder({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 8.5 }]
    })

    await cancelPurchaseOrder(order.id)

    const updatedOrder = await getPurchaseOrderById(order.id)
    expect(updatedOrder?.status).toBe('CANCELLED')
  })
})
