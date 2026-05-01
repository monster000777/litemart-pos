import { prisma } from '~~/server/lib/prisma'

export type CreateSupplierInput = {
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export type UpdateSupplierInput = {
  name?: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  status?: string
  notes?: string
}

type SupplierWithCounts = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: string
  notes: string | null
  createdAt: Date
  _count?: {
    products: number
    purchaseOrders: number
  }
}

export const toSupplierResponse = (supplier: SupplierWithCounts) => ({
  id: supplier.id,
  name: supplier.name,
  contactName: supplier.contactName,
  phone: supplier.phone,
  email: supplier.email,
  address: supplier.address,
  status: supplier.status,
  notes: supplier.notes,
  createdAt: supplier.createdAt,
  _count: supplier._count
})

export const getSuppliers = async (params?: { status?: string; search?: string }) => {
  const where: {
    status?: string
    OR?: Array<{
      name?: { contains: string }
      contactName?: { contains: string }
      phone?: { contains: string }
    }>
  } = {}

  if (params?.status) {
    where.status = params.status
  }

  if (params?.search) {
    const search = params.search.trim()
    where.OR = [
      { name: { contains: search } },
      { contactName: { contains: search } },
      { phone: { contains: search } }
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: {
      _count: {
        select: { products: true, purchaseOrders: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return suppliers.map(toSupplierResponse)
}

export const getSupplierById = async (id: string) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      products: {
        select: { id: true, name: true, sku: true, stock: true }
      },
      _count: {
        select: { products: true, purchaseOrders: true }
      }
    }
  })

  return supplier ? toSupplierResponse(supplier) : null
}

export const createSupplier = async (input: CreateSupplierInput) => {
  const supplier = await prisma.supplier.create({
    data: {
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null
    },
    include: {
      _count: { select: { products: true, purchaseOrders: true } }
    }
  })

  return toSupplierResponse(supplier)
}

export const updateSupplier = async (id: string, input: UpdateSupplierInput) => {
  const data: Record<string, string | null> = {}

  if (input.name !== undefined) data.name = input.name.trim()
  if (input.contactName !== undefined) data.contactName = input.contactName?.trim() || null
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null
  if (input.email !== undefined) data.email = input.email?.trim() || null
  if (input.address !== undefined) data.address = input.address?.trim() || null
  if (input.status !== undefined) data.status = input.status
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null

  const supplier = await prisma.supplier.update({
    where: { id },
    data,
    include: {
      _count: { select: { products: true, purchaseOrders: true } }
    }
  })

  return toSupplierResponse(supplier)
}

export const deleteSupplier = async (id: string) => {
  const productCount = await prisma.product.count({ where: { supplierId: id } })
  if (productCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `该供应商下有 ${productCount} 个商品，无法删除`
    })
  }

  const orderCount = await prisma.purchaseOrder.count({ where: { supplierId: id } })
  if (orderCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `该供应商下有 ${orderCount} 笔采购单，无法删除`
    })
  }

  await prisma.supplier.delete({ where: { id } })
}
