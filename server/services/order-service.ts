import { Prisma } from '@prisma/client'
import { ORDER_STATUS } from '~~/shared/constants/order'
import { prisma } from '~~/server/lib/prisma'
import { getEarnedPoints, getPointDiscountAmount } from '~~/server/services/customer-service'

export type CreateOrderItemInput = {
  productId: string
  quantity: number
}

export type CreateOrderInput = {
  items?: CreateOrderItemInput[]
  customerTail?: string
  memberId?: string
  pointsToUse?: number
}

export type CreatedOrderResult = {
  id: string
  orderNo: string
  status: string
  customerTail: string | null
  createdAt: Date
  totalAmount: number
  pointsUsed: number
  pointsEarned: number
  discountAmount: number
  items: Array<{
    productId: string
    name: string
    sku: string
    quantity: number
    unitPrice: number
    lineAmount: number
  }>
}

const MAX_ORDER_NO_RETRY = 3
const CUSTOMER_TAIL_PATTERN = /^\d{4}$/

const buildOrderNo = () => {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`
  const randomPart = Math.random().toString().slice(2, 8)
  return `LM${datePart}${randomPart}`
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const normalizeCustomerTail = (value: string | undefined) => {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return null
  }
  if (!CUSTOMER_TAIL_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '手机号尾号必须为 4 位数字'
    })
  }
  return normalized
}

const normalizeItems = (inputItems: CreateOrderItemInput[]) => {
  const mergedMap = new Map<string, number>()
  for (const item of inputItems) {
    const quantity = Math.floor(item.quantity)
    if (!item.productId || quantity <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '订单明细格式错误'
      })
    }
    mergedMap.set(item.productId, (mergedMap.get(item.productId) ?? 0) + quantity)
  }

  return Array.from(mergedMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity
  }))
}

export const createOrderAtomic = async (input: CreateOrderInput): Promise<CreatedOrderResult> => {
  const inputItems = input.items ?? []
  const customerTail = normalizeCustomerTail(input.customerTail)
  const pointsToUse = Math.max(0, Math.floor(input.pointsToUse ?? 0))

  if (!inputItems.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '订单明细不能为空'
    })
  }

  const mergedItems = normalizeItems(inputItems)
  const productIds = mergedItems.map((item) => item.productId)

  for (let attempt = 1; attempt <= MAX_ORDER_NO_RETRY; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            price: true,
            memberPrice: true
          }
        })

        if (products.length !== productIds.length) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: '存在无效商品，无法创建订单'
          })
        }

        const productMap = new Map(products.map((product) => [product.id, product]))
        let subtotal = 0
        let memberPoints = 0

        for (const item of mergedItems) {
          const product = productMap.get(item.productId)
          if (!product) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Bad Request',
              message: '存在无效商品，无法创建订单'
            })
          }

          if (product.stock < item.quantity) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Bad Request',
              message: `商品 ${product.name} 库存不足，当前库存 ${product.stock}`
            })
          }

          const unitPrice =
            input.memberId && product.memberPrice != null
              ? Number(product.memberPrice)
              : Number(product.price)
          subtotal += unitPrice * item.quantity
        }

        if (input.memberId) {
          const member = await tx.customer.findUnique({
            where: { id: input.memberId },
            select: { id: true, points: true }
          })

          if (!member) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Bad Request',
              message: '会员不存在'
            })
          }

          memberPoints = member.points
        }

        const maxDiscountByPoints = getPointDiscountAmount(memberPoints)
        const requestedDiscount = getPointDiscountAmount(pointsToUse)
        const rawDiscount = Math.min(maxDiscountByPoints, requestedDiscount)
        const maxDiscountByAmount = Math.floor(subtotal * 0.5)
        const discountAmount = Math.min(rawDiscount, maxDiscountByAmount)
        const finalPointsUsed = discountAmount * 100
        const totalAmount = Math.max(0, roundMoney(subtotal - discountAmount))
        const pointsEarned = input.memberId ? getEarnedPoints(totalAmount) : 0

        for (const item of mergedItems) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity }
            },
            data: {
              stock: { decrement: item.quantity }
            }
          })

          if (updated.count !== 1) {
            throw createError({
              statusCode: 409,
              statusMessage: 'Conflict',
              message: '库存更新冲突，请重试'
            })
          }
        }

        const order = await tx.order.create({
          data: {
            orderNo: buildOrderNo(),
            totalAmount: roundMoney(totalAmount),
            status: ORDER_STATUS.COMPLETED,
            customerTail,
            memberId: input.memberId ?? null,
            pointsUsed: finalPointsUsed,
            pointsEarned,
            discountAmount
          }
        })

        if (input.memberId && finalPointsUsed > 0) {
          await tx.customer.update({
            where: { id: input.memberId },
            data: {
              points: { decrement: finalPointsUsed }
            }
          })

          await tx.pointLog.create({
            data: {
              customerId: input.memberId,
              orderId: order.id,
              change: -finalPointsUsed,
              reason: '积分抵扣'
            }
          })
        }

        if (input.memberId && pointsEarned > 0) {
          await tx.customer.update({
            where: { id: input.memberId },
            data: {
              points: { increment: pointsEarned }
            }
          })

          await tx.pointLog.create({
            data: {
              customerId: input.memberId,
              orderId: order.id,
              change: pointsEarned,
              reason: '消费积分'
            }
          })
        }

        await tx.orderItem.createMany({
          data: mergedItems.map((item) => {
            const product = productMap.get(item.productId)!
            const unitPrice =
              input.memberId && product.memberPrice != null ? product.memberPrice : product.price
            return {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice
            }
          })
        })

        const orderItems = mergedItems.map((item) => {
          const product = productMap.get(item.productId)!
          const unitPrice =
            input.memberId && product.memberPrice != null
              ? Number(product.memberPrice)
              : Number(product.price)
          return {
            productId: item.productId,
            name: product.name,
            sku: product.sku,
            quantity: item.quantity,
            unitPrice,
            lineAmount: roundMoney(unitPrice * item.quantity)
          }
        })

        return {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          customerTail: order.customerTail,
          createdAt: order.createdAt,
          totalAmount: Number(order.totalAmount),
          pointsUsed: finalPointsUsed,
          pointsEarned,
          discountAmount,
          items: orderItems
        }
      })
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined
      const conflictOnOrderNo =
        (Array.isArray(target) && target.includes('orderNo')) ||
        (typeof target === 'string' && target.includes('orderNo'))
      const isOrderNoConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        conflictOnOrderNo

      if (isOrderNoConflict && attempt < MAX_ORDER_NO_RETRY) {
        continue
      }

      if (isOrderNoConflict) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          message: '订单号生成失败，请重试'
        })
      }

      throw error
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: '创建订单失败，请稍后重试'
  })
}
