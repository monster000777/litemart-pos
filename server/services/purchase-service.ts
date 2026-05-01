import { prisma } from '~~/server/lib/prisma'

export type CreatePurchaseOrderInput = {
  supplierId: string
  items: Array<{ productId: string; quantity: number; unitCost: number }>
  notes?: string
}

export type PurchaseOrderStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED'

const PURCHASE_STATUS: Record<string, PurchaseOrderStatus> = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
}

const buildPurchaseOrderNo = () => {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const randomPart = Math.random().toString().slice(2, 8)
  return `PO${datePart}${randomPart}`
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export const getPurchaseOrders = async (params?: {
  status?: string
  supplierId?: string
  page?: number
  pageSize?: number
}) => {
  const page = Math.max(1, params?.page || 1)
  const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20))

  const where: { status?: string; supplierId?: string } = {}
  if (params?.status) where.status = params.status
  if (params?.supplierId) where.supplierId = params.supplierId

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.purchaseOrder.count({ where })
  ])

  return {
    orders: orders.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({
        ...item,
        unitCost: Number(item.unitCost)
      }))
    })),
    total,
    page,
    pageSize
  }
}

export const getPurchaseOrderById = async (id: string) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, stock: true } }
        }
      }
    }
  })

  if (!order) return null

  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      ...item,
      unitCost: Number(item.unitCost)
    }))
  }
}

export const createPurchaseOrder = async (input: CreatePurchaseOrderInput) => {
  if (!input.supplierId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '请选择供应商'
    })
  }

  if (!input.items?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '采购明细不能为空'
    })
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
  if (!supplier) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '供应商不存在'
    })
  }

  const productIds = input.items.map((item) => item.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      supplierId: input.supplierId
    }
  })
  if (products.length !== productIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '存在不属于该供应商的商品'
    })
  }

  const totalAmount = roundMoney(
    input.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0)
  )

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNo: buildPurchaseOrderNo(),
      supplierId: input.supplierId,
      totalAmount,
      status: PURCHASE_STATUS.PENDING,
      notes: input.notes?.trim() || null,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantity: Math.floor(item.quantity),
          unitCost: roundMoney(item.unitCost)
        }))
      }
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } }
        }
      }
    }
  })

  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      ...item,
      unitCost: Number(item.unitCost)
    }))
  }
}

export const receivePurchaseOrder = async (id: string) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '采购单不存在'
    })
  }

  if (order.status !== PURCHASE_STATUS.PENDING) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: order.status === PURCHASE_STATUS.RECEIVED ? '该采购单已入库' : '该采购单已取消'
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id },
      data: { status: PURCHASE_STATUS.RECEIVED }
    })

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
          costPrice: Number(item.unitCost)
        }
      })
    }
  })

  return { success: true, orderNo: order.orderNo }
}

export const cancelPurchaseOrder = async (id: string) => {
  const order = await prisma.purchaseOrder.findUnique({ where: { id } })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: '采购单不存在'
    })
  }

  if (order.status !== PURCHASE_STATUS.PENDING) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message:
        order.status === PURCHASE_STATUS.RECEIVED ? '已入库的采购单无法取消' : '该采购单已取消'
    })
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: PURCHASE_STATUS.CANCELLED }
  })

  return { success: true, orderNo: order.orderNo }
}
