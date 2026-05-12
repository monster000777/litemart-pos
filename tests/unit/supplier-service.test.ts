import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier
} from '~~/server/services/supplier-service'
import { prisma } from '~~/server/lib/prisma'

describe('Supplier Service', () => {
  beforeEach(async () => {
    await prisma.purchaseItem.deleteMany()
    await prisma.purchaseOrder.deleteMany()
    await prisma.product.deleteMany()
    await prisma.supplier.deleteMany()
  })

  it('can create a supplier', async () => {
    const input = {
      name: 'Test Supplier',
      contactName: 'Jane Doe',
      phone: '13800138000',
      email: 'jane@example.com'
    }

    const supplier = await createSupplier(input)

    expect(supplier.id).toBeDefined()
    expect(supplier.name).toBe('Test Supplier')
    expect(supplier.contactName).toBe('Jane Doe')
    expect(supplier.phone).toBe('13800138000')
    expect(supplier.email).toBe('jane@example.com')
  })

  it('can retrieve a list of suppliers', async () => {
    await createSupplier({ name: 'Supplier A' })
    await createSupplier({ name: 'Supplier B' })

    const suppliers = await getSuppliers()
    expect(suppliers).toHaveLength(2)

    // Test search
    const results = await getSuppliers({ search: 'A' })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Supplier A')
  })

  it('can get a supplier by id', async () => {
    const created = await createSupplier({ name: 'Find Me' })
    const supplier = await getSupplierById(created.id)

    expect(supplier).toBeDefined()
    expect(supplier?.name).toBe('Find Me')
  })

  it('can update a supplier', async () => {
    const supplier = await createSupplier({ name: 'Old Name' })

    const updated = await updateSupplier(supplier.id, {
      name: 'New Name',
      notes: 'Some notes'
    })

    expect(updated.name).toBe('New Name')
    expect(updated.notes).toBe('Some notes')
  })

  it('can delete a supplier without dependencies', async () => {
    const supplier = await createSupplier({ name: 'Delete Me' })
    await deleteSupplier(supplier.id)

    const found = await getSupplierById(supplier.id)
    expect(found).toBeNull()
  })

  it('cannot delete a supplier with products', async () => {
    const supplier = await createSupplier({ name: 'Has Products' })

    await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST-SKU',
        price: 10,
        category: 'Test',
        supplierId: supplier.id
      }
    })

    await expect(deleteSupplier(supplier.id)).rejects.toThrow(/无法删除/)
  })
})
