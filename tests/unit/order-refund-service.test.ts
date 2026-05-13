import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '~~/server/lib/prisma'
import { refundOrderAtomic } from '~~/server/services/order-refund-service'
import { ORDER_STATUS } from '~~/shared/constants/order'

describe('Order Refund Service', () => {
  beforeEach(async () => {
    await prisma.pointLog.deleteMany()
    await prisma.purchaseItem.deleteMany()
    await prisma.purchaseOrder.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.product.deleteMany()
    await prisma.supplier.deleteMany()
    await prisma.customer.deleteMany()
  })

  it('throws 404 when order does not exist', async () => {
    await expect(refundOrderAtomic('non-exist-id')).rejects.toThrow('订单不存在')
  })

  it('throws 409 when order is already refunded', async () => {
    const order = await prisma.order.create({
      data: {
        orderNo: 'ORD123',
        status: ORDER_STATUS.REFUNDED,
        totalAmount: 100
      }
    })
    await expect(refundOrderAtomic(order.id)).rejects.toThrow('该订单已退款')
  })

  it('throws 400 when order is not completed', async () => {
    const order = await prisma.order.create({
      data: {
        orderNo: 'ORD124',
        status: 'SOME_OTHER_STATUS',
        totalAmount: 100
      }
    })
    await expect(refundOrderAtomic(order.id)).rejects.toThrow('仅已完成订单可退款')
  })

  it('successfully refunds completed order, restoring stock and reverting points', async () => {
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        phone: '13812341234',
        points: 50
      }
    })

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST-PROD-01',
        category: 'Test Category',
        price: 100,
        stock: 10
      }
    })

    const order = await prisma.order.create({
      data: {
        orderNo: 'ORD_TEST_REFUND',
        status: ORDER_STATUS.COMPLETED,
        totalAmount: 100,
        memberId: customer.id,
        pointsUsed: 20,
        pointsEarned: 10,
        items: {
          create: [
            {
              productId: product.id,
              unitPrice: 100,
              quantity: 3
            }
          ]
        }
      }
    })

    await refundOrderAtomic(order.id)

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(updatedOrder?.status).toBe(ORDER_STATUS.REFUNDED)

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(updatedProduct?.stock).toBe(13)

    const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } })
    expect(updatedCustomer?.points).toBe(60)

    const pointLogs = await prisma.pointLog.findMany({ where: { customerId: customer.id } })
    expect(pointLogs.length).toBe(1)
    expect(pointLogs[0].change).toBe(10)
  })
})
